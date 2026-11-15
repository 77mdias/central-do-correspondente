import { liberarConta } from "../../scripts/conta-liberar";
import { type Cenario, criarCenario, criarConta, criarMembro, linha, poolOwner, poolSystem } from "./ajudantes";

let s: Cenario;
beforeEach(async () => {
  s = await criarCenario();
  await poolSystem.query("update contas set status_assinatura = 'pendente'");
});

const ativa = async (conta: string) => (await linha<{ ok: boolean }>("select conta_ativa($1) as ok", [conta])).ok;

test("libera pelo e-mail do gestor", async () => {
  expect(await ativa(s.contaB)).toBe(false);
  expect(await liberarConta(poolOwner, "GB@b.com", "2099-12-31")).toEqual({ ok: true, contaId: s.contaB });
  expect(await linha("select ativa_ate::text as d from contas where id = $1", [s.contaB])).toEqual({ d: "2099-12-31" });
  expect(await ativa(s.contaB)).toBe(true);
});

test("e-mail gestor de duas contas não grava e lista", async () => {
  const outra = await criarConta("simples", "pendente");
  await criarMembro(outra, s.gB, "gestor");
  const r = await liberarConta(poolOwner, "gb@b.com", "2099-12-31");
  expect(r).toMatchObject({ ok: false, motivo: "ambigua" });
  expect(r.ok === false && r.motivo === "ambigua" && r.contas.map((c) => c.id).sort()).toEqual([s.contaB, outra].sort());
  expect(await linha("select count(*)::int as n from contas where ativa_ate is not null")).toEqual({ n: 0 });
});

test("libera pelo id", async () => {
  expect(await liberarConta(poolOwner, s.contaSimples, "2099-12-31")).toEqual({ ok: true, contaId: s.contaSimples });
});

test("quem não é gestor não é encontrado", async () => {
  expect(await liberarConta(poolOwner, "fa@a.com", "2099-12-31")).toEqual({ ok: false, motivo: "nao_encontrada" });
});

test("data inválida é recusada", async () => {
  await expect(liberarConta(poolOwner, s.contaB, "31/12/2099")).rejects.toThrow(/AAAA-MM-DD/);
});
