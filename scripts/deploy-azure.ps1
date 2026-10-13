param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$ImageTag,
    [string]$ResourceGroup = 'pulse-hackathon',
    [string]$Registry = 'crpulsealexbf7b4530',
    [string]$Location = 'southafricanorth'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$account = az account show --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $account.state -ne 'Enabled') { throw 'Select an enabled Azure subscription first.' }
$runs = gh run list --repo alexwafula/pulse --commit $ImageTag --limit 10 --json workflowName,status,conclusion | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot confirm GitHub build status.' }
foreach ($workflow in @('CI', 'Build Azure Images')) {
    if (-not ($runs | Where-Object { $_.workflowName -eq $workflow -and $_.status -eq 'completed' -and $_.conclusion -eq 'success' })) {
        throw "$workflow must pass for image source $ImageTag before deployment."
    }
}
foreach ($image in @('pulse-web', 'pulse-agents')) {
    az acr repository show --name $Registry --image "${image}:$ImageTag" --output none --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "Missing tested image: ${image}:$ImageTag" }
}

$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$token = $null
try {
    $generator.GetBytes($bytes)
    $token = [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    Write-Host "Deploying $ImageTag to $($account.name) / $ResourceGroup (billable hosting, recorded mode)."
    az deployment group create --resource-group $ResourceGroup --name pulse-containerapps `
        --template-file (Join-Path $root 'infra/azure/main.bicep') `
        --parameters (Join-Path $root 'infra/azure/main.bicepparam') `
        --parameters "acrName=$Registry" "location=$Location" "webImageTag=$ImageTag" "agentsImageTag=$ImageTag" `
        agentMode=recorded modelRequestCap=0 "agentAuthToken=$token" `
        --query '{state:properties.provisioningState,webUrl:properties.outputs.webUrl.value}' --output json
    if ($LASTEXITCODE -ne 0) { throw 'Azure deployment failed; inspect its operations before retrying.' }
} finally {
    $token = $null
    [Array]::Clear($bytes, 0, $bytes.Length)
    $generator.Dispose()
}
