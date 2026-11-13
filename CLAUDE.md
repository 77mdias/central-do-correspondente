# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual

Repositório em **planejamento da v1** (nov/2026): só existe documentação em `docs/`, ainda sem código. Existe um protótipo separado que é a referência de telas e regras; o código dele **não está aqui** (pendência P-01 depende dele). Briefing e Documentação do Produto originais (PDF, 03/11/2026) ficam fora do repo, em `../central-correspondente/`.

Quando `docs/DECISOES.md` contradiz Briefing/Documentação, **vale DECISOES.md**. Antes de implementar algo com pendência aberta (P-01 a P-10), perguntar em vez de inventar.

Toda a interface, o schema e a documentação são em **português** (RNF-12). Tabelas, campos e funções do banco em português `snake_case`.

## Comandos (planejados — confirmar quando o código existir)

```bash
pnpm install
supabase start      # Postgres, Auth e Storage locais (Docker)
pnpm dev            # Vite + Worker local (Wrangler)
pnpm test           # Vitest (regras) + testes de RLS no Supabase local
```

CI planejada (GitHub Actions): lint + testes em todo PR; deploy do Worker e `supabase db push` no merge na `main`. Schema só muda por migration em `supabase/migrations/`, nunca pelo painel.

## Arquitetura

Stack: React + Vite + TS (SPA/PWA) · Cloudflare Workers (assets + `/api` + Cron Triggers) · Supabase São Paulo (Postgres, Auth, Storage, Realtime) · Asaas · Web Push + e-mail. Sem Next.js e sem Vercel (D-26, D-27).

**Princípio central:** o navegador fala direto com o Supabase via `supabase-js`, e **a segurança é a RLS do Postgres**, não a tela. O Worker (`worker/`) só faz o que exige chave de serviço ou segredo: convites, links temporários de download auditados, webhook/API do Asaas, push e rotinas agendadas. No Worker, a permissão é conferida consultando o banco **com o JWT do próprio usuário** (a RLS decide); a service role só entra depois dessa checagem.

Onde cada regra mora:
- **Integridade → gatilhos no Postgres** (D-28): RN-06 (data de assinatura automática), RN-07/RN-11 (congelar/limpar percentual), RN-12 (`atualizado_em`), RF-23 (anexo marca recebido), histórico de etapa, auditoria, agendamento de exclusão de anexos (RN-14/15). Ver tabela de gatilhos em `docs/MODELO-DE-DADOS.md` §6.
- **Remuneração/VGV → views só do gestor** (`vw_remuneracao`, `vw_vgv_*`) com `security_invoker = on`.
- **Regras de exibição → funções puras em `src/regras/`** (ativo, parado, situação da cobrança, mensagens de WhatsApp), testadas com Vitest.
- Validação de formulário com Zod usando as mesmas regras do banco (CPF com dígito verificador, telefone 10/11 dígitos, e-mail).

Multi-escritório e perfis:
- Toda tabela de negócio tem `conta_id`; `membros` liga usuário ↔ conta ↔ perfil (`gestor`, `funcionaria`, `corretor`). Um mesmo usuário pode estar em várias contas e escolhe o escritório ao entrar.
- Funções auxiliares `security definer`: `meu_perfil(conta)`, `meu_corretor_id(conta)`, `conta_ativa(conta)`, `hoje_br()`.
- **Funcionária e corretor nunca recebem percentual/remuneração do banco** (RN-17): por isso esses campos ficam em `clientes_remuneracao` (e possivelmente `contas_config`), com RLS só do gestor.
- Corretor só lê clientes com `corretor_id = meu_corretor_id(conta_id)`; pode anexar, não edita ficha nem remove anexo.
- Dois planos (D-04, RN-18): **Simples** (R$ 99) só o gestor, corretores só como cadastro, sem login; **Com corretores** (R$ 149) gestor + 1 funcionária + corretores ilimitados no portal. O limite vale no banco (índice único parcial + gatilho `tg_limite_plano` em `membros`), não só no convite.
- Escrita exige `conta_ativa`: conta suspensa (RN-16) fica somente leitura para todos.

Arquivos: bucket privado `documentos`, caminho `conta_id/cliente_id/arquivo_id.ext`. Há política de upload, mas **nenhuma de leitura**: download só via `GET /api/arquivos/:id/link` (link de até 5 min + registro em `auditoria`).

"Hoje" sempre no fuso `America/Sao_Paulo` (`hoje_br()`); Cron Triggers rodam em UTC (8h BRT = 11h UTC).

## Testes que importam

A meta da fase 1 é RLS comprovada por teste: para cada perfil e para um usuário de **outra conta**, o que lê e grava em cada tabela. Casos obrigatórios: funcionária não lê `clientes_remuneracao`; corretor não lê cliente de outro corretor; contas diferentes não se enxergam. Gatilhos RN-06/07/11/12 e RF-23 também têm teste SQL.

## Mapa da documentação

- `docs/DECISOES.md` — decisões D-01..D-29 e pendências P-01..P-10 (ler primeiro).
- `docs/SRS.md` — requisitos RF-xx, regras RN-xx, matriz de permissões, RNF. Citar esses códigos em tarefas, commits e testes.
- `docs/MODELO-DE-DADOS.md` — tipos, tabelas, RLS, gatilhos, views e o mapeamento do JSON do protótipo para o importador (gatilhos RN-07/RN-12 desligados durante a importação).
- `docs/ARQUITETURA.md` — rotas do Worker, crons, integrações (Asaas idempotente via `eventos_asaas`).
- `docs/FLUXOS.md` — jornada, mapa de telas e fluxos (cobrança com "Enviou?", convite, inadimplência).
- `docs/PRD.md` — escopo, fora de escopo e fases (1 Base → 2 Migração → 3 Portal do corretor → 4 Venda).
