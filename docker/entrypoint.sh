#!/bin/sh
# Os segredos do app chegam na memória do processo, nunca em arquivo (docs/SEGREDOS.md).
# As credenciais do CriptEnv vêm dos Docker secrets (${SECRETS_DIR:-/run/secrets}), não do ambiente do container.
# `criptenv run` busca e decifra o ambiente, tira as credenciais do ambiente do comando e faz exec dele.
set -eu
SECRETS_DIR="${SECRETS_DIR:-/run/secrets}"
export HOME=/tmp
CRIPTENV_API_KEY="$(cat "$SECRETS_DIR/criptenv_api_key")"
CRIPTENV_VAULT_PASSWORD="$(cat "$SECRETS_DIR/criptenv_vault_password")"
export CRIPTENV_API_KEY CRIPTENV_VAULT_PASSWORD
exec criptenv run -e "$CRIPTENV_ENV" -p "$CRIPTENV_PROJECT" -- "$@"
