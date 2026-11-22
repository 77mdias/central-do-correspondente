# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual

Fase 1 (Base) concluída e no ar em https://central-correspondente.wdias.tech (spec `docs/superpowers/specs/2026-11-15-fase-1-base-design.md`, plano `docs/superpowers/plans/2026-11-15-fase-1-base.md`). Fase 2 (Migração): spec `docs/superpowers/specs/2026-11-22-fase-2-migracao-design.md` (aprovada), plano `docs/superpowers/plans/2026-11-22-fase-2-migracao.md`. O protótipo é a referência de telas e regras: um Artifact do Claude (https://claude.ai/artifact/VyQhFpjAr6aetT4nVkf6c6), com os dados no banco compartilhado do próprio Artifact (coleções `clientes`, `corretores` e o documento `config/geral`) e os anexos no armazenamento de arquivos dele. Cópia de referência em `docs/prototipo/prototipo.html` (ver o README da pasta). Os outros protótipos citados no Briefing não funcionam e não servem de referência. Briefing e Documentação do Produto originais (PDF, 03/11/2026) ficam fora do repo, em `../central-correspondente/`.

Precedência: spec da fase atual > `docs/DECISOES.md` > demais docs > Briefing/Documentação. Antes de implementar algo com pendência aberta (P-03 a P-06, P-10), perguntar em vez de inventar.

Toda a interface, o schema, os commits e a documentação são em **português** (RNF-12). Tabelas, campos e funções do banco em português `snake_case`, exceto as tabelas do Better Auth (nomes padrão dele: `user`, `session`, `account`, `verification`, `rateLimit`).

## Comandos

```bash
pnpm docker:up                               # Postgres, Mailpit, s3mock e o app (http://localhost:3002), segredos do CriptEnv
pnpm test                                    # unidade (src/**/*.test.ts e worker/**/*.test.ts)
pnpm test:db                                 # RLS e gatilhos, contra o Postgres do compose (porta 5435)
pnpm test:worker                             # rotas da API (Hono app.request) contra o banco de teste
pnpm test:e2e                                # Playwright (Postgres + Mailpit do compose)
pnpm vitest run --project db -t "nome"       # um teste só
pnpm db:new <nome>                           # nova migration (dbmate, db/migrations)
pnpm conta:liberar <email|id> <AAAA-MM-DD>   # libera conta pendente (cortesia)
pnpm lint && pnpm typecheck
```

Testes e CI usam os valores fixos de `tests/test-env.ts`, sem CriptEnv. Nunca criar `.env`/`.dev.vars` com valores (ver `docs/SEGREDOS.md`). Versões exatas no `package.json`, sem `^`.

## Arquitetura

Stack: React + Vite + TS (SPA) servida pelo mesmo Cloudflare Worker (Hono) que expõe `/api` · Better Auth 1.7.16 · Postgres 18 (produção no Supabase São Paulo via Hyperdrive, só como hospedagem) · dbmate · Asaas · Web Push + e-mail por API HTTP. Sem Next.js, Vercel, Supabase Auth ou Realtime (D-26, D-27, D-31, D-32).

**Princípio central:** o navegador só fala com `/api`. Toda rota de domínio roda em `withUser(pools.app, usuarioId, fn)` (`worker/db.ts`): transação como `app_user` com `set_config('app.usuario_id', id, true)`, e **a RLS do Postgres decide o acesso**. O `usuarioId` vem só da sessão do Better Auth. Três papéis no banco:
- dono (`postgres`): migrations e `conta:liberar`;
- `app_user` (sem BYPASSRLS): toda rota de domínio;
- `app_system` (BYPASSRLS): só Better Auth, `POST /api/cadastro`, aceite de convite e rotinas do sistema, sempre filtrando por `conta_id` no código.

No Worker, as conexões são criadas por pedido (`abrirPools(env)`) e fechadas com `waitUntil`: objetos de I/O não podem ser reaproveitados entre pedidos.

Onde cada regra mora:
- **Integridade → gatilhos no Postgres** (D-28): RN-06, RN-07/RN-11 (percentual congelado em `clientes_remuneracao`), RN-12 (`atualizado_em`), RN-14/15 (`anexos_apagar_em`), RN-18 (limite do plano em `membros` e `convites`), RF-23, histórico de etapa, auditoria. Tabela em `docs/MODELO-DE-DADOS.md` §6.
- **Remuneração/VGV → views** que filtram `meu_perfil(conta_id) = 'gestor'`.
- **Regras puras e esquemas Zod → `src/regras/`**, usados pela SPA e pelo Worker (mesma validação nos dois lados).

Multi-escritório e perfis:
- Toda tabela de negócio tem `conta_id`; `membros` liga `"user"` ↔ conta ↔ perfil (`gestor`, `funcionaria`, `corretor`) com `status` (`ativo`/`desativado`; desativar não apaga a linha). O escritório ativo vem na URL (`/api/contas/:contaId/...`, telas `/e/:contaId`); trocar o id não abre nada.
- Funções `security definer`: `meu_usuario_id()`, `meu_perfil(conta)`, `meu_corretor_id(conta)`, `conta_ativa(conta)`, `hoje_br()`.
- **Funcionária e corretor nunca recebem percentual/remuneração do banco** (RN-17): `contas_config.percentual_atual` e `clientes_remuneracao` com RLS só do gestor.
- `plano`, `status_assinatura` e `ativa_ate` de `contas`: sem update para `app_user`.
- Dois planos (D-04, RN-18): **Simples** (R$ 99) só o gestor, corretores só como cadastro, sem login; **Com corretores** (R$ 149) gestor + 1 funcionária + corretores ilimitados. Convite pendente de funcionária conta no limite.
- Escrita exige `conta_ativa`: conta `pendente` (recém-cadastrada) ou suspensa fica somente leitura.
- Convites: token no link, só o hash (sha-256) no banco, 7 dias; aceite pela função `aceitar_convite` (como `app_system`).

Dinheiro em centavos (`bigint`, sufixo `_centavos`); percentual `numeric(6,3)`. "Hoje" sempre `hoje_br()` (`America/Sao_Paulo`); Cron Triggers rodam em UTC.

## Testes que importam

RLS comprovada por teste: para cada perfil e para um usuário de **outra conta**, o que lê e grava em cada tabela (`tests/db/rls.test.ts`). Gatilhos com teste SQL (`tests/db/gatilhos.test.ts`). Testes de banco usam uma conexão por papel (`max: 1`), para provar que nada vaza entre transações.

## Mapa da documentação

- `docs/DECISOES.md` — decisões D-01..D-40 e pendências P-01..P-11 (ler primeiro).
- `docs/SRS.md` — requisitos RF-xx, regras RN-xx, matriz de permissões, RNF. Citar esses códigos em tarefas, commits e testes.
- `docs/MODELO-DE-DADOS.md` — tipos, tabelas, RLS, gatilhos, views e o mapeamento do JSON do protótipo para o importador (gatilhos RN-07/RN-12 desligados durante a importação).
- `docs/ARQUITETURA.md` — rotas do Worker, crons, integrações (Asaas idempotente via `eventos_asaas`), ambientes.
- `docs/SEGREDOS.md` — CriptEnv, Docker e valores de teste.
- `docs/FLUXOS.md` — jornada, mapa de telas e fluxos (cobrança com "Enviou?", convite, inadimplência).
- `docs/PRD.md` — escopo, fora de escopo e fases (1 Base → 2 Migração → 3 Portal do corretor → 4 Venda).
