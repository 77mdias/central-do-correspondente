# Modelo de dados

Central do Correspondente · versão 0.1 · 13/11/2026

Postgres 18 (local em container; produção no Supabase, só como hospedagem). Migrations em `db/migrations` (dbmate). Nomes em português, `snake_case`, exceto as tabelas do Better Auth (nomes padrão dele). Dinheiro em centavos, `bigint` com sufixo `_centavos` (D-34), percentuais em `numeric(6,3)`, datas de negócio em `date`, momentos em `timestamptz`. Todo id é `uuid` (exceto onde indicado).

## 1. Diagrama

```mermaid
erDiagram
    contas ||--o{ membros : tem
    user ||--o{ membros : participa
    contas ||--o{ convites : envia
    contas ||--|| contas_config : "só gestor"
    contas ||--o{ corretores : cadastra
    corretores ||--o| membros : "acesso do corretor"
    contas ||--o{ clientes : tem
    corretores ||--o{ clientes : indica
    clientes ||--o| clientes_remuneracao : "só gestor"
    clientes ||--o{ documentos : checklist
    clientes ||--o{ arquivos : anexos
    clientes ||--o{ historico : registra
    contas ||--o{ historico_percentual : "só gestor"
    contas ||--o{ auditoria : registra
    user ||--o{ push_inscricoes : aparelhos
```

## 2. Tipos

```sql
create type perfil as enum ('gestor', 'funcionaria', 'corretor');
create type plano as enum ('simples', 'com_corretores');
create type status_membro as enum ('ativo', 'desativado');  -- convite pendente é uma linha em convites
create type status_assinatura as enum ('pendente', 'ativa', 'em_atraso', 'suspensa', 'cancelada');
create type modalidade as enum ('mcmv', 'sbpe', 'pro_cotista', 'outra');
create type etapa as enum (
  'cadastro', 'documentacao_pendente', 'analise_credito', 'credito_aprovado',
  'avaliacao_imovel', 'conformidade', 'assinatura_contrato',
  'registro_cartorio', 'concluido', 'reprovado_cancelado'
);
create type tipo_historico as enum ('nota', 'etapa', 'cobranca', 'documento', 'contrato', 'sistema');
create type acao_auditoria as enum ('ver', 'criar', 'alterar', 'excluir', 'baixar', 'exportar');
```

## 3. Tabelas

### contas
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| nome_escritorio | text not null | |
| documento_titular | text not null | CPF (11 dígitos) ou CNPJ, inclusive o alfanumérico da IN RFB 2.229/2024 (12 caracteres 0-9/A-Z + 2 dígitos), sem pontuação; pedido no cadastro; o Asaas exige |
| plano | plano not null | `simples` (R$ 99) ou `com_corretores` (R$ 149). Muda só pelo Worker |
| status_assinatura | status_assinatura | default `pendente` |
| ativa_ate | date | cortesia manual |
| vencimento_em_aberto | date | preenchido pelo webhook quando atrasa |
| asaas_customer_id | text | |
| asaas_subscription_id | text | |
| criado_em | timestamptz default now() | |

`plano`, `status_assinatura` e `ativa_ate` não têm permissão de update para `app_user`: só o comando `conta:liberar`, o webhook e as rotinas do sistema mudam esses campos.

### contas_config (só gestor)
| Campo | Tipo | Nota |
|---|---|---|
| conta_id | uuid pk → contas | |
| percentual_atual | numeric(6,3) not null default 0 | 0 a 100 |

Separada de `contas` para que `contas` seja legível por todo membro ativo sem expor receita.

### user (Better Auth)
Tabela de usuário do Better Auth 1.7.16 (nome padrão, colunas em camelCase), junto com `session`, `account`, `verification` e `rateLimit`, todas geradas pela CLI do Better Auth e versionadas como migration. Acesso só por `app_system`. Campos extras (`input: false`, gravados só pelo nosso código):
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| name, email, emailVerified, … | | padrão do Better Auth |
| termosVersao | text | versão aceita (`rascunho-1` na fase 1) |
| termosAceitosEm | timestamptz | |
| adminSistema | boolean default false | painel do sistema |

### membros
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| conta_id | uuid → contas | |
| usuario_id | uuid → "user" | |
| perfil | perfil | |
| corretor_id | uuid → corretores null | obrigatório se perfil = corretor |
| status | status_membro default 'ativo' | |
| convidado_por | uuid → "user" | |
| criado_em | timestamptz | |

Restrições:
- `unique (conta_id, usuario_id)`
- índice único parcial `(conta_id) where perfil = 'gestor' and status = 'ativo'`
- idem para `'funcionaria'`
- `check (perfil <> 'corretor' or corretor_id is not null)`
- gatilho `tg_limite_plano`: em conta `simples`, só aceita o perfil `gestor` (RN-18)

### convites
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| conta_id | uuid → contas | |
| email | text | sempre em minúsculas (`check (email = lower(email))`) |
| perfil | perfil | `funcionaria` ou `corretor` (`check (perfil <> 'gestor')`) |
| corretor_id | uuid → corretores null | obrigatório se perfil = corretor |
| token_hash | text unique not null | sha-256 do token do link; o token não fica no banco |
| expira_em | timestamptz | 7 dias após criar ou reenviar |
| aceito_em | timestamptz | |
| revogado_em | timestamptz | |
| convidado_por | uuid → "user" | |
| criado_em | timestamptz | |

Gatilho `tg_limite_convite` (RN-18): em conta `simples` recusa qualquer convite; convite de funcionária é recusado se já houver funcionária ativa ou convite de funcionária aberto. Aceite pela função `aceitar_convite(token_hash, usuario_id)` (só `app_system`), que confere validade e e-mail e cria (ou reativa) o membro.

### corretores
| Campo | Tipo |
|---|---|
| id | uuid pk |
| conta_id | uuid → contas |
| nome | text not null |
| imobiliaria | text |
| whatsapp | text (só dígitos) |
| creci | text |
| email | text |
| criado_em, atualizado_em | timestamptz |

### clientes
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| conta_id | uuid → contas | |
| corretor_id | uuid → corretores null | null = cliente direto |
| nome | text not null | |
| cpf | text | 11 dígitos, validado |
| whatsapp | text | só dígitos, validado |
| email | text | validado |
| modalidade | modalidade | |
| etapa | etapa | default `documentacao_pendente` (RF-11) |
| valor_imovel_centavos | bigint | |
| valor_financiado_centavos | bigint | |
| valor_avaliacao_centavos | bigint | |
| entrada_centavos | bigint | |
| fgts_centavos | bigint | |
| subsidio_centavos | bigint | |
| numero_contrato | text | |
| data_assinatura | date | |
| proxima_cobranca | date | default hoje |
| intervalo_cobranca | smallint | default 3, `check in (1,2,3,5,7)` |
| qtd_cobrancas | integer default 0 | |
| ultima_cobranca | timestamptz | |
| observacoes | text | |
| finalizado_em | timestamptz | quando entrou em concluído/cancelado |
| anexos_apagar_em | date | calculado (RN-14) |
| criado_em | timestamptz | |
| atualizado_em | timestamptz | RN-12 |

Índices: `(conta_id, etapa)`, `(conta_id, corretor_id)`, `(conta_id, proxima_cobranca)`, `(conta_id, atualizado_em)`, trigram em `nome` para busca.

### clientes_remuneracao (só gestor)
| Campo | Tipo | Nota |
|---|---|---|
| cliente_id | uuid pk → clientes | |
| conta_id | uuid | |
| pct_contrato | numeric(6,3) | congelado na assinatura (RN-07) |
| pct_proprio | numeric(6,3) | override manual |
| remuneracao_recebida_em | date | RF-56 |

### documentos
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| conta_id, cliente_id | uuid | |
| tipo | text | código de um dos 12 (pendência P-01) |
| recebido_em | date null | null = pendente |
| marcado_por | uuid → "user" | |

`unique (cliente_id, tipo)`. Os 12 tipos ficam numa tabela fixa `tipos_documento (codigo, nome, grupo, ordem)` para a lista ser igual em todo lugar.

**Lista proposta (P-01, aguardando revisão do William com as correspondentes).** Documentos usuais do financiamento habitacional da Caixa; a tabela só recebe as linhas depois da revisão.

| Grupo | Ordem | `codigo` | Nome |
|---|---|---|---|
| comprador | 1 | `identidade` | RG ou CNH, com CPF |
| comprador | 2 | `estado_civil` | Certidão de nascimento ou casamento |
| comprador | 3 | `residencia` | Comprovante de residência |
| comprador | 4 | `renda` | Comprovante de renda |
| comprador | 5 | `ctps` | Carteira de trabalho |
| comprador | 6 | `irpf` | Declaração do Imposto de Renda |
| comprador | 7 | `fgts` | Extrato do FGTS |
| comprador | 8 | `conjuge` | Documentos do cônjuge ou de quem compõe a renda |
| imovel_vendedor | 1 | `matricula` | Matrícula atualizada do imóvel |
| imovel_vendedor | 2 | `iptu` | IPTU |
| imovel_vendedor | 3 | `vendedor` | Documentos do vendedor (RG, CPF e estado civil) |
| imovel_vendedor | 4 | `contrato_compra` | Contrato ou proposta de compra e venda |

### arquivos
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| conta_id, cliente_id | uuid | |
| tipo_documento | text | código ou `outros` |
| nome | text | nome original |
| caminho | text | `conta_id/cliente_id/id.ext` |
| tamanho | integer | bytes |
| mime | text | |
| enviado_por | uuid → "user" | |
| enviado_em | timestamptz | |
| apagado_em | timestamptz | RN-14 |

### historico
| Campo | Tipo |
|---|---|
| id | uuid pk |
| conta_id, cliente_id | uuid |
| usuario_id | uuid → "user" (null = sistema) |
| tipo | tipo_historico |
| texto | text |
| criado_em | timestamptz |

Sem limite de entradas (D-20). Visibilidade para o corretor conforme P-03 (filtro por `tipo`).

### historico_percentual (só gestor)
| Campo | Tipo |
|---|---|
| id | uuid pk |
| conta_id | uuid |
| percentual | numeric(6,3) |
| alterado_por | uuid |
| criado_em | timestamptz |

### auditoria (só inserção; leitura do gestor)
| Campo | Tipo |
|---|---|
| id | bigint identity pk |
| conta_id | uuid |
| usuario_id | uuid |
| acao | acao_auditoria |
| entidade | text (`cliente`, `arquivo`, …) |
| entidade_id | uuid |
| detalhe | jsonb (campos alterados, sem valores sensíveis) |
| criado_em | timestamptz |

### push_inscricoes
| Campo | Tipo |
|---|---|
| id | uuid pk |
| usuario_id | uuid |
| endpoint | text unique |
| chaves | jsonb (p256dh, auth) |
| criado_em | timestamptz |

### eventos_asaas
| Campo | Tipo |
|---|---|
| id | text pk (id do evento) |
| tipo | text |
| conta_id | uuid null |
| payload | jsonb |
| recebido_em | timestamptz |
| processado_em | timestamptz |

## 4. Funções auxiliares (security definer)

```sql
-- usuário da transação: set_config('app.usuario_id', <id da sessão>, true), feito pelo withUser do Worker
meu_usuario_id() returns uuid  -- nullif(current_setting('app.usuario_id', true), '')::uuid
-- perfil do usuário logado na conta (null se não for membro ativo)
meu_perfil(conta uuid) returns perfil
-- corretor_id do usuário logado na conta (null se não for corretor)
meu_corretor_id(conta uuid) returns uuid
-- conta pode receber escrita? (ativa, em_atraso ou ativa_ate >= hoje)
conta_ativa(conta uuid) returns boolean
-- "hoje" no fuso do Brasil
hoje_br() returns date  -- (now() at time zone 'America/Sao_Paulo')::date
```

## 5. Políticas RLS (resumo)

| Tabela | Ler | Gravar |
|---|---|---|
| contas | membro ativo | gestor (só `nome_escritorio`); plano, status e `ativa_ate` só pelo sistema |
| contas_config | gestor | gestor + `conta_ativa` |
| membros | gestor e funcionária da conta; o próprio usuário | update de `status`: gestor desativa F e C, funcionária desativa C, ninguém desativa gestor; insert só por `aceitar_convite` e pelo cadastro |
| convites | gestor e funcionária (sem `token_hash`) | gestor convida F e C, funcionária convida C, + `conta_ativa` |
| corretores | gestor, funcionária | gestor, funcionária + `conta_ativa` |
| clientes | gestor, funcionária; corretor onde `corretor_id = meu_corretor_id` | gestor, funcionária + `conta_ativa` |
| clientes_remuneracao | gestor | gestor + `conta_ativa` |
| documentos | como clientes | gestor, funcionária; corretor só via gatilho de anexo |
| arquivos | como clientes | inserir: gestor, funcionária, corretor (próprios); apagar: gestor, funcionária |
| historico | gestor, funcionária; corretor conforme P-03 | inserir: gestor, funcionária; gatilhos |
| historico_percentual | gestor | gatilho ao mudar percentual |
| auditoria | gestor | só gatilhos, RPC e Worker |
| push_inscricoes | o próprio usuário | o próprio usuário |
| eventos_asaas | ninguém | só Worker |

Storage (`documentos`): inserir quando o primeiro segmento do caminho é uma conta em que o usuário pode anexar para aquele cliente; **sem select** para usuários comuns.

## 6. Gatilhos

| Gatilho | Tabela | Faz |
|---|---|---|
| `tg_atualizado_em` | clientes, documentos, arquivos, historico | Atualiza `clientes.atualizado_em` (RN-12) |
| `tg_etapa` | clientes (update de etapa) | Histórico de etapa; RN-06 (data de hoje); `finalizado_em`; recalcula `anexos_apagar_em` (RN-14/15) |
| `tg_assinatura` | clientes (update de data_assinatura) | RN-07 (congela `contas_config.percentual_atual` em `pct_contrato`); RN-11 (apagar data limpa); histórico tipo `contrato` |
| `tg_anexo_recebido` | arquivos (insert) | Marca o documento como recebido (RF-23) e escreve no histórico com o nome de quem anexou |
| `tg_percentual` | contas_config (update de percentual_atual) | Insere em `historico_percentual` |
| `tg_auditoria` | clientes, corretores, arquivos, membros | Grava criar/alterar/excluir em `auditoria` |
| `tg_limite_plano` | membros (insert/update) | Recusa funcionária e corretor ativos em conta do plano `simples` (RN-18) |
| `tg_limite_convite` | convites (insert) | Recusa convite em conta `simples` e segundo convite/funcionária (RN-18) |

## 7. Views (só gestor)

- `vw_remuneracao`: por cliente, percentual usado (RN-08), remuneração (RN-09), cota (RN-10), contratado (RN-05).
- `vw_vgv_periodo`: VGV contratado por mês.
- `vw_vgv_origem`: contratos, VGV, financiado, remuneração e em andamento por corretor/cliente direto.

As views filtram por `meu_perfil(conta_id) = 'gestor'` (um único papel, `app_user`, atende todos os perfis) e são `security_invoker` + `security_barrier`: valem a RLS das tabelas de quem consulta e o filtro de perfil roda antes de qualquer filtro de quem consulta.
