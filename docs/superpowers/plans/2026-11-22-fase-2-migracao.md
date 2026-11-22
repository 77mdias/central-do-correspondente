# Fase 2 — Migração: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a rotina inteira do escritório no app (Início, Clientes, ficha, documentos com anexos, Cobrar hoje com "Enviou?", Corretores, VGV), a importação do JSON do protótipo e a exclusão programada de anexos, tudo com RLS provada por teste.

**Architecture:** mesma da fase 1. A SPA só fala com `/api`; toda rota de domínio roda em `withUser(pools.app, usuarioId, fn)` e a RLS decide. Os anexos vão para o S3 (Supabase Storage em produção, s3mock no desenvolvimento) passando pelo Worker. As regras de exibição (ativo, parado, cobrança, mensagens) são funções puras em `src/regras/`, copiadas do protótipo regra por regra. Remuneração e VGV vêm de `vw_remuneracao`.

**Tech Stack:** a da fase 1, mais uma biblioteca de assinatura S3 v4 para Workers (`aws4fetch`) e uma de conversão de HEIC no navegador (`heic2any`), carregada só quando precisa.

**Spec:** `docs/superpowers/specs/2026-11-22-fase-2-migracao-design.md` (aprovada pelo Jean em 22/11/2026). Ler antes de cada tarefa, junto com `docs/MODELO-DE-DADOS.md`, `docs/SRS.md` e `docs/prototipo/README.md`. Para qualquer regra de tela, o protótipo (`docs/prototipo/prototipo.html`) é a referência: abrir a função citada e reproduzir o comportamento.

## Ajuste à spec (feito na tarefa 1)

A spec manda a importação gravar como `app_user`, com a RLS valendo, e uma função `marcar_importacao` para os campos de `contas`. Só que três políticas da fase 1 impedem isso:
- `historico_anotar` só aceita `tipo in ('nota', 'cobranca')` com `usuario_id = meu_usuario_id()`, e a importação precisa da nota `sistema` e do histórico original;
- `historico_percentual` não tem insert para `app_user`;
- `contas` não tem update desses campos para `app_user`.

**Troca:** a importação vira **uma função SQL**, `importar_prototipo(conta uuid, dados jsonb)`, `security definer`, chamada pela rota sob `withUser`. A função:
- confere `meu_perfil(conta) = 'gestor'`, `conta_ativa(conta)`, conta vazia, ainda não importada e `origem` livre;
- liga `app.importando`;
- grava tudo numa transação só.

O Worker entrega `dados` já convertido e validado pelo esquema Zod de `src/regras/importacao.ts`, o mesmo da prévia. Resultado: uma transação, a regra de acesso no banco e nenhuma política afrouxada. A tarefa 1 atualiza as seções 10.2 e 12 da spec com isso. `marcar_importacao` deixa de existir.

## Global Constraints

- Tudo o que vale na fase 1: versões **exatas** no `package.json`; Node 24 e pnpm; nada de `.env` com valores; português em UI, docs, erros e commits; dinheiro em centavos (`bigint`, sufixo `_centavos`); percentual `numeric(6,3)`; "hoje" é `hoje_br()`; o `usuarioId` só da sessão.
- **"Hoje" na SPA** é `hojeBr()` de `src/regras/datas.ts`, ou seja, o dia em `America/Sao_Paulo`. Nunca `new Date()` puro para decidir dia.
- **Constantes do protótipo:**
  - `STALE` = **7** dias;
  - intervalos de cobrança **1, 2, 3, 5 e 7**;
  - salvamento **700 ms** depois de parar de digitar;
  - histórico sem limite (D-20).
- **Listas e cards:** Início mostra até **6** cobranças, até **6** parados, até **6** com documento faltando (com os 3 primeiros documentos), até **8** linhas por origem e as últimas **7** atualizações.
- **Anexos:**
  - PDF até **20 MB** (20.971.520 bytes);
  - JPG, PNG, WebP e HEIC;
  - fotos acima de **2,5 MB** reduzidas para **2.200 px** em JPG **0,85**;
  - link temporário de **5 min**.
- **Exclusão programada:** aviso **5 dias** antes (P-07), exclusão no dia de `anexos_apagar_em`. O cron roda às **6h UTC** (3h de Brasília).
- **S3:** bucket `documentos`; caminho `conta_id/cliente_id/arquivo_id.ext`. Variáveis `S3_ENDPOINT`, `S3_REGIAO` e `S3_BUCKET` (em `vars`) e `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` (segredos). No desenvolvimento, o s3mock fica na porta **9093**.
- **Importação:** só `formato: "central-prototipo"` e `versao: 1`; conta vazia; uma vez por conta; `contas.prototipo_origem` único.
- **PRs:** um por grupo de tarefas, cada um saindo de `main` atualizada e aberto só com o CI verde:
  - **PR 1:** tarefas 1–5 (docs, banco e regras);
  - **PR 2:** tarefas 6–11 (API, anexos e cron);
  - **PR 3:** tarefas 12–14 (telas de clientes, ficha e cobrança);
  - **PR 4:** tarefas 15–16 (corretores, VGV, importação e botão no protótipo);
  - **PR 5:** tarefa 17 (e2e).

## Review Focus

Casos que a spec implica e que nenhum teste de tarefa pega por acaso. Cada linha tem teste na tarefa dona:

1. **Virada do dia:** às 22h de Brasília (1h UTC do dia seguinte), "cobrar hoje", "atrasada" e "parado" usam o dia de Brasília, na SPA e no banco (tarefas 4 e 7).
2. **Funcionária e dinheiro:** `GET …/clientes/:id` nunca traz `remuneracao` para F; `GET …/vgv` e `PUT …/percentual` dão 403 para F. A resposta de `GET …/clientes` não tem nenhum campo de percentual (tarefas 7 e 9).
3. **Salvamento simultâneo:** dois `PATCH` em campos diferentes do mesmo cliente, um logo depois do outro, mantêm os dois valores (tarefa 7).
4. **Upload que falha no S3:** nenhuma linha em `arquivos`, o documento não fica marcado e o histórico não registra nada, porque tudo está na mesma transação (tarefa 8).
5. **Importação:**
   - a mesma `origem` em outra conta é recusada;
   - um erro no meio não deixa nada gravado;
   - `criado_em`, `atualizado_em`, `data_assinatura`, `pct_contrato` e as datas do histórico ficam iguais às do arquivo (tarefas 3 e 10).
6. **Arquivo de outra conta:** `GET …/arquivos/:id/link` com o id de outra conta dá 404 e não grava auditoria (tarefa 8).
7. **Conta pendente ou suspensa:** todas as escritas novas dão 403; as telas mostram somente leitura (tarefas 7 a 10 e 12).
8. **`config/geral` no protótipo:** depois de exportar, mudar o percentual no protótipo não apaga a `origem` (tarefa 16).

---

### Task 1: Documentação e ajuste da spec

**Files:**
- Modify: `docs/superpowers/specs/2026-11-22-fase-2-migracao-design.md` (status "aprovada", seções 10.2 e 12 com a função `importar_prototipo`), `docs/MODELO-DE-DADOS.md`, `docs/ARQUITETURA.md`, `docs/SRS.md`, `docs/FLUXOS.md`, `docs/SEGREDOS.md`, `CLAUDE.md`

- [ ] **Step 1: Spec** — status "aprovada pelo Jean em 22/11/2026"; trocar a gravação como `app_user` e o `marcar_importacao` pela função `importar_prototipo` (ver "Ajuste à spec" acima).
- [ ] **Step 2: MODELO-DE-DADOS:**
  - trocar a seção 8 pelo mapeamento da spec (10.3);
  - acrescentar `clientes.anexos_aviso_em`, `contas.prototipo_origem`, o `check` de tamanho em `arquivos`, a política de insert em `auditoria` (`ver` e `baixar`), a marca `app.importando` nos gatilhos (§6) e a função `importar_prototipo` (§4).
- [ ] **Step 3: ARQUITETURA** — tabela de rotas da spec (seção 7):
  - `POST /api/importar` vira `POST /api/contas/:contaId/importacao`;
  - o link de arquivo passa para `/api/contas/:contaId/arquivos/:id/link`;
  - S3 pelo Worker;
  - cron de anexos com aviso 5 dias antes.
- [ ] **Step 4: SRS** — o RF-36 deixa de citar a pendência e passa a citar a D-39; o RF-90 cita o botão de exportar e a regra "uma cópia, um escritório" (D-40).
- [ ] **Step 5: FLUXOS** — §4 com o detalhe da seção 9 da spec ("Cobrança aberta"); §8 com o atalho "Importar do protótipo" no Início vazio.
- [ ] **Step 6: SEGREDOS** — as variáveis S3; como criar o bucket `documentos` (privado) e a chave S3 no Supabase (*Storage → S3 Connection*); valores de teste.
- [ ] **Step 7: CLAUDE.md** — "Fase 2 em implementação", com o link do plano.
- [ ] **Step 8: Commit**

```bash
git add docs CLAUDE.md && git commit -m "docs: fase 2 alinhada ao plano (importação por função SQL, rotas e S3)"
```

---

### Task 2: Migration do schema da fase 2

**Files:**
- Create: `db/migrations/20261122120000_fase_2.sql`
- Modify: `tests/db/ajudantes.ts` (o cenário não apaga nem recria `tipos_documento`), `tests/db/gatilhos.test.ts` (sai o insert de `cpf` em `tipos_documento`), `tests/db/schema.test.ts`, `tests/db/rls.test.ts`

**Interfaces:**
- Produces:
  - `tipos_documento` populada com os 12 tipos de `docs/MODELO-DE-DADOS.md`;
  - `clientes.anexos_aviso_em date`;
  - `contas.prototipo_origem text unique`;
  - `arquivos` com `check (tamanho between 1 and 20971520)`;
  - `grant insert on auditoria to app_user` e a política `auditoria_registrar`:
    - `acao in ('ver','baixar')`;
    - `usuario_id = meu_usuario_id()`;
    - `sou_escritorio(conta_id) or meu_cliente_de_corretor(conta_id, entidade_id)`, este último só para `baixar`.

- [ ] **Step 1: Escrever os testes**

```ts
test("os 12 tipos estão no banco na ordem do protótipo", /* select codigo order by grupo desc, ordem = ['rg','cpf','civil','resid','renda','ctps','ir','fgts','matr','iptu','vend','form'] */);
test("arquivo acima de 20 MB é recusado", /* insert tamanho 20971521 → 23514 */);
test("prototipo_origem não repete", /* duas contas com a mesma origem → 23505 */);
test("funcionária registra 'ver' na própria conta", /* como(fA) insert auditoria ver contaA → ok */);
test("ninguém registra 'alterar' à mão", /* como(gA) insert acao alterar → erro de RLS */);
test("não registra auditoria em nome de outro", /* usuario_id = gB → erro de RLS */);
test("não registra auditoria em outra conta", /* como(gB) conta A → erro de RLS */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:db`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar a migration** (com `migrate:down` completo) e ajustar o cenário. Os testes antigos usavam `tipo = 'rg'`, que continua existindo.
- [ ] **Step 4: Rodar**

Run: `pnpm test:db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db tests/db && git commit -m "feat: schema da fase 2 (tipos de documento, auditoria de leitura, origem do protótipo)"
```

---

### Task 3: Gatilhos com `app.importando` e a função `importar_prototipo`

**Files:**
- Create: `db/migrations/20261122120100_importacao.sql`, `tests/db/importacao.test.ts`, `tests/fixtures/importacao-normalizada.json`

**Interfaces:**
- Produces:
  - função `em_importacao() returns boolean` = `current_setting('app.importando', true) = 'on'`;
  - os gatilhos abaixo, recriados com `create or replace`, passam a respeitar a marca:

    | Gatilho | Com `em_importacao()` |
    |---|---|
    | `tg_clientes_antes` | não toca em `atualizado_em`, `finalizado_em` e `data_assinatura`; continua calculando `anexos_apagar_em` |
    | `tg_clientes_depois` | não faz nada |
    | `tg_toca_cliente` | não faz nada |
    | `tg_auditoria` | não faz nada |
    | `tg_percentual` | não faz nada |

  - `importar_prototipo(conta uuid, dados jsonb) returns jsonb` (`security definer`, `set search_path = public, pg_temp`):
    - **erros** (mensagem exata): `sem_permissao` se `meu_perfil(conta) <> 'gestor'`; `conta_inativa`; `conta_nao_vazia` (há clientes ou corretores); `ja_importado`; `origem_usada` (`prototipo_origem` em outra conta, detectado pelo `23505`);
    - **formato de `dados`** (já convertido pelo Worker, tarefa 5): `{ origem, percentual, historicoPercentual: [{percentual, criadoEm}], corretores: [{idOrigem, nome, imobiliaria, whatsapp, creci, email, criadoEm}], clientes: [{ idOrigem, corretorIdOrigem, campos de clientes em snake_case já em centavos e enums, documentos: [{tipo, recebidoEm}], historico: [{texto, criadoEm}], remuneracao: {pctContrato, pctProprio, recebidaEm} }] }`;
    - **ordem:**
      1. `set_config('app.importando','on', true)`;
      2. `contas_config` e `historico_percentual`;
      3. corretores, guardando o mapa de ids;
      4. clientes (`criado_em` e `atualizado_em` do arquivo);
      5. `clientes_remuneracao`, documentos e histórico (`usuario_id` nulo, tipo `nota`);
      6. uma nota `sistema` por cliente: "Importado do protótipo em dd/mm/aaaa";
      7. uma linha em `auditoria` (`acao 'criar'`, `entidade 'importacao'`, `detalhe` com as contagens);
      8. `update contas set importado_prototipo_em = now(), prototipo_origem = …`;
      9. `set_config('app.importando','off', true)`;
    - **retorno:** `{ corretores, clientes, documentos, notas }`;
  - `grant execute on function importar_prototipo to app_user`.

- [ ] **Step 1: Escrever os testes** (com a fixture normalizada: 2 corretores, 4 clientes, sendo 1 concluído com assinatura e `pct_contrato` diferente do atual, 1 cancelado e 1 direto)

```ts
test("gestor importa e as datas originais ficam", /* criado_em, atualizado_em, data_assinatura e historico.criado_em iguais à fixture */);
test("pct_contrato do arquivo, não o atual", /* clientes_remuneracao.pct_contrato = fixture, percentual_atual da conta ≠ */);
test("sem histórico automático de etapa nem de contrato", /* só as notas da fixture + 1 nota 'sistema' por cliente */);
test("uma auditoria só, da importação", /* count auditoria entidade='cliente' = 0; entidade='importacao' = 1 */);
test("anexos_apagar_em calculado para concluído e cancelado", /* data_assinatura+30 e finalizado+30 */);
test("funcionária não importa", /* como(fA) → sem_permissao */);
test("conta com cliente não importa", /* contaA do cenário → conta_nao_vazia */);
test("segunda importação recusada", /* ja_importado */);
test("mesma origem em outra conta recusada", /* origem_usada, e nada gravado na segunda conta */);
test("erro no meio não grava nada", /* cliente com tipo de documento inexistente → erro, 0 clientes, importado_prototipo_em nulo */);
test("fora da importação os gatilhos valem", /* depois de importar: update etapa grava histórico de etapa; app.importando não vaza para a transação seguinte */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run --project db -t importa`
Expected: FAIL.

- [ ] **Step 3: Implementar.** A função usa `jsonb_to_recordset`/`jsonb_array_elements`. Os ids novos ficam numa tabela temporária `on commit drop` (`id_origem → id`).
- [ ] **Step 4: Rodar**

Run: `pnpm test:db`
Expected: PASS (inclusive os testes da fase 1 de gatilhos).

- [ ] **Step 5: Commit**

```bash
git add db tests && git commit -m "feat: importação do protótipo numa função do banco (RF-90)"
```

---

### Task 4: Regras puras do processo

**Files:**
- Create: `src/regras/datas.ts`, `src/regras/processo.ts`, `src/regras/mensagens.ts`, `src/regras/catalogo.ts`, mais os `*.test.ts` de cada um
- Modify: `src/regras/dinheiro.ts` (+ teste), `src/regras/esquemas.ts`

**Interfaces:**
- Produces:
  - **`catalogo.ts`:**
    - `ETAPAS: { codigo: Etapa; nome: string }[]`, os 10 de RN-01 na ordem;
    - `ETAPAS_FIM`;
    - `MODALIDADES: { codigo: Modalidade; nome: string }[]`;
    - `DOCUMENTOS: { codigo; nome; grupo: "comprador" | "imovel_vendedor" }[]`, os 12 na ordem, iguais à migration (um teste de banco da tarefa 2 compara);
    - `INTERVALOS = [1, 2, 3, 5, 7]` e `DIAS_PARADO = 7`;
  - **`datas.ts`:**
    - `hojeBr(agora = new Date()): string` (`AAAA-MM-DD` em `America/Sao_Paulo`);
    - `somarDias(iso, n)`, `diasAte(iso, hoje)`, `diasDesde(instante, agora)`;
    - `dataBr(iso)` e `dataCurta(iso)`;
  - **`processo.ts`** (tipos de entrada = `ClienteLista` de `src/tipos-api.ts`):
    - `ativo`, `parado` e `faltando(c)`, que devolve a lista de `DOCUMENTOS` sem `recebido_em`;
    - `situacaoCobranca(c, hoje)`, que devolve `{ classe: "atrasada" | "hoje" | "depois", texto, vence }` ou `null` (RN-04);
    - `contratado`;
    - `ordenar(lista, hoje)` (RF-14);
    - `resumo(lista, hoje)`, que devolve `{ ativos, hoje, pendentes, parados, finalizados }`;
    - `filtrar(lista, { busca, origem, etapa, card }, corretores)` (RF-12, RF-13; dígitos a partir de 3);
  - **`mensagens.ts`:** `mensagemCliente(c)`, `mensagemCorretor(corretor, clientes)` e `linkWhatsApp(telefone, texto)`, com o texto **idêntico** ao das funções `msgCliente`, `msgCorretor` e `waLink` do protótipo;
  - **`dinheiro.ts`:** `lerReais("R$ 1.234,56") → 123456` (aceita `1234,5`, `1.234`, vazio → `null`) e `formatarReaisCurto` (`Rk` do protótipo: "R$ 1,2 mi", "R$ 350 mil");
  - **`esquemas.ts`:** `esquemaCliente`, `esquemaClienteParcial` (para o `PATCH`), `esquemaCorretor`, `esquemaNota`, `esquemaDocumento` e `esquemaRemuneracao`, com CPF, telefone (10 ou 11 dígitos) e e-mail validados (RF-19), aceitando vazio.

- [ ] **Step 1: Escrever os testes.** Um caso por regra do protótipo, mais:

```ts
test("hojeBr às 22h de Brasília ainda é o mesmo dia", /* new Date('2026-11-23T01:00:00Z') → '2026-11-22' */);
test("cliente sem documento faltando não tem cobrança", /* RN-04 */);
test("cobrança de ontem está atrasada 1 dia", /* texto 'Cobrança atrasada 1 dia' */);
test("busca por 3 dígitos do telefone acha o cliente", /* '988' */);
test("busca por 2 dígitos não usa dígitos", /* '98' só no nome */);
test("telefone de 11 dígitos ganha 55; com 13 fica como está; com menos de 10 não gera link", /* linkWhatsApp */);
test("mensagem do cliente igual à do protótipo", /* comparar com string literal copiada de msgCliente */);
test("ordenação: ativos, depois cobrança vencida, depois mais dias parado", /* RF-14 */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 3: Implementar** lendo o protótipo função por função.
- [ ] **Step 4: Rodar**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/regras src/tipos-api.ts && git commit -m "feat: regras do processo, datas em Brasília e mensagens do protótipo"
```

---

### Task 5: Conversão do JSON do protótipo

**Files:**
- Create: `src/regras/importacao.ts`, `src/regras/importacao.test.ts`, `tests/fixtures/prototipo-exemplo.json` (dados **inventados**, no formato da exportação da spec 10.1)

**Interfaces:**
- Consumes: `catalogo.ts` (tarefa 4).
- Produces:
  - `esquemaArquivoPrototipo`, o Zod do arquivo exportado: `formato`, `versao`, `origem` (uuid) e o resto, com campos desconhecidos tolerados;
  - `converterPrototipo(arquivo): { dados: DadosImportacao; previa: Previa; avisos: Aviso[] }`:
    - `DadosImportacao` é o formato de `dados` da tarefa 3;
    - `Previa = { corretores, clientes, documentos, notas, anexosParaReenviar, percentual }`;
    - `Aviso = { clienteNome, campo, mensagem }`;
  - regras da conversão (spec 10.3):
    - `valor` antigo cai em `valor_imovel`;
    - `remRecebida` usa a data da última nota "Remuneração recebida", ou a data da importação;
    - `docs[k]` com ISO vira a data em Brasília;
    - `false` é ignorado;
    - `finalizado_em` = `atualizadoEm` para concluído e cancelado;
    - etapa ou modalidade desconhecida gera aviso (etapa cai em `documentacao_pendente`, modalidade em `outra`);
    - corretor inexistente gera aviso e o cliente fica direto;
    - CPF ou telefone inválido gera aviso e o valor é importado só com os dígitos.

- [ ] **Step 1: Escrever os testes**

```ts
test("exemplo converte com as contagens certas", /* previa bate com a fixture */);
test("arquivo de outro formato ou versão é recusado", /* formato 'x' ou versao 2 → erro de esquema */);
test("sem origem é recusado", /* o botão sempre grava origem */);
test("docs com ISO de 23h em Brasília caem no dia certo", /* '2026-11-23T01:30:00Z' → '2026-11-22' */);
test("valores em reais viram centavos", /* 350000 → 35000000; 1234.5 → 123450 */);
test("remRecebida sem nota usa a data da importação", /* hoje injetado */);
test("cliente apontando para corretor removido vira direto com aviso", /* */);
test("a saída passa no esquema que o Worker usa", /* esquemaDadosImportacao.parse(dados) */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- importacao`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit e PR 1**

```bash
git add src/regras tests/fixtures && git commit -m "feat: conversão do JSON do protótipo com prévia e avisos"
```

Abrir o PR 1 (tarefas 1–5) com o CI verde.

---

### Task 6: Cliente S3 no Worker

**Files:**
- Create: `worker/s3.ts`, `tests/worker/s3.test.ts`
- Modify: `worker/env.ts`, `tests/test-env.ts`, `wrangler.jsonc`, `compose.yaml` (se faltar algo para o s3mock), `package.json`, `.github/workflows/ci.yml` (serviço s3mock no job `db`, que roda `pnpm test:worker`)

**Interfaces:**
- Produces:
  - em `worker/s3.ts`, `criarS3(env)`, que devolve:
    - `enviar(caminho, corpo: ArrayBuffer | ReadableStream, tipo): Promise<void>`;
    - `apagar(caminho): Promise<void>`;
    - `linkTemporario(caminho, segundos = 300, nomeArquivo): Promise<string>`, com `response-content-disposition` para o nome original;
    - `listar(prefixo): AsyncIterable<{ caminho; criadoEm }>`;
  - `Env` ganha `S3_ENDPOINT`, `S3_REGIAO`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`;
  - `TEST_ENV` com o s3mock (`http://localhost:9093`, `us-east-1`, `documentos`, chaves fixas de teste).

- [ ] **Step 1: Conferir as ferramentas** — `npm view aws4fetch version` e `npm view heic2any version`; fixar as versões exatas. Conferir na documentação do Supabase se a API S3 aceita link pré-assinado de GET. Se não aceitar, implementar o plano B da spec (seção 8): rota `…/conteudo` que entrega o arquivo pelo Worker.
- [ ] **Step 2: Escrever os testes** (contra o s3mock do compose)

```ts
test("envia, gera link e o link baixa o mesmo conteúdo", /* fetch(link) → mesmo bytes */);
test("link expira", /* segundos = 1, esperar 2 s → 403 */);
test("apagar remove o objeto", /* */);
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm test:worker -- s3`
Expected: FAIL.

- [ ] **Step 4: Implementar.** Em `wrangler.jsonc`:
  - `S3_ENDPOINT`, `S3_REGIAO` e `S3_BUCKET` nas `vars` de cada ambiente;
  - em produção, o endpoint do Supabase com `sa-east-1`;
  - as duas chaves em `secrets.required` do bloco de produção.
- [ ] **Step 5: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 6: Ação do Jean (bloqueia o merge do PR 2)** — no Supabase, criar o bucket `documentos` como **privado** e uma chave S3; gravar `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` no Worker de produção (*Settings → Variables and Secrets*) e no CriptEnv (`development` com os valores do s3mock). Sem isso, o deploy do merge falha pelo `secrets.required`.
- [ ] **Step 7: Commit**

```bash
git add worker tests wrangler.jsonc package.json pnpm-lock.yaml compose.yaml .github && git commit -m "feat: anexos no S3 pelo Worker (aws4fetch)"
```

---

### Task 7: Rotas de clientes

**Files:**
- Create: `worker/rotas/clientes.ts`, `tests/worker/clientes.test.ts`, `tests/worker/cenario.ts` (gestor, funcionária e outra conta pelos helpers da fase 1)
- Modify: `worker/app.ts`, `worker/db.ts` (novos erros conhecidos), `src/tipos-api.ts`

**Interfaces:**
- Consumes: esquemas da tarefa 4.
- Produces:
  - em `src/tipos-api.ts`:
    - `ClienteLista`: campos de `clientes` em camelCase, com `documentos: Record<codigo, string | null>` e `anexos: Record<codigo | "outros", number>`;
    - `Ficha = { cliente; documentos; anexos: ArquivoResumo[]; historico: Nota[]; remuneracao?: Remuneracao }`;
  - rotas sob `exigirUsuario` e `withUser`; id que não é uuid ou de outra conta dá 404 `{ erro: "nao_encontrado" }`:

| Rota | Resposta |
|---|---|
| `GET /api/contas/:contaId/clientes` | `ClienteLista[]` |
| `POST /api/contas/:contaId/clientes` | 201 `{ id }`; nota "Cliente cadastrado · {origem}" na mesma transação; `proxima_cobranca = hoje_br()`, `intervalo_cobranca = 3`, `etapa = 'documentacao_pendente'` |
| `GET /api/contas/:contaId/clientes/:id` | `Ficha`; `remuneracao` só se `meu_perfil = 'gestor'`; insere `auditoria` com `ver` |
| `PATCH /api/contas/:contaId/clientes/:id` | 200 `ClienteLista`; só os campos enviados (`esquemaClienteParcial`) |
| `DELETE /api/contas/:contaId/clientes/:id` | 204; os objetos do S3 são apagados com `waitUntil` depois do commit |
| `PUT /api/contas/:contaId/clientes/:id/documentos/:tipo` | 200; `{ recebido: true }` faz upsert com `recebido_em = hoje_br()` e `marcado_por`; `false` grava `recebido_em = null`; nota "Recebido: X" ou "Desmarcado: X" (e "· documentação completa" quando fecha) |
| `POST /api/contas/:contaId/clientes/:id/historico` | 201; tipo `nota` |
| `POST /api/contas/:contaId/clientes/:id/cobrancas` | 200 `ClienteLista`; RN-13 em SQL (`ultima_cobranca = now()`, `qtd_cobrancas + 1`, `proxima_cobranca = hoje_br() + intervalo_cobranca`); nota do tipo `cobranca` com o texto do protótipo; 409 `{ erro: "sem_cobranca" }` se não há documento faltando ou o processo não está ativo |
| `PATCH /api/contas/:contaId/clientes/:id/remuneracao` | 200; upsert em `clientes_remuneracao`; 403 para F |

- [ ] **Step 1: Escrever os testes**

```ts
test("gestor cadastra e o cliente nasce como no RF-11", /* etapa, intervalo 3, próxima = hoje_br, nota de cadastro */);
test("funcionária cadastra, lista e edita", /* */);
test("lista não traz nenhum campo de percentual", /* Object.keys sem pct* nem remuneracao* */);
test("ficha da funcionária sem remuneracao; do gestor com", /* */);
test("abrir a ficha grava auditoria 'ver'", /* */);
test("dois PATCH em campos diferentes mantêm os dois", /* nome e email */);
test("CPF inválido no PATCH dá 400 com o campo", /* campos: ['cpf'] */);
test("mudar etapa para concluído grava data de assinatura e histórico (gatilho)", /* RN-06 */);
test("cobrança registrada: contador, próxima e nota", /* intervalo 7 → hoje_br + 7 */);
test("cobrança sem documento faltando dá 409", /* todos os 12 marcados */);
test("cliente de outra conta: 404 em todas as rotas", /* gB */);
test("conta pendente não grava", /* 403 sem_permissao */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker -- clientes`
Expected: FAIL.

- [ ] **Step 3: Implementar.** Para devolver 404 sem vazar se o id existe, ler antes sob RLS: sem linha, 404. Os erros de RLS viram 403 por `erroDoBanco`.
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker src/tipos-api.ts tests/worker && git commit -m "feat: rotas de clientes, documentos, histórico e cobrança"
```

---

### Task 8: Rotas de anexos

**Files:**
- Create: `worker/rotas/arquivos.ts`, `tests/worker/arquivos.test.ts`
- Modify: `worker/app.ts`

**Interfaces:**
- Consumes: `criarS3` (tarefa 6).
- Produces:

| Rota | Resposta |
|---|---|
| `POST /api/contas/:contaId/clientes/:id/arquivos` | `multipart/form-data` com `tipo` (código ou `outros`, que vira `null`) e `arquivo`. 201 `ArquivoResumo`. 413 `{ erro: "arquivo_grande" }`; 415 `{ erro: "tipo_nao_aceito" }` |
| `GET /api/contas/:contaId/arquivos/:id/link` | 200 `{ url }`; insere `auditoria` com `baixar` |
| `DELETE /api/contas/:contaId/arquivos/:id` | 204; apaga o objeto depois do commit; o documento continua recebido |

- [ ] **Step 1: Escrever os testes**

```ts
test("anexar PDF marca o documento e escreve 'Anexado por'", /* RF-23 */);
test("21 MB dá 413 e nada é gravado", /* */);
test("tipo text/plain dá 415", /* */);
test("S3 fora do ar: nenhuma linha, documento não marcado", /* S3_ENDPOINT inválido no env do teste → 502, count arquivos = 0, documentos sem recebido */);
test("link grava auditoria 'baixar' e baixa o arquivo", /* */);
test("link de arquivo de outra conta: 404 e sem auditoria", /* gB */);
test("remover anexo apaga o objeto e mantém o documento recebido", /* */);
test("conta pendente não anexa", /* 403 */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker -- arquivos`
Expected: FAIL.

- [ ] **Step 3: Implementar.** Ordem do upload, dentro de `withUser`:
  1. validar tipo e tamanho (o MIME pelo conteúdo: assinatura `%PDF`, JPEG, PNG, WebP; HEIC chega convertido);
  2. `insert into arquivos … returning id`;
  3. `s3.enviar`;
  4. commit.

  Se o S3 falhar, a exceção desfaz a transação.
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker tests/worker && git commit -m "feat: anexar, abrir por link temporário e remover anexos (RF-22 a RF-26)"
```

---

### Task 9: Rotas de corretores e VGV

**Files:**
- Create: `worker/rotas/corretores.ts`, `worker/rotas/vgv.ts`, `tests/worker/corretores.test.ts`, `tests/worker/vgv.test.ts`
- Modify: `worker/app.ts`, `src/tipos-api.ts`

**Interfaces:**
- Produces:
  - `Corretor = { id; nome; imobiliaria; whatsapp; creci; email; acesso: "sem_acesso" | "convidado" | "ativo" }`;
  - `Vgv = { percentualAtual; historicoPercentual: { percentual; criadoEm }[]; linhas: LinhaRemuneracao[] }`, com `LinhaRemuneracao` = colunas de `vw_remuneracao` em camelCase.

| Rota | Resposta |
|---|---|
| `GET /api/contas/:contaId/corretores` | `Corretor[]` (acesso: membro ativo > convite aberto > sem acesso) |
| `POST /api/contas/:contaId/corretores` · `PATCH …/:id` | 201 `{ id }` / 200 |
| `DELETE /api/contas/:contaId/corretores/:id` | 204; 409 `{ erro: "corretor_com_clientes" }` (FK `23503`) |
| `GET /api/contas/:contaId/vgv` | `Vgv`; 403 para F |
| `PUT /api/contas/:contaId/percentual` | 200; `{ percentual }` de 0 a 100 com até 3 casas; 403 para F |

- [ ] **Step 1: Escrever os testes**

```ts
test("funcionária cadastra corretor; status 'sem_acesso'", /* */);
test("convite aberto vira 'convidado'; aceito vira 'ativo'", /* usa a rota de convites da fase 1 */);
test("corretor com cliente não é excluído", /* 409 */);
test("VGV do gestor bate com a view", /* remuneração = round(financiado × pct / 100) */);
test("funcionária não vê VGV nem muda percentual", /* 403, 403 */);
test("mudar percentual guarda o histórico e não muda contrato antigo", /* RN-07 */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker -- corretores vgv`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker src/tipos-api.ts tests/worker && git commit -m "feat: rotas de corretores, VGV e percentual"
```

---

### Task 10: Rota de importação

**Files:**
- Create: `worker/rotas/importacao.ts`, `tests/worker/importacao.test.ts`
- Modify: `worker/app.ts`, `worker/db.ts` (erros `conta_nao_vazia`, `ja_importado`, `origem_usada`, `conta_inativa` como 409)

**Interfaces:**
- Consumes: `esquemaArquivoPrototipo` e `converterPrototipo` (tarefa 5); `importar_prototipo` (tarefa 3).
- Produces: `POST /api/contas/:contaId/importacao` com o arquivo exportado (JSON, até 10 MB). 200 `{ corretores, clientes, documentos, notas }`; 400 `{ erro: "arquivo_invalido" }`; 409 com os erros da função; 403 para F.

- [ ] **Step 1: Escrever os testes**

```ts
test("gestor importa o exemplo e a lista mostra os clientes", /* GET clientes depois */);
test("segunda vez: 409 ja_importado", /* */);
test("mesma origem em outra conta: 409 origem_usada", /* */);
test("arquivo de outro formato: 400", /* */);
test("funcionária: 403", /* */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker -- importacao`
Expected: FAIL.

- [ ] **Step 3: Implementar.** A rota faz `converterPrototipo` (descarta a prévia) e chama `select importar_prototipo($1, $2::jsonb)` em `withUser`.
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker tests/worker && git commit -m "feat: rota de importação do protótipo"
```

---

### Task 11: Rotina diária de anexos

**Files:**
- Create: `worker/rotinas/anexos.ts`, `tests/worker/rotina-anexos.test.ts`
- Modify: `worker/index.ts` (handler `scheduled`), `worker/emails.ts` (e-mail de aviso), `wrangler.jsonc` (`triggers.crons: ["0 6 * * *"]` no bloco de produção; conferir se o bloco herda), `db/migrations/…` se precisar de índice em `anexos_apagar_em`

**Interfaces:**
- Produces: `rotinaAnexos(env, agora, deps)`, como `app_system`, sempre com `conta_id` explícito:
  1. **aviso:** clientes com `anexos_apagar_em = hoje_br() + 5`, anexos não apagados e `anexos_aviso_em is distinct from hoje_br()`. Agrupa por conta, manda um e-mail para G e F ativos e grava `anexos_aviso_em`;
  2. **exclusão:** clientes com `anexos_apagar_em <= hoje_br()` e arquivos com `apagado_em is null`. Apaga os objetos, grava `apagado_em` e escreve a nota `sistema` "Anexos apagados pelo prazo de 30 dias";
  3. **limpeza:** objetos sem linha em `arquivos`, com mais de 1 dia.

- [ ] **Step 1: Escrever os testes**

```ts
test("avisa uma vez só, 5 dias antes, para G e F", /* rodar 2x no mesmo dia → 1 e-mail por conta */);
test("apaga no dia, mantém documento e ficha, escreve nota", /* */);
test("volta para etapa ativa cancela a exclusão (RN-15)", /* anexos_apagar_em nulo → nada apagado */);
test("objeto sem linha com 2 dias é apagado; com 1 hora não", /* */);
test("conta B não recebe aviso da conta A", /* */);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:worker -- rotina`
Expected: FAIL.

- [ ] **Step 3: Implementar.** O handler `scheduled` abre os pools, roda a rotina e fecha os pools com `waitUntil`.
- [ ] **Step 4: Rodar**

Run: `pnpm test:worker && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit e PR 2**

```bash
git add worker wrangler.jsonc db tests/worker && git commit -m "feat: exclusão programada de anexos com aviso (RF-27, RN-14)"
```

Abrir o PR 2 (tarefas 6–11) só depois da ação do Jean da tarefa 6.

---

### Task 12: Dados na SPA, menu e Início

**Files:**
- Create: `src/consultas-escritorio.ts`, `src/componentes/Salvando.tsx`, `src/ganchos/useSalvarCampo.ts`
- Modify: `src/consultas.ts`, `src/componentes/Casca.tsx` (menu da spec, seção 6), `src/telas/Inicio.tsx`, `src/rotas.tsx`

**Interfaces:**
- Produces:
  - consultas TanStack com `refetchInterval: 30_000` nas listas: `useClientes(contaId)`, `useFicha(contaId, id)`, `useCorretores(contaId)` e `useVgv(contaId)` (só G);
  - mutações que invalidam a lista e a ficha;
  - `useSalvarCampo(contaId, id)`: debounce de 700 ms por campo, envia só os campos alterados e expõe `estado: "ocioso" | "salvando" | "salvo" | "erro"`;
  - Início (RF-01 a RF-05) com `resumo`, `situacaoCobranca` e `faltando` da tarefa 4; cada contador leva à lista filtrada (`/e/:contaId/clientes?card=hoje`);
  - Início vazio do gestor, com atalhos "Cadastrar primeiro cliente" e "Importar do protótipo".

- [ ] **Step 1: Escrever os testes** — unidade do `useSalvarCampo` com relógio falso: digitar 3 vezes em 500 ms gera 1 `PATCH`; campos diferentes vão juntos no mesmo `PATCH` se cair na mesma janela.
- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 3: Implementar.** Visual com os tokens de `src/index.css` e os componentes de `src/componentes/ui.tsx`; conteúdo e textos do `renderInicio` do protótipo.
- [ ] **Step 4: Conferir no navegador** — `pnpm docker:up`, conta liberada, alguns clientes criados pela API. Fotos em desktop e celular (375 px).
- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: menu da fase 2, consultas e Início"
```

---

### Task 13: Clientes, Novo cliente e ficha

**Files:**
- Create: `src/telas/Clientes.tsx`, `src/telas/ficha/Ficha.tsx`, `src/telas/ficha/Dados.tsx`, `src/telas/ficha/Valores.tsx`, `src/telas/ficha/Contrato.tsx`, `src/telas/ficha/Historico.tsx`, `src/telas/NovoCliente.tsx`, `src/componentes/PainelLateral.tsx`, `src/componentes/CampoDinheiro.tsx`
- Modify: `src/rotas.tsx`

**Interfaces:**
- Produces:
  - lista com busca, filtros e cards (RF-12, RF-13), ordenação (RF-14) e "parado" em vermelho;
  - painel lateral aberto por `?cliente=<id>` (o voltar do celular fecha) e `?novo=1`;
  - ficha com salvamento automático e "Salvo" ao lado do campo;
  - etapa com as 10 opções;
  - valores com a cota calculada;
  - contrato (número e data);
  - remuneração só para G;
  - histórico com nota livre;
  - excluir com confirmação em dois cliques (RF-18).

- [ ] **Step 1: Implementar** seguindo `renderProcessos` e `renderDrawer` do protótipo.
- [ ] **Step 2: Conferir no navegador:**
  - funcionária não vê o bloco de remuneração;
  - erro de CPF aparece no campo;
  - fotos em desktop e celular.
- [ ] **Step 3: Rodar**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: lista de clientes, novo cliente e ficha com salvamento automático"
```

---

### Task 14: Documentos, anexos e Cobrar hoje com "Enviou?"

**Files:**
- Create: `src/telas/ficha/Documentos.tsx`, `src/telas/ficha/Cobranca.tsx`, `src/telas/CobrarHoje.tsx`, `src/lib/preparar-arquivo.ts` (+ teste), `src/ganchos/useEnviou.ts`
- Modify: `src/rotas.tsx`, `package.json` (`heic2any`)

**Interfaces:**
- Produces:
  - **`prepararArquivo(file): Promise<{ blob; tipo; nome }>`:**
    - reduz foto acima de 2,5 MB para 2.200 px, em JPG 0,85;
    - converte HEIC (primeiro `createImageBitmap`; se falhar, `heic2any` com `import()` dinâmico);
    - recusa o que não é PDF, JPG, PNG, WebP ou HEIC, com as mensagens do protótipo;
  - **checklist:** dois grupos mais "Outros arquivos"; marcar e desmarcar; anexar com progresso; miniatura de foto; abrir pelo link temporário; remover com confirmação;
  - **`useEnviou()`:**
    - guarda `{ clienteId, nome }` ao abrir o WhatsApp ou copiar;
    - no `visibilitychange` para visível, mostra "Enviou a cobrança para Fulano?";
    - Sim chama `POST …/cobrancas`;
    - Não fecha;
    - sem resposta, a cobrança fica "aberta" no `sessionStorage` e aparece como "Cobrança aberta: enviou?" em Cobrar hoje até ser respondida;
  - **Cobrar hoje:** atrasadas e de hoje, com WhatsApp ou Copiar (RF-31, RF-34), intervalo (RF-32) e mudança manual da próxima data (RF-33).

- [ ] **Step 1: Escrever os testes** — `prepararArquivo`, com os tipos aceitos e recusados e o tamanho (canvas simulado), e `useEnviou`, com visibilidade simulada: Sim chama a mutação, Não não chama.
- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Conferir no navegador:**
  - anexar PDF e foto grande;
  - abrir o anexo;
  - cobrar pelo WhatsApp num celular de verdade, para ver o "Enviou?" ao voltar.

  Fotos em desktop e celular.
- [ ] **Step 5: Commit e PR 3**

```bash
git add src package.json pnpm-lock.yaml && git commit -m "feat: documentos com anexos e Cobrar hoje com 'Enviou?' (RF-20 a RF-36)"
```

Abrir o PR 3 (tarefas 12–14).

---

### Task 15: Corretores parceiros e VGV

**Files:**
- Create: `src/telas/Corretores.tsx`, `src/telas/FichaCorretor.tsx`, `src/telas/Vgv.tsx`, `src/regras/vgv.ts` (+ teste)
- Modify: `src/rotas.tsx`

**Interfaces:**
- Produces:
  - **`vgv.ts`:**
    - `noPeriodo(data, periodo, hoje)` para `mes | ant | ano | tudo`;
    - `indicadores(linhas, periodo, hoje)`, que devolve VGV, financiado, cota média, remuneração, recebida e ticket médio (RF-51 a RF-53);
    - `porOrigem(linhas, corretores)` (RF-54);
    - `porEtapa(linhas)` (RF-55);
  - **Corretores:**
    - cards por corretor e "Clientes diretos" (RF-41, RF-42), com VGV no card só para G;
    - ficha do corretor com mensagem de situação (RF-43);
    - excluir só sem clientes (RF-44);
    - "Convidar para o portal" (RF-45): exige e-mail; mostra o status; no plano Simples, o botão explica que o portal faz parte do plano Com corretores;
  - **VGV (G):**
    - percentual atual e últimas 5 alterações;
    - período;
    - indicadores;
    - tabela por origem, em que tocar na linha abre Clientes filtrado;
    - barra por etapa;
    - remuneração a receber, com "Marcar recebida" (RF-56).

- [ ] **Step 1: Escrever os testes de `vgv.ts`.** Os números de um conjunto de exemplo têm de bater com os que o `renderVGV` do protótipo produz para os mesmos dados (calcular à mão e fixar no teste).
- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- vgv`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Conferir no navegador** como G e como F (F não vê o menu VGV nem o VGV nos cards). Fotos.
- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: corretores parceiros e VGV e comissões"
```

---

### Task 16: Tela de importação e botão no protótipo

**Files:**
- Create: `src/telas/Importar.tsx`
- Modify: `src/rotas.tsx`, `docs/prototipo/prototipo.html`, `docs/prototipo/README.md`

**Interfaces:**
- Produces:
  - **tela Importar (G):**
    - escolher o arquivo;
    - prévia com `converterPrototipo` (contagens, percentual, avisos agrupados e "N anexos terão de ser reenviados");
    - "Importar" chama `POST …/importacao`;
    - sucesso leva para Clientes;
    - mensagens para cada erro 409;
  - **no protótipo:**
    - item **"Exportar JSON"** no menu lateral;
    - a função `exportar()`:
      1. se `S.config.origem` não existe, gera `crypto.randomUUID()` e grava `db.doc("config/geral").set({ ...S.config, origem })`;
      2. monta `{ formato: "central-prototipo", versao: 1, origem, exportadoEm, config: S.config, corretores: S.corretores, clientes: S.clientes }`;
      3. baixa `central-AAAA-MM-DD.json` por `Blob` e `URL.createObjectURL`;
    - **correção obrigatória:** o `set` do percentual (linha do `fila("config/geral", …)`) passa a gravar `{ ...S.config, percentual, atualizadoEm, historicoPct }`. Hoje ele substitui o documento inteiro e apagaria a `origem` (Review Focus 8).

- [ ] **Step 1: Implementar a tela.**
- [ ] **Step 2: Implementar o botão no protótipo** e conferir na cópia local (sem dados, o botão avisa "Abra a página logado no Claude").
- [ ] **Step 3: Teste de ponta a ponta manual:**
  1. publicar a cópia alterada num Artifact **de teste** (não no da correspondente);
  2. cadastrar 2 corretores e 3 clientes;
  3. exportar;
  4. mudar o percentual e exportar de novo (a mesma `origem`);
  5. importar numa conta de teste local;
  6. conferir na tela os números do protótipo (ativos, cobrar hoje, parados, VGV e remuneração);
  7. tentar importar o mesmo arquivo em outra conta (recusado).
- [ ] **Step 4: Ação do Jean** — com o PR mergeado, republicar o protótipo com o botão **no mesmo Artifact de cada correspondente** (o dono de cada cópia), conferir que os dados continuam lá e exportar um arquivo de cada cópia.
- [ ] **Step 5: Commit e PR 4**

```bash
git add src docs/prototipo && git commit -m "feat: tela de importação e botão Exportar JSON no protótipo"
```

Abrir o PR 4 (tarefas 15–16).

---

### Task 17: E2E da fase 2

**Files:**
- Create: `tests/e2e/fase-2.spec.ts`
- Modify: `playwright.config.ts` (env S3 do s3mock), `.github/workflows/ci.yml` (s3mock no job `e2e`), `tests/test-env.ts` (`E2E_ENV` com S3)

- [ ] **Step 1: Escrever o teste** (caminho feliz da spec, seção 13):
  1. gestor liberado cadastra corretor e cliente;
  2. anexa um PDF pequeno e o documento aparece recebido;
  3. em Cobrar hoje, toca WhatsApp: a aba nova é interceptada por `context.on("page")` e fechada; ao voltar, "Enviou?" → Sim, e o contador sobe;
  4. muda a etapa para "Assinatura do contrato" com data e vê o VGV;
  5. convida a funcionária pelo Mailpit; ela entra e não vê VGV nem remuneração;
  6. um gestor de outra conta abre `/e/<contaA>/clientes?cliente=<id>` e não vê nada.

  Mais um teste curto de importação: importar `tests/fixtures/prototipo-exemplo.json` e ver a contagem na lista.
- [ ] **Step 2: Rodar**

Run: `pnpm test:e2e`
Expected: PASS.

- [ ] **Step 3: CI** — o job `e2e` com o serviço s3mock e as variáveis S3.
- [ ] **Step 4: Conferir o critério de pronto da spec (seção 1)** — CI verde e a importação real da tarefa 16 com os números batendo.
- [ ] **Step 5: Commit e PR 5**

```bash
git add tests playwright.config.ts .github && git commit -m "test: e2e da fase 2 e s3mock no CI"
```

Abrir o PR 5.
