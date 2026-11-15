-- migrate:up
-- Achados da revisão final da fase 1.

-- Views de remuneração: com security_invoker a RLS das tabelas vale para quem consulta, e com security_barrier
-- o filtro "só gestor" roda antes de qualquer filtro de quem consulta (um filtro que dá erro não vaza outra conta).
alter view vw_remuneracao set (security_invoker = true, security_barrier = true);
alter view vw_vgv_periodo set (security_invoker = true, security_barrier = true);
alter view vw_vgv_origem set (security_invoker = true, security_barrier = true);

-- Tirar o acesso de alguém vale mesmo com a conta pendente ou suspensa (só reduz acesso; LGPD).
-- Devolver o acesso (status 'ativo') continua exigindo conta ativa.
drop policy membros_status on membros;
create policy membros_status on membros for update to app_user
  using (perfil <> 'gestor'
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')))
  with check (perfil <> 'gestor'
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor'))
         and (status = 'desativado' or conta_ativa(conta_id)));

-- CNPJ alfanumérico (IN RFB 2.229/2024): 12 caracteres 0-9/A-Z e 2 dígitos verificadores.
alter table contas drop constraint contas_documento_titular_check;
alter table contas add constraint contas_documento_titular_check
  check (documento_titular ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$');

-- migrate:down
alter table contas drop constraint contas_documento_titular_check;
alter table contas add constraint contas_documento_titular_check check (documento_titular ~ '^([0-9]{11}|[0-9]{14})$');
drop policy membros_status on membros;
create policy membros_status on membros for update to app_user
  using (perfil <> 'gestor' and conta_ativa(conta_id)
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')))
  with check (perfil <> 'gestor' and conta_ativa(conta_id)
         and (meu_perfil(conta_id) = 'gestor' or (meu_perfil(conta_id) = 'funcionaria' and perfil = 'corretor')));
alter view vw_vgv_origem reset (security_invoker, security_barrier);
alter view vw_vgv_periodo reset (security_invoker, security_barrier);
alter view vw_remuneracao reset (security_invoker, security_barrier);
