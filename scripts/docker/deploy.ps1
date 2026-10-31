# Implantação automatizada com Docker Compose (Windows / PowerShell).
# Mesmo fluxo do deploy.sh: versão -> build -> subida -> verificação -> rollback se falhar.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts/docker/deploy.ps1 [-Version 1.2.0]
param([string]$Version = "")

# Sem "Stop": no Windows PowerShell 5, qualquer texto no stderr de um comando
# externo (git, docker) viraria erro fatal. Os erros são checados por $LASTEXITCODE.
$ErrorActionPreference = "Continue"

function Invoke-GitQuiet {
    $anterior = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $saida = & git @args 2>$null
    $codigo = $LASTEXITCODE
    $ErrorActionPreference = $anterior
    if ($codigo -eq 0) { return $saida } else { return $null }
}
Set-Location (Join-Path $PSScriptRoot "..\..")

if (-not (Test-Path ".env")) {
    Write-Error "Arquivo .env não encontrado. Copie o .env.example e preencha."
    exit 1
}

# ---- 1. Versão --------------------------------------------------------------
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$pkgVersion = if ($pkg.version) { $pkg.version } else { "0.0.0" }
$commit = Invoke-GitQuiet rev-parse --short HEAD
if (-not $commit) { $commit = "unknown" }
$tag = Invoke-GitQuiet describe --tags --exact-match

if ($Version) { $appVersion = $Version }
elseif ($tag) { $appVersion = $tag -replace '^v', '' }
else { $appVersion = "$pkgVersion-$commit" }
if (Invoke-GitQuiet status --porcelain) { $appVersion = "$appVersion-dirty" }

$buildDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$env:APP_VERSION = $appVersion
$env:GIT_COMMIT = $commit
$env:BUILD_DATE = $buildDate

$previous = ""
if (Test-Path ".deploy/current-version") { $previous = (Get-Content ".deploy/current-version").Trim() }

Write-Host "==> Deploy da versão $appVersion (commit $commit)"
if ($previous) { Write-Host "    versão anterior: $previous" }

# ---- 2. Build e 3. Subida ---------------------------------------------------
Write-Host "==> Construindo imagens"
docker compose build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "==> Subindo contêineres"
docker compose up -d --remove-orphans
if ($LASTEXITCODE -ne 0) { exit 1 }

# ---- 4. Verificação ---------------------------------------------------------
New-Item -ItemType Directory -Force -Path ".deploy" | Out-Null
& (Join-Path $PSScriptRoot "verify.ps1") -Expected $appVersion
if ($LASTEXITCODE -eq 0) {
    Set-Content ".deploy/current-version" $appVersion
    Add-Content ".deploy/history.log" "$buildDate $appVersion $commit OK"
    $port = if ($env:HTTP_PORT) { $env:HTTP_PORT } else { "8080" }
    Write-Host "==> Deploy concluído: versão $appVersion no ar em http://localhost:$port"
    exit 0
}

# ---- 5. Rollback ------------------------------------------------------------
Write-Host "==> Verificação falhou" -ForegroundColor Red
Add-Content ".deploy/history.log" "$buildDate $appVersion $commit FALHOU"
docker compose logs --tail=50
if ($previous) {
    Write-Host "==> Voltando para a versão $previous" -ForegroundColor Yellow
    $env:APP_VERSION = $previous
    docker compose up -d --no-build
    & (Join-Path $PSScriptRoot "verify.ps1") -Expected $previous
}
exit 1
