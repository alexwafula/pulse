# Azure Container Apps Deployment Runbook

This runbook documents the declarative infrastructure-as-code (Bicep) deployment for Pulse on Azure Container Apps.

> Go and Python are deployed in South Africa North.
> [Open the public demo](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/).
> Main releases automatically run CI, container smoke checks, image publication
> and image-only updates of the two existing apps.

See [live deployment status](AZURE-LIVE-STATUS.md) for exact resources, image
digests and remaining checks. ACR Tasks failed with `TasksOperationsNotAllowed`;
GitHub built the images instead. Azure's first Go create returned an identity
bootstrap 500; the identical retry succeeded. No Foundry resources were replaced.

The approved replacement is `.github/workflows/build-images.yml`, which uses an
Azure federated publisher identity restricted to main and `AcrPush` on this registry.
It builds on GitHub, tests both containers and uploads commit-SHA tags. A separate
main-only identity can update the two existing apps; neither identity accesses
Foundry. Do not enable registry admin passwords or upload an Azure model key to
GitHub. See [decision 0020](decisions/0020-main-release-and-default-experience.md).

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
   - `pulse-agents`: Configured internal HTTP ingress on port 8090; direct reachability was observed, so service authentication is mandatory. Network isolation remains unverified.
   - `PULSE_AGENTS_URL` dynamically configured via Bicep referencing the agents app FQDN.
2. **Security**:
   - Zero-credential container pulls via User-Assigned Managed Identity assigned the `AcrPull` RBAC role.
   - ACR `adminUserEnabled` is set to `false`.
   - Foundry API key (when configured) is stored strictly as a Container App secret, never in code or git.
3. **Observability**:
   - Centralized Log Analytics Workspace (`PerGB2018`).
   - Liveness and readiness HTTP probes on `/healthz` for both containers.

---

## Repeat Deployment

These steps create billable Azure resources. Template mode makes no paid model
calls; it does not make Azure hosting free. ACR, image builds, Log Analytics
and running Container Apps replicas can incur charges. The parameter file uses
recorded mode, zero minimum and one maximum replica per app, 0.25 vCPU/0.5 GiB.
No Foundry key is needed or deployed in this mode. The saved CASUAL/en-GB corner
response is checked by Python and Go and labelled `Verified (recorded)` in the UI.
Other requests receive templates. See [decision 0017](decisions/0017-recorded-cloud-demo.md).

Hosted Python also requires a generated `agentAuthToken` secure parameter. The
same token is injected into Go/Python app secrets, never the browser or GitHub.
Health checks remain public; `/insights` rejects requests without the service
credential. Do not infer network privacy from `external: false` alone: direct
requests reached Python in this deployment. See [decision 0019](decisions/0019-agent-service-authentication.md).

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

For this Students subscription use the GitHub build workflow, not ACR Tasks:

```powershell
az deployment group create --resource-group pulse-hackathon --template-file infra/azure/github-build.bicep --parameters acrName=crpulsealexbf7b4530
az deployment group create --resource-group pulse-hackathon --template-file infra/azure/github-deploy.bicep
```

Set GitHub secrets `PULSE_AZURE_CLIENT_ID`, `PULSE_AZURE_TENANT_ID` and
`PULSE_AZURE_SUBSCRIPTION_ID` from its outputs, and repository variable
`PULSE_ACR_NAME=crpulsealexbf7b4530`. These are identifiers, not passwords.
Set `PULSE_AZURE_DEPLOY_CLIENT_ID` from the deployment identity's `clientId` output.
Only exact main-branch OIDC subjects can exchange tokens. The publisher has
registry-scoped `AcrPush`; the deployer has Container Apps Contributor on the two
apps and Reader on their environment. Remove obsolete feature-branch federation
after confirming main trust. No client password or model key is used.

Pushes to `main` trigger **Build Azure Images**. It calls the full reusable CI
gate, builds both images, checks authenticated Go/Python delivery and the
desktop/mobile homepage, then pushes commit-SHA tags. A non-superseded release
updates Python and Go to those tags and checks the public APIs. Image-only updates
preserve service secrets, recorded mode, model cap and replica limits. Manual
dispatch is supported on main. Feature branches and PRs never deploy.

For existing hosting this workflow replaces manual steps 6 and 7. Those steps
remain for initial infrastructure provisioning or an explicitly reviewed
configuration change; use the tested build's full SHA for both image tags.

For other subscriptions with ACR Tasks enabled, the alternative is:
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

On Windows use the tested image SHA with the deployment helper. It verifies both
GitHub workflows and uploaded tags before generating a token in memory:

```powershell
.\scripts\deploy-azure.ps1 -ImageTag '<FULL-SOURCE-COMMIT-SHA>'
```

The generic CLI equivalent below requires `AGENT_AUTH_TOKEN` to be generated
securely in the shell first. Never paste its value into a file or GitHub:
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
    modelRequestCap=0 \
    agentAuthToken="$AGENT_AUTH_TOKEN"
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
    agentAuthToken="$AGENT_AUTH_TOKEN" \
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
