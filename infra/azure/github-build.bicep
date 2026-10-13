@description('Existing Azure registry; this template cannot create or change it.')
param acrName string

param location string = resourceGroup().location
param identityName string = 'id-pulse-github-build'

@allowed([
  'alexwafula/pulse'
])
param repository string = 'alexwafula/pulse'

@description('Immutable IDs verified from GitHub and the actual OIDC token subject.')
@allowed([
  91899603
])
param ownerId int = 91899603

@allowed([
  1404538837
])
param repositoryId int = 1404538837

@allowed([
  'feat/meeting-readiness'
])
param branch string = 'feat/meeting-readiness'

var repositoryParts = split(repository, '/')

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource federation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: identity
  name: 'github-meeting-readiness'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${repositoryParts[0]}@${ownerId}/${repositoryParts[1]}@${repositoryId}:ref:refs/heads/${branch}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

var pushRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec')

resource pushRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, pushRoleId)
  scope: registry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: pushRoleId
  }
}

output clientId string = identity.properties.clientId
output tenantId string = subscription().tenantId
output subscriptionId string = subscription().subscriptionId
