import type { ArquivoResumo, ClienteLista, Ficha } from "../../src/tipos-api";
import { tipoPeloConteudo } from "../../worker/rotas/arquivos";
import { criarCenario, poolSystem } from "../db/ajudantes";
import { corretorLogado, escritorio, hojeBanco } from "./cenario";

beforeEach(async () => {
  await criarCenario();
});

type E = Awaited<ReturnType<typeof escritorio>>;
const PDF = new TextEncoder().encode("%PDF-1.4\n%conteúdo de teste\n");
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

async function cliente(e: E) {
  const r = await e.req(`/api/contas/${e.conta}/clientes`, { body: { nome: "Maria" }, cookie: e.g });
  return ((await r.json()) as { id: string }).id;
}
function form(tipo: string, bytes: Uint8Array<ArrayBuffer>, nome = "rg.pdf", mime = "application/pdf") {
  const f = new FormData();
  f.set("tipo", tipo);
  f.set("arquivo", new File([bytes], nome, { type: mime }));
  return f;
}
const anexar = (e: E, id: string, f: FormData, cookie = e.g) => e.enviar(`/api/contas/${e.conta}/clientes/${id}/arquivos`, f, cookie);
const ficha = (e: E, id: string) => e.json<Ficha>(e.req(`/api/contas/${e.conta}/clientes/${id}`, { cookie: e.g }));

test("tipo pelo conteúdo", () => {
  expect(tipoPeloConteudo(PDF)?.mime).toBe("application/pdf");
  expect(tipoPeloConteudo(JPG)?.mime).toBe("image/jpeg");
  expect(tipoPeloConteudo(new TextEncoder().encode("olá, sou texto"))).toBeNull();
});

test("anexar PDF marca o documento recebido e escreve 'Anexado por' (RF-23)", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  const r = await anexar(e, id, form("rg", PDF), e.f);
  expect(r.status).toBe(201);
  const a = (await r.json()) as ArquivoResumo;
  expect(a).toMatchObject({ tipo: "rg", nome: "rg.pdf", mime: "application/pdf", tamanho: PDF.byteLength });
  const f = await ficha(e, id);
  expect(f.cliente.documentos.rg).toBe(await hojeBanco());
  expect(f.cliente.anexos).toEqual({ rg: 1 });
  expect(f.anexos.map((x) => x.id)).toEqual([a.id]);
  expect(f.historico[0]!.texto).toBe("Anexado por Func: RG ou CNH (rg.pdf)");
  const linha = await poolSystem.query("select caminho from arquivos where id = $1", [a.id]);
  expect(linha.rows[0].caminho).toBe(`${e.conta}/${id}/${a.id}.pdf`);
});

test("'outros' não marca documento", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  expect((await anexar(e, id, form("outros", JPG, "laudo.jpg", "image/jpeg"))).status).toBe(201);
  const c = (await ficha(e, id)).cliente as ClienteLista;
  expect(c.anexos).toEqual({ outros: 1 });
  expect(c.documentos).toEqual({});
});

test("acima de 20 MB dá 413 e nada é gravado", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  const grande = new Uint8Array(20 * 1024 * 1024 + 1);
  grande.set(PDF);
  const r = await anexar(e, id, form("rg", grande));
  expect(r.status).toBe(413);
  expect((await poolSystem.query("select 1 from arquivos where cliente_id = $1", [id])).rowCount).toBe(0);
});

test("texto com nome .pdf dá 415", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  const r = await anexar(e, id, form("rg", new TextEncoder().encode("não sou pdf"), "falso.pdf"));
  expect(r.status).toBe(415);
  expect(await r.json()).toEqual({ erro: "tipo_nao_aceito" });
});

test("S3 fora do ar: 502, nenhuma linha e documento não marcado", async () => {
  const e = await escritorio({ S3_ENDPOINT: "http://localhost:9" });
  const id = await cliente(e);
  const r = await anexar(e, id, form("rg", PDF));
  expect(r.status).toBe(502);
  expect((await poolSystem.query("select 1 from arquivos where cliente_id = $1", [id])).rowCount).toBe(0);
  expect((await poolSystem.query("select 1 from documentos where cliente_id = $1", [id])).rowCount).toBe(0);
  expect((await ficha(e, id)).historico.map((h) => h.texto)).toEqual(["Cliente cadastrado · Cliente direto"]);
});

test("link grava auditoria 'baixar' e baixa o arquivo", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  const a = (await (await anexar(e, id, form("rg", PDF))).json()) as ArquivoResumo;
  const { url } = await e.json<{ url: string }>(e.req(`/api/contas/${e.conta}/arquivos/${a.id}/link`, { cookie: e.f }));
  const r = await fetch(url);
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(PDF);
  const aud = await poolSystem.query("select acao from auditoria where entidade_id = $1 and acao = 'baixar'", [a.id]);
  expect(aud.rowCount).toBe(1);
});

test("link de arquivo de outra conta: 404 e sem auditoria", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  const a = (await (await anexar(e, id, form("rg", PDF))).json()) as ArquivoResumo;
  expect((await e.req(`/api/contas/${e.conta}/arquivos/${a.id}/link`, { cookie: e.outro })).status).toBe(404);
  expect((await e.req(`/api/contas/${e.contaOutro}/arquivos/${a.id}/link`, { cookie: e.outro })).status).toBe(404);
  expect((await poolSystem.query("select 1 from auditoria where entidade_id = $1 and acao = 'baixar'", [a.id])).rowCount).toBe(0);
});

test("remover anexo apaga o objeto e mantém o documento recebido (RF-24)", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  const a = (await (await anexar(e, id, form("rg", PDF))).json()) as ArquivoResumo;
  const { url } = await e.json<{ url: string }>(e.req(`/api/contas/${e.conta}/arquivos/${a.id}/link`, { cookie: e.g }));
  expect((await e.req(`/api/contas/${e.conta}/arquivos/${a.id}`, { method: "DELETE", cookie: e.f })).status).toBe(204);
  await new Promise((ok) => setTimeout(ok, 200)); // o objeto sai depois da resposta (waitUntil)
  expect((await fetch(url)).ok).toBe(false);
  const f = await ficha(e, id);
  expect(f.cliente.documentos.rg).toBe(await hojeBanco());
  expect(f.anexos).toEqual([]);
  expect(f.historico[0]!.texto).toBe("Arquivo removido: RG ou CNH (rg.pdf)");
});

test("outra conta não anexa nem remove", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  expect((await anexar(e, id, form("rg", PDF), e.outro)).status).toBe(404);
  const a = (await (await anexar(e, id, form("rg", PDF))).json()) as ArquivoResumo;
  expect((await e.req(`/api/contas/${e.conta}/arquivos/${a.id}`, { method: "DELETE", cookie: e.outro })).status).toBe(404);
});

test("conta pendente não anexa nem remove (403)", async () => {
  const e = await escritorio();
  const id = await cliente(e);
  const a = (await (await anexar(e, id, form("rg", PDF))).json()) as ArquivoResumo;
  await poolSystem.query("update contas set ativa_ate = null, status_assinatura = 'pendente' where id = $1", [e.conta]);
  expect((await anexar(e, id, form("cpf", PDF))).status).toBe(403);
  expect((await e.req(`/api/contas/${e.conta}/arquivos/${a.id}`, { method: "DELETE", cookie: e.g })).status).toBe(403);
});

// ── corretor (fase 3, RF-82) ──

async function comCorretor() {
  const e = await escritorio();
  const k = await corretorLogado(e, { conta: e.conta, gestora: e.g, nome: "Ana Corretora" });
  const novo = async (corretorId: string | null) =>
    ((await (await e.req(`/api/contas/${e.conta}/clientes`, { body: { nome: "Cliente", corretorId }, cookie: e.g })).json()) as { id: string }).id;
  const outroK = ((await (await e.req(`/api/contas/${e.conta}/corretores`, { body: { nome: "Outro" }, cookie: e.g })).json()) as { id: string }).id;
  return { e, k, meu: await novo(k.corretorId), deOutro: await novo(outroK) };
}
const desativar = async (e: E, usuarioId: string) => {
  const m = (await poolSystem.query<{ id: string }>("select id from membros where usuario_id = $1 and conta_id = $2", [usuarioId, e.conta])).rows[0]!.id;
  expect((await e.req(`/api/contas/${e.conta}/membros/${m}/desativar`, { body: {}, cookie: e.g })).status).toBe(200);
};

test("corretor anexa no próprio cliente: documento marcado e 'Anexado por {nome}' (RF-82)", async () => {
  const { e, k, meu } = await comCorretor();
  const r = await anexar(e, meu, form("rg", PDF), k.cookie);
  expect(r.status).toBe(201);
  const f = await ficha(e, meu);
  expect(f.cliente.documentos.rg).toBe(await hojeBanco());
  expect(f.anexos).toEqual([expect.objectContaining({ tipo: "rg", nome: "rg.pdf" })]);
  expect(f.historico.find((h) => h.tipo === "documento")?.texto).toBe("Anexado por Ana Corretora: RG ou CNH (rg.pdf)");
});

test("corretor não anexa em cliente de outro corretor (404)", async () => {
  const { e, k, deOutro } = await comCorretor();
  expect((await anexar(e, deOutro, form("rg", PDF), k.cookie)).status).toBe(404);
  expect((await poolSystem.query("select 1 from arquivos where cliente_id = $1", [deOutro])).rowCount).toBe(0);
});

test("corretor não remove anexo, nem o que ele mesmo enviou (403)", async () => {
  const { e, k, meu } = await comCorretor();
  const dele = (await (await anexar(e, meu, form("rg", PDF), k.cookie)).json()) as ArquivoResumo;
  const doEscritorio = (await (await anexar(e, meu, form("cpf", PDF, "cpf.pdf"), e.f)).json()) as ArquivoResumo;
  for (const a of [dele, doEscritorio]) {
    expect((await e.req(`/api/contas/${e.conta}/arquivos/${a.id}`, { method: "DELETE", cookie: k.cookie })).status).toBe(403);
  }
  expect((await ficha(e, meu)).anexos).toHaveLength(2);
});

test("corretor abre o link de anexo do próprio cliente e grava 'baixar'", async () => {
  const { e, k, meu } = await comCorretor();
  const a = (await (await anexar(e, meu, form("rg", PDF), e.f)).json()) as ArquivoResumo;
  const r = await e.req(`/api/contas/${e.conta}/arquivos/${a.id}/link`, { cookie: k.cookie });
  expect(r.status).toBe(200);
  expect(((await r.json()) as { url: string }).url).toMatch(/^http/);
  const aud = await poolSystem.query("select acao from auditoria where usuario_id = $1 and entidade_id = $2", [k.usuarioId, a.id]);
  expect(aud.rows).toEqual([{ acao: "baixar" }]);
});

test("corretor desativado: anexar e link dão 404, sem auditoria", async () => {
  const { e, k, meu } = await comCorretor();
  const a = (await (await anexar(e, meu, form("rg", PDF), e.f)).json()) as ArquivoResumo;
  await desativar(e, k.usuarioId);
  expect((await anexar(e, meu, form("cpf", PDF), k.cookie)).status).toBe(404);
  expect((await e.req(`/api/contas/${e.conta}/arquivos/${a.id}/link`, { cookie: k.cookie })).status).toBe(404);
  expect((await poolSystem.query("select 1 from auditoria where usuario_id = $1", [k.usuarioId])).rowCount).toBe(0);
});

test("conta pendente: corretor lê o portal, mas anexar dá 403", async () => {
  const { e, k, meu } = await comCorretor();
  await poolSystem.query("update contas set ativa_ate = null, status_assinatura = 'pendente' where id = $1", [e.conta]);
  expect((await e.req(`/api/contas/${e.conta}/portal/clientes`, { cookie: k.cookie })).status).toBe(200);
  expect((await anexar(e, meu, form("rg", PDF), k.cookie)).status).toBe(403);
});
