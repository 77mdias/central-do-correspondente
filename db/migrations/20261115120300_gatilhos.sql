-- migrate:up
-- Regras de integridade no banco (D-28): valem não importa quem grava. docs/MODELO-DE-DADOS.md §6.
-- Gatilhos que gravam em tabelas que o perfil não pode escrever (histórico, remuneração, auditoria) são
-- security definer; o autor vem sempre de meu_usuario_id().

create function rotulo_etapa(e etapa) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case e
    when 'cadastro' then 'Cadastro'
    when 'documentacao_pendente' then 'Documentação pendente'
    when 'analise_credito' then 'Análise de crédito'
    when 'credito_aprovado' then 'Crédito aprovado'
    when 'avaliacao_imovel' then 'Avaliação do imóvel'
    when 'conformidade' then 'Conformidade'
    when 'assinatura_contrato' then 'Assinatura do contrato'
    when 'registro_cartorio' then 'Registro em cartório'
    when 'concluido' then 'Concluído'
    when 'reprovado_cancelado' then 'Reprovado / Cancelado'
  end
$$;

create function data_br(d date) returns text
language sql immutable set search_path = public, pg_temp as $$ select to_char(d, 'DD/MM/YYYY') $$;

create function pct_br(p numeric) returns text
language sql immutable set search_path = public, pg_temp as $$ select replace(to_char(p, 'FM990.000'), '.', ',') || '%' $$;

-- clientes, antes de gravar: RN-12 (atualizado_em), RN-06, finalizado_em e RN-14/15 (anexos_apagar_em)
create function tg_clientes_antes() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa or new.data_assinatura is distinct from old.data_assinatura then
    if new.etapa in ('registro_cartorio', 'concluido') and new.data_assinatura is null then
      new.data_assinatura := hoje_br();
    end if;
    if new.etapa in ('concluido', 'reprovado_cancelado') then
      if tg_op = 'INSERT' or old.etapa not in ('concluido', 'reprovado_cancelado') then
        new.finalizado_em := now();
      end if;
    else
      new.finalizado_em := null;
    end if;
    new.anexos_apagar_em := case
      when new.data_assinatura is not null then new.data_assinatura + 30
      when new.etapa = 'reprovado_cancelado' then (new.finalizado_em at time zone 'America/Sao_Paulo')::date + 30
    end;
  end if;
  return new;
end $$;
create trigger clientes_antes before insert or update on clientes
  for each row execute function tg_clientes_antes();

-- clientes, depois de gravar: histórico de etapa; RN-07 e RN-11 (percentual congelado) com histórico de contrato
create function tg_clientes_depois() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pct numeric(6,3);
  v_texto text;
begin
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    insert into historico (conta_id, cliente_id, usuario_id, tipo, texto)
    values (new.conta_id, new.id, meu_usuario_id(), 'etapa',
            'Etapa: ' || rotulo_etapa(old.etapa) || ' → ' || rotulo_etapa(new.etapa));
  end if;

  if (tg_op = 'INSERT' and new.data_assinatura is not null)
     or (tg_op = 'UPDATE' and new.data_assinatura is distinct from old.data_assinatura) then
    if tg_op = 'INSERT' or old.data_assinatura is null then
      select percentual_atual into v_pct from contas_config where conta_id = new.conta_id;
      insert into clientes_remuneracao (cliente_id, conta_id, pct_contrato) values (new.id, new.conta_id, v_pct)
        on conflict (cliente_id) do update set pct_contrato = excluded.pct_contrato;
      v_texto := 'Data de assinatura gravada: ' || data_br(new.data_assinatura) || '; percentual de '
                 || pct_br(v_pct) || ' congelado no contrato';
    elsif new.data_assinatura is null then
      update clientes_remuneracao set pct_contrato = null where cliente_id = new.id;
      v_texto := 'Data de assinatura apagada (era ' || data_br(old.data_assinatura) || '); percentual congelado removido';
    else
      v_texto := 'Data de assinatura alterada de ' || data_br(old.data_assinatura) || ' para '
                 || data_br(new.data_assinatura) || '; percentual congelado mantido';
    end if;
    insert into historico (conta_id, cliente_id, usuario_id, tipo, texto)
    values (new.conta_id, new.id, meu_usuario_id(), 'contrato', v_texto);
  end if;
  return null;
end $$;
create trigger clientes_depois after insert or update on clientes
  for each row execute function tg_clientes_depois();

-- RN-12: mexer em documento, anexo ou histórico conta como atualização do cliente.
-- Só toca atualizado_em, então os gatilhos de etapa e de assinatura não entram em laço.
create function tg_toca_cliente() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cliente uuid;
begin
  if tg_op = 'DELETE' then v_cliente := old.cliente_id; else v_cliente := new.cliente_id; end if;
  update clientes set atualizado_em = now() where id = v_cliente;
  return null;
end $$;
create trigger documentos_toca after insert or update or delete on documentos for each row execute function tg_toca_cliente();
create trigger arquivos_toca after insert or update or delete on arquivos for each row execute function tg_toca_cliente();
create trigger historico_toca after insert or update or delete on historico for each row execute function tg_toca_cliente();

-- RF-23: anexar marca o documento como recebido e registra quem anexou
create function tg_anexo_recebido() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text;
begin
  select name into v_nome from "user" where id = new.enviado_por;
  if new.tipo_documento is not null then
    insert into documentos (conta_id, cliente_id, tipo, recebido_em, marcado_por)
    values (new.conta_id, new.cliente_id, new.tipo_documento, hoje_br(), new.enviado_por)
    on conflict (cliente_id, tipo) do update
      set recebido_em = coalesce(documentos.recebido_em, excluded.recebido_em),
          marcado_por = case when documentos.recebido_em is null then excluded.marcado_por else documentos.marcado_por end;
  end if;
  insert into historico (conta_id, cliente_id, usuario_id, tipo, texto)
  values (new.conta_id, new.cliente_id, new.enviado_por, 'documento',
          'Anexado por ' || coalesce(v_nome, 'sistema') || ': '
          || coalesce((select nome from tipos_documento where codigo = new.tipo_documento), 'Outros arquivos')
          || ' (' || new.nome || ')');
  return null;
end $$;
create trigger arquivos_recebido after insert on arquivos for each row execute function tg_anexo_recebido();

-- Percentual alterado vai para o histórico do percentual (sem limite de entradas, D-20)
create function tg_percentual() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.percentual_atual is distinct from old.percentual_atual then
    insert into historico_percentual (conta_id, percentual, alterado_por) values (new.conta_id, new.percentual_atual, meu_usuario_id());
  end if;
  return null;
end $$;
create trigger contas_config_percentual after update on contas_config for each row execute function tg_percentual();

-- Auditoria de criar, alterar e excluir: só os nomes dos campos, nunca os valores (LGPD)
create function tg_auditoria() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_conta uuid;
  v_id uuid;
  v_acao acao_auditoria;
  v_campos jsonb := '[]';
begin
  if tg_op = 'INSERT' then
    v_conta := new.conta_id; v_id := new.id; v_acao := 'criar';
  elsif tg_op = 'DELETE' then
    v_conta := old.conta_id; v_id := old.id; v_acao := 'excluir';
  else
    v_conta := new.conta_id; v_id := new.id; v_acao := 'alterar';
    select coalesce(jsonb_agg(n.key order by n.key), '[]') into v_campos
      from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key <> 'atualizado_em';
    if v_campos = '[]' then return null; end if; -- só atualizado_em mudou (RN-12)
  end if;
  insert into auditoria (conta_id, usuario_id, acao, entidade, entidade_id, detalhe)
  values (v_conta, meu_usuario_id(), v_acao, tg_argv[0], v_id, jsonb_build_object('campos', v_campos));
  return null;
end $$;
create trigger clientes_auditoria after insert or update or delete on clientes for each row execute function tg_auditoria('cliente');
create trigger corretores_auditoria after insert or update or delete on corretores for each row execute function tg_auditoria('corretor');
create trigger arquivos_auditoria after insert or update or delete on arquivos for each row execute function tg_auditoria('arquivo');
create trigger membros_auditoria after insert or update or delete on membros for each row execute function tg_auditoria('membro');

-- RN-18: conta Simples só tem o gestor. Gatilho depois de gravar: a RLS recusa antes (403 vence 409).
create function tg_limite_plano() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'ativo' and new.perfil <> 'gestor'
     and (select plano from contas where id = new.conta_id) = 'simples' then
    raise exception 'limite_plano' using errcode = 'P0001';
  end if;
  return null;
end $$;
create trigger membros_limite_plano after insert or update of status, perfil on membros
  for each row execute function tg_limite_plano();

-- RN-18: convite na conta Simples, e convite pendente de funcionária ocupa a vaga dela
create function tg_limite_convite() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.aceito_em is not null or new.revogado_em is not null or new.expira_em <= now() then
    return null; -- convite fechado não ocupa vaga
  end if;
  perform pg_advisory_xact_lock(hashtext('convites:' || new.conta_id::text)); -- dois convites ao mesmo tempo
  if (select plano from contas where id = new.conta_id) = 'simples' then
    raise exception 'limite_plano' using errcode = 'P0001';
  end if;
  if new.perfil = 'funcionaria' and (
       exists (select 1 from membros where conta_id = new.conta_id and perfil = 'funcionaria' and status = 'ativo')
       or exists (select 1 from convites where conta_id = new.conta_id and perfil = 'funcionaria' and id <> new.id
                    and aceito_em is null and revogado_em is null and expira_em > now())) then
    raise exception 'limite_funcionaria' using errcode = 'P0001';
  end if;
  return null;
end $$;
create trigger convites_limite after insert or update of expira_em, revogado_em on convites
  for each row execute function tg_limite_convite();

revoke execute on function rotulo_etapa(etapa), data_br(date), pct_br(numeric) from public;
grant execute on function rotulo_etapa(etapa), data_br(date), pct_br(numeric) to app_user, app_system;

-- migrate:down
drop trigger convites_limite on convites;
drop trigger membros_limite_plano on membros;
drop trigger membros_auditoria on membros;
drop trigger arquivos_auditoria on arquivos;
drop trigger corretores_auditoria on corretores;
drop trigger clientes_auditoria on clientes;
drop trigger contas_config_percentual on contas_config;
drop trigger arquivos_recebido on arquivos;
drop trigger historico_toca on historico;
drop trigger arquivos_toca on arquivos;
drop trigger documentos_toca on documentos;
drop trigger clientes_depois on clientes;
drop trigger clientes_antes on clientes;
drop function tg_limite_convite(), tg_limite_plano(), tg_auditoria(), tg_percentual(), tg_anexo_recebido(),
  tg_toca_cliente(), tg_clientes_depois(), tg_clientes_antes(), pct_br(numeric), data_br(date), rotulo_etapa(etapa);
