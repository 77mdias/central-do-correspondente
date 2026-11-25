-- migrate:up
-- Fase 3: o corretor também registra a abertura da ficha (spec da fase 3, §7), só dos próprios clientes.
-- 'baixar' continua como na fase 2.
drop policy auditoria_registrar on auditoria;
create policy auditoria_registrar on auditoria for insert to app_user
  with check (usuario_id = meu_usuario_id()
              and (
                (acao = 'ver' and (sou_escritorio(conta_id)
                                   or (entidade = 'cliente' and meu_cliente_de_corretor(conta_id, entidade_id))))
                or (acao = 'baixar' and (sou_escritorio(conta_id) or exists (
                      select 1 from arquivos a
                       where a.id = entidade_id and a.conta_id = auditoria.conta_id
                         and meu_cliente_de_corretor(a.conta_id, a.cliente_id))))
              ));

-- migrate:down
drop policy auditoria_registrar on auditoria;
create policy auditoria_registrar on auditoria for insert to app_user
  with check (usuario_id = meu_usuario_id()
              and (
                (acao = 'ver' and sou_escritorio(conta_id))
                or (acao = 'baixar' and (sou_escritorio(conta_id) or exists (
                      select 1 from arquivos a
                       where a.id = entidade_id and a.conta_id = auditoria.conta_id
                         and meu_cliente_de_corretor(a.conta_id, a.cliente_id))))
              ));
