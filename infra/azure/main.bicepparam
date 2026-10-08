using 'main.bicep'

param environmentName = 'pulse-demo'
param webImageTag = 'demo'
param agentsImageTag = 'demo'
param agentMode = 'template'
param modelRequestCap = 10
param minReplicasWeb = 1
param maxReplicasWeb = 5
param minReplicasAgents = 1
param maxReplicasAgents = 3
