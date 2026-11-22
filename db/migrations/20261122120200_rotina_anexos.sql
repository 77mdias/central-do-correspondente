-- migrate:up
-- Rotina diária de anexos (RF-27, RN-14): ela também liga app.importando, porque apagar anexo pelo prazo
-- ou marcar o aviso não é atualização do processo (RN-12) e não pode zerar a contagem de "parado".
-- Falta o gatilho de anexos respeitar a marca (a importação não grava anexos, por isso ficou de fora antes).
drop trigger arquivos_toca on arquivos;
create trigger arquivos_toca after insert or update or delete on arquivos
  for each row when (not em_importacao()) execute function tg_toca_cliente();

-- Busca da rotina: clientes com data de exclusão marcada.
create index clientes_anexos_apagar on clientes (anexos_apagar_em) where anexos_apagar_em is not null;

-- migrate:down
drop index clientes_anexos_apagar;
drop trigger arquivos_toca on arquivos;
create trigger arquivos_toca after insert or update or delete on arquivos for each row execute function tg_toca_cliente();
