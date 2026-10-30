#!/usr/bin/env bash
# Verificação após o deploy. Confere se:
#   - os contêineres backend e frontend estão "healthy"
#   - o Nginx responde em /healthz
#   - a versão publicada (/version.json e cabeçalho X-App-Version) é a esperada
#   - as páginas renderizadas pelo back-end respondem 200 (/ e /checkin/...)
#   - um arquivo estático do build é servido pelo Nginx
#
# Uso: scripts/docker/verify.sh [versão-esperada] [url-base]
set -uo pipefail

cd "$(dirname "$0")/../.."
[ -f .env ] && set -a && . ./.env && set +a

EXPECTED="${1:-${APP_VERSION:-}}"
BASE_URL="${2:-http://localhost:${HTTP_PORT:-8080}}"
TIMEOUT="${VERIFY_TIMEOUT:-90}"
FALHAS=0

ok() { echo "  [ok]    $*"; }
falha() { echo "  [falha] $*" >&2; FALHAS=$((FALHAS + 1)); }

echo "==> Verificando ${BASE_URL} (versão esperada: ${EXPECTED:-qualquer})"

# 1. Healthcheck dos contêineres
for svc in backend frontend; do
  fim=$((SECONDS + TIMEOUT))
  estado=""
  while [ $SECONDS -lt $fim ]; do
    cid=$(docker compose ps -q "$svc" 2>/dev/null)
    estado=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "ausente")
    [ "$estado" = "healthy" ] && break
    sleep 3
  done
  if [ "$estado" = "healthy" ]; then ok "contêiner $svc healthy"; else falha "contêiner $svc: $estado"; fi
done

# 2. Nginx
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/healthz")
[ "$code" = "200" ] && ok "/healthz -> 200" || falha "/healthz -> $code"

# 3. Versão publicada
versao=$(curl -s "$BASE_URL/version.json" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
header=$(curl -s -D - -o /dev/null "$BASE_URL/" | tr -d '\r' | sed -n 's/^[Xx]-[Aa]pp-[Vv]ersion: //p')
if [ -z "$versao" ]; then
  falha "/version.json não respondeu"
elif [ -n "$EXPECTED" ] && [ "$versao" != "$EXPECTED" ]; then
  falha "versão publicada $versao, esperada $EXPECTED"
else
  ok "versão publicada: $versao (cabeçalho X-App-Version: ${header:-ausente})"
fi

# 4. Páginas (SSR pelo back-end)
for rota in / /checkin/verificacao-deploy; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$rota")
  [ "$code" = "200" ] && ok "$rota -> 200" || falha "$rota -> $code"
done

# 5. Estático do build servido pelo Nginx
asset=$(curl -s "$BASE_URL/" | grep -o '/assets/[^"]*\.js' | head -1)
if [ -n "$asset" ]; then
  cache=$(curl -s -D - -o /dev/null "$BASE_URL$asset" | tr -d '\r' | grep -i '^cache-control' || true)
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$asset")
  [ "$code" = "200" ] && ok "$asset -> 200 ($cache)" || falha "$asset -> $code"
else
  falha "nenhum /assets/*.js encontrado no HTML"
fi

if [ $FALHAS -gt 0 ]; then
  echo "==> Verificação: $FALHAS falha(s)" >&2
  exit 1
fi
echo "==> Verificação: tudo certo"
