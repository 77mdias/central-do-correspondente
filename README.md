# Central do Correspondente

App web para o correspondente bancário Caixa controlar cada financiamento habitacional, do cadastro do cliente ao registro em cartório. Junta ficha do cliente, documentos, cobrança pelo WhatsApp, corretores parceiros e cálculo de VGV e remuneração.

**Diferencial:** mostra o que fazer hoje (quem cobrar, o que está parado) e calcula sozinho quanto o correspondente vai receber.

> Status: planejamento da v1 (nov/2026). Existe um protótipo funcionando que serve de referência de telas e regras; esta é a versão final, com login, banco e armazenamento próprios.

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
| Hospedagem | Cloudflare Workers (assets estáticos + rotas `/api`) |
| Banco e login | Supabase (Postgres + Auth + RLS + Realtime), região São Paulo |
| Arquivos | Supabase Storage, bucket privado, links temporários |
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

## Estrutura do repositório (planejada)

```
central-do-correspondente/
├── src/                  # front-end React (telas, componentes, regras de exibição)
│   ├── regras/           # funções puras das regras de negócio (testadas)
│   ├── telas/
│   └── lib/supabase.ts
├── worker/               # Cloudflare Worker: /api, webhooks, cron
├── supabase/
│   ├── migrations/       # schema, gatilhos e políticas RLS
│   └── tests/            # testes de RLS por perfil
├── public/               # manifest e ícones do PWA
├── docs/
└── wrangler.jsonc
```

## Rodando localmente (quando o código existir)

```bash
pnpm install
supabase start            # Postgres, Auth e Storage locais
pnpm dev                  # Vite + Worker local
pnpm test                 # regras de negócio e RLS
```

## Fases

1. **Base:** login, contas, perfis, convites e banco com RLS.
2. **Migração:** todas as telas do protótipo no banco novo, com anexos e importador do JSON do protótipo.
3. **Portal do corretor e uso real:** acesso do corretor; teste com os 2 correspondentes atuais.
4. **Venda:** assinatura Asaas, lembretes, relatórios e página de venda ligada ao cadastro.

## Equipe

- Desenvolvimento: dono do código.
- Negócios e vendas: William Henrique Moreira Dias (venda pelo CNPJ dele).
