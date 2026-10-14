param location string = resourceGroup().location
param identityName string = 'id-pulse-github-deploy'
param environmentName string = 'env-pulse-demo'

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource federation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: identity
  name: 'github-main'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:alexwafula@91899603/pulse@1404538837:ref:refs/heads/main'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

var role = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '358470bc-b998-42bd-ab17-a7e34c199c0f')
var reader = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7')

resource apps 'Microsoft.App/containerApps@2024-03-01' existing = [for name in ['pulse-web', 'pulse-agents']: {
  name: name
}]

resource appRoles 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (name, i) in ['pulse-web', 'pulse-agents']: {
  name: guid(apps[i].id, identity.id, role)
  scope: apps[i]
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: role
  }
}]

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

resource environmentReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(environment.id, identity.id, reader)
  scope: environment
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: reader
  }
}

output clientId string = identity.properties.clientId
