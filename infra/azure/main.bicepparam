using 'main.bicep'

param environmentName = 'pulse-demo'
param webImageTag = 'demo'
param agentsImageTag = 'demo'
param agentMode = 'recorded'
param modelRequestCap = 0
param minReplicasWeb = 0
param maxReplicasWeb = 1
param minReplicasAgents = 0
param maxReplicasAgents = 1
