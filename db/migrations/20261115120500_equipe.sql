-- migrate:up
-- Membros da conta com nome e e-mail (que moram na tabela "user" do Better Auth, fora do alcance do app_user).
-- Só devolve linhas para gestor e funcionária da conta: mesma regra da política membros_ler.
create function equipe_membros(conta uuid)
returns table (id uuid, nome text, email text, perfil perfil, status status_membro)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, u.name, u.email, m.perfil, m.status
    from membros m join "user" u on u.id = m.usuario_id
   where m.conta_id = conta and sou_escritorio(conta)
   order by m.perfil, u.name
$$;
revoke execute on function equipe_membros(uuid) from public;
grant execute on function equipe_membros(uuid) to app_user;

-- migrate:down
drop function equipe_membros(uuid);
