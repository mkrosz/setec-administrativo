# Verificação após o deploy (Windows / PowerShell). Mesmas checagens do verify.sh.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts/docker/verify.ps1 [-Expected 1.2.0] [-BaseUrl http://localhost:8080]
param(
    [string]$Expected = $env:APP_VERSION,
    [string]$BaseUrl = "",
    [int]$Timeout = 90
)

Set-Location (Join-Path $PSScriptRoot "..\..")

if (-not $BaseUrl) {
    $port = "8080"
    if (Test-Path ".env") {
        $linha = Select-String -Path ".env" -Pattern '^HTTP_PORT=(\d+)' | Select-Object -First 1
        if ($linha) { $port = $linha.Matches[0].Groups[1].Value }
    }
    $BaseUrl = "http://localhost:$port"
}

$script:falhas = 0
function Ok($msg) { Write-Host "  [ok]    $msg" -ForegroundColor Green }
function Falha($msg) { Write-Host "  [falha] $msg" -ForegroundColor Red; $script:falhas++ }
function Get-Http($url) {
    try { return Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 }
    catch { return $_.Exception.Response }
}

Write-Host "==> Verificando $BaseUrl (versão esperada: $(if ($Expected) { $Expected } else { 'qualquer' }))"

# 1. Healthcheck dos contêineres
foreach ($svc in "backend", "frontend") {
    $fim = (Get-Date).AddSeconds($Timeout)
    $estado = ""
    while ((Get-Date) -lt $fim) {
        $cid = docker compose ps -q $svc 2>$null
        $estado = if ($cid) { docker inspect -f "{{.State.Health.Status}}" $cid 2>$null } else { "ausente" }
        if ($estado -eq "healthy") { break }
        Start-Sleep -Seconds 3
    }
    if ($estado -eq "healthy") { Ok "contêiner $svc healthy" } else { Falha "contêiner ${svc}: $estado" }
}

# 2. Nginx
$r = Get-Http "$BaseUrl/healthz"
if ($r.StatusCode -eq 200) { Ok "/healthz -> 200" } else { Falha "/healthz -> $($r.StatusCode)" }

# 3. Versão publicada
try {
    $v = Invoke-RestMethod "$BaseUrl/version.json" -TimeoutSec 10
    $pagina = Get-Http "$BaseUrl/"
    $header = $pagina.Headers["X-App-Version"]
    if ($Expected -and $v.version -ne $Expected) { Falha "versão publicada $($v.version), esperada $Expected" }
    else { Ok "versão publicada: $($v.version) (commit $($v.commit), cabeçalho X-App-Version: $header)" }
} catch { Falha "/version.json não respondeu" }

# 4. Páginas (SSR pelo back-end)
foreach ($rota in "/", "/checkin/verificacao-deploy") {
    $r = Get-Http "$BaseUrl$rota"
    if ($r.StatusCode -eq 200) { Ok "$rota -> 200" } else { Falha "$rota -> $($r.StatusCode)" }
}

# 5. Estático do build servido pelo Nginx
$html = (Get-Http "$BaseUrl/").Content
$m = [regex]::Match($html, '/assets/[^"]*\.js')
if ($m.Success) {
    $r = Get-Http "$BaseUrl$($m.Value)"
    if ($r.StatusCode -eq 200) { Ok "$($m.Value) -> 200 (Cache-Control: $($r.Headers['Cache-Control']))" }
    else { Falha "$($m.Value) -> $($r.StatusCode)" }
} else { Falha "nenhum /assets/*.js encontrado no HTML" }

if ($script:falhas -gt 0) {
    Write-Host "==> Verificação: $($script:falhas) falha(s)" -ForegroundColor Red
    exit 1
}
Write-Host "==> Verificação: tudo certo" -ForegroundColor Green
exit 0
