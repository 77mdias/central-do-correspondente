# SRS — Especificação de Requisitos de Software

Central do Correspondente · versão 0.1 · 13/11/2026

Cada requisito tem código para ser citado em tarefas, commits e testes.
**Origem:** `Protótipo` = já existe no protótipo, precisa ser refeito no banco novo · `Novo` = não existe ainda · `Alterado` = existe, mas muda · `Removido` = saiu do escopo.

Perfis: **G** gestor · **F** funcionária · **C** corretor.

---

## 1. Requisitos funcionais

### 1.1 Acesso e contas

| Código | Requisito | Origem |
|---|---|---|
| RF-60 | Entrar com e-mail e senha; recuperar senha por e-mail | Novo |
| RF-61 | Cada escritório é uma conta; todo registro pertence a uma conta | Novo |
| RF-62 | Perfis gestor, funcionária e corretor, com as permissões da seção 3 | Novo |
| RF-63 | Máximo de 1 gestor e 1 funcionária ativos por conta; corretores ilimitados | Novo |
| RF-64 | Convidar pessoa por e-mail: o app cria o acesso e envia link para ela definir a senha. G convida F e C; F convida C | Novo |
| RF-65 | Reenviar convite e desativar acesso (o histórico da pessoa permanece) | Novo |
| RF-66 | Uma pessoa pode pertencer a várias contas; ao entrar, escolhe o escritório e pode trocar depois | Novo |
| RF-67 | Aceitar termo de uso e política de privacidade antes do primeiro uso; registrar versão e data do aceite | Novo |
| RF-68 | Painel do sistema (só administradores do sistema): listar contas, status da assinatura e definir "ativa até" para cortesia | Novo |

### 1.2 Início

| Código | Requisito | Origem |
|---|---|---|
| RF-01 | Contadores de processos ativos, cobrar hoje, com documento faltando e parados há 7+ dias; cada contador abre a lista filtrada | Protótipo |
| RF-02 | Até 6 cobranças do dia com botão de WhatsApp | Protótipo |
| RF-03 | Até 6 processos parados e até 6 com documentos faltando, mostrando os 3 primeiros documentos pendentes | Protótipo |
| RF-04 | Tabela por origem (corretor ou cliente direto) com ativos, cobrar, pendência e parados; até 8 linhas | Protótipo |
| RF-05 | As 7 últimas entradas de histórico de todos os clientes | Protótipo |

### 1.3 Clientes

| Código | Requisito | Origem |
|---|---|---|
| RF-10 | Cadastrar cliente com nome (obrigatório), CPF, WhatsApp, e-mail, modalidade, origem, valor do imóvel e valor a financiar | Protótipo |
| RF-11 | Cliente novo entra em "Documentação pendente", com cobrança para hoje e intervalo de 3 dias | Protótipo |
| RF-12 | Buscar por nome, nº do contrato, corretor, imobiliária, CPF ou telefone (dígitos a partir de 3) | Protótipo |
| RF-13 | Filtrar por origem, etapa e pelos cards: ativos, cobrar hoje, com pendência, parados, finalizados | Protótipo |
| RF-14 | Ordenar: ativos primeiro, depois cobrança vencida, depois mais dias sem atualização | Protótipo |
| RF-15 | Editar campos na ficha com salvamento automático (700 ms após parar de digitar) | Protótipo |
| RF-16 | Mudar a etapa entre as 10 etapas, com registro no histórico | Protótipo |
| RF-17 | Anotar atualizações livres no histórico, **sem limite de entradas** | Alterado |
| RF-18 | Excluir cliente com confirmação em dois cliques | Protótipo |
| RF-19 | Validar CPF (dígitos verificadores), telefone brasileiro (10 ou 11 dígitos, com DDD) e e-mail | Novo |

### 1.4 Documentos

| Código | Requisito | Origem |
|---|---|---|
| RF-20 | Checklist de 12 documentos em 2 grupos: Comprador (8) e Imóvel e vendedor (4), mais "Outros arquivos". Lista única para todas as modalidades | Protótipo |
| RF-21 | Marcar documento como recebido com data; desmarcar volta a pendente | Protótipo |
| RF-22 | Anexar PDF (até 20 MB) ou foto (JPG, PNG, WebP, HEIC); fotos acima de 2,5 MB reduzidas para 2.200 px em JPG no navegador | Protótipo |
| RF-23 | Anexar um arquivo marca o documento como recebido | Protótipo |
| RF-24 | Remover anexo com confirmação (G e F) | Protótipo |
| RF-25 | Checklist diferente por modalidade | **Removido** |
| RF-26 | Abrir ou baixar anexo só por link temporário, com registro na auditoria | Novo |
| RF-27 | Apagar anexos automaticamente conforme RN-14, com aviso prévio a G e F | Novo |

### 1.5 Cobrança

| Código | Requisito | Origem |
|---|---|---|
| RF-30 | Gerar mensagem para o cliente listando os documentos que faltam | Protótipo |
| RF-31 | Abrir o WhatsApp do cliente com a mensagem pronta (`wa.me`, DDI 55 automático) | Protótipo |
| RF-32 | Registrar a cobrança: data, contador e próxima data pelo intervalo (1, 2, 3, 5 ou 7 dias) | Protótipo |
| RF-33 | Mudar a data da próxima cobrança manualmente | Protótipo |
| RF-34 | Copiar a mensagem quando não houver WhatsApp cadastrado | Protótipo |
| RF-35 | Avisar G e F das cobranças do dia sem abrir o app: push (PWA) e e-mail diário | Novo |
| RF-36 | Ao voltar do WhatsApp, perguntar "Enviou?"; registrar a cobrança só se sim (pendência P-02) | Novo |

### 1.6 Corretores parceiros

| Código | Requisito | Origem |
|---|---|---|
| RF-40 | Cadastrar corretor com nome (obrigatório), imobiliária, WhatsApp, CRECI e e-mail | Protótipo |
| RF-41 | Card por corretor com ativos, contratados, VGV ativo e alertas (cobrar, pendência, parados). VGV só para G | Alterado |
| RF-42 | Card fixo "Clientes diretos" para clientes sem corretor | Protótipo |
| RF-43 | Mensagem para o corretor com a situação e documentos faltando de cada cliente dele | Protótipo |
| RF-44 | Impedir remover corretor que ainda tem clientes | Protótipo |
| RF-45 | Botão "Convidar para o portal" no cadastro do corretor (exige e-mail) e indicação de status: sem acesso, convidado, ativo | Novo |

### 1.7 VGV e comissões (só gestor)

| Código | Requisito | Origem |
|---|---|---|
| RF-50 | Definir o percentual atual de remuneração (0 a 100%) e guardar **todas** as alterações | Alterado |
| RF-51 | Pipeline (não contratado): VGV, financiamento previsto e remuneração prevista | Protótipo |
| RF-52 | VGV contratado por período: este mês, mês anterior, este ano, tudo | Protótipo |
| RF-53 | Valor financiado, cota média, remuneração, remuneração recebida e ticket médio | Protótipo |
| RF-54 | Tabela por origem com contratos, VGV, financiado, remuneração e em andamento; tocar na linha abre Clientes filtrado | Protótipo |
| RF-55 | Barra de VGV por etapa | Protótipo |
| RF-56 | Marcar remuneração como recebida por cliente | Protótipo |
| RF-57 | Exportar relatório do período em PDF e planilha | Novo |

### 1.8 Portal do corretor

| Código | Requisito | Origem |
|---|---|---|
| RF-80 | Lista "Meus clientes" com busca, etapa, dias sem atualização e quantidade de documentos pendentes | Novo |
| RF-81 | Ficha do cliente em leitura: dados de contato, modalidade, etapa, valor do imóvel, valor financiado e checklist | Novo |
| RF-82 | Anexar arquivo em qualquer item do checklist dos próprios clientes (marca como recebido e entra no histórico com o nome dele) | Novo |
| RF-83 | Ver histórico conforme pendência P-03 | Novo |
| RF-84 | Trocar de escritório quando o corretor atende mais de uma correspondente | Novo |

### 1.9 Assinatura

| Código | Requisito | Origem |
|---|---|---|
| RF-70 | Criar cliente e assinatura recorrente no Asaas para a conta (R$ 99,00/mês) | Novo |
| RF-71 | Receber webhook do Asaas e atualizar o status da conta (ativa, em atraso, suspensa, cancelada) | Novo |
| RF-72 | Tela de assinatura para o gestor: status, próximo vencimento e link da fatura | Novo |
| RF-73 | Conta suspensa fica somente leitura para todos os perfis, com aviso fixo | Novo |

### 1.10 Migração

| Código | Requisito | Origem |
|---|---|---|
| RF-90 | Importar o JSON do protótipo (clientes, corretores, percentual) para uma conta nova, só uma vez por conta, com prévia antes de gravar | Novo |

---

## 2. Regras de negócio

| Código | Regra |
|---|---|
| RN-01 | Etapas, em ordem: Cadastro, Documentação pendente, Análise de crédito, Crédito aprovado, Avaliação do imóvel, Conformidade, Assinatura do contrato, Registro em cartório, Concluído, Reprovado / Cancelado |
| RN-02 | Processo ativo = qualquer etapa exceto Concluído e Reprovado / Cancelado |
| RN-03 | Processo parado = ativo e sem atualização há 7 dias ou mais |
| RN-04 | Só há cobrança se o processo está ativo e falta pelo menos 1 documento. Data menor que hoje = atrasada; igual = cobrar hoje |
| RN-05 | Contratado = tem data de assinatura e não está cancelado |
| RN-06 | Ao mudar para Registro em cartório ou Concluído sem data de assinatura, gravar a data de hoje |
| RN-07 | Ao gravar a data de assinatura, o percentual atual fica congelado no contrato; mudar o percentual geral depois não altera contratos antigos |
| RN-08 | Percentual usado, em ordem: próprio do cliente, depois o do contrato, depois o atual |
| RN-09 | Remuneração = valor financiado × percentual ÷ 100 |
| RN-10 | Cota financiada = valor financiado ÷ valor do imóvel; VGV = soma do valor do imóvel |
| RN-11 | Mudar a data de assinatura mantém o percentual congelado. Apagar a data apaga o percentual congelado; gravar de novo congela o percentual vigente. As duas ações vão para o histórico |
| RN-12 | "Atualização" (para RN-03) = qualquer alteração na ficha, mudança de etapa, nota no histórico, documento marcado/desmarcado ou anexo enviado, por qualquer perfil |
| RN-13 | Cobrança registrada: última cobrança = agora; contador + 1; próxima = hoje + intervalo |
| RN-14 | Anexos são apagados 30 dias após a data de assinatura; em cancelados sem assinatura, 30 dias após entrar em Reprovado / Cancelado. A marcação "recebido" e a ficha permanecem. Aviso a G e F alguns dias antes (P-07) |
| RN-15 | Se a data de assinatura for apagada ou o processo voltar a uma etapa ativa, o agendamento de exclusão é cancelado |
| RN-16 | Conta com pagamento vencido há mais de 7 dias fica somente leitura até a confirmação do pagamento |
| RN-17 | Funcionária e corretor nunca recebem do banco os campos de percentual e remuneração (garantido por RLS, não só pela tela) |

---

## 3. Matriz de permissões

| Ação | G | F | C |
|---|:-:|:-:|:-:|
| Ver Início, Clientes, Cobrar hoje | ✓ | ✓ | — |
| Ver clientes de todos os corretores | ✓ | ✓ | — |
| Ver só os próprios clientes | — | — | ✓ |
| Cadastrar, editar, excluir cliente | ✓ | ✓ | — |
| Mudar etapa, anotar histórico | ✓ | ✓ | — |
| Ver valor do imóvel e financiado | ✓ | ✓ | ✓ |
| Ver percentual, remuneração, VGV e comissões | ✓ | — | — |
| Alterar percentual, marcar remuneração recebida | ✓ | — | — |
| Exportar relatório de VGV | ✓ | — | — |
| Marcar documento recebido | ✓ | ✓ | — |
| Anexar arquivo | ✓ | ✓ | ✓ (próprios) |
| Baixar arquivo | ✓ | ✓ | ✓ (próprios) |
| Remover anexo | ✓ | ✓ | — |
| Registrar cobrança | ✓ | ✓ | — |
| Cadastrar e editar corretores | ✓ | ✓ | — |
| Convidar corretor | ✓ | ✓ | — |
| Convidar ou desativar funcionária | ✓ | — | — |
| Ver auditoria | ✓ | — | — |
| Gerenciar assinatura | ✓ | — | — |
| Receber lembrete diário | ✓ | ✓ | — |

Com a conta suspensa (RN-16), todas as ações de escrita ficam bloqueadas para todos.

---

## 4. Requisitos não funcionais

| Código | Requisito | Origem |
|---|---|---|
| RNF-01 | Funcionar em celular e computador; menu lateral vira menu deslizante abaixo de 900 px | Protótipo |
| RNF-02 | Tema claro e escuro conforme o aparelho | Protótipo |
| RNF-03 | Atualização em tempo real entre usuários com o app aberto | Protótipo |
| RNF-04 | Aviso quando os dados não carregam em 10 segundos | Protótipo |
| RNF-05 | Valores em reais e datas no padrão brasileiro; fuso America/Sao_Paulo para "hoje" | Protótipo |
| RNF-06 | Controle de acesso por conta e perfil aplicado no banco (RLS) | Novo |
| RNF-07 | LGPD: termos com aceite registrado, auditoria de visualização/alteração/download, prazo dos anexos | Novo |
| RNF-08 | Backup diário do banco e exportação dos dados da conta pelo gestor | Novo |
| RNF-09 | Instalável como PWA (manifest, ícones, service worker) | Novo |
| RNF-10 | Dados hospedados no Brasil (Supabase região São Paulo) | Novo |
| RNF-11 | Arquivos em bucket privado; links temporários com validade curta (até 5 minutos) | Novo |
| RNF-12 | Todo texto da interface em português | Protótipo |
| RNF-13 | Testes automatizados das regras de negócio (RN) e das políticas de acesso por perfil | Novo |
