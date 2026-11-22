# Central do Correspondente

App web para o correspondente bancário Caixa controlar cada financiamento habitacional, do cadastro do cliente ao registro em cartório. Junta ficha do cliente, documentos, cobrança pelo WhatsApp, corretores parceiros e cálculo de VGV e remuneração.

**Diferencial:** mostra o que fazer hoje (quem cobrar, o que está parado) e calcula sozinho quanto o correspondente vai receber.

> Status: fase 1 (base) em produção em https://central-correspondente.wdias.tech (nov/2026); fase 2 (rotina do escritório) a seguir. O app é feito do zero: não há protótipo nem dados a migrar.

## Para quem

| Perfil | Quantos por escritório | Acesso |
|---|---|---|
| Gestor (correspondente) | 1 | Tudo, inclusive VGV, comissões e percentual |
| Funcionária | 1 (só no plano Com corretores) | Tudo, menos valores de receita |
| Corretor parceiro | Ilimitado (só no plano Com corretores) | Só os clientes vinculados a ele |

## Planos

Assinatura mensal recorrente no Asaas, por escritório:

| Plano | Preço | Quem entra |
|---|---|---|
| **Simples** | R$ 99,00/mês | Só o gestor. Ele cadastra corretores como origem dos clientes, mas os corretores não têm login |
| **Com corretores** | R$ 149,00/mês | Gestor + 1 funcionária + corretores ilimitados no portal |

## Stack

| Parte | Escolha |
|---|---|
| Front-end | React + Vite + TypeScript (SPA, PWA instalável) |
| API e hospedagem | Cloudflare Workers com Hono: serve a SPA e a API inteira (`/api`) |
| Login | Better Auth (e-mail e senha) |
| Banco | Postgres 18 com RLS e gatilhos; migrations com dbmate. Produção no Supabase (São Paulo) via Hyperdrive |
| Arquivos | Supabase Storage (API S3), bucket privado, links temporários |
| Desenvolvimento | Docker (Postgres, Mailpit, s3mock e o app); segredos no CriptEnv |
| Rotinas agendadas | Cloudflare Cron Triggers |
| Pagamento | Asaas (assinatura recorrente + webhook) |
| WhatsApp | Link `wa.me` com mensagem pronta |
| Lembretes | Web Push (PWA) + e-mail de reserva |

O motivo de cada escolha está em [docs/DECISOES.md](docs/DECISOES.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/DECISOES.md](docs/DECISOES.md) | Registro das decisões tomadas e pendências |
| [docs/PRD.md](docs/PRD.md) | Problema, público, objetivos, escopo e fases |
| [docs/SRS.md](docs/SRS.md) | Requisitos funcionais, regras de negócio, permissões, não funcionais |
| [docs/FLUXOS.md](docs/FLUXOS.md) | Jornada do processo, mapa de telas e fluxos do usuário |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Componentes, segurança, rotinas, integrações, ambientes |
| [docs/MODELO-DE-DADOS.md](docs/MODELO-DE-DADOS.md) | Tabelas, campos, gatilhos e regras de acesso (RLS) |

## Estrutura do repositório

```
central-do-correspondente/
├── src/                  # SPA React (telas, componentes)
│   └── regras/           # funções puras e esquemas Zod, usados também pelo Worker
├── worker/               # Cloudflare Worker (Hono): Better Auth, rotas /api
├── db/migrations/        # schema, RLS e gatilhos (dbmate)
├── tests/                # db (RLS, gatilhos), worker (rotas), e2e (Playwright)
├── scripts/              # comandos (conta:liberar)
├── docker/               # compose.sh e entrypoint com CriptEnv
├── docs/
└── wrangler.jsonc
```

## Rodando localmente

Segredos e primeira configuração em [docs/SEGREDOS.md](docs/SEGREDOS.md).

```bash
pnpm install
pnpm docker:up                               # Postgres, Mailpit, s3mock e o app em http://localhost:3002
pnpm test                                    # regras (unidade)
pnpm test:db                                 # RLS e gatilhos (precisa do Postgres do compose)
pnpm test:worker                             # rotas da API
pnpm test:e2e                                # ponta a ponta (Postgres e Mailpit do compose)
pnpm conta:liberar <email|id> <AAAA-MM-DD>   # libera uma conta pendente
```

E-mails locais: Mailpit em http://localhost:8028.

## Fases

1. **Base:** login, cadastro aberto de escritório, contas, perfis, convites e banco com RLS.
2. **Rotina do escritório:** clientes, ficha, documentos com anexos, cobrança, corretores e VGV.
3. **Portal do corretor e uso real:** acesso do corretor; teste com os 2 correspondentes atuais.
4. **Venda:** assinatura Asaas, lembretes, relatórios e página de venda ligada ao cadastro.

## Equipe

- Desenvolvimento: dono do código.
- Negócios e vendas: William Henrique Moreira Dias (venda pelo CNPJ dele).
