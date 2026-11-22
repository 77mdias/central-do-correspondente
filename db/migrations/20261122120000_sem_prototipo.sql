-- migrate:up
-- Não existe protótipo nem dados a importar (D-24, revista em 22/11/2026): a coluna nunca foi usada.
alter table contas drop column importado_prototipo_em;

-- migrate:down
alter table contas add column importado_prototipo_em timestamptz;
