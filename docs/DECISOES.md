# Registro de decisões

Decisões tomadas em 13/11/2026 a partir do Briefing e da Documentação do Produto (03/11/2026). Quando uma decisão daqui contradiz aqueles documentos, **vale esta**.

Formato: cada decisão tem código (D-xx), o que foi decidido e por quê.

---

## Produto e negócio

**D-01 · Nome:** o sistema se chama **Central do Correspondente**. Repositório: `central-do-correspondente`. Nada de "Caixa" no nome (marca registrada).

**D-02 · Sociedade:** o desenvolvedor é dono do código; William cuida de negócios e vendas; a venda sai pelo CNPJ do William.

**D-03 · Multi-escritório:** um único sistema atende vários correspondentes. Cada escritório é uma conta isolada; nenhum dado cruza contas.

**D-04 · Plano e preço:** valor fixo de **R$ 99,00/mês por escritório**. Inclui 1 gestor, 1 funcionária e corretores ilimitados. Não há segunda funcionária na v1 (bloqueado, sem adicional pago).

**D-05 · O app não cobra ninguém em nome da correspondente:** é só organização de processos. A única cobrança é a assinatura que a correspondente paga a nós.

**D-06 · Gateway:** **Asaas**, assinatura recorrente (o William já tem conta). Status do pagamento chega por webhook.

**D-07 · Sem teste grátis:** a venda é feita pelo William em conversa direta, e a demonstração substitui o teste. A conta ativa no primeiro pagamento. Para cortesias (ex.: as 2 correspondentes que já usam o protótipo), o painel do sistema tem o campo "ativa até", preenchido à mão.

**D-08 · Inadimplência:** 7 dias de tolerância depois do vencimento; em seguida a conta fica **somente leitura** até pagar. Nada é apagado por falta de pagamento.

## Acesso e perfis

**D-09 · Perfis:** gestor, funcionária e corretor. O Briefing (que pede perfis) vale sobre a Documentação (que os punha fora do escopo).

**D-10 · Funcionária:** vê e edita tudo, inclusive valor do imóvel e valor financiado, mas **não vê** percentual, remuneração, remuneração recebida nem a tela VGV e comissões. Pode cadastrar corretores e enviar convites a eles.

**D-11 · Portal do corretor entra na v1:** o corretor tem login próprio e vê só os clientes vinculados a ele. Pode **acompanhar e anexar documentos**. Não cadastra cliente, não edita a ficha, não remove anexo.

**D-12 · Valores para o corretor:** vê etapa, documentos pendentes, valor do imóvel e valor do financiamento. **Nunca** vê percentual nem comissão.

**D-13 · Imobiliária:** é só um campo no cadastro do corretor. Sem login de imobiliária na v1.

**D-14 · Corretor em vários escritórios:** o mesmo e-mail pode estar ligado a várias contas; ao entrar, ele escolhe qual escritório ver. Cada escritório só enxerga os próprios dados.

**D-15 · Acesso por convite:** gestor (ou funcionária, para corretores) cadastra a pessoa → o app envia um link por e-mail → a pessoa cria a própria senha. Todos entram com e-mail e senha, com recuperação de senha.

## Regras de negócio

**D-16 · Regras RN-01 a RN-10 mantidas** exatamente como na Documentação.

**D-17 · Data de assinatura alterada:** mudar a data **não** muda o percentual congelado. Apagar a data **apaga** o percentual congelado; ao gravar de novo, congela o percentual vigente naquele momento. As duas ações vão para o histórico.

**D-18 · Contrato cancelado:** sai do VGV contratado (RN-05) e do pipeline (RN-02). Já estava nos documentos; registrado aqui para não haver dúvida.

**D-19 · Checklist único:** os 12 documentos são os mesmos para todas as modalidades. O requisito RF-25 (checklist por modalidade) **sai do escopo**.

**D-20 · Sem limites artificiais:** o histórico do cliente (antes 80 entradas) e o histórico do percentual (antes 30) ficam completos. O histórico também serve de trilha de auditoria.

## Dados, LGPD e operação

**D-21 · Prazo dos anexos:** os arquivos são apagados **30 dias depois da data de assinatura**. Processos cancelados sem assinatura: 30 dias depois do cancelamento. A ficha do cliente (dados e histórico) permanece. O app avisa antes de apagar para dar tempo de baixar. Justificativa: após a assinatura os documentos já ficam com a Caixa.

**D-22 · Compartilhamento com o corretor:** o termo de uso e a política de privacidade informam que os dados e documentos do cliente são compartilhados com o corretor que o indicou.

**D-23 · Lembretes:** notificação no celular por **Web Push** (app instalado como PWA) e **e-mail diário** de reserva. No iPhone o push só funciona com o app adicionado à tela de início.

**D-24 · Migração:** as correspondentes atuais criam contas novas; um importador lê o JSON exportado do protótipo e carrega os dados na conta nova (fase 2).

## Técnica

**D-25 · Banco, login e arquivos:** Supabase (Postgres, Auth, Storage privado, Realtime), região São Paulo. Plano pago em produção (o gratuito pausa por inatividade e não tem backup diário).

**D-26 · Hospedagem:** **Cloudflare Workers**, não Vercel (o plano gratuito da Vercel não permite uso comercial).

**D-27 · Front-end sem Next.js:** **React + Vite (SPA)**. Next.js na Cloudflare depende de adaptador (a própria Cloudflare hoje recomenda o vinext em vez do OpenNext para apps novos), e o app não ganha nada com renderização no servidor: fica atrás de login, não precisa de SEO, e quem protege os dados é a RLS do banco. As partes de servidor (webhook, convites, links de download, push, rotinas) ficam num Worker. A página de venda é um site estático à parte.

**D-28 · Regras no banco:** regras que garantem integridade (congelar percentual, data automática de assinatura, documento recebido ao anexar, histórico de etapa) ficam em **gatilhos no Postgres**, para valerem não importa quem grava. Cálculos de remuneração ficam em views restritas ao gestor.

**D-29 · Download só pelo Worker:** o usuário não lê o bucket direto. O link temporário é gerado por um endpoint que confere a permissão e grava na auditoria quem baixou.

---

## Pendências

| # | Pendência | Proposta atual | Quem decide |
|---|---|---|---|
| P-01 | Nomes dos 12 documentos (8 do comprador, 4 do imóvel e vendedor) | Copiar do código do protótipo | Dev (precisa do código ou do JSON) |
| P-02 | Confirmação de envio do WhatsApp | Ao voltar para o app, perguntar "Enviou?"; só registra a cobrança se a resposta for sim | Dev + William |
| P-03 | Corretor vê o histórico do cliente? | Vê mudanças de etapa e anexos; não vê observações internas | William |
| P-04 | Como a correspondente nova se cadastra | Página de venda → cadastro do gestor → aceite dos termos → pagamento no Asaas → conta ativa | William |
| P-05 | Formas de pagamento aceitas no Asaas | Cartão, Pix e boleto | William |
| P-06 | Horário do lembrete diário | 8h (horário de Brasília) | William |
| P-07 | Quantos dias antes de apagar anexos avisar | 5 dias | William |
| P-08 | Provedor de e-mail (convites, recuperação de senha, lembretes) | SMTP próprio (ex.: Resend) configurado no Supabase | Dev |
| P-09 | Domínio do app | — | William |
| P-10 | Acordo por escrito entre os sócios (código, receita, saída) | — | Sócios |
