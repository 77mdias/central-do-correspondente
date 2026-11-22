-- migrate:up
-- Importação do protótipo (RF-90, D-40) numa função do banco: confere o acesso, grava tudo numa transação
-- e preserva as datas e os percentuais originais. Docs: spec da fase 2, seção 10; plano, "Ajuste à spec".

-- A transação está importando? Só importar_prototipo liga a marca (set_config local: some no fim da transação).
create function em_importacao() returns boolean
language sql stable set search_path = public, pg_temp as $$
  select coalesce(current_setting('app.importando', true), '') = 'on'
$$;

-- Durante a importação os gatilhos de regra não agem: as datas, os percentuais e o histórico vêm do arquivo.
drop trigger clientes_antes on clientes;
create trigger clientes_antes before insert or update on clientes
  for each row when (not em_importacao()) execute function tg_clientes_antes();
drop trigger clientes_depois on clientes;
create trigger clientes_depois after insert or update on clientes
  for each row when (not em_importacao()) execute function tg_clientes_depois();
drop trigger documentos_toca on documentos;
create trigger documentos_toca after insert or update or delete on documentos
  for each row when (not em_importacao()) execute function tg_toca_cliente();
drop trigger historico_toca on historico;
create trigger historico_toca after insert or update or delete on historico
  for each row when (not em_importacao()) execute function tg_toca_cliente();
drop trigger clientes_auditoria on clientes;
create trigger clientes_auditoria after insert or update or delete on clientes
  for each row when (not em_importacao()) execute function tg_auditoria('cliente');
drop trigger corretores_auditoria on corretores;
create trigger corretores_auditoria after insert or update or delete on corretores
  for each row when (not em_importacao()) execute function tg_auditoria('corretor');
drop trigger contas_config_percentual on contas_config;
create trigger contas_config_percentual after update on contas_config
  for each row when (not em_importacao()) execute function tg_percentual();

-- `dados` chega convertido e validado pelo Worker (src/regras/importacao.ts): campos de clientes com os nomes
-- das colunas, valores em centavos e enums já traduzidos; ids do protótipo em idOrigem/corretorIdOrigem.
create function importar_prototipo(conta uuid, dados jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_origem text := nullif(dados->>'origem', '');
  v_hoje date := hoje_br();
  v_mapa jsonb := '{}';
  v_item jsonb;
  v_id uuid;
  v_cli clientes;
  n_cor int := 0;
  n_cli int := 0;
  n_doc int := 0;
  n_nota int := 0;
  n int;
begin
  if meu_perfil(conta) is distinct from 'gestor' then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if not conta_ativa(conta) then
    raise exception 'conta_inativa' using errcode = 'P0001';
  end if;
  if v_origem is null then
    raise exception 'arquivo_invalido' using errcode = 'P0001';
  end if;
  perform 1 from contas where id = conta for update; -- duas importações ao mesmo tempo na mesma conta
  if (select importado_prototipo_em from contas where id = conta) is not null then
    raise exception 'ja_importado' using errcode = 'P0001';
  end if;
  if exists (select 1 from clientes where conta_id = conta) or exists (select 1 from corretores where conta_id = conta) then
    raise exception 'conta_nao_vazia' using errcode = 'P0001';
  end if;
  if exists (select 1 from contas where prototipo_origem = v_origem) then
    raise exception 'origem_usada' using errcode = 'P0001';
  end if;

  perform set_config('app.importando', 'on', true);

  update contas_config set percentual_atual = coalesce((dados->>'percentual')::numeric, percentual_atual) where conta_id = conta;
  insert into historico_percentual (conta_id, percentual, criado_em)
  select conta, (h->>'percentual')::numeric, (h->>'criadoEm')::timestamptz
    from jsonb_array_elements(coalesce(dados->'historicoPercentual', '[]')) h;

  for v_item in select * from jsonb_array_elements(coalesce(dados->'corretores', '[]')) loop
    insert into corretores (conta_id, nome, imobiliaria, whatsapp, creci, email, criado_em, atualizado_em)
    values (conta, v_item->>'nome', v_item->>'imobiliaria', v_item->>'whatsapp', v_item->>'creci', v_item->>'email',
            coalesce((v_item->>'criadoEm')::timestamptz, now()), coalesce((v_item->>'criadoEm')::timestamptz, now()))
    returning id into v_id;
    v_mapa := v_mapa || jsonb_build_object(v_item->>'idOrigem', v_id);
    n_cor := n_cor + 1;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(dados->'clientes', '[]')) loop
    v_cli := jsonb_populate_record(null::clientes, v_item);
    v_cli.id := gen_random_uuid();
    v_cli.conta_id := conta;
    v_cli.corretor_id := (v_mapa->>(v_item->>'corretorIdOrigem'))::uuid; -- sem corretor no mapa: cliente direto
    v_cli.etapa := coalesce(v_cli.etapa, 'documentacao_pendente');
    v_cli.intervalo_cobranca := coalesce(v_cli.intervalo_cobranca, 3);
    v_cli.qtd_cobrancas := coalesce(v_cli.qtd_cobrancas, 0);
    v_cli.criado_em := coalesce(v_cli.criado_em, now());
    v_cli.atualizado_em := coalesce(v_cli.atualizado_em, v_cli.criado_em);
    v_cli.anexos_aviso_em := null;
    if v_cli.etapa in ('concluido', 'reprovado_cancelado') then
      v_cli.finalizado_em := coalesce(v_cli.finalizado_em, v_cli.atualizado_em);
    else
      v_cli.finalizado_em := null;
    end if;
    v_cli.anexos_apagar_em := case -- RN-14, a mesma conta do gatilho tg_clientes_antes
      when v_cli.data_assinatura is not null then v_cli.data_assinatura + 30
      when v_cli.etapa = 'reprovado_cancelado' then (v_cli.finalizado_em at time zone 'America/Sao_Paulo')::date + 30
    end;
    insert into clientes select v_cli.*;

    insert into clientes_remuneracao (cliente_id, conta_id, pct_contrato, pct_proprio, remuneracao_recebida_em)
    values (v_cli.id, conta, (v_item#>>'{remuneracao,pctContrato}')::numeric, (v_item#>>'{remuneracao,pctProprio}')::numeric,
            (v_item#>>'{remuneracao,recebidaEm}')::date);

    insert into documentos (conta_id, cliente_id, tipo, recebido_em)
    select conta, v_cli.id, d->>'tipo', (d->>'recebidoEm')::date
      from jsonb_array_elements(coalesce(v_item->'documentos', '[]')) d;
    get diagnostics n = row_count;
    n_doc := n_doc + n;

    insert into historico (conta_id, cliente_id, usuario_id, tipo, texto, criado_em)
    select conta, v_cli.id, null, 'nota', h->>'texto', coalesce((h->>'criadoEm')::timestamptz, v_cli.criado_em)
      from jsonb_array_elements(coalesce(v_item->'historico', '[]')) h;
    get diagnostics n = row_count;
    n_nota := n_nota + n;

    insert into historico (conta_id, cliente_id, usuario_id, tipo, texto)
    values (conta, v_cli.id, null, 'sistema', 'Importado do protótipo em ' || data_br(v_hoje));
    n_cli := n_cli + 1;
  end loop;

  insert into auditoria (conta_id, usuario_id, acao, entidade, detalhe)
  values (conta, meu_usuario_id(), 'criar', 'importacao',
          jsonb_build_object('corretores', n_cor, 'clientes', n_cli, 'documentos', n_doc, 'notas', n_nota));

  begin
    update contas set importado_prototipo_em = now(), prototipo_origem = v_origem where id = conta;
  exception when unique_violation then
    raise exception 'origem_usada' using errcode = 'P0001'; -- outra conta importou a mesma cópia ao mesmo tempo
  end;

  perform set_config('app.importando', 'off', true);
  return jsonb_build_object('corretores', n_cor, 'clientes', n_cli, 'documentos', n_doc, 'notas', n_nota);
end $$;

revoke execute on function importar_prototipo(uuid, jsonb) from public;
grant execute on function importar_prototipo(uuid, jsonb) to app_user;
grant execute on function em_importacao() to app_user, app_system;

-- migrate:down
drop function importar_prototipo(uuid, jsonb);
drop trigger contas_config_percentual on contas_config;
create trigger contas_config_percentual after update on contas_config for each row execute function tg_percentual();
drop trigger corretores_auditoria on corretores;
create trigger corretores_auditoria after insert or update or delete on corretores for each row execute function tg_auditoria('corretor');
drop trigger clientes_auditoria on clientes;
create trigger clientes_auditoria after insert or update or delete on clientes for each row execute function tg_auditoria('cliente');
drop trigger historico_toca on historico;
create trigger historico_toca after insert or update or delete on historico for each row execute function tg_toca_cliente();
drop trigger documentos_toca on documentos;
create trigger documentos_toca after insert or update or delete on documentos for each row execute function tg_toca_cliente();
drop trigger clientes_depois on clientes;
create trigger clientes_depois after insert or update on clientes for each row execute function tg_clientes_depois();
drop trigger clientes_antes on clientes;
create trigger clientes_antes before insert or update on clientes for each row execute function tg_clientes_antes();
drop function em_importacao();
