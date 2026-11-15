-- migrate:up
-- Núcleo do domínio (docs/MODELO-DE-DADOS.md, com a spec da fase 1 §8). Toda tabela de domínio tem conta_id,
-- e as referências entre tabelas usam FK composta (conta_id, x_id): nada aponta para outra conta.
create extension if not exists pg_trgm;

create type perfil as enum ('gestor', 'funcionaria', 'corretor');
create type status_membro as enum ('ativo', 'desativado');
create type status_assinatura as enum ('pendente', 'ativa', 'em_atraso', 'suspensa', 'cancelada');
create type plano as enum ('simples', 'com_corretores');
create type modalidade as enum ('mcmv', 'sbpe', 'pro_cotista', 'outra');
create type etapa as enum (
  'cadastro', 'documentacao_pendente', 'analise_credito', 'credito_aprovado',
  'avaliacao_imovel', 'conformidade', 'assinatura_contrato',
  'registro_cartorio', 'concluido', 'reprovado_cancelado'
);
create type tipo_historico as enum ('nota', 'etapa', 'cobranca', 'documento', 'contrato', 'sistema');
create type acao_auditoria as enum ('ver', 'criar', 'alterar', 'excluir', 'baixar', 'exportar');

create table contas (
  id uuid primary key default gen_random_uuid(),
  nome_escritorio text not null check (length(nome_escritorio) between 2 and 120),
  documento_titular text not null check (documento_titular ~ '^([0-9]{11}|[0-9]{14})$'),
  plano plano not null,
  status_assinatura status_assinatura not null default 'pendente',
  ativa_ate date,
  vencimento_em_aberto date,
  asaas_customer_id text,
  asaas_subscription_id text,
  importado_prototipo_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Separada de contas: contas é legível por todo membro ativo; o percentual é só do gestor (RN-17).
create table contas_config (
  conta_id uuid primary key references contas (id) on delete cascade,
  percentual_atual numeric(6,3) not null default 0 check (percentual_atual between 0 and 100)
);

create table corretores (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  nome text not null check (length(nome) between 1 and 120),
  imobiliaria text,
  whatsapp text check (whatsapp ~ '^[0-9]{10,11}$'),
  creci text,
  email text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (conta_id, id)
);

create table membros (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  usuario_id uuid not null references "user" (id) on delete cascade,
  perfil perfil not null,
  corretor_id uuid,
  status status_membro not null default 'ativo',
  convidado_por uuid references "user" (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (conta_id, usuario_id),
  foreign key (conta_id, corretor_id) references corretores (conta_id, id),
  check (perfil <> 'corretor' or corretor_id is not null)
);
create unique index membros_um_gestor on membros (conta_id) where perfil = 'gestor' and status = 'ativo';
create unique index membros_uma_funcionaria on membros (conta_id) where perfil = 'funcionaria' and status = 'ativo';
create unique index membros_um_login_por_corretor on membros (conta_id, corretor_id) where corretor_id is not null;
create index membros_usuario on membros (usuario_id);

create table convites (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  perfil perfil not null check (perfil <> 'gestor'),
  corretor_id uuid,
  token_hash text not null unique,
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_em timestamptz,
  revogado_em timestamptz,
  convidado_por uuid references "user" (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (conta_id, corretor_id) references corretores (conta_id, id),
  check (perfil <> 'corretor' or corretor_id is not null)
);
create index convites_conta on convites (conta_id) where aceito_em is null and revogado_em is null;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  corretor_id uuid,
  nome text not null check (length(nome) between 1 and 160),
  cpf text check (cpf ~ '^[0-9]{11}$'),
  whatsapp text check (whatsapp ~ '^[0-9]{10,11}$'),
  email text,
  modalidade modalidade,
  etapa etapa not null default 'documentacao_pendente',
  valor_imovel_centavos bigint check (valor_imovel_centavos >= 0),
  valor_financiado_centavos bigint check (valor_financiado_centavos >= 0),
  valor_avaliacao_centavos bigint check (valor_avaliacao_centavos >= 0),
  entrada_centavos bigint check (entrada_centavos >= 0),
  fgts_centavos bigint check (fgts_centavos >= 0),
  subsidio_centavos bigint check (subsidio_centavos >= 0),
  numero_contrato text,
  data_assinatura date,
  proxima_cobranca date default ((now() at time zone 'America/Sao_Paulo')::date),
  intervalo_cobranca smallint not null default 3 check (intervalo_cobranca in (1, 2, 3, 5, 7)),
  qtd_cobrancas integer not null default 0,
  ultima_cobranca timestamptz,
  observacoes text,
  finalizado_em timestamptz,
  anexos_apagar_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (conta_id, id),
  foreign key (conta_id, corretor_id) references corretores (conta_id, id)
);
create index clientes_etapa on clientes (conta_id, etapa);
create index clientes_corretor on clientes (conta_id, corretor_id);
create index clientes_cobranca on clientes (conta_id, proxima_cobranca);
create index clientes_atualizado on clientes (conta_id, atualizado_em);
create index clientes_nome_trgm on clientes using gin (nome gin_trgm_ops);

-- Só gestor (RN-17).
create table clientes_remuneracao (
  cliente_id uuid primary key,
  conta_id uuid not null,
  pct_contrato numeric(6,3) check (pct_contrato between 0 and 100),
  pct_proprio numeric(6,3) check (pct_proprio between 0 and 100),
  remuneracao_recebida_em date,
  foreign key (conta_id, cliente_id) references clientes (conta_id, id) on delete cascade
);

-- Lista única dos 12 documentos (D-19); nasce vazia até a P-01.
create table tipos_documento (
  codigo text primary key,
  nome text not null,
  grupo text not null check (grupo in ('comprador', 'imovel_vendedor')),
  ordem smallint not null
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null,
  cliente_id uuid not null,
  tipo text not null references tipos_documento (codigo),
  recebido_em date,
  marcado_por uuid references "user" (id) on delete set null,
  unique (cliente_id, tipo),
  foreign key (conta_id, cliente_id) references clientes (conta_id, id) on delete cascade
);

create table arquivos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null,
  cliente_id uuid not null,
  tipo_documento text references tipos_documento (codigo), -- null = "Outros arquivos"
  nome text not null,
  caminho text not null unique,
  tamanho integer not null check (tamanho > 0),
  mime text not null,
  enviado_por uuid references "user" (id) on delete set null,
  enviado_em timestamptz not null default now(),
  apagado_em timestamptz,
  foreign key (conta_id, cliente_id) references clientes (conta_id, id) on delete cascade
);
create index arquivos_cliente on arquivos (cliente_id);

create table historico (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null,
  cliente_id uuid not null,
  usuario_id uuid references "user" (id) on delete set null, -- null = sistema
  tipo tipo_historico not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  foreign key (conta_id, cliente_id) references clientes (conta_id, id) on delete cascade
);
create index historico_conta on historico (conta_id, criado_em desc);
create index historico_cliente on historico (cliente_id, criado_em desc);

create table historico_percentual (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  percentual numeric(6,3) not null,
  alterado_por uuid references "user" (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table auditoria (
  id bigint generated always as identity primary key,
  conta_id uuid not null references contas (id) on delete cascade,
  usuario_id uuid references "user" (id) on delete set null,
  acao acao_auditoria not null,
  entidade text not null,
  entidade_id uuid,
  detalhe jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index auditoria_conta on auditoria (conta_id, criado_em desc);

create table push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references "user" (id) on delete cascade,
  endpoint text not null unique,
  chaves jsonb not null,
  criado_em timestamptz not null default now()
);

create table eventos_asaas (
  id text primary key,
  tipo text not null,
  conta_id uuid references contas (id) on delete set null,
  payload jsonb not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz
);

-- RLS ligada em todas; as políticas e os grants do app_user vêm na migration de acesso.
alter table contas enable row level security;
alter table contas_config enable row level security;
alter table corretores enable row level security;
alter table membros enable row level security;
alter table convites enable row level security;
alter table clientes enable row level security;
alter table clientes_remuneracao enable row level security;
alter table tipos_documento enable row level security;
alter table documentos enable row level security;
alter table arquivos enable row level security;
alter table historico enable row level security;
alter table historico_percentual enable row level security;
alter table auditoria enable row level security;
alter table push_inscricoes enable row level security;
alter table eventos_asaas enable row level security;

-- migrate:down
drop table eventos_asaas, push_inscricoes, auditoria, historico_percentual, historico, arquivos, documentos,
  tipos_documento, clientes_remuneracao, clientes, convites, membros, corretores, contas_config, contas;
drop type acao_auditoria, tipo_historico, etapa, modalidade, plano, status_assinatura, status_membro, perfil;
