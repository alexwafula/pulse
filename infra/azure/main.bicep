@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Logical name for the Pulse environment (e.g. pulse-demo).')
param environmentName string = 'pulse-demo'

@description('Globally unique name of the Azure Container Registry. 5-50 alphanumeric characters.')
@minLength(5)
@maxLength(50)
param acrName string = 'crpulse${uniqueString(resourceGroup().id)}'

@description('Tag of the pulse-web image in ACR.')
param webImageTag string = 'demo'

@description('Tag of the pulse-agents image in ACR.')
param agentsImageTag string = 'demo'

@description('Agent operating mode. Default is zero-cost deterministic template.')
@allowed([
  'template'
  'foundry-shadow'
])
param agentMode string = 'template'

@description('Microsoft Foundry / Azure OpenAI resource endpoint URL (e.g. https://your-resource.openai.azure.com).')
param foundryEndpoint string = ''

@description('Foundry model deployment name.')
param foundryDeployment string = ''

@description('Foundry API key. Injected as a Container App secret.')
@secure()
param foundryApiKey string = ''

@description('Maximum paid shadow workflows allowed per service process.')
param modelRequestCap int = 10

@description('Minimum replicas for the web container app (0 enables scale-to-zero).')
param minReplicasWeb int = 1

@description('Maximum replicas for the web container app.')
param maxReplicasWeb int = 5

@description('Minimum replicas for the agents container app (0 enables scale-to-zero).')
param minReplicasAgents int = 1

@description('Maximum replicas for the agents container app.')
param maxReplicasAgents int = 3

@description('CPU allocated to each container.')
param cpuCore string = '0.5'

@description('Memory allocated to each container.')
param memorySize string = '1.0Gi'

// 1. Log Analytics Workspace for Container Apps Environment
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${environmentName}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      searchVersion: 1
    }
  }
}

// 2. Azure Container Registry (Basic SKU, Managed Identity Pull)
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

// 3. User-Assigned Managed Identity for secure container pulls
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${environmentName}'
  location: location
}

// AcrPull built-in role definition ID: 7f951dda-4ed3-4680-a7ca-43fe172d538d
var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, managedIdentity.id, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

// 4. Container Apps Managed Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'env-${environmentName}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

var hasFoundryKey = !empty(foundryApiKey)

var agentSecrets = hasFoundryKey ? [
  {
    name: 'foundry-key'
    value: foundryApiKey
  }
] : []

var agentBaseEnv = [
  {
    name: 'PULSE_AGENT_MODE'
    value: agentMode
  }
  {
    name: 'PULSE_MODEL_REQUEST_CAP'
    value: string(modelRequestCap)
  }
]

var agentFoundryEnv = hasFoundryKey ? [
  {
    name: 'PULSE_FOUNDRY_ENDPOINT'
    value: foundryEndpoint
  }
  {
    name: 'PULSE_FOUNDRY_DEPLOYMENT'
    value: foundryDeployment
  }
  {
    name: 'PULSE_FOUNDRY_API_KEY'
    secretRef: 'foundry-key'
  }
] : (!empty(foundryEndpoint) ? [
  {
    name: 'PULSE_FOUNDRY_ENDPOINT'
    value: foundryEndpoint
  }
  {
    name: 'PULSE_FOUNDRY_DEPLOYMENT'
    value: foundryDeployment
  }
] : [])

var agentEnv = concat(agentBaseEnv, agentFoundryEnv)

// 5. Container App: pulse-agents (Internal HTTP Ingress on port 8090)
resource agentsApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'pulse-agents'
  location: location
  dependsOn: [
    acrPullRoleAssignment
  ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 8090
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: managedIdentity.id
        }
      ]
      secrets: agentSecrets
    }
    template: {
      containers: [
        {
          name: 'pulse-agents'
          image: '${acr.properties.loginServer}/pulse-agents:${agentsImageTag}'
          resources: {
            cpu: json(cpuCore)
            memory: memorySize
          }
          env: agentEnv
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 8090
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: 8090
              }
              initialDelaySeconds: 3
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicasAgents
        maxReplicas: maxReplicasAgents
      }
    }
  }
}

// 6. Container App: pulse-web (External Public HTTP Ingress on port 8080)
resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'pulse-web'
  location: location
  dependsOn: [
    acrPullRoleAssignment
  ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: managedIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'pulse-web'
          image: '${acr.properties.loginServer}/pulse-web:${webImageTag}'
          resources: {
            cpu: json(cpuCore)
            memory: memorySize
          }
          env: [
            {
              name: 'PULSE_AGENTS_URL'
              value: 'https://${agentsApp.properties.configuration.ingress.fqdn}'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: 8080
              }
              initialDelaySeconds: 3
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicasWeb
        maxReplicas: maxReplicasWeb
      }
    }
  }
}

@description('Public HTTPS URL of the Pulse web application.')
output webUrl string = 'https://${webApp.properties.configuration.ingress.fqdn}'

@description('Public FQDN of the Pulse web application.')
output webFqdn string = webApp.properties.configuration.ingress.fqdn

@description('Internal FQDN of the Pulse agent service (accessible within the ACA environment).')
output agentsInternalFqdn string = agentsApp.properties.configuration.ingress.fqdn

@description('Login server for the Azure Container Registry.')
output acrLoginServer string = acr.properties.loginServer

@description('Resource ID of the user-assigned managed identity.')
output managedIdentityId string = managedIdentity.id

@description('Client ID of the user-assigned managed identity.')
output managedIdentityClientId string = managedIdentity.properties.clientId
