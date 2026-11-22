import { Hono } from "hono";
import { esquemaCorretor, esquemaCorretorParcial } from "../../src/regras/esquemas";
import type { Corretor } from "../../src/tipos-api";
import { type AppTipos, exigirUsuario } from "../contexto";
import { corpo, ehResposta, emTransacao, ErroRota, exigirEscritorio, ids, naoEncontrado, semPermissao } from "./comum";

export const rotasCorretores = new Hono<AppTipos>();
rotasCorretores.use("/contas/:contaId/*", exigirUsuario);

/** RF-45: status do acesso ao portal (membro ativo > convite aberto > sem acesso). */
const SELECT_CORRETOR = `
  k.id, k.nome, k.imobiliaria, k.whatsapp, k.creci, k.email,
  case
    when exists (select 1 from membros m where m.conta_id = k.conta_id and m.corretor_id = k.id and m.status = 'ativo') then 'ativo'
    when exists (select 1 from convites v where v.conta_id = k.conta_id and v.corretor_id = k.id
                  and v.aceito_em is null and v.revogado_em is null and v.expira_em > now()) then 'convidado'
    else 'sem_acesso'
  end as acesso`;

const COLUNA: Record<string, string> = { nome: "nome", imobiliaria: "imobiliaria", whatsapp: "whatsapp", creci: "creci", email: "email" };

rotasCorretores.get("/contas/:contaId/corretores", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    await exigirEscritorio(db, conta!);
    return (await db.query<Corretor>(`select ${SELECT_CORRETOR} from corretores k where k.conta_id = $1 order by k.nome`, [conta])).rows;
  });
  return ehResposta(r) ? r : c.json<Corretor[]>(r);
});

rotasCorretores.post("/contas/:contaId/corretores", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    await exigirEscritorio(db, conta!);
    const d = await corpo(c, esquemaCorretor);
    const ins = await db.query<{ id: string }>(
      `insert into corretores (conta_id, nome, imobiliaria, whatsapp, creci, email) values ($1, $2, $3, $4, $5, $6) returning id`,
      [conta, d.nome, d.imobiliaria ?? null, d.whatsapp ?? null, d.creci ?? null, d.email ?? null],
    );
    return { id: ins.rows[0]!.id };
  });
  return ehResposta(r) ? r : c.json(r, 201);
});

async function existe(db: Parameters<typeof exigirEscritorio>[0], conta: string, id: string) {
  const r = await db.query("select 1 from corretores where conta_id = $1 and id = $2", [conta, id]);
  if (!r.rowCount) throw naoEncontrado();
}

rotasCorretores.patch("/contas/:contaId/corretores/:id", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirEscritorio(db, conta!);
    const d = await corpo(c, esquemaCorretorParcial);
    await existe(db, conta!, id!);
    const campos = Object.entries(d).filter(([k]) => k in COLUNA);
    const sets = campos.map(([k], i) => `${COLUNA[k]} = $${i + 3}`).join(", ");
    const up = await db.query(`update corretores set ${sets}, atualizado_em = now() where conta_id = $1 and id = $2`, [
      conta,
      id,
      ...campos.map(([, v]) => v),
    ]);
    if (!up.rowCount) throw semPermissao();
    return (await db.query<Corretor>(`select ${SELECT_CORRETOR} from corretores k where k.id = $1`, [id])).rows[0]!;
  });
  return ehResposta(r) ? r : c.json<Corretor>(r);
});

/** RF-44: corretor com clientes (ou com acesso ao portal) não é removido. */
rotasCorretores.delete("/contas/:contaId/corretores/:id", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirEscritorio(db, conta!);
    await existe(db, conta!, id!);
    try {
      const del = await db.query("delete from corretores where conta_id = $1 and id = $2", [conta, id]);
      if (!del.rowCount) throw semPermissao();
    } catch (e) {
      const { code, table } = (e ?? {}) as { code?: string; table?: string };
      if (code !== "23503") throw e;
      throw new ErroRota(409, { erro: table === "clientes" ? "corretor_com_clientes" : "corretor_com_acesso" });
    }
    return true;
  });
  return ehResposta(r) ? r : c.body(null, 204);
});
