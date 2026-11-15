# Segredos (CriptEnv) e ambiente de desenvolvimento

Nenhum `.env` ou `.dev.vars` com valores no disco (D-35). Os segredos ficam cifrados no CriptEnv e só existem em texto claro na memória do processo do app, dentro do container. O padrão é o mesmo do `~/projects/ateliesys` (`docs/SEGREDOS.md` de lá).

## Primeira configuração (uma vez por máquina)

1. Criar o projeto `central-do-correspondente` no CriptEnv, com o ambiente `development`.
2. Gravar as variáveis do ambiente `development` (tabela abaixo).
3. Criar a API key só de leitura presa ao ambiente e guardar as credenciais no chaveiro do sistema (o `secret-tool` pede o valor sem mostrar):

```bash
criptenv api-keys create -p central-do-correspondente -n docker-dev -s read:secrets --env development
secret-tool store --label='CriptEnv central-do-correspondente api-key' service criptenv project central-do-correspondente item api-key
secret-tool store --label='CriptEnv central-do-correspondente vault-password' service criptenv project central-do-correspondente item vault-password
```

4. Se o `criptenv run` pedir o ID do projeto (e não o nome), trocar o padrão de `CRIPTENV_PROJECT` em `compose.app.yaml` pelo ID, que não é segredo.

**Guarde também a senha do cofre no seu gerenciador de senhas**: sem ela ninguém lê os segredos.

### Ambiente `development`

As URLs apontam para a rede do compose (`postgres`, `mailpit`).

| Variável | Valor de desenvolvimento |
|---|---|
| `BETTER_AUTH_SECRET` | gerar com `openssl rand -base64 32` |
| `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB_APP` | `postgres://app_user:app_user@postgres:5432/central` |
| `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB_SYSTEM` | `postgres://app_system:app_system@postgres:5432/central` |
| `DATABASE_URL_OWNER` | `postgres://postgres:postgres@postgres:5432/central` |
| `EMAIL_API_URL` | `http://mailpit:8025/api/v1/send` |

## Como o Worker local recebe os valores

Conferido em 15/11/2026 com wrangler 4.162.0 e `@cloudflare/vite-plugin` 1.69.1:

- **Segredos:** `secrets.required` no `wrangler.jsonc` faz o `vite dev` ler `BETTER_AUTH_SECRET` e `EMAIL_API_URL` do `process.env` (log: "Using secrets defined in process.env"). Sem `.dev.vars`.
- **Banco:** o Hyperdrive local usa `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>` (`DB_APP`, `DB_SYSTEM`). Sem essa variável, o `vite dev` não sobe.
- Os valores não secretos (`APP_URL`, `EMAIL_REMETENTE`) ficam em `vars` no `wrangler.jsonc`.

```
chaveiro ─► docker/compose.sh ─► Docker secrets (/run/secrets) ─► docker/entrypoint.sh
                                                     criptenv run -e development -p <projeto> -- <comando>
```

## Comandos

| Para | Comando |
|---|---|
| Subir tudo (Postgres, Mailpit, s3mock e app com hot reload) | `pnpm docker:up` (foreground, Compose Watch) |
| Subir em segundo plano (sem sincronizar edições) | `pnpm docker:dev` |
| Parar | `pnpm docker:down` |
| Rodar um comando com os segredos | `pnpm docker:exec pnpm db:migrate` |
| Ver os logs do app | `pnpm docker:logs` |
| Só os serviços de apoio, para testes no host | `docker compose up -d postgres mailpit` |

Endereços locais: app em `http://localhost:3002`, Mailpit em `http://localhost:8028`, Postgres em `localhost:5435`, s3mock em `localhost:9093`.

## Testes

Os testes rodam no host e não precisam do CriptEnv: usam os valores fixos de `tests/test-env.ts` (os mesmos do CI), contra o Postgres e o Mailpit do compose. Os papéis `app_user` e `app_system` e os bancos `cc_test` e `cc_e2e` nascem em `docker/postgres/init/01-papeis.sql`, que só roda quando o volume do Postgres é criado; se o volume já existia, rode o arquivo com `psql`.

## Produção (a partir da fase 3)

Os papéis `app_user` e `app_system` são criados à mão no Supabase, com senhas fortes, antes da primeira migration (as migrations dão grants a eles). Os segredos de produção ficam no ambiente `production` do CriptEnv e vão para o Worker como segredos da Cloudflare. As conexões do Worker usam dois Hyperdrive (`DB_APP` e `DB_SYSTEM`), cada um com o papel dele.
