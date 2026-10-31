#!/usr/bin/env bash
# Implantação automatizada com Docker Compose:
#   1. identifica a versão (tag do git ou package.json + commit)
#   2. constrói as imagens backend e frontend com essa versão
#   3. sobe os contêineres
#   4. roda a verificação pós-deploy
#   5. se a verificação falhar, volta para a versão que estava no ar
#
# Uso: scripts/docker/deploy.sh [versão]
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  echo "ERRO: arquivo .env não encontrado. Copie o .env.example e preencha." >&2
  exit 1
fi

# ---- 1. Versão --------------------------------------------------------------
PKG_VERSION=$(node -p "require('./package.json').version || '0.0.0'" 2>/dev/null || echo "0.0.0")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || true)
if [ -n "${1:-}" ]; then
  APP_VERSION="$1"
elif [ -n "$GIT_TAG" ]; then
  APP_VERSION="${GIT_TAG#v}"
else
  APP_VERSION="${PKG_VERSION}-${GIT_COMMIT}"
fi
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  APP_VERSION="${APP_VERSION}-dirty"
fi
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
export APP_VERSION GIT_COMMIT BUILD_DATE

# Versão atualmente no ar (para rollback)
PREVIOUS_VERSION=""
if [ -f .deploy/current-version ]; then
  PREVIOUS_VERSION=$(cat .deploy/current-version)
fi

echo "==> Deploy da versão ${APP_VERSION} (commit ${GIT_COMMIT})"
[ -n "$PREVIOUS_VERSION" ] && echo "    versão anterior: ${PREVIOUS_VERSION}"

# ---- 2. Build ---------------------------------------------------------------
echo "==> Construindo imagens"
docker compose build

# ---- 3. Subida --------------------------------------------------------------
echo "==> Subindo contêineres"
docker compose up -d --remove-orphans

# ---- 4. Verificação ---------------------------------------------------------
if scripts/docker/verify.sh "$APP_VERSION"; then
  mkdir -p .deploy
  echo "$APP_VERSION" > .deploy/current-version
  echo "${BUILD_DATE} ${APP_VERSION} ${GIT_COMMIT} OK" >> .deploy/history.log
  echo "==> Deploy concluído: versão ${APP_VERSION} no ar em http://localhost:${HTTP_PORT:-8080}"
  exit 0
fi

# ---- 5. Rollback ------------------------------------------------------------
echo "==> Verificação falhou" >&2
mkdir -p .deploy
echo "${BUILD_DATE} ${APP_VERSION} ${GIT_COMMIT} FALHOU" >> .deploy/history.log
docker compose logs --tail=50 >&2 || true
if [ -n "$PREVIOUS_VERSION" ]; then
  echo "==> Voltando para a versão ${PREVIOUS_VERSION}" >&2
  APP_VERSION="$PREVIOUS_VERSION" docker compose up -d --no-build
  APP_VERSION="$PREVIOUS_VERSION" scripts/docker/verify.sh "$PREVIOUS_VERSION" || true
fi
exit 1
