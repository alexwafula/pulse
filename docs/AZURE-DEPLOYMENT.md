# Azure Container Apps Deployment Runbook

This runbook documents the declarative infrastructure-as-code (Bicep) deployment for Pulse on Azure Container Apps.

> **Status**: Bicep templates validated with `az bicep build`. No resources provisioned yet (pending cloud credentials).

---

## Architecture Overview

```
                      +---------------------------------------+
                      |         Azure Container Apps          |
                      |              Environment              |
                      |                                       |
Internet              |   +------------+     internal HTTP    |
   |                  |   | pulse-web  | -------------------> |
   v                  |   | (Port 8080)|   https://pulse-     |
[External Ingress] -> |   +------------+   agents.<domain>    |
                      |          |                            |
                      |          v                            |
                      |   +--------------+                    |
                      |   | pulse-agents |                    |
                      |   | (Port 8090)  |                    |
                      |   +--------------+                    |
                      +---------------------------------------+
                                 ^
                                 | AcrPull
                      +----------------------+
                      |    User-Assigned     |
                      |   Managed Identity   |
                      +----------------------+
                                 |
                                 v
                      +----------------------+
                      |   Azure Container    |
                      |    Registry (ACR)    |
                      +----------------------+
```

1. **Networking**:
   - `pulse-web`: External HTTP ingress on port 8080 (publicly routable).
   - `pulse-agents`: Internal HTTP ingress on port 8090 (only reachable within the ACA environment).
   - `PULSE_AGENTS_URL` dynamically configured via Bicep referencing the agents app FQDN.
2. **Security**:
   - Zero-credential container pulls via User-Assigned Managed Identity assigned the `AcrPull` RBAC role.
   - ACR `adminUserEnabled` is set to `false`.
   - Foundry API key (when configured) is stored strictly as a Container App secret, never in code or git.
3. **Observability**:
   - Centralized Log Analytics Workspace (`PerGB2018`).
   - Liveness and readiness HTTP probes on `/healthz` for both containers.

---

## Step-by-Step Deployment Commands (When Access Arrives)

### 1. Authenticate and Configure Subscription
```bash
az login
az account set --subscription "<YOUR-SUBSCRIPTION-ID>"
```

### 2. Register Required Azure Resource Providers
```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.ContainerRegistry
```

### 3. Set Environment Variables
```bash
RESOURCE_GROUP="pulse-hackathon"
LOCATION="eastus2"          # Choose a region with available quota
ACR_NAME="crpulse$(openssl rand -hex 4)" # 5-50 lowercase alphanumeric characters
ENVIRONMENT_NAME="pulse-demo"
```

### 4. Create Resource Group and Registry
```bash
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled false
```

### 5. Build and Push Container Images to ACR
```bash
az acr build --registry "$ACR_NAME" --image pulse-web:demo --file Dockerfile .
az acr build --registry "$ACR_NAME" --image pulse-agents:demo --file agents/Dockerfile .
```

### 6. Validate Bicep Deployment (What-If)
```bash
az deployment group what-if \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam \
  --parameters acrName="$ACR_NAME" location="$LOCATION" environmentName="$ENVIRONMENT_NAME"
```

### 7. Provision Infrastructure via Bicep

#### Option A: Zero-cost Deterministic Template Mode (Default)
```bash
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam \
  --parameters \
    acrName="$ACR_NAME" \
    location="$LOCATION" \
    environmentName="$ENVIRONMENT_NAME" \
    agentMode="template"
```

#### Option B: Foundry Shadow Mode with Model Key
```bash
read -sp "Enter Foundry API Key: " FOUNDRY_KEY
echo ""

az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam \
  --parameters \
    acrName="$ACR_NAME" \
    location="$LOCATION" \
    environmentName="$ENVIRONMENT_NAME" \
    agentMode="foundry-shadow" \
    foundryEndpoint="https://<YOUR-RESOURCE>.openai.azure.com" \
    foundryDeployment="<YOUR-DEPLOYMENT-NAME>" \
    foundryApiKey="$FOUNDRY_KEY" \
    modelRequestCap=10
```

### 8. Verify Deployment and Retrieve Public URL
```bash
# Retrieve deployment outputs
az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query properties.outputs

# Test public healthz
WEB_URL=$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query properties.outputs.webUrl.value -o tsv)

echo "Pulse Public URL: $WEB_URL"
curl -fsS "$WEB_URL/healthz"
```
