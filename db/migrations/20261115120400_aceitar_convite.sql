-- migrate:up
-- Aceite de convite (como app_system; quem chama já conferiu a sessão: p_usuario_id é o da sessão).
-- Confere validade e e-mail, cria o membro (ou reativa um desativado) e fecha o convite.
-- Os gatilhos de limite do plano e o índice de uma funcionária ativa continuam valendo.
create function aceitar_convite(p_token_hash text, p_usuario_id uuid) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_inv convites;
  v_email text;
begin
  select * into v_inv from convites where token_hash = p_token_hash for update;
  if not found or v_inv.aceito_em is not null or v_inv.revogado_em is not null or v_inv.expira_em <= now() then
    raise exception 'convite_invalido' using errcode = 'P0002';
  end if;

  select email into v_email from "user" where id = p_usuario_id for update;
  if not found then
    raise exception 'convite_invalido' using errcode = 'P0002';
  end if;
  if lower(v_email) <> v_inv.email then
    raise exception 'convite_email_diferente' using errcode = 'P0001';
  end if;
  if exists (select 1 from membros where conta_id = v_inv.conta_id and usuario_id = p_usuario_id and status = 'ativo') then
    raise exception 'ja_membro' using errcode = 'P0001';
  end if;

  insert into membros (conta_id, usuario_id, perfil, corretor_id, convidado_por)
  values (v_inv.conta_id, p_usuario_id, v_inv.perfil, v_inv.corretor_id, v_inv.convidado_por)
  on conflict (conta_id, usuario_id) do update
    set status = 'ativo', perfil = excluded.perfil, corretor_id = excluded.corretor_id;
  update convites set aceito_em = now() where id = v_inv.id;
  return v_inv.conta_id;
end $$;

revoke execute on function aceitar_convite(text, uuid) from public;
grant execute on function aceitar_convite(text, uuid) to app_system;

-- migrate:down
drop function aceitar_convite(text, uuid);
