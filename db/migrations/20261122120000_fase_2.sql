-- migrate:up
-- Fase 2 (Migração): os 12 documentos do protótipo (P-01), campos novos e a auditoria de leitura.

-- Os 12 tipos, com os códigos que o protótipo usa em `docs` e `arquivos` (MODELO-DE-DADOS, tipos_documento).
insert into tipos_documento (codigo, nome, grupo, ordem) values
  ('rg', 'RG ou CNH', 'comprador', 1),
  ('cpf', 'CPF', 'comprador', 2),
  ('civil', 'Certidão de nascimento ou casamento', 'comprador', 3),
  ('resid', 'Comprovante de residência', 'comprador', 4),
  ('renda', 'Comprovante de renda (3 últimos holerites)', 'comprador', 5),
  ('ctps', 'Carteira de trabalho', 'comprador', 6),
  ('ir', 'Declaração de Imposto de Renda', 'comprador', 7),
  ('fgts', 'Extrato do FGTS', 'comprador', 8),
  ('matr', 'Matrícula atualizada do imóvel', 'imovel_vendedor', 1),
  ('iptu', 'Carnê do IPTU', 'imovel_vendedor', 2),
  ('vend', 'Documentos do vendedor', 'imovel_vendedor', 3),
  ('form', 'Formulários assinados', 'imovel_vendedor', 4)
on conflict (codigo) do update set nome = excluded.nome, grupo = excluded.grupo, ordem = excluded.ordem;

-- Aviso de exclusão dos anexos só uma vez por dia (rotina diária, RF-27).
alter table clientes add column anexos_aviso_em date;

-- Cópia do protótipo já importada (D-40): a mesma cópia não entra em duas contas.
alter table contas add column prototipo_origem text unique;

-- Anexo de até 20 MB (RF-22).
alter table arquivos drop constraint arquivos_tamanho_check,
  add constraint arquivos_tamanho_check check (tamanho between 1 and 20971520);

-- Auditoria de leitura: abrir a ficha (`ver`) e baixar anexo (`baixar`), sempre em nome próprio (RNF-07).
-- As outras ações continuam só pelos gatilhos.
grant insert on auditoria to app_user;
create policy auditoria_registrar on auditoria for insert to app_user
  with check (usuario_id = meu_usuario_id()
              and (
                (acao = 'ver' and sou_escritorio(conta_id))
                or (acao = 'baixar' and (sou_escritorio(conta_id) or exists (
                      select 1 from arquivos a
                       where a.id = entidade_id and a.conta_id = auditoria.conta_id
                         and meu_cliente_de_corretor(a.conta_id, a.cliente_id))))
              ));

-- migrate:down
drop policy auditoria_registrar on auditoria;
revoke insert on auditoria from app_user;
alter table arquivos drop constraint arquivos_tamanho_check,
  add constraint arquivos_tamanho_check check (tamanho > 0);
alter table contas drop column prototipo_origem;
alter table clientes drop column anexos_aviso_em;
delete from tipos_documento
 where codigo in ('rg', 'cpf', 'civil', 'resid', 'renda', 'ctps', 'ir', 'fgts', 'matr', 'iptu', 'vend', 'form')
   and not exists (select 1 from documentos d where d.tipo = tipos_documento.codigo)
   and not exists (select 1 from arquivos a where a.tipo_documento = tipos_documento.codigo);
