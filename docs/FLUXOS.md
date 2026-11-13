# Fluxos do usuário

Central do Correspondente · versão 0.1 · 13/11/2026

Os diagramas usam Mermaid e aparecem desenhados direto no GitHub.

---

## 1. Jornada do processo

10 etapas, 2 decisões. Enquanto faltar documento, o cliente volta para a lista de cobrança no intervalo escolhido. A assinatura é o ponto em que o app grava a data e congela o percentual.

```mermaid
flowchart TD
    A[Cadastro] --> B[Documentação pendente]
    B --> D1{Falta documento?}
    D1 -- sim --> COB[Cobrança no intervalo<br/>1, 2, 3, 5 ou 7 dias]
    COB --> B
    D1 -- não --> C[Análise de crédito]
    C --> D2{Crédito aprovado?}
    D2 -- não --> X[Reprovado / Cancelado]
    D2 -- sim --> E[Crédito aprovado]
    E --> F[Avaliação do imóvel]
    F --> G[Conformidade]
    G --> H[Assinatura do contrato<br/><i>grava data + congela %</i>]
    H --> I[Registro em cartório]
    I --> J[Concluído]
    H -. 30 dias .-> DEL[Anexos apagados<br/>ficha permanece]
    X -. 30 dias .-> DEL
```

Qualquer etapa ativa pode ir para Reprovado / Cancelado. Ir direto para Registro em cartório ou Concluído sem data de assinatura grava a data de hoje (RN-06).

---

## 2. Mapa de telas

```mermaid
flowchart LR
    subgraph Público
        LOGIN[Entrar]
        REC[Recuperar senha]
        CONV[Aceitar convite<br/>definir senha]
        TERMOS[Aceitar termos]
    end

    subgraph Escritório["Escritório (G e F)"]
        INI[Início]
        CLI[Clientes]
        COBH[Cobrar hoje]
        COR[Corretores parceiros]
        VGV[VGV e comissões<br/><i>só G</i>]
        EQ[Equipe e acessos<br/><i>plano Com corretores</i>]
        ASS[Assinatura<br/><i>só G</i>]
    end

    subgraph Paineis["Painéis laterais"]
        FICHA[Ficha do cliente]
        NOVO[Novo cliente]
        FCOR[Ficha do corretor]
    end

    subgraph Portal["Portal do corretor (C), plano Com corretores"]
        MEUS[Meus clientes]
        FLEIT[Ficha em leitura<br/>+ anexar]
    end

    LOGIN --> TERMOS --> INI
    LOGIN --> MEUS
    CONV --> TERMOS
    INI --> FICHA
    CLI --> FICHA
    COBH --> FICHA
    CLI --> NOVO
    COR --> FCOR
    VGV -- linha da tabela --> CLI
    MEUS --> FLEIT
```

Início, Clientes e Cobrar hoje abrem a mesma ficha. Quem tem mais de um escritório vê um seletor de escritório logo depois de entrar.

---

## 3. Rotina diária do escritório

1. Às 8h chega o push (ou e-mail) com as cobranças do dia.
2. Abrir **Início** e ver os contadores.
3. Entrar em **Cobrar hoje** e tocar em WhatsApp em cada cliente; ao voltar, confirmar "Enviou?" e o app registra a cobrança e marca a próxima data.
4. Ao receber um documento, abrir a ficha e tocar em **Anexar** no item; ele fica marcado como recebido. (Se o corretor anexou pelo portal, já aparece recebido.)
5. Quando a Caixa der retorno, mudar a etapa na ficha.
6. Ver **Parados há 7+ dias** e anotar no histórico o que foi feito.
7. Uma vez por semana, enviar a mensagem de situação para cada corretor com clientes pendentes.

---

## 4. Cobrança com confirmação

```mermaid
sequenceDiagram
    actor U as Gestor / Funcionária
    participant App
    participant WA as WhatsApp
    U->>App: Toca "WhatsApp" no cliente
    App->>WA: Abre wa.me/55... com mensagem pronta
    U->>WA: Envia (ou não)
    U->>App: Volta para o app
    App->>U: "Enviou a cobrança para Fulano?"
    alt Sim
        App->>App: Registra cobrança, contador +1,<br/>próxima = hoje + intervalo
    else Não
        App->>App: Nada muda
    end
```

Sem WhatsApp cadastrado, o botão vira "Copiar mensagem" e a mesma pergunta aparece.

---

## 5. Convite de acesso

```mermaid
sequenceDiagram
    actor G as Gestor (ou F, para corretor)
    participant App
    participant API as Worker /api
    participant Auth as Supabase Auth
    actor P as Pessoa convidada
    G->>App: Cadastra funcionária ou corretor com e-mail
    G->>App: "Convidar"
    App->>API: POST /api/convites
    API->>API: Confere perfil de quem convida,<br/>plano Com corretores e limite de 1 funcionária
    alt E-mail ainda não tem conta
        API->>Auth: Cria usuário e envia link de convite
    else E-mail já existe (corretor de outro escritório)
        API->>API: Só cria o vínculo com a conta
        API->>P: E-mail avisando do novo escritório
    end
    P->>App: Abre o link, define a senha
    App->>P: Aceitar termos → entra
```

---

## 6. Corretor acompanha e anexa

1. Corretor entra e cai em **Meus clientes** (só os vinculados a ele).
2. Vê etapa, dias sem atualização e documentos pendentes de cada um.
3. Abre a ficha e toca em **Anexar** no documento que recebeu do cliente.
4. O documento fica recebido, o histórico registra "Anexado por [corretor]" e o processo conta como atualizado.
5. O escritório vê a mudança em tempo real.

---

## 7. Assinatura e inadimplência

```mermaid
stateDiagram-v2
    [*] --> Pendente: Gestor se cadastra
    Pendente --> Ativa: Asaas confirma 1º pagamento
    Ativa --> EmAtraso: Fatura vence sem pagamento
    EmAtraso --> Ativa: Pagamento confirmado
    EmAtraso --> Suspensa: 7 dias sem pagar
    Suspensa --> Ativa: Pagamento confirmado
    Ativa --> Cancelada: Gestor cancela
    Suspensa --> Cancelada: Gestor cancela
    note right of Suspensa: Somente leitura,<br/>nada é apagado
```

Cortesia: o administrador do sistema define o plano e preenche "ativa até"; enquanto a data não passar, a conta é tratada como ativa.

Troca de plano (RF-74): o gestor muda na tela Assinatura e o Worker atualiza o valor no Asaas. Ao voltar para o Simples, funcionária e corretores são desativados antes da troca (nada é apagado). Cobrança da troca: P-11.

---

## 8. Cadastro de escritório novo (proposta P-04)

1. Página de venda → escolhe o plano (Simples ou Com corretores) → "Assinar".
2. Formulário: nome, e-mail, senha, nome do escritório, CPF ou CNPJ (o Asaas exige).
3. Aceite dos termos.
4. Link de pagamento do Asaas.
5. Webhook confirma → conta ativa → gestor entra no Início vazio, com atalho para "Importar do protótipo" e "Cadastrar primeiro cliente".

---

## 9. Exclusão programada de anexos

1. Rotina diária (madrugada) procura clientes com assinatura há 25 dias, ou cancelados há 25 dias, com anexos.
2. Avisa G e F: "Os anexos de Fulano serão apagados em 5 dias."
3. No dia 30, apaga os arquivos do storage, marca os registros como apagados e escreve no histórico.
4. Se a data de assinatura for apagada ou o processo voltar a uma etapa ativa antes disso, nada é apagado (RN-15).
