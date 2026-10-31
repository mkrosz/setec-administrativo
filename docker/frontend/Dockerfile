# syntax=docker/dockerfile:1.7
#
# Front-end do SETEC Administrativo: Nginx como porta de entrada.
#
# O projeto usa SSR (TanStack Start), então o HTML das páginas é gerado pelo
# back-end. Este contêiner serve direto os arquivos estáticos do build
# (/assets, ícones, version.json) com cache e compressão, e repassa o resto
# (páginas e server functions) para o back-end.
#
# Os estáticos vêm da própria imagem do back-end, garantindo que front e back
# sejam sempre da mesma versão. O contexto "backend" é passado pelo compose
# (additional_contexts) ou manualmente:
#   docker build -f docker/frontend/Dockerfile -t setec-frontend:local \
#     --build-context backend=docker-image://setec-backend:local .

ARG NGINX_VERSION=1.27

FROM backend AS app

FROM nginx:${NGINX_VERSION}-alpine AS runtime
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="setec-frontend" \
      org.opencontainers.image.description="SETEC Administrativo - proxy reverso Nginx e arquivos estáticos" \
      org.opencontainers.image.source="https://github.com/mkrosz/setec-administrativo" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# Valores padrão; podem ser trocados no docker run / compose
ENV APP_VERSION=${APP_VERSION} \
    BACKEND_HOST=backend:3000 \
    LOVABLE_ASSETS_ORIGIN=""

# O entrypoint oficial do Nginx processa os templates com envsubst
COPY docker/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/frontend/15-lovable-assets.sh /docker-entrypoint.d/15-lovable-assets.sh
RUN chmod +x /docker-entrypoint.d/15-lovable-assets.sh \
 && rm -f /etc/nginx/conf.d/default.conf

COPY --from=app /app/.output/public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
