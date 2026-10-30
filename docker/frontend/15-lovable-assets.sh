#!/bin/sh
# As logos do projeto ficam hospedadas na Lovable (caminho /__l5e/...), fora do
# repositório. Se LOVABLE_ASSETS_ORIGIN estiver definida (ex.: a URL publicada
# do projeto na Lovable), o Nginx repassa esse caminho para lá. Sem ela, o
# caminho segue para o back-end normalmente.
set -eu

INC=/etc/nginx/conf.d/lovable-assets.inc

if [ -n "${LOVABLE_ASSETS_ORIGIN:-}" ]; then
  host=$(echo "$LOVABLE_ASSETS_ORIGIN" | sed -E 's#^https?://##; s#/.*$##')
  cat > "$INC" <<EOF
location /__l5e/ {
    resolver 1.1.1.1 8.8.8.8 valid=300s ipv6=off;
    set \$lovable_origin "${LOVABLE_ASSETS_ORIGIN%/}";
    proxy_pass \$lovable_origin;
    proxy_set_header Host ${host};
    proxy_ssl_server_name on;
    add_header Cache-Control "public, max-age=86400" always;
}
EOF
  echo "15-lovable-assets: /__l5e/ -> ${LOVABLE_ASSETS_ORIGIN}"
else
  echo "# LOVABLE_ASSETS_ORIGIN não definida" > "$INC"
fi
