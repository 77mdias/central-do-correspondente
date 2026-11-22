# Fase 2 — Migração: design

Central do Correspondente · 22/11/2026 · status: **aprovado pelo Jean em 22/11/2026** (a importação virou função SQL no plano; ver o "Ajuste à spec" em `docs/superpowers/plans/2026-11-22-fase-2-migracao.md`)

Este documento manda sobre os outros de `docs/` onde eles divergem; a atualização deles faz parte da fase (seção 14). A referência de telas e regras é o protótipo (`docs/prototipo/prototipo.html`).

## 1. Intenção

A fase 2 põe a rotina inteira do escritório no app: clientes, ficha, documentos com anexos, cobrança, corretores e VGV. Ela também traz os dados do protótipo para o banco novo. Na fase 3 as 2 correspondentes passam a usar o app de verdade, então aqui ainda não há uso real.

**Pronto quando:**
- uma correspondente consegue fazer a rotina diária da seção 3 de `docs/FLUXOS.md` só no app, sem o protótipo:
  - cadastrar corretor e cliente;
  - anexar documentos;
  - cobrar pelo WhatsApp com "Enviou?";
  - mudar a etapa até a assinatura;
  - ver o VGV (gestor);
- o JSON exportado de uma cópia real do protótipo entra numa conta de teste e as telas mostram os mesmos números que o protótipo: ativos, cobrar hoje, parados, VGV e remuneração;
- a RLS dos anexos e das telas novas está provada por teste, para cada perfil e para outra conta;
- CI verde.

## 2. Decisões do Jean (22/11/2026)

| # | Decisão | Fecha |
|---|---|---|
| 1 | Ao voltar do WhatsApp, o app pergunta "Enviou a cobrança para Fulano?". Só registra a cobrança se a resposta for sim | P-02 |
| 2 | O protótipo ganha um botão **"Exportar JSON"**, e o importador do app lê esse arquivo. Os anexos não migram: são reenviados à mão | P-11 |
| 3 | O protótipo em `docs/prototipo/` é a referência de telas e regras. Os outros protótipos do Briefing não servem | — |

## 3. Abordagens consideradas

**Listas (escolhida: A)**
- **A — Carregar todos os clientes da conta de uma vez.** A SPA calcula filtros, contadores e ordenação com as funções puras de `src/regras/`, como o protótipo faz. Um escritório tem de dezenas a poucos milhares de processos, e assim a busca e os filtros respondem na hora, sem ida ao servidor. As mesmas funções valem para Início, Clientes, Cobrar hoje e Corretores.
- **B — Filtrar e paginar no servidor.** Descartada por enquanto: seriam quatro telas de consultas próprias e a busca ficaria mais lenta, sem ganho no volume real. Se uma conta passar de uns 5 mil clientes, a lista ganha paginação.

**Upload de anexos (escolhida: A)**
- **A — Arquivo passa pelo Worker.** O Worker grava a linha em `arquivos` sob `withUser`, de modo que a RLS decide se a pessoa pode anexar àquele cliente. Depois ele envia o objeto ao S3 e só então faz o commit; se o envio falhar, a linha some. O limite de 20 MB fica bem abaixo do limite de corpo do Worker. É o que a ARQUITETURA já pede ("upload e download só pelo Worker").
- **B — Link de upload pré-assinado direto para o S3.** Descartada: a permissão seria conferida num pedido e o arquivo chegaria em outro. Haveria linhas sem arquivo e arquivos sem linha para limpar.

**Importação (escolhida: A)**
- **A — Validar no navegador, mostrar a prévia e gravar tudo numa transação no Worker.** O navegador e o Worker usam o mesmo esquema Zod, e o Worker valida de novo antes de gravar.
- **B — Script de linha de comando, como o `conta:liberar`.** Descartada: quem tem o arquivo é a correspondente, e o RF-90 pede prévia na tela.

## 4. Objetivos

1. **Início** (RF-01 a RF-05).
2. **Clientes**: lista, busca, filtros, ordenação, novo cliente e ficha com salvamento automático (RF-10 a RF-19).
3. **Documentos e anexos** (RF-20 a RF-24 e RF-26): checklist de 12 itens mais "Outros arquivos", anexar, abrir por link temporário e remover. Inclui a exclusão programada (RF-27, seção 11).
4. **Cobrança** (RF-30 a RF-34 e RF-36): mensagem pronta, WhatsApp ou copiar, "Enviou?", intervalo e próxima data.
5. **Corretores parceiros** (RF-40 a RF-45), inclusive o botão "Convidar para o portal". O portal em si é da fase 3.
6. **VGV e comissões**, só para o gestor (RF-50 a RF-56).
7. **Importação do protótipo** (RF-90), com o botão "Exportar JSON" no protótipo.
8. **Auditoria** (RNF-07): abertura da ficha e download de anexo.
9. **Documentação** atualizada (seção 14).

## 5. Não objetivos

- Portal do corretor e o histórico visto pelo corretor: fase 3 (RF-80 a RF-84, P-03). A RLS do corretor já existe e continua testada.
- Lembrete diário por push e e-mail (RF-35), PWA (RNF-09), relatório em PDF e planilha (RF-57) e exportação da conta pelo gestor (RNF-08): fase 4.
- Asaas, troca de plano, painel do sistema: fase 4.
- Migrar os anexos do protótipo (decisão 2).
- Tempo real: continua a atualização a cada 30 s e ao voltar para a aba (D-32).
- Deploy de produção com dados reais. O código vai para produção como sempre, a cada merge, mas as correspondentes só entram na fase 3.

## 6. Telas

As telas seguem o protótipo em conteúdo, textos, ordem e comportamento. A identidade visual é a do app que já está no ar (tokens de `src/index.css`, padrão de `DESIGN.md`), e não as cores e fontes do protótipo (escolha 1 da seção 16).

| Tela | Rota | Quem | Do protótipo |
|---|---|---|---|
| Início | `/e/:contaId` | G, F | contadores, cobranças de hoje (até 6), parados e com documento faltando (até 6, com os 3 primeiros documentos), tabela por origem (até 8), últimas 7 atualizações |
| Clientes | `/e/:contaId/clientes` | G, F | busca, filtro por origem e etapa, cards que filtram, ordenação do RF-14, aviso de "parado" em vermelho |
| Cobrar hoje | `/e/:contaId/cobrar` | G, F | cobranças atrasadas e do dia, cada uma com WhatsApp ou Copiar |
| Corretores parceiros | `/e/:contaId/corretores` | G, F | cards por corretor e o card "Clientes diretos"; VGV no card só para G |
| VGV e comissões | `/e/:contaId/vgv` | G | percentual atual e histórico, período, indicadores, tabela por origem, VGV por etapa, remuneração a receber |
| Importar do protótipo | `/e/:contaId/importar` | G | — (seção 10) |

**Painéis laterais** (como no protótipo, e viram tela cheia no celular):
- **Ficha do cliente:** origem, dados (nome, CPF, WhatsApp, e-mail, modalidade, corretor), valores (imóvel, avaliação, financiado, entrada, FGTS, subsídio, com a cota calculada), etapa, contrato (número e data de assinatura), remuneração (só G: percentual usado, próprio, remuneração, recebida), documentos, cobrança, observações e histórico. Abre a partir do Início, de Clientes e de Cobrar hoje (`?cliente=<id>` na URL, para o botão voltar do celular fechar o painel).
- **Novo cliente:** nome (obrigatório), CPF, WhatsApp, e-mail, modalidade, origem, valor do imóvel e valor a financiar (RF-10). Nasce em "Documentação pendente", com cobrança para hoje e intervalo de 3 dias (RF-11).
- **Ficha do corretor:** dados, clientes dele, mensagem de situação (RF-43), status do acesso ao portal e o botão "Convidar para o portal" (RF-45).

**Salvamento automático (RF-15):** cada campo grava 700 ms depois de parar de digitar, só com os campos alterados (`PATCH`), e mostra "Salvo" ou o erro ao lado. Se dois usuários editam campos diferentes, os dois valem; no mesmo campo, vale o último.

**Menu:** Início, Clientes, Cobrar hoje, Corretores parceiros, VGV e comissões (só G), Equipe (só G, já existe). O item "Importar do protótipo" aparece para o gestor enquanto a conta não tem clientes, e também como atalho no Início vazio.

## 7. API

Todas as rotas de domínio ficam em `/api/contas/:contaId/...` e rodam em `withUser`; a RLS decide o acesso. Os corpos são validados com os esquemas Zod de `src/regras/esquemas.ts`, os mesmos da SPA.

| Rota | Faz | Quem |
|---|---|---|
| `GET …/clientes` | Todos os clientes da conta, cada um com `documentos` (`{tipo: recebido_em}`) e a quantidade de anexos por tipo | G, F |
| `POST …/clientes` | Novo cliente (RF-10, RF-11). Na mesma transação, a rota grava no histórico "Cliente cadastrado · origem", como o protótipo | G, F |
| `GET …/clientes/:id` | Ficha completa: cliente, documentos, anexos (sem caminho), histórico, e `remuneracao` só para G. Grava `auditoria` com `acao = 'ver'` | G, F |
| `PATCH …/clientes/:id` | Campos alterados. Mudança de etapa e de data de assinatura dispara os gatilhos existentes | G, F |
| `DELETE …/clientes/:id` | Exclui o cliente (RF-18) e apaga os objetos dele no S3 depois do commit | G, F |
| `PUT …/clientes/:id/documentos/:tipo` | `{ recebido: boolean }`: marca com a data de hoje ou volta a pendente (RF-21) | G, F |
| `POST …/clientes/:id/historico` | Nota livre (RF-17) | G, F |
| `POST …/clientes/:id/cobrancas` | Registra a cobrança (RN-13): última = agora, contador + 1, próxima = `hoje_br()` + intervalo, e histórico do tipo `cobranca` com os documentos que faltavam | G, F |
| `PATCH …/clientes/:id/remuneracao` | `pct_proprio` e `remuneracao_recebida_em` (RF-56) | G |
| `POST …/clientes/:id/arquivos` | `multipart/form-data`: tipo (código ou `outros`) e arquivo. Grava a linha, envia ao S3 e faz o commit (seção 8) | G, F (C na fase 3) |
| `GET …/arquivos/:id/link` | Confere a permissão lendo a linha sob RLS, grava `auditoria` com `acao = 'baixar'` e devolve um link de até 5 minutos (RF-26) | G, F |
| `DELETE …/arquivos/:id` | Remove o anexo (RF-24) e o objeto no S3. O documento continua marcado como recebido, como no protótipo | G, F |
| `GET …/corretores` · `POST` · `PATCH …/:id` · `DELETE …/:id` | Cadastro de corretores. A lista traz o status do acesso: sem acesso, convidado ou ativo (RF-45). Excluir corretor com clientes devolve 409 (RF-44) | G, F |
| `GET …/vgv` | Linhas de `vw_remuneracao`, `percentual_atual` e `historico_percentual` | G |
| `PUT …/percentual` | Muda `contas_config.percentual_atual`; o gatilho guarda o histórico (RF-50) | G |
| `POST …/importacao` | Importa o JSON do protótipo (seção 10) | G |

O convite do corretor usa a rota que já existe (`POST …/convites` com `perfil = 'corretor'` e `corretor_id`).

**Cálculos ficam num lugar só:**
- remuneração, percentual usado e cota (RN-08 a RN-10) vêm de `vw_remuneracao`, e a SPA só soma;
- ativo, parado, situação da cobrança, documentos faltando, ordenação e mensagens (RN-02 a RN-04, RF-14, RF-30, RF-43) são funções puras em `src/regras/`, testadas com Vitest e copiadas do protótipo regra por regra;
- **"hoje" na SPA é sempre o dia em `America/Sao_Paulo`**, igual ao `hoje_br()` do banco, e não o dia do aparelho.

## 8. Anexos

- **Storage:** bucket privado `documentos`, Supabase Storage pela API S3 em produção e s3mock no desenvolvimento (já no compose). Caminho `conta_id/cliente_id/arquivo_id.ext`. Assinatura S3 v4 no Worker com uma biblioteca pequena (`aws4fetch` ou parecida; escolha do builder).
- **Segredos novos** (CriptEnv e Worker): `S3_ENDPOINT`, `S3_REGIAO`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`. Valores fixos de teste em `tests/test-env.ts`. A chave S3 do Supabase dá acesso ao Storage inteiro, então fica só no Worker.
- **Envio:** no navegador, como no protótipo:
  - fotos acima de 2,5 MB são reduzidas para 2.200 px em JPG 0,85;
  - HEIC é convertido para JPG; quando o navegador não decodifica HEIC, entra uma biblioteca carregada só nessa hora;
  - aceita PDF até 20 MB e JPG, PNG, WebP e HEIC (RF-22).

  O Worker confere de novo o tipo e o tamanho. Anexar marca o documento como recebido: o gatilho `tg_anexo_recebido` já existe (RF-23).
- **Abrir e baixar:** link pré-assinado de GET com validade de 5 minutos (RNF-11). *Conferir no builder* se o Supabase Storage aceita link pré-assinado pela API S3. Se não aceitar, o Worker entrega o arquivo ele mesmo, numa rota `…/arquivos/:id/conteudo` com a mesma checagem e a mesma auditoria.
- **Excluir cliente:** os objetos são apagados depois do commit. Se algum falhar, a rotina da seção 11 recolhe os objetos sem linha.

## 9. "Enviou?" (RF-36, P-02)

1. Tocar em **WhatsApp** abre `wa.me/55…` numa aba nova com a mensagem pronta (RF-30, RF-31) e guarda na memória da página qual cliente foi cobrado.
2. Quando a aba do app volta a ficar visível (`visibilitychange`), aparece "Enviou a cobrança para Fulano?" com **Sim** e **Não**.
3. **Sim** chama `POST …/cobrancas`. **Não** fecha o aviso sem mudar nada.
4. Sem WhatsApp cadastrado, o botão vira **Copiar mensagem** (RF-34), e a mesma pergunta aparece logo depois de copiar.
5. A pergunta também pode ser respondida mais tarde: enquanto não houver resposta, o cliente mostra "Cobrança aberta: enviou?" na lista de Cobrar hoje.

## 10. Importação do protótipo (RF-90)

### 10.1 Botão "Exportar JSON" no protótipo

O botão entra no menu do protótipo e baixa `central-AAAA-MM-DD.json` com o que a página já tem carregado:

```json
{ "formato": "central-prototipo", "versao": 1, "origem": "<uuid da cópia>", "exportadoEm": "2026-11-22T12:00:00.000Z",
  "config": { "percentual": 1.2, "historicoPct": [{ "t": "…", "pct": 1.2 }] },
  "corretores": [{ "id": "…", "nome": "…", "imobiliaria": "…", "telefone": "…", "creci": "…", "email": "…", "criadoEm": "…" }],
  "clientes": [{ "id": "…", "nome": "…", "…": "todos os campos como estão no banco do protótipo" }] }
```

- O arquivo inclui os metadados de `arquivos`, só para a prévia dizer quantos anexos vão precisar ser reenviados.
- A mudança é feita na cópia `docs/prototipo/prototipo.html` e republicada **no mesmo Artifact**: mesmo link e mesmo banco, então os dados continuam lá.
- **Uma cópia do protótipo é um escritório** (decisão do Jean, seção 16). Cada correspondente usa a própria cópia, e o botão entra em cada uma. Eu preparo o HTML, e quem é dono da cópia republica.
- **`origem`:** na primeira exportação, o botão sorteia um uuid e grava em `config/geral.origem`, no banco da própria cópia. Daí em diante toda exportação daquela cópia leva o mesmo valor. É assim que o app reconhece a cópia (seção 10.2).
- Se uma cópia tiver clientes de dois escritórios, ela **não é importada** até alguém separar os dados fora do app. O importador não tem como separar.

### 10.2 Importar no app

1. O gestor abre "Importar do protótipo" e escolhe o arquivo.
2. A SPA valida o arquivo com o esquema de `src/regras/importacao.ts` e mostra a prévia:
   - quantos corretores e clientes entram;
   - quantos documentos marcados;
   - quantas notas de histórico;
   - o percentual atual;
   - avisos: CPF ou telefone inválido (importados assim mesmo, com aviso na ficha), etapa ou modalidade desconhecida, cliente apontando para corretor inexistente (entra como cliente direto);
   - quantos anexos terão de ser reenviados.
3. "Importar" envia o JSON para `POST …/importacao`. O Worker valida de novo e grava tudo numa transação, como `app_user` (a RLS vale). Ou entra tudo, ou nada.

**Condições:** a conta está ativa (`conta_ativa`), ainda não importou (`contas.importado_prototipo_em` nulo) e não tem clientes nem corretores. Assim não há o que mesclar. Além disso, **a mesma cópia do protótipo (`origem`) não entra em duas contas**: `contas.prototipo_origem` é único no banco. Uma segunda importação da mesma cópia, mesmo em outra conta, é recusada com a mensagem "Estes dados já foram importados em outro escritório". A importação grava `importado_prototipo_em`, uma nota do tipo `sistema` em cada cliente ("Importado do protótipo em dd/mm/aaaa") e uma linha de auditoria.

**Gatilhos durante a importação:** a transação faz `set_config('app.importando', 'on', true)`. Com essa marca, os gatilhos de RN-07 (congelar percentual), RN-12 (`atualizado_em`), histórico automático e auditoria por linha não agem, e as datas e percentuais originais ficam preservados. Só a rota de importação liga a marca; o teste de banco prova que, sem ela, os gatilhos seguem valendo.

### 10.3 Mapeamento (completa a seção 8 do MODELO-DE-DADOS)

| Protótipo | Banco novo |
|---|---|
| `config.percentual` | `contas_config.percentual_atual` |
| `config.historicoPct[] {t, pct}` | `historico_percentual (percentual, criado_em = t)` |
| `corretores.{nome, imobiliaria, creci, email, criadoEm}` | iguais em `corretores` |
| `corretores.telefone` | `corretores.whatsapp` (só dígitos) |
| `clientes.{nome, cpf, email}` | iguais (CPF só dígitos) |
| `clientes.telefone` | `whatsapp` (só dígitos) |
| `corretorId` | `corretor_id` pelo mapa de ids importados; vazio = cliente direto |
| `modalidade` | "Minha Casa Minha Vida" → `mcmv` · "SBPE" → `sbpe` · "Pró-Cotista FGTS" → `pro_cotista` · "Habitacional Caixa (outros)" → `outra` |
| `etapa` | os 10 nomes de RN-01 → enum `etapa` |
| `valorImovel` (ou `valor`, campo antigo), `valorAvaliacao`, `valorFinanciado`, `entrada`, `fgtsUsado`, `subsidio` | `*_centavos` (× 100, arredondado) |
| `contrato`, `dataContrato` | `numero_contrato`, `data_assinatura` |
| `pctContrato`, `pctOverride` | `clientes_remuneracao.pct_contrato`, `pct_proprio` |
| `remRecebida` (booleano) | `remuneracao_recebida_em` = data da última nota "Remuneração recebida" do histórico; sem nota, a data da importação |
| `proximaCobranca`, `intervalo`, `cobrancas`, `ultimaCobranca` | `proxima_cobranca`, `intervalo_cobranca`, `qtd_cobrancas`, `ultima_cobranca` |
| `obs` | `observacoes` |
| `docs {codigo: ISO ou false}` | uma linha em `documentos` por código; `recebido_em` = dia da data ISO em `America/Sao_Paulo` |
| `historico[] {t, txt}` | `historico` do tipo `nota`, `criado_em = t` |
| `criadoEm`, `atualizadoEm` | `criado_em`, `atualizado_em` |
| — | `finalizado_em` (concluídos e cancelados) = `atualizadoEm`; `anexos_apagar_em` calculado pela regra de RN-14 |
| `arquivos` | não importados; só contados na prévia |

## 11. Exclusão programada de anexos (RF-27, RN-14)

A rotina roda pelo Cron Trigger diário às 3h de Brasília (6h UTC), como `app_system`, sempre filtrando por `conta_id`:
1. **Aviso:** clientes com `anexos_apagar_em = hoje_br() + 5` (P-07, confirmada pelo Jean) e anexos não apagados geram **um e-mail por conta** para G e F, listando os clientes e a data.
2. **Exclusão:** clientes com `anexos_apagar_em <= hoje_br()`:
   - apaga os objetos no S3;
   - grava `arquivos.apagado_em`;
   - escreve no histórico (tipo `sistema`) "Anexos apagados pelo prazo de 30 dias".

   A marcação de recebido e a ficha continuam (RN-14).
3. **Limpeza:** apaga objetos do bucket sem linha em `arquivos`, criados há mais de 1 dia.

A rotina é idempotente: rodar duas vezes no mesmo dia não manda dois avisos (marca de envio por cliente e data).

## 12. Mudanças no modelo de dados

- Migration que **popula `tipos_documento`** com os 12 tipos da lista do MODELO-DE-DADOS (P-01).
- Os gatilhos passam a respeitar `app.importando` (seção 10.2).
- `arquivos.tamanho` com `check (tamanho <= 20971520)`; `arquivos.tipo_documento` aponta para `tipos_documento` ou vale `outros`.
- `contas.prototipo_origem text unique`, gravado junto com `importado_prototipo_em` pela função `marcar_importacao(conta, origem)` (`security definer`; confere `meu_perfil(conta) = 'gestor'`), porque `app_user` não altera `contas` além do nome.
- `anexos_aviso_em date` em `clientes`, para o aviso não ir duas vezes (seção 11).
- Política de **insert em `auditoria`** para `app_user`, restrita a `acao in ('ver', 'baixar')`, à própria conta e a `usuario_id = meu_usuario_id()`. Leitura continua só do gestor.
- Nenhuma mudança na RLS de `clientes`, `documentos`, `arquivos` e `historico`: elas já existem e têm teste. A fase acrescenta casos de teste (seção 13).

## 13. Testes e CI

- **db:**
  - os gatilhos com `app.importando` desligado e ligado;
  - os 12 tipos populados;
  - funcionária não lê `vw_remuneracao`, `contas_config` nem `clientes_remuneracao` pelas rotas novas;
  - insert em `auditoria` só com `ver` e `baixar` da própria conta;
  - corretor não anexa a cliente de outro corretor (já preparado para a fase 3).
- **worker:**
  - cada rota da seção 7 com G, F e um usuário de outra conta;
  - conta pendente ou suspensa não grava;
  - upload grava a linha e o objeto (s3mock);
  - link temporário grava a auditoria;
  - importação de um JSON de exemplo (com dados inventados em `tests/fixtures/`) bate com o esperado e não roda duas vezes;
  - a mesma `origem` não entra em uma segunda conta;
  - a rotina da seção 11 avisa e apaga.
- **unit:**
  - regras de `src/regras/`: ativo, parado, cobrança, faltando, ordenação, mensagens, link do WhatsApp, cota, dinheiro, hoje em Brasília;
  - os mesmos casos de borda do protótipo (por exemplo, telefone com 10 ou 11 dígitos ganha o 55).
- **e2e** (Playwright, s3mock no CI):
  - gestor liberado cadastra corretor e cliente;
  - anexa um PDF e o documento fica recebido;
  - cobra pelo WhatsApp: o link abre numa aba interceptada, o gestor responde "Sim" e o contador sobe;
  - muda a etapa para Assinatura e vê o VGV;
  - a funcionária entra e não vê VGV nem remuneração;
  - outra conta não abre o cliente pela URL.
- **CI:** os jobs `app`, `db` e `e2e` continuam. O `e2e` ganha o s3mock.

## 14. Documentos a atualizar nesta fase

- **DECISOES:** D-39 (P-02) e D-40 (P-11) já entraram junto com esta spec. A P-07 (5 dias) foi confirmada pelo Jean.
- **SRS:** RF-36 sem "pendência P-02"; RF-90 citando o botão de exportar; a origem "Protótipo" continua valendo.
- **MODELO-DE-DADOS:** substituir a seção 8 pelo mapeamento da seção 10.3; acrescentar `anexos_aviso_em`, a marca `app.importando` e a política de insert da auditoria.
- **ARQUITETURA:** rotas da seção 7 (`/api/importar` vira `/api/contas/:contaId/importacao`, e o link de arquivo passa para dentro da conta); segredos S3; rotina de anexos.
- **SEGREDOS:** as variáveis S3 e como criar a chave S3 no Supabase.
- **FLUXOS:** §4 com o detalhe da seção 9; §8 com o atalho "Importar do protótipo".
- **CLAUDE.md e README:** estado atual e comandos novos, se houver.

## 15. Fica com o builder

- Biblioteca de assinatura S3 e de conversão de HEIC.
- Formato exato das respostas da API e os tipos em `src/tipos-api.ts`.
- Como os componentes da ficha se dividem.
- A ordem das tarefas e a divisão em PRs, um por assunto, como o Jean prefere. Sugestão: (1) banco e regras puras; (2) clientes e ficha; (3) documentos e anexos; (4) cobrança e corretores; (5) VGV; (6) importação e botão no protótipo; (7) rotina de anexos e e2e.

## 16. Escolhas minhas e perguntas para o Jean

**Respostas do Jean (22/11/2026):**
1. **Os clientes de escritórios diferentes não se misturam.** Cada correspondente exporta da própria cópia do protótipo, e o banco garante que uma cópia entra em uma conta só (seção 10).
2. **P-07:** o aviso continua 5 dias antes de apagar os anexos.

**Escolhas para conferir:**
1. Visual do app atual (tokens de `src/index.css`) com o conteúdo e a organização do protótipo. Não copio as cores nem as fontes do protótipo (seção 6).
2. Lista carrega todos os clientes da conta e filtra no navegador (seção 3).
3. Upload passa pelo Worker (seção 3).
4. Importação só em conta vazia e uma vez só (seção 10.2).
5. CPF ou telefone inválido no protótipo entra assim mesmo, com aviso, em vez de barrar a importação (seção 10.2).
6. `remRecebida` sem data vira a data da nota de histórico, ou a da importação (seção 10.3).
7. A exclusão programada de anexos entra já nesta fase, porque é quando os anexos passam a existir (seção 11).
8. Remover um anexo não desmarca o documento, como no protótipo (seção 7).
9. A pergunta "Enviou?" sem resposta fica pendurada como "Cobrança aberta" (seção 9).
