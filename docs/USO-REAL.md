# Uso real da fase 3: roteiro

Central do Correspondente · checklist para o Jean e o William levarem as 2 correspondentes do protótipo para o app (spec da fase 3, §9).

A fase 3 termina quando **as 2 correspondentes usam o app por 2 semanas sem bloqueio**. Este roteiro cobre o que fazer antes de elas entrarem, a entrada de cada escritório e o acompanhamento das 2 semanas.

> O arquivo exportado do protótipo tem nomes, CPFs e telefones de clientes reais. Ele **nunca** entra no repositório, em issue, em PR ou em conversa com o Claude. Guarde só enquanto durar a importação e apague depois.

---

## 1. Antes de as correspondentes entrarem

- [ ] **Supabase no plano pago, com backup diário** (D-25, RNF-08). No painel do projeto de São Paulo (`uxxpbjfshtwgdtcuhrbc`):
  - *Organization → Billing*: plano pago;
  - *Database → Backups*: backups diários aparecendo.
- [ ] **Projeto de Oregon** (`tlpumcurfxwmalkarpjt`) pausado ou apagado. Ele não tem dados reais.
- [ ] **Termos revisados (P-12).** Os sócios, de preferência com um advogado, revisam o texto do PR 5 da fase 3. O PR só é mergeado depois disso. Quem aceitou a versão provisória vê "Termos atualizados" no próximo acesso.
- [ ] **Banco e app de produção atualizados**, nesta ordem: primeiro as migrations, depois o deploy.

  ```bash
  criptenv run -e production -p <projeto> -- pnpm db:migrate
  ```

  ```bash
  pnpm deploy:producao
  ```

- [ ] **Workers Logs ligados.** No painel da Cloudflare: *Workers & Pages → central-do-correspondente → Observability*. Depois do deploy aparecem os pedidos e, quando houver, os erros (ver §3).
- [ ] **E-mail funcionando.** Faça um cadastro de teste com um e-mail seu e confira que a confirmação chega (Resend, D-38). Se não chegar, olhe *Resend → Logs*.

## 2. Para cada correspondente

Faça um escritório de cada vez. Comece pela correspondente com menos clientes.

### 2.1 Escritório
- [ ] A gestora cria o escritório em https://central-correspondente.wdias.tech/criar-escritorio, no plano **Com corretores** se ela tem funcionária ou corretores com acesso, e confirma o e-mail.
- [ ] Liberar como cortesia (D-07), com a data combinada para o fim da cortesia:

  ```bash
  criptenv run -e production -p <projeto> -- pnpm conta:liberar <email-da-gestora> <AAAA-MM-DD>
  ```

- [ ] A gestora entra de novo e confere que o aviso "Conta aguardando liberação" sumiu.

### 2.2 Dados do protótipo
- [ ] Quem é dono do Artifact da correspondente **republica** `docs/prototipo/prototipo.html` no **mesmo** Artifact (mesmo link), para ganhar o botão "Exportar JSON". Os dados ficam no banco do Artifact e continuam lá. Detalhes em `docs/prototipo/README.md`.
- [ ] No protótipo: **Exportar JSON** (baixa `central-AAAA-MM-DD.json`; se o download for bloqueado, use o painel para copiar).
- [ ] No app, com a gestora: **Importar do protótipo** → escolher o arquivo → conferir a **prévia** e os avisos (CPF ou telefone inválido vira nota no cliente) → **Importar**.
  - A importação só funciona com o escritório vazio e uma vez só. A mesma cópia do protótipo não entra em dois escritórios (D-40).

### 2.3 Conferir os números (fecha o critério da fase 2)
Com o protótipo e o app abertos lado a lado, anote os dois valores de cada linha:

| O quê | Onde no protótipo | Onde no app |
|---|---|---|
| Total de clientes | Clientes, card "Todos" | Clientes, card "Todos" |
| Processos ativos | Início | Início |
| Cobrar hoje | Início | Início e "Cobrar hoje" |
| Parados há 7+ dias | Início | Início |
| Clientes por etapa | Clientes, filtro de etapa | Clientes, filtro de etapa |
| Clientes por corretor | Início, tabela por origem | Início, tabela por origem |
| Documentos recebidos de 3 clientes escolhidos | ficha | ficha |
| Percentual atual e VGV do mês | VGV | VGV e comissões |

- [ ] Todos batem. Se algum não bater, **pare aqui**: não apague o arquivo exportado e conte qual linha divergiu, sem mandar os dados dos clientes.

### 2.4 Anexos
Os anexos do protótipo não vêm na importação.
- [ ] Reenviar aos poucos pela ficha de cada cliente, começando pelos processos ativos com cobrança vencida ou perto da assinatura. Processo finalizado não precisa.

### 2.5 Equipe
- [ ] Funcionária: *Equipe e acessos → E-mail da funcionária → Enviar convite* (o plano Com corretores aceita 1).
- [ ] Corretores: *Corretores parceiros → Editar → E-mail → Convidar para o portal*. O corretor vê só os clientes dele (sem CPF, contrato, cobrança nem valores do escritório) e pode anexar documentos.
- [ ] Combinar com a equipe: **cada pessoa usa o próprio acesso, sem dividir senha**, e a partir de hoje nada se cadastra no protótipo.

## 3. Durante as 2 semanas

- **Canal:** problemas pelo WhatsApp do William. Peça print da tela e o horário; nunca CPF ou documento do cliente.
- **Bloqueio ou lista?**
  - **Bloqueio** (correção no mesmo dia): não consegue entrar, cadastrar cliente, salvar a ficha, anexar, cobrar ("Enviou?") ou importar; dado de um escritório aparecendo em outro; corretor vendo cliente que não é dele.
  - **Lista para depois:** texto, ordem, cor, atalho, "seria bom se…".
- **Workers Logs a cada 2 ou 3 dias** (*Observability → Logs*, filtro por nível `error`). Os registros do app têm o campo `onde`:

  | `onde` | O que é | O que fazer |
  |---|---|---|
  | `rota <MÉTODO> <caminho>` | erro sem tratamento numa rota da API; traz `codigo` e `constraint` quando vem do banco | anotar a rota e o código e abrir uma correção |
  | `e-mail não enviado` | a Resend recusou ou não respondeu | conferir *Resend → Logs* e o domínio verificado |
  | `rotina diária` · `anexo vencido não apagado` · `órfão não apagado` | a rotina das 3h (exclusão de anexos) falhou em parte | ela tenta de novo no dia seguinte; se repetir 2 dias, abrir uma correção |
  | `auth` | aviso ou erro do login | olhar junto com o relato de quem não conseguiu entrar |

  Os logs não guardam nome, CPF, e-mail, telefone, nome de arquivo nem dados de ficha (`worker/log.ts`). Se aparecer algum dado pessoal num log, isso é um bloqueio.
- **Protótipo:** continua no ar só para consulta até o fim das 2 semanas.

## 4. Fim das 2 semanas
- [ ] 2 semanas seguidas sem bloqueio nas 2 correspondentes: a fase 3 está pronta. Registrar a data em `docs/DECISOES.md` e no `CLAUDE.md`.
- [ ] Combinar com cada dona de Artifact o que fazer com o protótipo (arquivar ou apagar) e apagar os arquivos exportados.
- [ ] A lista "para depois" vira entrada para a fase 4.
