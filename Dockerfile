# syntax=docker/dockerfile:1
# Build sem nenhum segredo: os valores chegam do CriptEnv no start (docker/entrypoint.sh). Veja docs/SEGREDOS.md.

# CLI do CriptEnv e o entrypoint que injeta os segredos
FROM node:24-bookworm-slim AS criptenv
ARG CRIPTENV_VERSION=0.2.4
ENV PATH=/opt/criptenv/bin:$PATH
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
 && python3 -m venv /opt/criptenv \
 && /opt/criptenv/bin/pip install --no-cache-dir "criptenv==${CRIPTENV_VERSION}" \
 && apt-get purge -y python3-venv && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]

# Dev: o Compose Watch copia o código editado no host para cá e o vite dev recarrega.
# O container não monta a pasta do projeto: não consegue escrever nos arquivos do host.
FROM criptenv AS dev
ENV NODE_ENV=development COREPACK_HOME=/home/node/.cache/node/corepack
RUN corepack enable && mkdir -p /app && chown -R node:node /app
WORKDIR /app
USER node
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-central,target=/home/node/.local/share/pnpm/store,uid=1000,gid=1000 \
    pnpm install --frozen-lockfile
COPY --chown=node:node . .
EXPOSE 3002
# Aplica as migrations pendentes (idempotente) e sobe o vite dev com o Worker no workerd.
CMD ["sh", "-c", "pnpm db:migrate && exec pnpm dev --host 0.0.0.0"]
