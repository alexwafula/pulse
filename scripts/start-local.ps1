param(
    [int]$WebPort = 8080,
    [int]$AgentPort = 8090,
    [ValidateSet('template', 'recorded', 'foundry-shadow', 'foundry')]
    [string]$AgentMode = 'template',
    [switch]$SkipWebBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if ($WebPort -lt 1024 -or $WebPort -gt 65435 -or $AgentPort -lt 1024 -or $AgentPort -gt 65435) {
    throw 'Choose ports between 1024 and 65435.'
}

function Find-FreePort([int]$start, [int]$excluded = 0) {
    for ($port = $start; $port -le $start + 100; $port++) {
        if ($port -eq $excluded) { continue }
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
        try { $listener.Start(); return $port } catch [Net.Sockets.SocketException] { } finally { $listener.Stop() }
    }
    throw "No free port near $start."
}

function Wait-Pulse([string]$url, $process) {
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        $process.Refresh()
        if ($process.HasExited) { throw "Pulse process $($process.Id) exited; inspect the logs." }
        try {
            $health = Invoke-RestMethod "$url/healthz" -TimeoutSec 2
            if ($health.status -eq 'ok') { return $health }
            if ($health -is [string] -and $health.Trim() -eq 'ok') { return $health }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
    throw "Pulse did not become healthy at $url."
}

$go = Get-Command go -ErrorAction SilentlyContinue
if ($go) { $goPath = $go.Source } else {
    $goPath = Join-Path $env:USERPROFILE 'tools/go/bin/go.exe'
    if (-not (Test-Path -LiteralPath $goPath)) { throw 'Install Go and add it to PATH.' }
}
$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python -ErrorAction SilentlyContinue }
if (-not $python) { throw 'Install Python 3.11 or newer.' }
if ($AgentMode -in @('foundry', 'foundry-shadow') -and (-not $env:PULSE_FOUNDRY_ENDPOINT -or -not $env:PULSE_FOUNDRY_DEPLOYMENT -or -not $env:PULSE_FOUNDRY_API_KEY)) {
    throw 'Foundry mode requires the three PULSE_FOUNDRY_* session variables. Never put keys in the browser.'
}
$runDir = Join-Path ([IO.Path]::GetTempPath()) ('pulse-local-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runDir | Out-Null
$binary = Join-Path $runDir 'pulse-server.exe'
$agents = $null
$web = $null
Push-Location $root
try {
    if (-not $SkipWebBuild) {
        if (-not (Test-Path -LiteralPath 'node_modules')) { throw 'Run npm ci first, or use -SkipWebBuild for committed assets.' }
        & npm.cmd run check:web
        if ($LASTEXITCODE -ne 0) { throw 'Web type check failed.' }
        & npm.cmd run build:web
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    & $goPath build -o $binary ./app/cmd/server
    if ($LASTEXITCODE -ne 0) { throw 'Go build failed.' }
    $AgentPort = Find-FreePort $AgentPort
    $WebPort = Find-FreePort $WebPort $AgentPort
    $agentURL = "http://127.0.0.1:$AgentPort"
    $webURL = "http://127.0.0.1:$WebPort"
    $agents = Start-Process -FilePath $python.Source -ArgumentList @('agents/run.py', '--port', $AgentPort, '--mode', $AgentMode) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDir 'agents.out.log') -RedirectStandardError (Join-Path $runDir 'agents.err.log')
    $agentHealth = Wait-Pulse $agentURL $agents
    if ($agentHealth.mode -ne $AgentMode) { throw 'Agent mode differs from the requested mode.' }
    $web = Start-Process -FilePath $binary -ArgumentList @('-addr', "127.0.0.1:$WebPort", '-agents-url', $agentURL) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDir 'web.out.log') -RedirectStandardError (Join-Path $runDir 'web.err.log')
    $null = Wait-Pulse $webURL $web
    # No insight request in Foundry modes: launching alone must not spend credits.
    if ($AgentMode -eq 'template') {
        $feed = Invoke-WebRequest "$webURL/api/insights?scenario=corner" -UseBasicParsing -TimeoutSec 25
        $payload = $feed.Content | ConvertFrom-Json
        if ($feed.Headers['X-Pulse-Insight-Source'] -ne 'python-template' -or $payload.cues.Count -ne 1 -or $payload.cues[0].verification.status -ne 'FALLBACK_TEMPLATE') {
            throw 'Go-to-Python template smoke test failed.'
        }
    }
    [pscustomobject]@{
        Pulse = "$webURL/"
        AgentURL = $agentURL
        AgentMode = $AgentMode
        WebPID = $web.Id
        AgentPID = $agents.Id
        Logs = $runDir
    }
} catch {
    if ($web -and -not $web.HasExited) { Stop-Process -Id $web.Id }
    if ($agents -and -not $agents.HasExited) { Stop-Process -Id $agents.Id }
    throw "Local startup failed. Logs: $runDir. $($_.Exception.Message)"
} finally {
    Pop-Location
}
