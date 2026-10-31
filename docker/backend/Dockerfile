# syntax=docker/dockerfile:1.7
#
# Back-end do SETEC Administrativo: servidor TanStack Start (SSR + server functions)
# rodando em Node.js. O build usa o preset "node-server" do Nitro em vez do padrão
# Cloudflare, sem precisar alterar o vite.config.ts.
#
# Build (a partir da raiz do repositório):
#   docker build -f docker/backend/Dockerfile -t setec-backend:local \
#     --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... .

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.8.1

# ---------------------------------------------------------------------------
# 1) Dependências: camada separada para aproveitar o cache do Docker
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
ARG PNPM_VERSION
WORKDIR /app
RUN npm install -g pnpm@${PNPM_VERSION}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2) Build da aplicação
# ---------------------------------------------------------------------------
FROM deps AS build
# Variáveis VITE_* entram no bundle do navegador no momento do build,
# por isso são build args (só valores públicos: URL e chave publishable).
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
    NITRO_PRESET=node-server
COPY . .

# Identificação da versão publicada: vira o arquivo /version.json do site.
# Precisa existir antes do build, porque o Nitro só serve estáticos que
# estavam em public/ no momento do build.
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
RUN printf '{"name":"setec-administrativo","version":"%s","commit":"%s","buildDate":"%s"}\n' \
      "$APP_VERSION" "$GIT_COMMIT" "$BUILD_DATE" > public/version.json \
 && pnpm run build

# ---------------------------------------------------------------------------
# 3) Imagem final: só o .output (o Nitro já empacota as dependências usadas)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="setec-backend" \
      org.opencontainers.image.description="SETEC Administrativo - servidor TanStack Start (SSR)" \
      org.opencontainers.image.source="https://github.com/mkrosz/setec-administrativo" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION} \
    GIT_COMMIT=${GIT_COMMIT}

WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output

# Usuário sem privilégios (já existe na imagem oficial do Node)
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/version.json" > /dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
