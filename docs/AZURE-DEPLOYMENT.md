# Azure Container Apps Deployment Runbook

This runbook documents the declarative infrastructure-as-code (Bicep) deployment for Pulse on Azure Container Apps.

> **Status (2026-10-13)**: Foundry resource/project, model deployment, budget alerts
> and ACR Basic `crpulsealexbf7b4530` are provisioned in South Africa North.
> Go/Python hosting is **not deployed**. Both `az acr build` requests were rejected
> with `TasksOperationsNotAllowed` by this Students subscription. No image builds
> ran and no Container Apps were created. The created registry remains billable.

The tested branch `feat/meeting-readiness` is pushed at runtime commit `103b3a4`.
[GitHub CI passed](https://github.com/alexwafula/pulse/actions/runs/38458056303).
Local Go/Python, recorded mode, both persona boundaries and desktop/mobile pitch
and evidence checks passed. Azure What-If succeeded, with no deletions and no
changes to the Foundry resources. This is not proof of a deployed cloud runtime.

Next build route, pending team approval: a manual GitHub Actions workflow using
an Azure federated identity restricted to this branch and `AcrPush` on this
registry. Do not enable registry admin passwords or upload an Azure model key to
GitHub. See [Microsoft's OIDC setup](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect).
Only deploy after both image tags exist; then check public Go health, Go-to-Python
recorded insight delivery and desktop/mobile browser playback on the public URL.

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

These steps create billable Azure resources. Template mode makes no paid model
calls; it does not make Azure hosting free. ACR, image builds, Log Analytics
and running Container Apps replicas can incur charges. The parameter file uses
recorded mode, zero minimum and one maximum replica per app, 0.25 vCPU/0.5 GiB.
No Foundry key is needed or deployed in this mode. The saved CASUAL/en-GB corner
response is checked by Python and Go and labelled `Verified (recorded)` in the UI.
Other requests receive templates. See [decision 0017](decisions/0017-recorded-cloud-demo.md).

Confirm the subscription, region, permissions and budget before proceeding.
Configure Azure Cost Management budget alerts; alerts do not automatically
stop spending. Setting minimum replicas to zero can reduce idle compute costs,
but adds cold starts and does not remove registry or logging costs.

Microsoft references:
[Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing),
[Container Registry pricing](https://azure.microsoft.com/en-us/pricing/details/container-registry/),
[budget alerts](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets).

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
az provider register --namespace Microsoft.ManagedIdentity
```

### 3. Set Environment Variables
```bash
RESOURCE_GROUP="pulse-hackathon"
LOCATION="southafricanorth" # Allowed by the current Students region policy
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

#### Option A: Reviewed Recorded Mode (No Runtime Model Charges)
```bash
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam \
  --parameters \
    acrName="$ACR_NAME" \
    location="$LOCATION" \
    environmentName="$ENVIRONMENT_NAME" \
    agentMode="recorded" \
    modelRequestCap=0
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

After validating shadow mode, `agentMode="foundry"` is an explicit opt-in to
independently checked corner-shot publishing. It is billable and still requires
complete evidence; it does not enable free prose or broader tactical facts.
Start with a small `modelRequestCap`, check both Verified and Template behaviour,
and follow [Foundry setup](FOUNDRY-AZURE-SETUP.md). These cloud steps have not been
executed as part of local readiness testing.
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
