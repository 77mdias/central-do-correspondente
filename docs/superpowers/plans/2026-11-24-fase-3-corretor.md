# Fase 3 — Portal do corretor e uso real: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o corretor convidado entra, vê só os clientes dele (sem CPF, contrato, cobrança nem dinheiro do escritório) e anexa documentos. Os termos ganham versão nova com novo aceite, os logs do Worker ficam ligados em produção sem dados pessoais, e o roteiro do uso real fica pronto para as 2 correspondentes.

**Architecture:** a das fases 1 e 2. A RLS decide **quais clientes** o corretor vê; as rotas do portal (`/api/contas/:contaId/portal/...`) decidem **quais campos** saem, por uma lista fechada de colunas. A SPA usa a mesma casca (`/e/:contaId`) com menu e Início próprios para o perfil corretor.

**Tech Stack:** a da fase 2. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-24-fase-3-corretor-design.md` (aprovada pelo Jean em 24/11/2026, com as escolhas da seção 12). Ler antes de cada tarefa, junto com a matriz de permissões do `docs/SRS.md` e o `docs/MODELO-DE-DADOS.md`.

## Ajustes à spec (feitos na tarefa 1)

1. **Ordem dos PRs e o texto dos termos.** O mecanismo do novo aceite não depende do texto. Por isso ele entra antes, com a versão ainda `rascunho-1`, e os testes simulam uma versão antiga gravando outro valor direto no banco. O texto `v1` e a troca de `TERMOS_VERSAO` para `v1` ficam num PR separado (PR 5), que só é mergeado depois da revisão dos sócios (P-12). Assim, uma correção no texto revisado não força um segundo aceite de quem já aceitou.
2. **Onde o aceite é exigido.** O `GET /api/eu` passa a dizer `termosPendentes`, e a SPA mostra "Termos atualizados" antes de qualquer tela com sessão. As rotas de domínio não recusam quem está com o aceite pendente: o registro de versão e data (RF-67) é o que importa, e um bloqueio no Worker só criaria um estado a mais para testar em cada rota. Fica escrito na spec, seção 8.
3. **Logs sem dados pessoais.** Hoje o `onError` do Worker faz `console.error(err)`. Um erro do Postgres traz em `detail` os valores da linha (o CPF, por exemplo, numa violação de `check`), e um erro do Resend pode trazer o e-mail do destinatário. A tarefa 6 troca todos os `console.error` por uma função que registra só nome, código, constraint e rota.

## Global Constraints

- Tudo o que vale nas fases 1 e 2: versões **exatas** no `package.json`; nada de `.env` com valores; português em UI, docs, erros e commits; "hoje" é `hoje_br()` no banco e `hojeBr()` na SPA; o `usuarioId` vem só da sessão.
- **Colunas do portal** (lista fechada, igual na rota e no tipo `ClientePortal`):
  - `id`, `nome`, `whatsapp`, `email`, `modalidade`, `etapa`, `valorImovelCentavos`, `valorFinanciadoCentavos`, `criadoEm`, `atualizadoEm`;
  - `documentos` (data de recebimento por tipo) e `anexos` (quantidade por tipo).
  - Nada mais. Em especial, **nunca**: `cpf`, `observacoes`, `numeroContrato`, `dataAssinatura`, `proximaCobranca`, `intervaloCobranca`, `qtdCobrancas`, `ultimaCobranca`, `corretorId`, `valorAvaliacaoCentavos`, `entradaCentavos`, `fgtsCentavos`, `subsidioCentavos`, `anexosApagarEm`, `finalizadoEm` e qualquer `pct*` ou `remuneracao*`.
- **Histórico do portal:** só o que a RLS libera (`etapa` e `documento`); a rota não filtra de novo, para o teste provar que a regra está no banco.
- **Portal:** responde **404** a quem não é corretor **ativo** da conta, com o mesmo corpo de um cliente inexistente.
- **Constantes:** lista atualiza a cada **30 s** (D-32); "parado" a partir de **7** dias; link de arquivo de **5 min**.
- **Termos:** a versão atual é `TERMOS_VERSAO` de `src/regras/planos.ts`; aceite em `"user"."termosVersao"` e `"termosAceitosEm"`, gravado como `app_system` e só para o usuário da sessão.
- **Logs:** nunca nome, CPF, e-mail, telefone, conteúdo de ficha, nome de arquivo nem o `detail` de erro do Postgres.
- **PRs:** um por grupo de tarefas, cada um saindo de `main` atualizada e aberto só com o CI verde:
  - **PR 1:** tarefas 1–2 (docs e banco);
  - **PR 2:** tarefas 3–7 (tipos, API do portal, anexo do corretor, logs e aceite dos termos);
  - **PR 3:** tarefas 8–10 (telas do corretor e "Termos atualizados");
  - **PR 4:** tarefas 11–12 (e2e e roteiro do uso real);
  - **PR 5:** tarefa 13 (texto `v1` dos termos). **Só é mergeado depois da revisão dos sócios (P-12).**

## Review Focus

Casos que a spec implica e que nenhum teste de tarefa pega por acaso. Cada linha tem teste na tarefa dona:

1. **Lista fechada de campos:** o teste compara o **conjunto exato** de chaves de cada cliente do portal com a lista acima, e não só a ausência das proibidas. Uma coluna nova em `clientes` não pode vazar para o corretor por descuido (tarefa 4).
2. **Corretor desativado:** depois de a gestora desativar o acesso, o portal dá 404, o anexo dá 404 e o link de arquivo dá 404, sem gravar auditoria (tarefas 4 e 5).
3. **Dois escritórios:** um corretor que atende as contas A e B vê, em cada uma, só os clientes dele naquela conta; o id de um cliente de B pela URL de A dá 404 (tarefa 4).
4. **Conta pendente ou suspensa:** o corretor lê, mas anexar dá 403 e a tela avisa que a conta está somente leitura (tarefas 5 e 9).
5. **Nenhuma rota do escritório na casca do corretor:** com o corretor logado, a SPA não chama `…/clientes`, `…/corretores` nem `…/historico`. O e2e conta as respostas 404 de `/api` e espera zero (tarefas 8 e 11).
6. **Aceite dos termos:** `POST /api/termos/aceitar` muda só o usuário da sessão, é idempotente e não aceita corpo com outro `usuarioId`. Cadastro e convite já gravam a versão atual, e quem acabou de entrar não vê "Termos atualizados" (tarefas 7 e 10).
7. **Logs:** um erro do Postgres com `detail` contendo um CPF e um erro de e-mail contendo um endereço saem nos logs sem o CPF e sem o endereço (tarefa 6).
8. **"Anexado por":** o histórico que a gestora vê traz o nome do corretor (o `name` do usuário dele), não "sistema" (tarefa 5).

---

### Task 1: Documentação e ajustes da spec

**Files:**
- Modify: `docs/superpowers/specs/2026-11-24-fase-3-corretor-design.md` (status "aprovada"; seção 8 com os ajustes 1 e 2 acima), `docs/MODELO-DE-DADOS.md`, `docs/ARQUITETURA.md`, `docs/SRS.md`, `docs/FLUXOS.md`, `CLAUDE.md`

- [ ] **Step 1: Spec** — status "aprovada pelo Jean em 24/11/2026"; seção 8 com o PR separado do texto `v1` e o aceite exigido pela SPA (ver "Ajustes à spec").
- [ ] **Step 2: MODELO-DE-DADOS** — política `auditoria_registrar` com `ver` também do corretor no próprio cliente.
- [ ] **Step 3: ARQUITETURA:**
  - rotas `GET /api/contas/:contaId/portal/clientes`, `GET …/portal/clientes/:id` e `POST /api/termos/aceitar`;
  - `GET /api/eu` com `termosPendentes`;
  - Workers Logs em produção e a regra dos logs sem dados pessoais.
- [ ] **Step 4: SRS** — o RF-83 cita a D-41; o RF-67 fala da versão `v1` e do novo aceite no próximo acesso.
- [ ] **Step 5: FLUXOS** — §6 com "a lista atualiza a cada 30 s" no lugar de "em tempo real".
- [ ] **Step 6: CLAUDE.md** — "Fase 3 em implementação", com o link do plano.
- [ ] **Step 7: Commit**

```bash
git add docs CLAUDE.md && git commit -m "docs: fase 3 alinhada ao plano (termos em PR próprio, logs sem dados pessoais)"
```

---

### Task 2: Migration da fase 3 (auditoria de leitura do corretor)

**Files:**
- Create: `db/migrations/20261124120000_fase_3.sql`
- Modify: `tests/db/rls.test.ts` (ou `tests/db/fase-3.test.ts` novo, no mesmo formato do `fase-2.test.ts`)

**Interfaces:**
- Produces: `auditoria_registrar` recriada:
  - `acao = 'ver'`: `sou_escritorio(conta_id)` **ou** (`entidade = 'cliente'` e `meu_cliente_de_corretor(conta_id, entidade_id)`);
  - `acao = 'baixar'`: igual à fase 2;
  - `usuario_id = meu_usuario_id()` nos dois casos.

- [ ] **Step 1: Escrever os testes**

```ts
test("corretor registra 'ver' do próprio cliente", /* como(cA) insert auditoria ver cliente do cA → ok */);
test("corretor não registra 'ver' de cliente de outro corretor", /* cliente do cA2 → erro de RLS */);
test("corretor não registra 'ver' de cliente direto", /* corretor_id null → erro de RLS */);
test("corretor desativado não registra 'ver'", /* membros.status = 'desativado' → erro de RLS */);
test("corretor não registra 'ver' com entidade 'arquivo'", /* entidade_id de um arquivo do próprio cliente → erro de RLS */);
test("os casos de corretor da fase 1 continuam", /* lê só os próprios clientes; histórico só etapa e documento; anexa só nos próprios; não remove */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:db`
Expected: FAIL nos testes novos de `ver`.

- [ ] **Step 3: Implementar a migration** com `migrate:down` que devolve a política da fase 2.
- [ ] **Step 4: Rodar**

Run: `pnpm test:db`
Expected: PASS.

- [ ] **Step 5: Commit e PR 1**

```bash
git add db tests/db && git commit -m "feat: corretor registra a leitura da ficha na auditoria"
```

Abrir o PR 1 (tarefas 1–2).

---

### Task 3: Tipos e regras do portal

**Files:**
- Modify: `src/tipos-api.ts` (inclui `Eu`), `src/regras/processo.ts`, `src/regras/processo.test.ts`

**Interfaces:**
- Produces:
  - `CAMPOS_PORTAL` (array `as const` com as chaves da lista fechada) e `ClientePortal = Pick<ClienteLista, (typeof CAMPOS_PORTAL)[number]>`;
  - `FichaPortal = { cliente: ClientePortal; anexos: ArquivoResumo[]; historico: NotaHistorico[] }`;
  - `Eu` com `termosPendentes: boolean`;
  - `filtrarPortal(lista, { busca, etapa })` e `ordenarPortal(lista, agora)`: ativos primeiro, depois os parados há mais tempo, depois por nome;
  - `ativo`, `faltando` e `parado` passam a aceitar `ClientePortal` (os `Pick` já usados bastam; só `parado` precisa trocar `Cliente` por `Pick<ClienteLista, "etapa" | "atualizadoEm">`).

- [ ] **Step 1: Escrever os testes** — `filtrarPortal` por nome sem acento e sem caixa ("joao" acha "João"); por etapa; `ordenarPortal` com um finalizado, um parado há 10 dias e um atualizado hoje.
- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 3: Implementar.** A busca usa a mesma normalização do `filtrar` do escritório.
- [ ] **Step 4: Rodar**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: tipos e regras do portal do corretor (RF-80)"
```

---

### Task 4: Rotas do portal

**Files:**
- Create: `worker/rotas/portal.ts`, `tests/worker/portal.test.ts`
- Modify: `worker/rotas/comum.ts` (`exigirCorretor`), `worker/app.ts`, `tests/worker/cenario.ts` (`corretorLogado`)

**Interfaces:**
- Consumes: `CAMPOS_PORTAL`, `ClientePortal`, `FichaPortal` (tarefa 3).
- Produces:
  - `exigirCorretor(db, conta)`: 404 se `meu_perfil(conta)` não é `corretor` (corretor desativado já não tem perfil);
  - `SELECT_PORTAL`: o `SELECT_CLIENTE` reduzido às colunas da lista fechada, com os mesmos `documentos` e `anexos`;
  - `GET /api/contas/:contaId/portal/clientes` → `ClientePortal[]` (a RLS filtra por `corretor_id`);
  - `GET /api/contas/:contaId/portal/clientes/:id` → `FichaPortal` e grava `auditoria` `ver`;
  - `corretorLogado(e, nome?)` no cenário: a gestora cadastra o corretor com e-mail, convida, e o corretor aceita pelo token do e-mail; devolve `{ cookie, corretorId, usuarioId }`.

- [ ] **Step 1: Escrever os testes**

```ts
test("portal lista só os clientes do corretor, com a lista fechada de campos", /* 2 clientes dele, 1 de outro corretor, 1 direto → 2; Object.keys(c).sort() == [...CAMPOS_PORTAL].sort() */);
test("ficha do portal: sem notas nem cobranças no histórico", /* gestora anota, registra cobrança, muda a etapa e anexa; o corretor vê só a etapa e o anexo */);
test("ficha do portal grava 'ver' na auditoria", /* gestora lê auditoria: acao ver, usuario do corretor */);
test("cliente de outro corretor pela URL dá 404", );
test("cliente de outra conta pela URL dá 404", /* corretor que atende A e B: id de B na URL de A */);
test("gestora e funcionária recebem 404 no portal", );
test("corretor recebe 404 nas rotas do escritório", /* GET clientes, GET clientes/:id, GET historico, GET corretores, GET vgv, POST clientes */);
test("corretor desativado: portal 404", );
```

Observação para o teste da ficha: o "Cliente cadastrado · …" é nota (tipo `nota`), então o corretor **não** o vê. O histórico dele começa na primeira mudança de etapa ou anexo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker`
Expected: FAIL.

- [ ] **Step 3: Implementar.** O `SELECT_PORTAL` é escrito à mão, coluna por coluna, e não derivado do `SELECT_CLIENTE`, para que uma coluna nova no escritório não entre no portal sem alguém decidir.
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker tests/worker && git commit -m "feat: rotas do portal do corretor (RF-80, RF-81, RF-83)"
```

---

### Task 5: Anexo do corretor

**Files:**
- Modify: `worker/rotas/arquivos.ts`, `tests/worker/arquivos.test.ts`

**Interfaces:**
- Produces: `existeCliente(db, conta, id)` (`select 1 from clientes where conta_id = $1 and id = $2`, sob RLS) no lugar do `lerCliente` no `POST …/clientes/:id/arquivos`. O resto da rota não muda.

- [ ] **Step 1: Escrever os testes**

```ts
test("corretor anexa no próprio cliente: documento marcado e 'Anexado por {nome}'", /* gestora lê a ficha: documentos.rg preenchido; histórico tipo documento com o nome do corretor */);
test("corretor não anexa em cliente de outro corretor (404)", );
test("corretor não remove anexo, nem o que ele mesmo enviou (403)", );
test("corretor abre o link de um anexo do próprio cliente e grava 'baixar'", );
test("corretor desativado: anexar e link dão 404, sem auditoria", );
test("conta pendente: corretor anexar dá 403", );
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker`
Expected: FAIL em pelo menos um (a troca de `lerCliente` é de minimização; se todos passarem já, registrar no commit que a rota já atendia e manter os testes).

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker tests/worker && git commit -m "feat: corretor anexa documentos dos próprios clientes (RF-82)"
```

---

### Task 6: Logs sem dados pessoais e Workers Logs

**Files:**
- Create: `worker/log.ts`, `worker/log.test.ts`
- Modify: `worker/app.ts`, `worker/index.ts`, `worker/rotinas/anexos.ts`, `worker/rotas/arquivos.ts`, `worker/email.ts` (erro do envio só com o status HTTP), `wrangler.jsonc`

**Interfaces:**
- Produces:
  - `registrarErro(onde: string, e: unknown, extra?: Record<string, string | number>)`: um `console.error` com um objeto `{ onde, nome, mensagem, codigo, constraint, ...extra }`. A `mensagem` só sai para erros que não são do Postgres nem do envio de e-mail; o `detail`, o `where` e a `stack` de erro do Postgres nunca saem;
  - `extra` aceita só ids (uuid) e números, nunca nome de arquivo nem e-mail;
  - `wrangler.jsonc`, em `env.production`: `"observability": { "enabled": true, "head_sampling_rate": 1 }`.

- [ ] **Step 1: Escrever os testes**

```ts
test("erro do Postgres sai sem detail", /* { code: '23514', constraint: 'clientes_cpf_check', detail: 'Failing row contains (..., 12345678909, ...)' } → saída sem '12345678909' */);
test("erro de e-mail sai sem o endereço", /* Error('422 {"to":"maria@x.com"}') vindo do envio → sem 'maria@x.com' */);
test("extra com texto que não é id é descartado", );
test("onError do app usa registrarErro", /* app.request numa rota que lança erro com detail → console.error espiado sem o detail */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test && pnpm test:worker`
Expected: FAIL.

- [ ] **Step 3: Implementar** e trocar todos os `console.error` e `console.log` do Worker (`grep -rn "console\." worker`). O `console.log("rotina de anexos", r)` continua, porque `r` só tem contagens.
- [ ] **Step 4: Rodar**

Run: `pnpm test && pnpm test:worker && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker wrangler.jsonc && git commit -m "feat: logs do Worker sem dados pessoais e Workers Logs em produção"
```

---

### Task 7: Novo aceite dos termos (mecanismo)

**Files:**
- Create: `worker/rotas/termos.ts`, `tests/worker/termos.test.ts`
- Modify: `worker/rotas/eu.ts`, `worker/app.ts`

**Interfaces:**
- Consumes: `TERMOS_VERSAO` (continua `rascunho-1` até o PR 5).
- Produces:
  - `GET /api/eu` com `termosPendentes = ("termosVersao" is distinct from TERMOS_VERSAO)`, lido como `app_system` pelo id da sessão;
  - `POST /api/termos/aceitar` → `204`; `update "user" set "termosVersao" = $1, "termosAceitosEm" = now() where id = <sessão>`; sem sessão, 401; o corpo é ignorado.

- [ ] **Step 1: Escrever os testes**

```ts
test("recém-cadastrada não tem termos pendentes", );
test("usuário com versão antiga tem termos pendentes", /* update termosVersao = 'antiga' pelo poolSystem */);
test("aceitar grava a versão atual e a data, só para quem está na sessão", /* outro usuário com 'antiga' continua 'antiga' */);
test("aceitar é idempotente e ignora corpo com outro usuarioId", );
test("aceitar sem sessão dá 401", );
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker`
Expected: FAIL.

- [ ] **Step 3: Implementar.** A rota usa `pools.system` (o papel `app_user` não tem update em `"user"`), sempre com o id da sessão no `where`.
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 5: Commit e PR 2**

```bash
git add worker tests/worker && git commit -m "feat: novo aceite dos termos quando a versão muda (RF-67)"
```

Abrir o PR 2 (tarefas 3–7).

---

### Task 8: Casca e rotas por perfil

**Files:**
- Modify: `src/componentes/Casca.tsx`, `src/rotas.tsx`, `src/consultas-escritorio.ts`, `src/consultas-portal.ts` (novo)

**Interfaces:**
- Produces:
  - `usePortalClientes(conta)` e `useFichaPortal(conta, id)` (`refetchInterval: 30_000` na lista), com chaves próprias (`["portal", conta]`, `["portal-ficha", conta, id]`);
  - `useClientes(conta, { ativo })`: a casca só liga a consulta do escritório quando o perfil é gestor ou funcionária;
  - menu do corretor: "Meus clientes" (com o contador de clientes ativos) e "Trocar de escritório" se houver mais de um;
  - rota índice: `MeusClientes` para o corretor, `Inicio` para o escritório;
  - `clientes`, `cobrar`, `corretores`, `vgv`, `importar` e `equipe` levam o corretor de volta a `/e/:contaId`;
  - painel lateral: `PainelFichaPortal` para o corretor, `PainelFicha` para o escritório.

- [ ] **Step 1: Implementar** (as telas novas entram na tarefa 9; aqui, um `MeusClientes` provisório com o título).
- [ ] **Step 2: Conferir no navegador** — corretor convidado pela tela de Corretores: entra, vê o menu dele, e a aba Rede das ferramentas do navegador não mostra nenhum 404 de `/api`.
- [ ] **Step 3: Rodar**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: casca do corretor com menu e rotas próprias (RF-84)"
```

---

### Task 9: Meus clientes e ficha do portal

**Files:**
- Create: `src/telas/MeusClientes.tsx`, `src/telas/ficha/FichaPortal.tsx`, `src/telas/ficha/PainelFichaPortal.tsx`
- Modify: `src/telas/ficha/Documentos.tsx`

**Interfaces:**
- Consumes: `filtrarPortal`, `ordenarPortal`, `faltando`, `parado` (tarefa 3); `usePortalClientes`, `useFichaPortal` (tarefa 8).
- Produces:
  - **Meus clientes (RF-80):** busca por nome; filtro por etapa; cada linha com nome, etapa, "há N dias" (em vermelho a partir de 7) e "N documentos pendentes"; vazio: "Nenhum cliente seu neste escritório ainda.";
  - **Ficha do portal (RF-81 a RF-83):** nome, WhatsApp (link `wa.me`), e-mail, modalidade, etapa, valor do imóvel e financiado, em leitura; checklist; histórico;
  - `Documentos` recebe `cliente: Pick<ClienteLista, "id" | "documentos">`, `anexos` e as permissões `podeMarcar`, `podeAnexar`, `podeRemover` no lugar de `podeGravar`. O escritório passa as três iguais a `podeGravar`; o corretor passa `podeMarcar = false`, `podeRemover = false` e `podeAnexar = escritorio.ativa`. Depois de anexar, o corretor invalida as chaves do portal, não as do escritório;
  - conta pendente ou suspensa: o aviso de conta que já existe na casca, e "Anexar" some.

- [ ] **Step 1: Implementar**, com os tokens de `src/index.css` e os componentes de `src/componentes/ui.tsx`. Textos curtos, no mesmo tom das telas do escritório.
- [ ] **Step 2: Conferir no navegador** — desktop e celular (375 px): lista, busca, filtro, ficha, anexar um PDF e uma foto, abrir o anexo. Do lado da gestora, o documento recebido e "Anexado por {corretor}" no histórico.
- [ ] **Step 3: Rodar**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: Meus clientes e ficha do portal do corretor (RF-80 a RF-83)"
```

---

### Task 10: Tela "Termos atualizados"

**Files:**
- Create: `src/telas/TermosAtualizados.tsx`
- Modify: `src/componentes/Sessao.tsx`

**Interfaces:**
- Consumes: `Eu.termosPendentes`, `POST /api/termos/aceitar` (tarefa 7).
- Produces: `ExigeSessao` mostra `TermosAtualizados` no lugar de `children` enquanto `termosPendentes`. A tela tem:
  - título "Termos atualizados" e uma frase dizendo o que mudou;
  - links para `/termos` e `/privacidade` (abrem em aba nova);
  - caixa "Li e aceito os Termos de Uso e a Política de Privacidade" e o botão "Continuar", desligado até marcar;
  - ao aceitar, invalida `useEu` e segue para a tela pedida;
  - "Sair" para quem não quer aceitar.

- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Conferir no navegador** — usuário com `termosVersao = 'antiga'` (pelo banco local) entra, aceita e chega no escritório; no banco, a versão atual e a data.
- [ ] **Step 3: Rodar**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit e PR 3**

```bash
git add src && git commit -m "feat: tela de novo aceite dos termos (RF-67)"
```

Abrir o PR 3 (tarefas 8–10).

---

### Task 11: E2E da fase 3

**Files:**
- Create: `tests/e2e/fase-3.spec.ts`
- Modify: `tests/e2e/ajudantes.ts` (se precisar de um ajudante para o corretor)

- [ ] **Step 1: Escrever o teste** (caminho feliz da spec, seção 10):
  1. a gestora cadastra o corretor com e-mail e dois clientes, um dele e um direto;
  2. convida o corretor pela ficha dele;
  3. o corretor aceita pelo Mailpit, cai em "Meus clientes" e vê só o cliente dele;
  4. na ficha: não aparece o CPF que a gestora preencheu, nem "Observações", nem "Cobrança";
  5. ele anexa um PDF no RG e o item fica marcado;
  6. a gestora abre a ficha: RG recebido e "Anexado por {corretor}" no histórico;
  7. durante todo o teste do corretor, nenhuma resposta 404 de `/api` (`page.on("response")`).

  Mais um teste curto de termos: usuária com `termosVersao = 'antiga'` (pelo `URL_OWNER_E2E`) entra, vê "Termos atualizados", aceita e chega no escritório.
- [ ] **Step 2: Rodar**

Run: `pnpm test:e2e`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests && git commit -m "test: e2e do portal do corretor e do novo aceite"
```

---

### Task 12: Roteiro do uso real

**Files:**
- Create: `docs/USO-REAL.md`
- Modify: `CLAUDE.md` (mapa da documentação)

- [ ] **Step 1: Escrever** a lista da spec (seção 9) como checklist para o Jean e o William, com os comandos e onde clicar em cada passo:
  - Supabase: plano pago e backup diário (onde conferir); Oregon pausado;
  - por correspondente: cadastro, `pnpm conta:liberar`, republicar o protótipo, exportar, importar, conferir os números (lista do que comparar: total de clientes, por etapa, por corretor, documentos recebidos, VGV do mês), reenviar anexos dos processos ativos;
  - convites de funcionária e corretores;
  - **Workers Logs:** onde ver no painel da Cloudflare, como filtrar por `onde` e o que fazer com cada tipo de erro;
  - durante as 2 semanas: canal de relato, o que é "bloqueio" (não consegue cadastrar, anexar, cobrar ou entrar) e o que vai para a lista.
- [ ] **Step 2: Commit e PR 4**

```bash
git add docs CLAUDE.md && git commit -m "docs: roteiro do uso real da fase 3"
```

Abrir o PR 4 (tarefas 11–12).

---

### Task 13: Texto `v1` dos termos e da política

**Files:**
- Modify: `src/telas/TermosPrivacidade.tsx`, `src/regras/planos.ts` (`TERMOS_VERSAO = "v1"`), `src/telas/TermosAtualizados.tsx` (a frase do que mudou), `docs/DECISOES.md` (P-12 fechada, com a data da revisão)

- [ ] **Step 1: Escrever o rascunho** a partir da spec, seção 8:
  - a correspondente é a **controladora** dos dados dos clientes dela; a Central é **operadora**;
  - dados e documentos do cliente compartilhados com o corretor que o indicou (D-22);
  - anexos apagados 30 dias depois da assinatura do contrato, com aviso 5 dias antes (D-21, P-07);
  - dados guardados no Brasil;
  - cada pessoa usa o próprio acesso, sem dividir senha;
  - direitos do titular (LGPD, art. 18) e como pedir; contato do encarregado (**a preencher pelos sócios**);
  - o que acontece com os dados quando a assinatura acaba (**a decidir pelos sócios**, sem inventar prazo).
- [ ] **Step 2: Abrir o PR 5 como rascunho** e pedir a revisão dos sócios, de preferência com um advogado. Eu não sou essa revisão.
- [ ] **Step 3: Aplicar as correções** da revisão no mesmo PR.
- [ ] **Step 4: Rodar**

Run: `pnpm test && pnpm test:worker && pnpm test:e2e`
Expected: PASS (os testes usam `TERMOS_VERSAO`, não o texto fixo).

- [ ] **Step 5: Commit**

```bash
git add src docs && git commit -m "feat: termos de uso e política de privacidade v1 (RF-67, fecha a P-12)"
```

Tirar o PR 5 de rascunho só com a revisão dos sócios feita. Depois do merge, quem aceitou `rascunho-1` vê "Termos atualizados" no próximo acesso.

---

## Critério de pronto (spec, seção 1)

- [ ] PRs 1 a 4 mergeados com CI verde (portal provado no banco, nas rotas e no navegador).
- [ ] PR 5 mergeado depois da revisão dos sócios.
- [ ] Roteiro de `docs/USO-REAL.md` cumprido até "convites".
- [ ] As 2 correspondentes usando o app por 2 semanas sem bloqueio.
