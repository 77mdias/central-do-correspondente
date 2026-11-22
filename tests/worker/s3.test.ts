import { criarS3 } from "../../worker/s3";
import { TEST_ENV } from "../test-env";

const s3 = criarS3(TEST_ENV);
const caminho = () => `teste/${crypto.randomUUID()}/nome com espaço.pdf`;

test("envia, gera link temporário e o link baixa o mesmo conteúdo", async () => {
  const c = caminho();
  const corpo = new TextEncoder().encode("%PDF-1.4 conteúdo");
  await s3.enviar(c, corpo, "application/pdf");
  const link = await s3.linkTemporario(c, "Contrato São Paulo.pdf");
  expect(link).toContain("X-Amz-Signature=");
  expect(link).toContain("X-Amz-Expires=300");
  const r = await fetch(link);
  expect(r.status).toBe(200);
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(corpo);
});

test("apagar remove o objeto e apagar de novo não dá erro", async () => {
  const c = caminho();
  await s3.enviar(c, new Uint8Array([1, 2, 3]), "application/octet-stream");
  await s3.apagar(c);
  expect((await fetch(await s3.linkTemporario(c, "x"))).ok).toBe(false); // 404 ou 403, conforme o servidor
  await s3.apagar(c);
});

test("listar devolve os objetos do prefixo com a data", async () => {
  const pasta = `lista/${crypto.randomUUID()}`;
  await s3.enviar(`${pasta}/a.pdf`, new Uint8Array([1]), "application/pdf");
  await s3.enviar(`${pasta}/b.pdf`, new Uint8Array([2]), "application/pdf");
  const achados = [];
  for await (const o of s3.listar(`${pasta}/`)) achados.push(o);
  expect(achados.map((o) => o.caminho).sort()).toEqual([`${pasta}/a.pdf`, `${pasta}/b.pdf`]);
  expect(achados[0]!.criadoEm.getTime()).toBeGreaterThan(Date.now() - 600_000);
});

test("S3 fora do ar vira ErroS3", async () => {
  const fora = criarS3({ ...TEST_ENV, S3_ENDPOINT: "http://localhost:9" });
  await expect(fora.enviar("x", new Uint8Array([1]), "text/plain")).rejects.toThrow();
});
