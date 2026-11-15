# Fase 1 — Base: design

Central do Correspondente · 15/11/2026 · status: **aprovado pelo Jean em 15/11/2026**

Este documento manda sobre os outros de `docs/` onde eles divergem; a atualização deles faz parte da fase (seção 10).

## 1. Intenção

A fase 1 monta o chão das fases 2 a 4: escritórios isolados, perfis, convites e login próprio. Ainda sem telas de cliente.

**Pronto quando:**
- usuários de dois escritórios diferentes não enxergam nada um do outro, e isso está provado por teste automatizado no banco;
- um correspondente cria o escritório sozinho pela tela, confirma o e-mail e entra. Depois de liberado, convida a funcionária (plano Com corretores), e ela aceita e entra;
- CI verde.

## 2. Decisões do Jean nesta conversa (15/11/2026)

| # | Decisão | Substitui |
|---|---|---|
| 1 | Login com **Better Auth**, não o Supabase Auth | D-25 (parte do login) e a arquitetura "navegador direto no Supabase" |
| 2 | Segredos no **CriptEnv** | Menção ao Infisical na ARQUITETURA |
| 3 | O **Worker é a API inteira**: o navegador só fala com `/api` | Princípio da ARQUITETURA §1 |
| 4 | **Cadastro aberto de escritório já na fase 1** | Proposta de que o cadastro só viria na fase 4 (P-04) |

## 3. Abordagens consideradas

**Arquitetura (escolhida: A)**
- **A — Worker como API inteira.** Better Auth no Worker; RLS continua no Postgres, recebendo o usuário pela transação; Supabase só como hospedagem do Postgres (e do Storage, na fase 2). Custa o tempo real do Supabase. Escolhida por manter a regra de acesso no banco com um login só.
- **B — Better Auth + ponte de JWT no formato do Supabase**, mantendo o navegador direto no banco e o Realtime. Descartada: dois sistemas de login colados, depende do formato de chave que o Supabase está mudando e traz o Supabase inteiro para o ambiente local.
- **Original — Supabase Auth com navegador direto.** Descartada pelo Jean (não quer o login do Supabase).

**Primeiro gestor (escolhido: cadastro aberto)**
- **Cadastro aberto agora**: tela "Criar escritório". Escolhido pelo Jean.
- **Nós criamos e convidamos** com um comando. Descartado; o comando continua existindo só para liberar contas (seção 6.3).

## 4. Objetivos

1. **Cadastro aberto** de escritório (seção 6).
2. **Login, saída e recuperação de senha** (RF-60), com e-mail confirmado antes do primeiro acesso.
3. **Convites** (RF-64, RF-65): G convida F (só no plano Com corretores); G e F convidam C. Na fase 1 o convite de corretor existe na API e nos testes; o botão "Convidar para o portal" entra na fase 2, junto com o cadastro de corretores (RF-40, RF-45).
4. **Escolher e trocar de escritório** (RF-66).
5. **Equipe e acessos**: o gestor vê os membros e os convites pendentes, convida a funcionária, reenvia convite e desativa acesso.
6. **Liberação manual de conta** por comando (D-07), até existirem o painel (RF-68) e o Asaas.
7. **Schema completo** de `docs/MODELO-DE-DADOS.md`, com as mudanças da seção 8, mais RLS e gatilhos (RN-06, RN-07, RN-11, RN-12, RN-18, RF-23, auditoria). Entra mesmo sem tela, porque RLS e testes por perfil são o critério de pronto.
8. **Ambiente local em Docker** e **CI** com jobs separados.
9. **Documentação atualizada** para a nova arquitetura (seção 10).

## 5. Não objetivos (fases seguintes)

- Telas de clientes, documentos, cobrança, corretores e VGV; importador do protótipo (fase 2).
- Upload e download de arquivos: a tabela `arquivos` e a RLS entram, mas o código de storage e a rota de link temporário ficam para a fase 2.
- Portal do corretor (fase 3).
- Asaas, troca de plano, push, lembretes, relatórios e página de venda (fase 4).
- Painel do sistema (RF-68): só o comando de liberação.
- Tempo real (seção 7.6).
- **Deploy em produção.** A infraestrutura de produção (Cloudflare, Hyperdrive, Postgres em São Paulo, provedor de e-mail) fica para antes do uso real da fase 3. *Escolha minha: o critério de pronto da fase 1 não pede produção.*

## 6. Cadastro aberto

### 6.1 Fluxo

1. **Criar escritório** (`/criar-escritorio`): nome, e-mail, senha, nome do escritório, CPF ou CNPJ do titular (validados; o Asaas vai exigir na fase 4) e plano (Simples R$ 99 / Com corretores R$ 149). Inclui a caixa de aceite dos termos (seção 6.2).
2. O Worker cria o usuário, a conta com status `pendente` e o membro gestor, e manda o e-mail de confirmação.
3. A pessoa confirma o e-mail e entra no Início vazio, com o aviso fixo **"Conta aguardando liberação"**. A conta pendente é somente leitura, porque `conta_ativa` dá falso.
4. Nós liberamos pelo comando da seção 6.3 e a conta passa a aceitar escrita.

```
┌ Criar escritório ─────────────────────┐
│ Seu nome            [               ] │
│ E-mail              [               ] │
│ Senha               [               ] │
│ Nome do escritório  [               ] │
│ CPF ou CNPJ         [               ] │
│ Plano  (•) Simples — R$ 99/mês        │
│        ( ) Com corretores — R$ 149/mês│
│ [x] Li e aceito os termos de uso      │
│              [ Criar escritório ]     │
└───────────────────────────────────────┘
```

O cadastro é uma rota nossa, `POST /api/cadastro`. Ela cria a credencial pela API interna do Better Auth e, como `app_system`, cria a conta e o gestor. Escritório só nasce por essa rota, para ninguém criar escritório sem CPF/CNPJ e sem termos.

Se a criação da conta falhar depois que o usuário já existe, quem entra sem escritório cai de novo na tela de criar escritório, só com a parte do escritório. Nenhum usuário fica preso sem saída.

**Mais de um escritório:** uma pessoa pode estar em vários escritórios (RF-66, D-14) e pode criar um escritório já estando logada. Um corretor de outra correspondente, por exemplo, abre o próprio. Nesse caso a tela mostra só a parte do escritório. Se alguém tenta se cadastrar com um e-mail que já tem conta, a resposta na tela é a mesma de um cadastro novo ("enviamos um e-mail"), para não revelar quem tem conta. O e-mail que chega diz "você já tem conta; entre para criar o escritório".

### 6.2 Termos (RF-67)

O mecanismo entra agora: a caixa de aceite, mais `termos_versao` e `termos_aceitos_em` no usuário. Quem aceita convite também aceita os termos. O texto é provisório, versão `rascunho-1`. *Escolha minha:* o texto real (controladora/operadora e compartilhamento com o corretor, D-22) precisa existir antes do uso real da fase 3.

### 6.3 Liberação manual

`pnpm conta:liberar <id-da-conta | email-do-gestor> <AAAA-MM-DD>` grava `ativa_ate` na conta. Se o e-mail for gestor de mais de uma conta, o comando não grava nada e lista as contas com os ids. Roda com `criptenv run` no ambiente desejado, usando a conexão de dono. É o mecanismo de cortesia do D-07 até o painel do sistema existir.

### 6.4 Abuso

O cadastro aberto só cria contas pendentes, sem custo e sem escrita. Nesta fase não há captcha. Fica o limite de tentativas do Better Auth, guardado no banco (um Worker não tem memória compartilhada entre instâncias). Se aparecer spam, entra o Cloudflare Turnstile.

## 7. Arquitetura

### 7.1 Visão

```
Navegador (SPA React) ──/api/*──► Worker (Hono)
                                   ├─ /api/auth/*  Better Auth
                                   └─ /api/...     rotas do app ──► Postgres (Hyperdrive em produção)
```

O Worker serve a SPA e a API na mesma origem: cookie de sessão `httpOnly`, sem CORS. Em produção, o Supabase só hospeda o Postgres (e, na fase 2, o Storage via API S3), em São Paulo.

### 7.2 Repositório

Um pacote só:

```
src/              SPA: React, React Router, TanStack Query, Zod
src/regras/       funções puras das regras (Vitest)
worker/           Hono: Better Auth, rotas /api, comando de liberação
db/migrations/    SQL versionado (dbmate): schema, RLS, gatilhos
tests/            db (RLS e gatilhos), worker (rotas), e2e (Playwright)
docker/           compose.sh, entrypoint.sh (padrão do AtelieSys)
```

Em desenvolvimento, o plugin oficial da Cloudflare para o Vite roda a SPA e o Worker juntos (`vite dev`, com o Worker no workerd).

### 7.3 Banco e acesso

São três papéis no Postgres, como no AtelieSys:

| Papel | Uso |
|---|---|
| `owner` | Migrations e o comando de liberação |
| `app_user` | Sem `BYPASSRLS`. Toda rota de domínio |
| `app_system` | `BYPASSRLS`. Só o Better Auth, nas tabelas dele, e código de sistema que recebe a conta explícita (cadastro, convites, rotinas futuras), sempre filtrando por `conta_id` no código |

- `withUser(usuarioId, fn)` abre uma transação e roda `set_config('app.usuario_id', usuarioId, true)`, que vale só para aquela transação e por isso funciona atrás de pooler em modo transação. É o mesmo padrão do `withUserDb` do AtelieSys.
- O `usuarioId` vem sempre da sessão do Better Auth, nunca do corpo do pedido.
- As funções `meu_perfil(conta)`, `meu_corretor_id(conta)` e `conta_ativa(conta)` leem `current_setting('app.usuario_id', true)`; `hoje_br()` continua igual.
- A conta ativa da sessão (`activeOrganizationId`) só filtra as consultas. Quem barra o acesso é a RLS, por linha, via `membros`: trocar o id de conta no pedido não abre nada.

### 7.4 Better Auth

*Revisto em 15/11/2026, ao planejar: sai o plugin `organization`.* Com a regra de que o navegador só usa a sessão, o plugin sobraria quase todo desligado e ainda exigiria mapear tabelas e travar campos. O AtelieSys já resolve equipe e convites com tabelas próprias sobre o Better Auth 1.7.16, e este projeto segue esse padrão.

- Versão exata **1.7.16**, com a mesma configuração de e-mail e senha do AtelieSys:
  - e-mail confirmado obrigatório, sem login automático ao confirmar;
  - aviso para quem tenta se cadastrar com e-mail que já tem conta (`onExistingUserSignUp`);
  - limite de tentativas guardado no banco;
  - uuid como id.
- **Tabelas do Better Auth com os nomes padrão** (`user`, `session`, `account`, `verification`, `rateLimit`), como no AtelieSys. O usuário ganha os campos `termosVersao`, `termosAceitosEm` e `adminSistema` (`input: false`). Só o nosso código grava esses campos, como `app_system`.
- **`contas`, `membros` e `convites` são tabelas nossas** (seção 8), lidas e gravadas só pelas nossas rotas, sob `withUser` e RLS. A exceção é o código de sistema (cadastro e aceite de convite), que roda como `app_system` com a conta explícita.
- **Escritório ativo:** vem na URL (`/api/contas/:contaId/...`) e o navegador guarda o último usado. Quem barra é a RLS por `membros`: trocar o id na URL não abre nada.
- **Convite:** o token vai no link e o banco guarda só o hash, com validade de 7 dias. Quem entra pelo convite tem o e-mail confirmado pelo próprio link, como no AtelieSys. O aceite é uma função do banco, `aceitar_convite`, que confere validade e e-mail e cria o membro.
- **Desativar acesso** grava `membros.status = 'desativado'` e não apaga a linha (RF-65). `meu_perfil` só vale para membro ativo, então a sessão de um desativado não abre dado nenhum.
- **Limites do plano (RN-18):** nossa rota de convite recusa com mensagem clara, e a garantia de verdade fica no banco: índices únicos parciais, `tg_limite_plano` em `membros` e a checagem no insert de `convites`. **Convite pendente de funcionária conta no limite**, para que dois convites não virem duas funcionárias. Conta pendente ou suspensa não convida, porque convidar é gravar.
- **Campos que só o sistema grava** (`plano`, `status_assinatura`, `ativa_ate`, `adminSistema`): `app_user` não tem permissão de update neles. Isso tem teste.

### 7.5 E-mail

O Worker não usa SMTP. O envio é por API HTTP, num único módulo de envio:
- **Local:** API de envio do Mailpit.
- **Produção:** o provedor da pendência P-08 (proposta: Resend), definido antes do deploy.

Os e-mails desta fase são confirmação de cadastro, recuperação de senha, convite e aviso de novo escritório para um corretor que já tem conta.

### 7.6 Sem tempo real (muda RNF-03)

Sem o Realtime do Supabase, o TanStack Query atualiza os dados ao voltar para a aba, depois de cada gravação e a cada 30 segundos nas telas de lista. Tempo real de verdade (Durable Objects) só se o uso real pedir.

### 7.7 Telas da fase 1

1. Criar escritório.
2. Entrar.
3. Confirme seu e-mail (com reenvio).
4. Esqueci a senha / Nova senha.
5. Aceitar convite: define a senha, ou só entra se o e-mail já tem conta, e aceita os termos.
6. Escolher escritório: aparece só para quem tem mais de um.
7. Casca do app: menu lateral que vira gaveta abaixo de 900 px (RNF-01), Início vazio e aviso fixo de conta pendente ou suspensa.
8. Equipe e acessos: só o gestor.

*Escolha minha:* Tailwind v4 + shadcn/ui com tokens claro/escuro em variáveis CSS (padrão do Jean). O visual do protótipo entra nesses tokens na fase 2, quando o código dele chegar (o mesmo código destrava a P-01).

### 7.8 Ambiente local

`docker/compose.sh` com CriptEnv pelo chaveiro do sistema, copiado do AtelieSys, e quatro serviços:
- Postgres 18;
- Mailpit;
- s3mock, já no compose para a fase 2;
- o app com Compose Watch.

O container aplica as migrations ao subir. As portas são deslocadas para não bater com os outros projetos locais, que já usam 3000, 3001, 5432, 5433, 1025/1026, 8025/8026, 8200 e 9091: app **3002**, Postgres **5435**, Mailpit **1028/8028**, s3mock **9093**. Os valores fixos de dev para os testes ficam em `tests/test-env.ts`.

## 8. Mudanças no modelo de dados

- **Dinheiro em centavos** (`bigint`), no padrão do Jean: `valor_imovel`, `valor_financiado`, `valor_avaliacao`, `entrada`, `fgts`, `subsidio`. O driver devolve `bigint` como texto; o código converte para `number` (os valores ficam bem abaixo de 2^53).
- **Percentual** continua `numeric(6,3)`. RN-09 fica: remuneração = `round(valor_financiado_centavos × percentual ÷ 100)`, em centavos inteiros, arredondando meio para cima.
- **`usuarios`** passa a ser a tabela `"user"` do Better Auth (nome padrão) com os campos extras. Saem a ligação com `auth.users` e o gatilho `tg_novo_usuario`.
- **`convites`** é tabela nova: `conta_id`, `email`, `perfil` (funcionária ou corretor), `corretor_id`, `token_hash`, `expira_em`, `aceito_em`, `revogado_em`, `convidado_por`. O status `convidado` sai de `status_membro`: convite pendente é uma linha em `convites`, e `membros.status` é `ativo` ou `desativado`.
- **`percentual_atual` sai de `contas`** e vai para `contas_config (conta_id, percentual_atual)`, com RLS só do gestor. `contas` fica legível por todo membro ativo e não guarda nada de receita.
- `contas` e `membros` seguem o modelo, com `membros.usuario_id` apontando para `"user".id` do Better Auth. Valem as mesmas restrições: único `(conta_id, usuario_id)`, um gestor e uma funcionária ativos, `check` do corretor e `tg_limite_plano`.
- O resto do modelo (`clientes`, `clientes_remuneracao`, `documentos`, `tipos_documento`, `arquivos`, `historico`, `historico_percentual`, `auditoria`, `push_inscricoes`, `eventos_asaas`, views) entra como está. `tipos_documento` nasce vazia até a P-01.

## 9. Testes e CI

- **db** (Vitest no host contra o Postgres do container, uma conexão só, para provar que nada vaza entre transações):
  - RLS: para cada perfil (G, F, C) e para um usuário de outra conta, o que lê e o que grava em cada tabela.
  - Casos obrigatórios: funcionária não lê `clientes_remuneracao` nem `percentual_atual`; corretor não lê cliente de outro corretor; contas diferentes não se enxergam; conta pendente ou suspensa não grava; conta Simples recusa funcionária e corretor.
  - Gatilhos: RN-06, RN-07, RN-11, RN-12, RN-18, RF-23.
- **worker** (rotas):
  - cadastro cria usuário, conta pendente e gestor;
  - convites respeitam plano e perfil de quem convida;
  - o gestor não muda o próprio plano nem o "ativa até";
  - a sessão de outra conta não abre dados.
- **e2e** (Playwright), um caminho feliz: criar escritório → confirmar e-mail pelo Mailpit → liberar por comando → convidar a funcionária → ela aceita pelo Mailpit e entra → aparece em Equipe e acessos.
- **unit:** `src/regras/` e validação de CPF/CNPJ.
- **CI:** GitHub Actions com jobs `app` (lint, tipos, unidade), `db` e `e2e`. Nenhum deploy nesta fase.

## 10. Documentos a atualizar nesta fase

- **DECISOES:**
  - revisar D-15 e D-25;
  - novos D-31 (Better Auth), D-32 (Worker como API inteira, sem Realtime), D-33 (cadastro aberto na fase 1, conta pendente até liberar) e D-34 (dinheiro em centavos);
  - atualizar P-04.
- **ARQUITETURA:** diagrama e §1–§6 para a nova arquitetura; segredos no CriptEnv; e-mail por HTTP.
- **MODELO-DE-DADOS:** seção 8 deste documento.
- **SRS:** RNF-03 (atualização ao voltar e a cada 30 s); RF-60 (confirmação de e-mail); RF-67 (versão provisória).
- **PRD:** a fase 1 inclui o cadastro aberto.
- **README e CLAUDE.md:** stack, comandos reais e a nova regra central (Worker → `withUser` → RLS).
- **Novo `docs/SEGREDOS.md`:** como no AtelieSys.

## 11. Fica com o builder

- Usar Hono, que é o que a documentação do Better Auth mostra para Workers, e Drizzle só para consultas, com migrations no dbmate, como no AtelieSys.
- O driver Postgres no Worker e a configuração local do Hyperdrive.
- A ferramenta dos testes de rota: o pool de Workers do Vitest ou `app.request` contra o banco de teste.
- A ordem das tarefas e a divisão em PRs, um por assunto, como o Jean prefere.

## 12. Escolhas minhas para o Jean conferir

1. Sem deploy em produção na fase 1 (seção 5).
2. Conta criada pelo cadastro nasce **pendente** e somente leitura até a liberação manual (seção 6.1).
3. Termos com texto provisório agora e o texto real antes da fase 3 (seção 6.2).
4. Sem captcha por enquanto (seção 6.4).
5. Convite de corretor só na API nesta fase; o botão vem na fase 2 com o cadastro de corretores (seção 4).
6. Tailwind + shadcn; visual do protótipo na fase 2 (seção 7.7).
7. Atualização a cada 30 s no lugar do tempo real (seção 7.6).
8. Dinheiro em centavos (seção 8).
9. Sem o plugin `organization`: o Better Auth cuida só do login; escritórios, membros e convites são tabelas e rotas nossas sob RLS, no padrão do AtelieSys (seção 7.4).
10. Desativar acesso marca o membro como desativado e não apaga a linha (seção 7.4).
11. `percentual_atual` vai para `contas_config`, só do gestor (seção 8).
12. Convite pendente de funcionária conta no limite do plano (seção 7.4).
13. Uma pessoa pode criar escritório já estando logada, e o cadastro com e-mail existente não revela que a conta existe (seção 6.1).
