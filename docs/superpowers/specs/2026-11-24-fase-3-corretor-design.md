# Fase 3 — Portal do corretor e uso real: design

Central do Correspondente · 24/11/2026 · status: **aprovada pelo Jean em 24/11/2026** (merge do PR 25)

Este documento manda sobre os outros de `docs/` onde eles divergem; a atualização deles faz parte da fase (seção 11).

## 1. Intenção

A fase 3 abre o app para o corretor parceiro, no plano Com corretores, e prepara o uso de verdade pelas 2 correspondentes que hoje usam o protótipo.

**Pronto quando:**
- um corretor convidado entra e vê **só os clientes dele**: dados de contato, etapa, valores e checklist. Ele anexa documentos, e o escritório vê o anexo com o nome do corretor. Isso está provado por teste no banco, nas rotas e no navegador;
- o texto real dos termos de uso e da política de privacidade está no ar, e quem aceitou a versão provisória aceita a nova no próximo acesso (RF-67);
- **as 2 correspondentes usam o app por 2 semanas sem bloqueio** (critério do PRD), com os dados importados do protótipo (fase 2).

## 2. Decisões

| # | Decisão | Fecha |
|---|---|---|
| 1 | O corretor vê no histórico só as mudanças de etapa e os anexos dos próprios clientes. Não vê observações, notas nem cobranças (Jean, 24/11/2026) | P-03 |

A RLS já segue essa regra desde a fase 1: a política `historico_ler` libera ao corretor só os tipos `etapa` e `documento` dos próprios clientes.

## 3. Abordagens consideradas

**Onde fica o portal (escolhida: A)**
- **A — Mesma SPA e mesma casca (`/e/:contaId`), com um menu próprio para o perfil corretor.** O login, a troca de escritório (RF-84) e o aviso de conta já existem. Só o conteúdo muda por perfil.
- **B — Um app separado (`/portal`).** Descartada: duplicaria login, casca e troca de escritório para meia dúzia de telas.

**Quais colunas o corretor recebe (escolhida: A)**
- **A — Rotas próprias do portal (`/api/contas/:contaId/portal/...`), que selecionam só as colunas permitidas.** A RLS continua decidindo **quais clientes** ele vê. **Quais campos** ele vê fica na rota, porque um papel só (`app_user`) atende todos os perfis e o Postgres não restringe coluna por perfil. As rotas do escritório continuam respondendo 404 ao corretor, e o teste prova as duas coisas.
- **B — Uma view por perfil.** Descartada por ora: daria o mesmo resultado com mais uma peça no banco. Se o portal crescer, a lista de colunas vira uma view.

## 4. Objetivos

1. **Portal do corretor** (RF-80 a RF-84): "Meus clientes", ficha em leitura, anexar e histórico conforme a decisão 1.
2. **Auditoria de leitura do corretor:** abrir a ficha grava `ver`, como para o escritório. Hoje a política só aceita `ver` do escritório.
3. **Termos reais (RF-67):** texto `v1`, novo aceite para quem aceitou a versão `rascunho-1` e registro de versão e data.
4. **Logs do Worker em produção** (Workers Logs), para acompanhar erros durante o uso real, sem dados pessoais nos logs.
5. **Roteiro do uso real** (seção 9): o que precisa estar feito antes de as correspondentes entrarem e como acompanhar as 2 semanas.

## 5. Não objetivos

- Asaas, lembrete diário por push e e-mail, relatórios, página de venda e painel do sistema: fase 4. As 2 correspondentes entram como cortesia, pelo `conta:liberar` (D-07).
- O corretor não marca nem desmarca documento à mão, não remove anexo, não edita a ficha e não vê cobrança, percentual nem remuneração (matriz de permissões do SRS).
- Notificação ao escritório quando o corretor anexa: a lista atualiza a cada 30 s (D-32), e o anexo aparece em "Últimas atualizações".

## 6. Telas do corretor

| Tela | Rota | Conteúdo |
|---|---|---|
| Meus clientes (RF-80) | `/e/:contaId` (Início do corretor) | busca por nome; filtro por etapa; para cada cliente: etapa, dias sem atualização (em vermelho a partir de 7) e documentos pendentes; ativos primeiro |
| Ficha em leitura (RF-81 a RF-83) | painel lateral `?cliente=<id>` | nome, WhatsApp e e-mail, modalidade, etapa, valor do imóvel e financiado; checklist com "Anexar" em cada item; anexos com abrir (link de 5 min); histórico só de etapa e anexos |
| Trocar de escritório (RF-84) | `/escritorios` | já existe |

**Menu do corretor:** "Meus clientes" e, se ele atende mais de uma correspondente, "Trocar de escritório". Nada de Clientes, Cobrar hoje, Corretores, VGV nem Equipe.

**Campos que o corretor não recebe:** CPF, observações, número e data do contrato, cobrança (próxima data, intervalo, contador) e qualquer percentual ou remuneração. Ver a escolha 1 da seção 12.

## 7. API do portal

As rotas ficam sob `/api/contas/:contaId/portal/` e rodam em `withUser`. Respondem 404 a quem não é corretor ativo da conta (`meu_perfil(conta) = 'corretor'`).

| Rota | Faz |
|---|---|
| `GET …/portal/clientes` | Clientes do corretor (a RLS filtra por `corretor_id`), só com as colunas da seção 6, mais `documentos` e a contagem de anexos |
| `GET …/portal/clientes/:id` | Ficha do portal: cliente (colunas da seção 6), documentos, anexos sem caminho e histórico (a RLS já filtra os tipos). Grava `auditoria` com `ver` |
| `POST …/clientes/:id/arquivos` | **Já existe.** A RLS de `arquivos` aceita o corretor no próprio cliente, e o gatilho marca o documento e escreve "Anexado por {nome}" (RF-23, RF-82). A rota hoje lê o cliente com todas as colunas só para confirmar que existe; passa a usar uma checagem que não depende do perfil |
| `GET …/arquivos/:id/link` | **Já existe.** RLS e auditoria `baixar` já aceitam o corretor |

As rotas do escritório (`…/clientes`, `…/corretores`, `…/vgv`, `…/historico` e as demais) continuam com `exigirEscritorio` e respondem 404 ao corretor.

## 8. Termos de uso e política de privacidade (RF-67)

- **Texto `v1`.** Eu escrevo o rascunho a partir das decisões já tomadas:
  - a correspondente é a **controladora** dos dados dos clientes dela, e nós somos **operadores**;
  - os dados e documentos do cliente são compartilhados com o corretor que o indicou (D-22);
  - os anexos são apagados 30 dias depois da assinatura (D-21);
  - os dados ficam no Brasil;
  - cada pessoa usa o próprio acesso, sem dividir senha (PRD, riscos).

  O texto entra como pendência **P-12**: precisa da revisão dos sócios, de preferência com um advogado, antes do uso real. Eu não sou essa revisão.
- **Novo aceite.** `TERMOS_VERSAO` passa a `v1`. Quem entra com `termosVersao` diferente da atual cai na tela "Termos atualizados", que mostra os textos e o botão "Li e aceito". A nova rota `POST /api/termos/aceitar` grava versão e data como `app_system`, só para o usuário da sessão. Cadastro e convite já gravam a versão atual.

## 9. Roteiro do uso real

**Antes de as correspondentes entrarem (Jean e William):**
1. Projeto Supabase de São Paulo no **plano pago, com backup diário** (D-25, RNF-08). Conferir no painel.
2. Projeto de Oregon pausado ou apagado.
3. Texto dos termos revisado (P-12) e publicado.
4. Para cada correspondente:
   - escritório criado pelo cadastro e liberado com `conta:liberar` (cortesia, D-07);
   - protótipo republicado com o botão "Exportar JSON", dados exportados e importados;
   - números conferidos com o protótipo (fecha o critério da fase 2);
   - anexos reenviados aos poucos, a partir dos processos ativos.
5. Funcionária e corretores convidados pelas telas.

**Durante as 2 semanas:**
- um canal direto (WhatsApp do William) para relatar problemas;
- Workers Logs olhados a cada 2 ou 3 dias;
- tudo o que **bloqueia** o trabalho vira correção no mesmo dia, e o resto entra numa lista para depois;
- o protótipo continua no ar, só para consulta, até o fim das 2 semanas.

## 10. Testes e CI

- **db:**
  - o corretor registra `ver` só do próprio cliente;
  - os casos de corretor que já existem continuam (lê só os próprios clientes, histórico só de etapa e documento, anexa só nos próprios).
- **worker:**
  - `portal/clientes` devolve só os clientes do corretor e nunca as chaves `cpf`, `observacoes`, `numeroContrato`, `dataAssinatura`, `proximaCobranca`, `intervaloCobranca`, `qtdCobrancas`, `ultimaCobranca` nem qualquer `pct*` ou `remuneracao*`;
  - a ficha do portal tem histórico sem notas;
  - um corretor abrindo cliente de outro corretor recebe 404;
  - as rotas do escritório dão 404 ao corretor;
  - o corretor anexa (documento marcado e "Anexado por") e não remove (403);
  - termos: entrar com `rascunho-1` exige o novo aceite, e `POST /api/termos/aceitar` grava a versão `v1`.
- **e2e:**
  1. a gestora cadastra o corretor com e-mail e o convida pela ficha;
  2. o corretor aceita pelo Mailpit e vê só o cliente dele;
  3. ele anexa um PDF;
  4. a gestora vê o documento recebido e "Anexado por {corretor}" no histórico.

## 11. Documentos a atualizar

- **DECISOES:** D-41 (P-03) já entra com esta spec. P-12 nova (texto dos termos, revisão jurídica).
- **SRS:** RF-83 cita a D-41; RF-67 com a versão `v1` e o novo aceite.
- **ARQUITETURA:** rotas do portal e de termos; Workers Logs.
- **FLUXOS:** §6 com "a lista atualiza a cada 30 s" no lugar de "em tempo real".
- **CLAUDE.md:** estado da fase 3.

## 12. Escolhas minhas para o Jean conferir

1. O corretor **não vê o CPF** nem os dados do contrato. O RF-81 fala em "dados de contato", e o CPF não é necessário para ele cobrar documentos (minimização, LGPD). Se o William quiser o CPF visível, é uma linha na rota.
2. O corretor vê **todos os anexos** do próprio cliente, inclusive os que o escritório enviou, porque o checklist é um só (RF-81). Ele não remove nenhum.
3. Novo aceite dos termos no próximo acesso para todos que aceitaram a versão provisória.
4. Workers Logs ligados em produção. Os logs atuais registram só erros técnicos, nunca nome, CPF ou conteúdo de ficha. Um teste confere que as mensagens de erro do Worker não levam dados de cliente.
5. O texto dos termos: eu escrevo o rascunho, os sócios revisam (P-12).
