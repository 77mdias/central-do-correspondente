-- migrate:up
-- Acesso por perfil (docs/MODELO-DE-DADOS.md §4–§5). O Worker roda toda rota de domínio como app_user numa
-- transação com set_config('app.usuario_id', <id da sessão>, true); as políticas abaixo decidem o que essa
-- pessoa lê e grava. As funções são security definer: leem membros e contas sem depender da RLS delas.

create function meu_usuario_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select nullif(current_setting('app.usuario_id', true), '')::uuid
$$;

create function hoje_br() returns date
language sql stable security definer set search_path = public, pg_temp as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- perfil do usuário logado na conta (null se não for membro ativo)
create function meu_perfil(conta uuid) returns perfil
language sql stable security definer set search_path = public, pg_temp as $$
  select perfil from membros where conta_id = conta and usuario_id = meu_usuario_id() and status = 'ativo'
$$;

-- corretor_id do usuário logado na conta (null se não for corretor ativo)
create function meu_corretor_id(conta uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select corretor_id from membros
   where conta_id = conta and usuario_id = meu_usuario_id() and status = 'ativo' and perfil = 'corretor'
$$;

-- conta pode receber escrita? (ativa, em atraso dentro da tolerância, ou cortesia com ativa_ate >= hoje)
create function conta_ativa(conta uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select status_assinatura in ('ativa', 'em_atraso') or ativa_ate >= hoje_br()
                     from contas where id = conta), false)
$$;

-- G ou F na conta (atalho das políticas)
create function sou_escritorio(conta uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select meu_perfil(conta) in ('gestor', 'funcionaria')
$$;

-- corretor dono do cliente?
create function meu_cliente_de_corretor(conta uuid, cliente uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from clientes where id = cliente and conta_id = conta
                   and corretor_id is not null and corretor_id = meu_corretor_id(conta))
$$;

revoke execute on function meu_usuario_id(), hoje_br(), meu_perfil(uuid), meu_corretor_id(uuid), conta_ativa(uuid),
  sou_escritorio(uuid), meu_cliente_de_corretor(uuid, uuid) from public;
grant execute on function meu_usuario_id(), hoje_br(), meu_perfil(uuid), meu_corretor_id(uuid), conta_ativa(uuid),
  sou_escritorio(uuid), meu_cliente_de_corretor(uuid, uuid) to app_user, app_system;

-- contas: todo membro ativo lê; o gestor só renomeia. plano, status e ativa_ate: só sistema (sem grant).
grant select on contas to app_user;
grant update (nome_escritorio) on contas to app_user;
create policy contas_ler on contas for select to app_user using (meu_perfil(id) is not null);
create policy contas_renomear on contas for update to app_user
  using (meu_perfil(id) = 'gestor' and conta_ativa(id)) with check (meu_perfil(id) = 'gestor' and conta_ativa(id));

-- contas_config: só gestor (RN-17)
grant select, update (percentual_atual) on contas_config to app_user;
create policy config_ler on contas_config for select to app_user using (meu_perfil(conta_id) = 'gestor');
create policy config_alterar on contas_config for update to app_user
  using (meu_perfil(conta_id) = 'gestor' and conta_ativa(conta_id))
  with check (meu_perfil(conta_id) = 'gestor' and conta_ativa(conta_id));

-- corretores: G e F
grant select, insert, update, delete on corretores to app_user;
create policy corretores_ler on corretores for select to app_user using (sou_escritorio(conta_id));
create policy corretores_gravar on corretores for all to app_user
  using (sou_escritorio(conta_id) and conta_ativa(conta_id))
  with check (sou_escritorio(conta_id) and conta_ativa(conta_id));

-- membros: G e F leem a conta; cada um lê a própria linha. Só o status muda pelo app:
-- gestor desativa F e C, funcionária desativa C, ninguém mexe na linha de um gestor.
-- Entrar na conta só pelo cadastro e por aceitar_convite (app_system).
grant select, update (status) on membros to app_user;
create policy membros_ler on membros for select to app_user
  using (sou_escritorio(conta_id) or usuario_id = meu_usuario_id());
create policy membros_status on membros for update to app_user
  using (perfil <> 'gestor' and conta_ativa(conta_id)
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')))
  with check (perfil <> 'gestor' and conta_ativa(conta_id)
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')));

-- convites: G e F leem (sem token_hash); gestor convida F e C, funcionária convida C.
grant select (id, conta_id, email, perfil, corretor_id, expira_em, aceito_em, revogado_em, convidado_por, criado_em)
  on convites to app_user;
grant insert (conta_id, email, perfil, corretor_id, token_hash, convidado_por) on convites to app_user;
grant update (token_hash, expira_em, revogado_em) on convites to app_user;
create policy convites_ler on convites for select to app_user using (sou_escritorio(conta_id));
create policy convites_criar on convites for insert to app_user
  with check (conta_ativa(conta_id) and convidado_por = meu_usuario_id()
              and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')));
create policy convites_alterar on convites for update to app_user
  using (conta_ativa(conta_id)
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')))
  with check (conta_ativa(conta_id)
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')));

-- clientes: G e F tudo; corretor lê os próprios
grant select, insert, update, delete on clientes to app_user;
create policy clientes_ler on clientes for select to app_user
  using (sou_escritorio(conta_id) or (corretor_id is not null and corretor_id = meu_corretor_id(conta_id)));
create policy clientes_gravar on clientes for all to app_user
  using (sou_escritorio(conta_id) and conta_ativa(conta_id))
  with check (sou_escritorio(conta_id) and conta_ativa(conta_id));

-- clientes_remuneracao: só gestor (RN-17)
grant select, insert, update on clientes_remuneracao to app_user;
create policy remuneracao_ler on clientes_remuneracao for select to app_user using (meu_perfil(conta_id) = 'gestor');
create policy remuneracao_gravar on clientes_remuneracao for all to app_user
  using (meu_perfil(conta_id) = 'gestor' and conta_ativa(conta_id))
  with check (meu_perfil(conta_id) = 'gestor' and conta_ativa(conta_id));

-- tipos_documento: lista fixa, todos leem
grant select on tipos_documento to app_user;
create policy tipos_ler on tipos_documento for select to app_user using (true);

-- documentos: como clientes; só G e F marcam (o corretor marca pelo anexo, via gatilho)
grant select, insert, update, delete on documentos to app_user;
create policy documentos_ler on documentos for select to app_user
  using (sou_escritorio(conta_id) or meu_cliente_de_corretor(conta_id, cliente_id));
create policy documentos_gravar on documentos for all to app_user
  using (sou_escritorio(conta_id) and conta_ativa(conta_id))
  with check (sou_escritorio(conta_id) and conta_ativa(conta_id));

-- arquivos: como clientes; corretor anexa nos próprios; só G e F removem
grant select, insert, delete on arquivos to app_user;
create policy arquivos_ler on arquivos for select to app_user
  using (sou_escritorio(conta_id) or meu_cliente_de_corretor(conta_id, cliente_id));
create policy arquivos_anexar on arquivos for insert to app_user
  with check (conta_ativa(conta_id) and enviado_por = meu_usuario_id()
              and (sou_escritorio(conta_id) or meu_cliente_de_corretor(conta_id, cliente_id)));
create policy arquivos_remover on arquivos for delete to app_user
  using (sou_escritorio(conta_id) and conta_ativa(conta_id));

-- historico: G e F; corretor vê etapa e anexos dos próprios clientes (proposta da P-03); G e F anotam
grant select, insert on historico to app_user;
create policy historico_ler on historico for select to app_user
  using (sou_escritorio(conta_id) or (tipo in ('etapa', 'documento') and meu_cliente_de_corretor(conta_id, cliente_id)));
create policy historico_anotar on historico for insert to app_user
  with check (sou_escritorio(conta_id) and conta_ativa(conta_id) and usuario_id = meu_usuario_id()
              and tipo in ('nota', 'cobranca'));

-- historico_percentual e auditoria: só gestor lê; gravam os gatilhos
grant select on historico_percentual, auditoria to app_user;
create policy historico_pct_ler on historico_percentual for select to app_user using (meu_perfil(conta_id) = 'gestor');
create policy auditoria_ler on auditoria for select to app_user using (meu_perfil(conta_id) = 'gestor');

-- push_inscricoes: cada um as próprias
grant select, insert, delete on push_inscricoes to app_user;
create policy push_proprias on push_inscricoes for all to app_user
  using (usuario_id = meu_usuario_id()) with check (usuario_id = meu_usuario_id());

-- eventos_asaas: ninguém pelo app (sem grant)

-- Views de remuneração (RN-05, RN-08 a RN-10). Rodam com o dono e filtram por perfil dentro:
-- um papel só (app_user) atende todos os perfis, então o filtro "só gestor" fica aqui.
create view vw_remuneracao as
select c.conta_id, c.id as cliente_id, c.nome, c.corretor_id, c.etapa, c.data_assinatura,
       c.valor_imovel_centavos, c.valor_financiado_centavos,
       (c.data_assinatura is not null and c.etapa <> 'reprovado_cancelado') as contratado,
       coalesce(r.pct_proprio, r.pct_contrato, cfg.percentual_atual) as pct_usado,
       round(c.valor_financiado_centavos * coalesce(r.pct_proprio, r.pct_contrato, cfg.percentual_atual) / 100)::bigint
         as remuneracao_centavos,
       c.valor_financiado_centavos::numeric / nullif(c.valor_imovel_centavos, 0) as cota,
       r.remuneracao_recebida_em
  from clientes c
  left join clientes_remuneracao r on r.cliente_id = c.id
  join contas_config cfg on cfg.conta_id = c.conta_id
 where meu_perfil(c.conta_id) = 'gestor';

create view vw_vgv_periodo as
select conta_id, date_trunc('month', data_assinatura)::date as mes, count(*) as contratos,
       sum(valor_imovel_centavos) as vgv_centavos, sum(valor_financiado_centavos) as financiado_centavos,
       sum(remuneracao_centavos) as remuneracao_centavos
  from vw_remuneracao where contratado group by conta_id, mes;

create view vw_vgv_origem as
select conta_id, corretor_id, count(*) filter (where contratado) as contratos,
       sum(valor_imovel_centavos) filter (where contratado) as vgv_centavos,
       sum(valor_financiado_centavos) filter (where contratado) as financiado_centavos,
       sum(remuneracao_centavos) filter (where contratado) as remuneracao_centavos,
       count(*) filter (where etapa not in ('concluido', 'reprovado_cancelado')) as em_andamento
  from vw_remuneracao group by conta_id, corretor_id;

grant select on vw_remuneracao, vw_vgv_periodo, vw_vgv_origem to app_user;

-- migrate:down
drop view vw_vgv_origem, vw_vgv_periodo, vw_remuneracao;
drop policy push_proprias on push_inscricoes;
drop policy auditoria_ler on auditoria;
drop policy historico_pct_ler on historico_percentual;
drop policy historico_anotar on historico;
drop policy historico_ler on historico;
drop policy arquivos_remover on arquivos;
drop policy arquivos_anexar on arquivos;
drop policy arquivos_ler on arquivos;
drop policy documentos_gravar on documentos;
drop policy documentos_ler on documentos;
drop policy tipos_ler on tipos_documento;
drop policy remuneracao_gravar on clientes_remuneracao;
drop policy remuneracao_ler on clientes_remuneracao;
drop policy clientes_gravar on clientes;
drop policy clientes_ler on clientes;
drop policy convites_alterar on convites;
drop policy convites_criar on convites;
drop policy convites_ler on convites;
drop policy membros_status on membros;
drop policy membros_ler on membros;
drop policy corretores_gravar on corretores;
drop policy corretores_ler on corretores;
drop policy config_alterar on contas_config;
drop policy config_ler on contas_config;
drop policy contas_renomear on contas;
drop policy contas_ler on contas;
revoke all on all tables in schema public from app_user;
drop function meu_cliente_de_corretor(uuid, uuid), sou_escritorio(uuid), conta_ativa(uuid), meu_corretor_id(uuid),
  meu_perfil(uuid), hoje_br(), meu_usuario_id();
