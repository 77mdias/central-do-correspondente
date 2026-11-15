#!/bin/sh
# docker compose com as credenciais do CriptEnv tiradas do chaveiro do sistema (nunca de arquivo).
# O Compose as entrega ao container como Docker secrets; veja docs/SEGREDOS.md.
set -eu
CRIPTENV_API_KEY="$(secret-tool lookup service criptenv project central-do-correspondente item api-key || true)"
CRIPTENV_VAULT_PASSWORD="$(secret-tool lookup service criptenv project central-do-correspondente item vault-password || true)"
if [ -z "$CRIPTENV_API_KEY" ] || [ -z "$CRIPTENV_VAULT_PASSWORD" ]; then
  echo "Credenciais do CriptEnv não estão no chaveiro. Veja docs/SEGREDOS.md." >&2
  exit 1
fi
export CRIPTENV_API_KEY CRIPTENV_VAULT_PASSWORD
exec docker compose -f compose.yaml -f compose.app.yaml "$@"
