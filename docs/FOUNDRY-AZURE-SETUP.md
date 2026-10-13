# Foundry and Azure setup

Status: local Go/Python features and one live Foundry workflow are tested.
Foundry resource, project and model deployment were created on 2026-10-13.
Go/Python app hosting is not deployed.
Windows preparation on 2026-10-09: Azure CLI 2.91.0 and the Container Apps
extension 1.3.0b5 are installed and verified. Student sign-in, provider registration,
allowed-region policy, model quota and budget alerts are now checked.
The container build and app-hosting commands below still need an actual smoke test.
Docker Desktop is optional for deployment: Azure Container Registry can build
both images in Azure using `az acr build`.

## Alex's student setup (2026-10-13)

- Resource group: `pulse-hackathon`.
- Foundry resource: `pulse-foundry-alex-bf7b4530`, kind AIServices, S0.
- Project: `pulse-hackathon` (display name Pulse).
- Resource location: `southafricanorth`.
- Deployment: `pulse-insights`, `gpt-4.1-mini`, version `2025-04-14`, Global Standard.
- Model endpoint: `https://pulse-foundry-alex-bf7b4530.openai.azure.com`.
- Allocated rate: 50,000 TPM / 50 RPM, not prepaid tokens or a spending cap.
- Provider registration and resource/project/deployment status: verified Succeeded.
- One live CASUAL corner workflow: accepted on first narration attempt, complete
  `evt-06`/`evt-07` evidence, Go source `python-verified`, status `VERIFIED`.
- Observed Python workflow latency: 7,813 ms; Go HTTP request: 7,875 ms.
  One run is not a model-quality or production-latency measurement.

The student subscription's policy permits Spain Central, Poland Central,
Austria East, Germany West Central and South Africa North. East US is blocked
for resource creation even though quota can be queried there. We checked live
model capacity in the permitted regions before creating the resource. Global
Standard inference can be processed outside the resource's home region.
No API key, contact email or full subscription ID is stored in these instructions.

Use the model endpoint above for Pulse, not the project endpoint ending in
`/api/projects/pulse-hackathon` or the generic `.cognitiveservices.azure.com` endpoint.
All three Python roles share this one deployment. This does not create three
hosted Foundry agents or deploy Go/Python Container Apps.

`infra/azure/budget.bicep` prepares resource-group alerts at 25/50/100 percent
of a default 20-unit monthly budget in the subscription's billing currency.
Notifications are not a hard cap; availability can lag on a new subscription.
The contact address is supplied as a secure deployment parameter, never committed.
Budget `pulse-credit-alerts` was deployed successfully with amount 20, Monthly,
enabled actual-spend thresholds 25/50/100 percent and expiry 2026-12-01. The initial
budget response did not report a currency unit; confirm it in the portal. Cost
data is delayed, so its initial zero is not proof that inference incurred no cost.

The local Foundry demo is capped at one distinct model workflow per service process.
Repeated CASUAL requests for the same corner pack use its cache; other audiences
or scenarios return templates once the cap is reached. Restarting resets the cap.
Keep the original template instance for freely testing all personas/scenarios.
Desktop/mobile browser checks passed against the warmed service, including Verified
status, evidence replay and a nonblank Three.js pitch. The workflow log count stayed
at one after these requests. Screenshots are in the temporary `pulse-foundry-preview`
folder. To repeat this browser check against an already-capped/warmed instance:

```powershell
$env:PULSE_URL = 'http://127.0.0.1:8089'
$env:PULSE_CACHED_FOUNDRY = '1'
node tests/integration/foundry-browser.mjs
```

This is a manual check, never an offline CI model test. Supply the actual printed
port and ensure the cap/cache are set; pointing it at a different uncapped service
can make paid requests. No other persona or scenario was tested live in this run.

## 0. Prepare this Windows machine

Install the official Azure CLI if `az version` is not available:

```powershell
winget install --exact --id Microsoft.AzureCLI --source winget
```

Open a new PowerShell terminal after installation, then sign in and inspect
the subscriptions you can use:

```powershell
az version
az login
az account list --query "[].{name:name,id:id,state:state,isDefault:isDefault}" --output table
az account set --subscription 'YOUR-SUBSCRIPTION-ID'
az account show --query "{name:name,id:id,state:state}" --output table
```

If the normal browser login fails, use `az login --use-device-code` and follow
the sign-in instructions in that terminal. Do not share the sign-in code,
password, API keys or access tokens with collaborators.

Before creating resources, confirm the subscription, available credits or
spending limit, region and your resource-creation permissions. In Azure Cost
Management, create a budget for this subscription or the dedicated Pulse
resource group and configure email alerts. A budget is an alert, not a hard
spending cap. Free credits do not make every service or model free.

Use this order:

1. Sign in and agree on a budget; reuse an existing Foundry resource if suitable.
2. Deploy one supported model and test one local shadow workflow (section 1).
3. Deploy Go and Python in template mode first (section 3).
4. Enable Foundry shadow mode on the internal Python app and inspect its logs.
5. After one successful shadow check, explicitly opt into constrained `foundry`
   publishing and verify its fallback and complete evidence in the browser.

The three Pulse roles can initially share one model deployment. This setup
does not create three hosted Foundry agents. `foundry` enables only the approved
corner-shot wording, not arbitrary prose or broader tactical analysis.

Microsoft references:
[Windows CLI installation](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows),
[interactive sign-in](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli-interactively),
[budget alerts](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets).

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

Read the Python terminal's `pulse_agent_workflow` log for accepted/rejected,
attempt count and measured latency. A successful shadow run still returns
`FALLBACK_TEMPLATE`. Shadow mode deliberately does not publish. The separately
tested `foundry` mode accepts only approved corner-shot wording with complete
evidence and independent checks in Python and Go. Logs are local diagnostics, not Foundry distributed
tracing. Keep the default `template` mode when recording credential-free demos.

Each model workflow makes up to five role calls (Explainer, Narrator/Verifier
with one retry), with bounded timeouts. The cap is per service process, not an
Azure-wide spending limit, and resets on restart. Cache hits do not call the
model again. The workflow has a 12-second deadline plus bounded transport shutdown;
Go allows 20 seconds. No API key belongs in browser code.

To publish after validating shadow mode, restart the Python service with:

```powershell
$env:PULSE_AGENT_MODE = 'foundry'
$env:PULSE_MODEL_REQUEST_CAP = '2'
py agents/run.py --port 8090
```

Start Go with `-agents-url http://127.0.0.1:8090`, select Corner chance and inspect
`/api/insights?scenario=corner&persona=CASUAL`. A supported model response returns
`X-Pulse-Insight-Source: python-verified` and a `VERIFIED` cue. Errors, unsupported
words, missing evidence, timeout or an exhausted cap return a checked template.
The browser displays Verified or Template accordingly. Publishing supports only
English CASUAL/ANALYST and the existing corner fact. The six permitted strings
are tested in both languages using `tests/evaluations/publication-cases.json`.
Offline tests do not verify live Foundry. One separately approved CASUAL smoke
test succeeded on 2026-10-13; additional calls need an explicit testing budget.
The native launcher also accepts `-AgentMode foundry`, but
loading a browser cue then consumes a workflow if it is not cached.

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
