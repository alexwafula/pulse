# Foundry and Azure setup

Status: local Go/Python features are tested. The REST adapter is tested with
mocked HTTP only. No live model calls or Azure deployments have been performed.
Docker and Azure CLI are not installed on this development machine, so the
container build and cloud commands below still need an actual smoke test.

## 1. Connect Foundry later today

1. Sign in to [Microsoft Foundry](https://ai.azure.com/) using the Azure
   subscription you intend to pay from. Create a project/resource in a region
   with available model quota. Set a budget alert in Azure Cost Management.
2. Deploy a chat model that supports strict JSON Schema structured outputs.
   A small supported model is sufficient for the initial constrained workflow;
   verify availability and cost in your subscription rather than assuming a
   particular model/region is available.
3. Open the deployed model's sample code/endpoint panel. Copy the **model
   resource endpoint**, deployment name and API key. Do not use the project URL
   ending in `/api/projects/...`. This adapter accepts public-cloud resource
   endpoints ending in `.openai.azure.com` or `.services.ai.azure.com` and calls
   `/openai/v1/chat/completions`. Sovereign/private endpoints need a separate
   reviewed adapter configuration.
4. Stop the existing **Pulse** Python service on port 8090 before restarting it
   in a new mode. Verify the process belongs to Pulse; do not stop unrelated
   Python processes. Set session environment variables in PowerShell. The Go/Python binaries do
   not automatically load `.env`; Docker Compose does support interpolation
   from a local ignored `.env`.

```powershell
$env:PULSE_FOUNDRY_ENDPOINT = 'https://YOUR-RESOURCE.openai.azure.com'
$env:PULSE_FOUNDRY_DEPLOYMENT = 'YOUR-DEPLOYMENT-NAME'
$key = Read-Host 'Foundry API key' -AsSecureString
$env:PULSE_FOUNDRY_API_KEY = [System.Net.NetworkCredential]::new('', $key).Password
$env:PULSE_AGENT_MODE = 'foundry-shadow'
$env:PULSE_MODEL_REQUEST_CAP = '2'
py agents/run.py --port 8090
```

Keep the Go server running at `http://127.0.0.1:8083` (or substitute your
chosen local port). In a second terminal, explicitly trigger **one paid workflow**:

```powershell
$pack = @(Invoke-RestMethod http://127.0.0.1:8083/api/fact-packs)[0]
$body = @{schemaVersion='2.0.0'; factPack=$pack; locale='en-GB'; persona='CASUAL'} | ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8090/insights `
  -ContentType application/json -Body $body -TimeoutSec 30
```

Read the Python terminal's `pulse_agent_shadow` log for accepted/rejected,
attempt count and measured latency. A successful shadow run still returns
`FALLBACK_TEMPLATE`. This is intentional: models cannot publish free prose
through the current canonical Go gate. Activating broader model-backed viewer
output requires the agreed contract/gate changes and adversarial tests, not
just supplying a key. Logs are local diagnostics, not Foundry distributed
tracing. Keep the default `template` mode when recording credential-free demos.

Each shadow workflow makes up to five role calls (Explainer, Narrator/Verifier
with one retry), with bounded timeouts. The cap is per service process, not an
Azure-wide spending limit, and resets on restart. Cache hits do not call the
model again. The browser's Go timeout is shorter than a full shadow workflow;
use the direct Python request above to test model stages, then refresh the
browser to consume the cached template. No API key belongs in browser code.

Microsoft references:
[v1 endpoint/authentication](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle),
[structured outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs).

## 2. One-command local containers

Install Docker Desktop and start it. From the repository root:

```powershell
docker compose up --build
```

Open `http://127.0.0.1:8080`. Only Go is exposed on the host; Python is reached
over the Compose network. Default mode has no model costs or credentials.
Run `docker compose down` when finished. This starts services, not cloud
resources. The Python server is the standard-library demo adapter, not a
production-hardened ASGI service.

## 3. Deploy two Container Apps

The following commands **create billable Azure resources**. Run them yourself
after checking subscription, region, budget and permissions. Use a dedicated
resource group. Registry names must be globally unique and lowercase.

Install Azure CLI, then:

```powershell
az login
az account set --subscription 'YOUR-SUBSCRIPTION-ID'
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.ContainerRegistry

$Group = 'pulse-hackathon'
$Region = 'YOUR-AVAILABLE-REGION'
$Environment = 'pulse-demo'
$Registry = 'YOURUNIQUEPULSEREGISTRY'
az group create --name $Group --location $Region
az acr create --resource-group $Group --name $Registry --sku Basic
az acr build --registry $Registry --image pulse-web:demo --file Dockerfile .
az acr build --registry $Registry --image pulse-agents:demo --file agents/Dockerfile .
az containerapp env create --name $Environment --resource-group $Group --location $Region
```

Wait for provider registration before creating resources. In the Azure portal:

1. Create a user-assigned managed identity and grant registry pull permission
   before deploying the private images. Use `AcrPull` for a non-ABAC registry;
   an ABAC-enabled registry instead needs `Container Registry Repository Reader`
   (and Catalog Lister if the portal must enumerate repositories).
2. Create `pulse-agents` in this environment from the `pulse-agents:demo` image.
   Select that managed identity for private-registry authentication. Configure **internal** HTTP
   ingress, target port **8090**, and `PULSE_AGENT_MODE=template` initially.
3. Create `pulse-web` from `pulse-web:demo` in the **same environment** with the
   same registry identity permissions. Configure **external** HTTP ingress,
   target port **8080**. Add `PULSE_AGENTS_URL=https://<agents-internal-FQDN>`.
4. Retrieve the agents FQDN using the portal or:

```powershell
az containerapp show --name pulse-agents --resource-group $Group `
  --query properties.configuration.ingress.fqdn --output tsv
```

5. Visit the web app's public HTTPS URL and `/healthz`. Check all three
   scenarios, audience switch, evidence, rewind, recap and mobile layout.
6. When ready to test Foundry, put the key into a **Container Apps secret**
   named `foundry-key`. Reference it from the agents app environment variable
   `PULSE_FOUNDRY_API_KEY` using source Secret. Set the endpoint, deployment,
   `PULSE_AGENT_MODE=foundry-shadow` and a small request cap. Never put keys in
   the Go app, frontend, screenshots, commands committed to Git, or project page.
7. Check logs and cold starts. Scaling to zero reduces idle compute but can
   add cold-start latency; choose replica settings deliberately for judging.

Keep Python ingress internal. ACR, logging, model calls and replicas can still
cost money even without traffic. Budget alerts notify; they do not guarantee
an automatic spending stop. Do not claim a deployment is tested until you
have exercised the actual public URL. GitHub Actions billing can be fixed
separately; manual deployment does not depend on Actions running.

Microsoft references:
[Container Apps deployment](https://learn.microsoft.com/en-us/azure/container-apps/quickstart-code-to-cloud),
[internal service communication](https://learn.microsoft.com/en-us/azure/container-apps/connect-apps),
[registry identity](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull),
[ABAC registry roles](https://learn.microsoft.com/azure/container-registry/container-registry-rbac-abac-repository-permissions),
[secret references](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets),
[environment variables](https://learn.microsoft.com/en-us/azure/container-apps/environment-variables).

## 4. Before final submission

- Live Foundry run, rejection/fallback and measured timings recorded.
- Public Azure URL tested without signing in; secrets remain server-side.
- Contract approval for GOAL outcomes and agent publishing, with shared tests.
- Native-speaker review before enabling Kiswahili; it is currently disabled.
- Public repository includes the final tested code and an appropriate licence.
- Demo video shows only working features, with accurate template/model labels.
- Current deadline, registration and category confirmed on the event website.
