# PRD — Documento de Requisitos do Produto

Central do Correspondente · versão 0.1 · 13/11/2026
Base: Briefing e Documentação do Produto (03/11/2026) + [DECISOES.md](DECISOES.md).

## 1. Problema

O correspondente Caixa toca dezenas de processos ao mesmo tempo, quase todos trazidos por corretores parceiros. O controle fica espalhado entre planilhas, conversas de WhatsApp e pastas de documentos. Por isso ele:

- perde a data de cobrar documentos;
- não vê quais processos estão parados;
- não sabe com clareza quanto vai receber de remuneração;
- passa o dia respondendo corretores que perguntam "como está meu cliente?".

## 2. Público

| Perfil | Quem é | O que precisa |
|---|---|---|
| Gestor | O correspondente bancário Caixa, dono do escritório e pagante | Ver o que fazer hoje, cobrar documentos, acompanhar etapas e saber quanto vai receber |
| Funcionária (plano Com corretores) | Assistente do escritório | Cadastrar clientes e corretores, anexar documentos, registrar andamento |
| Corretor parceiro (login só no plano Com corretores) | Indica clientes ao correspondente | Acompanhar sozinho a situação dos clientes dele e mandar documentos |

Cliente final (comprador do imóvel) não usa o app.

## 3. Objetivos

1. **Nenhuma cobrança esquecida:** todo cliente com pendência tem data da próxima cobrança.
2. **Nenhum processo parado sem ser visto:** sem atualização há 7+ dias aparece em destaque.
3. **Remuneração previsível:** VGV e comissão calculados por período e por corretor.
4. **Cobrança em um toque:** mensagem pronta no WhatsApp para cliente e corretor.
5. **Menos perguntas de corretor:** o corretor acompanha sozinho no portal.
6. **Dados protegidos:** cada pessoa vê só o que o perfil permite, com registro de acesso (LGPD).

## 4. Métricas de sucesso

| Métrica | Como medir |
|---|---|
| Cobranças em atraso | Quantidade em "Cobrar hoje" com status atrasado |
| Processos parados | Contador "Parados há 7+ dias" |
| Tempo até documentação completa | Do cadastro até o último documento recebido |
| Remuneração a receber | Contratos assinados sem remuneração recebida |
| Adoção do portal | % de corretores convidados que entraram ao menos 1 vez no mês |
| Retenção | Escritórios com assinatura ativa mês a mês |

Ainda não há metas numéricas.

## 5. Modelo de negócio

- Dois planos, cobrados por escritório:
  - **Simples — R$ 99,00/mês:** só o gestor. Corretores entram como cadastro (origem do cliente, ranking, mensagem pelo WhatsApp), sem login.
  - **Com corretores — R$ 149,00/mês:** gestor + 1 funcionária + corretores ilimitados com acesso ao portal.
- Assinatura recorrente no **Asaas**; o gestor pode trocar de plano (vale na hora; o valor novo só a partir da próxima fatura, D-30).
- Sem teste grátis; cortesias são liberadas manualmente.
- Inadimplência: 7 dias de tolerância, depois somente leitura.
- Venda conduzida pelo William, com página de venda de apoio.

## 6. Escopo da v1

### Vem do protótipo (migrar para o banco novo)

| Módulo | O que faz |
|---|---|
| Início | Contadores do dia, cobranças de hoje, parados, documentos faltando, ranking por corretor, últimas atualizações |
| Clientes | Lista com busca e filtros; ficha completa em painel lateral |
| Ficha do cliente | Dados, valores, 10 etapas, observações, checklist de 12 documentos com anexo, cobrança, histórico |
| Cobrar hoje | Cobranças vencidas ou do dia, com WhatsApp e mensagem pronta |
| Corretores parceiros | Cadastro, indicadores por corretor, mensagem de situação |
| VGV e comissões | Percentual, pipeline, VGV contratado por período, tabela por origem, VGV por etapa |

### Novo

| Item | Prioridade |
|---|---|
| Login com e-mail e senha, recuperação de senha | Alta |
| Contas separadas por escritório, perfis gestor / funcionária / corretor | Alta |
| Convite por link | Alta |
| Portal do corretor (acompanhar e anexar), no plano Com corretores | Alta |
| Validação de CPF, telefone e e-mail | Alta |
| Confirmação de envio da cobrança | Alta |
| Adequação à LGPD (termos, auditoria, prazo dos anexos, backup) | Alta |
| Assinatura no Asaas (2 planos e troca de plano) e bloqueio por inadimplência | Alta (fase 4) |
| Lembrete das cobranças do dia (push + e-mail) | Média |
| Exportar relatório de VGV e comissões (PDF e planilha) | Média |
| Importador do JSON do protótipo | Média |
| Painel do sistema (contas, status, cortesia) | Média |

### Fora do escopo da v1

- Integração com sistemas da Caixa.
- Simulador de financiamento.
- Envio automático de WhatsApp (API oficial).
- Portal do cliente final.
- Login de imobiliária.
- Checklist diferente por modalidade.
- Segunda funcionária ou cobrança por usuário.
- Teste grátis automático.

## 7. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| 1. Base | Login (Better Auth), cadastro aberto de escritório, contas, membros, convites, schema com RLS e gatilhos | Usuários de 2 contas diferentes não enxergam dados um do outro; testes de RLS passando |
| 2. Migração | Todas as telas do protótipo + anexos + importador | Correspondente consegue fazer a rotina diária inteira no app novo |
| 3. Corretor e uso real | Portal do corretor; uso pelas 2 correspondentes atuais | 2 escritórios usando por 2 semanas sem bloqueio |
| 4. Venda | Asaas, lembretes, relatórios, termos, página de venda ligada ao cadastro | Escritório novo assina e usa sem ajuda do dev |

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Vazamento de CPF e documentos | RLS desde a fase 1, bucket privado, download auditado, testes por perfil |
| Push não funciona no iPhone sem instalar | Instrução de instalação no primeiro acesso + e-mail de reserva |
| Cobrança registrada sem envio real | Confirmação "Enviou?" (P-02) |
| Corretor ver dado de outro corretor | Política RLS por `corretor_id` + teste dedicado |
| Página de venda prometer o que o app não faz | Revisar a página antes da fase 4 |
| Escritório no Simples divide a senha do gestor com a funcionária | Termos de uso proíbem dividir acesso; a auditoria deixa de distinguir quem fez cada ação |
