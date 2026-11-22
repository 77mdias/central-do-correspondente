import { AwsClient } from "aws4fetch";
import type { Env } from "./env";

export type ObjetoS3 = { caminho: string; criadoEm: Date };

export type S3 = {
  enviar(caminho: string, corpo: ArrayBuffer | Uint8Array<ArrayBuffer>, tipo: string): Promise<void>;
  apagar(caminho: string): Promise<void>;
  /** Link pré-assinado de GET (RNF-11: até 5 min), que abre no navegador com o nome original. */
  linkTemporario(caminho: string, nomeArquivo: string, segundos?: number): Promise<string>;
  listar(prefixo?: string): AsyncIterable<ObjetoS3>;
};

/** Erro do S3: sobe como 502 nas rotas (o armazenamento falhou, não o pedido). */
export class ErroS3 extends Error {}

const codificar = (caminho: string) => caminho.split("/").map(encodeURIComponent).join("/");
const entreTags = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, "g"))].map((m) => m[1]!);
const xmlTexto = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Cliente S3 mínimo (assinatura v4 com aws4fetch), endereçamento por caminho: `<endpoint>/<bucket>/<chave>`. */
export function criarS3(env: Pick<Env, "S3_ENDPOINT" | "S3_REGIAO" | "S3_BUCKET" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY">): S3 {
  const aws = new AwsClient({ accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, region: env.S3_REGIAO, service: "s3" });
  const base = `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}`;
  const url = (caminho: string) => `${base}/${codificar(caminho)}`;

  async function pedir(u: string, init: RequestInit, ok: (s: number) => boolean = (s) => s >= 200 && s < 300): Promise<Response> {
    const r = await aws.fetch(u, init);
    if (!ok(r.status)) throw new ErroS3(`S3 ${init.method ?? "GET"} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
  }

  return {
    async enviar(caminho, corpo, tipo) {
      await pedir(url(caminho), { method: "PUT", body: corpo, headers: { "content-type": tipo } });
    },
    async apagar(caminho) {
      await pedir(url(caminho), { method: "DELETE" }, (s) => (s >= 200 && s < 300) || s === 404);
    },
    async linkTemporario(caminho, nomeArquivo, segundos = 300) {
      const u = new URL(url(caminho));
      u.searchParams.set("X-Amz-Expires", String(segundos));
      u.searchParams.set("response-content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`);
      const assinado = await aws.sign(u.toString(), { method: "GET", aws: { signQuery: true } });
      return assinado.url;
    },
    async *listar(prefixo = "") {
      let token: string | undefined;
      do {
        const u = new URL(base);
        u.searchParams.set("list-type", "2");
        if (prefixo) u.searchParams.set("prefix", prefixo);
        if (token) u.searchParams.set("continuation-token", token);
        const xml = await (await pedir(u.toString(), { method: "GET" })).text();
        const blocos = xml.split("<Contents>").slice(1);
        for (const b of blocos) {
          const [chave] = entreTags(b, "Key");
          const [quando] = entreTags(b, "LastModified");
          if (chave) yield { caminho: xmlTexto(chave), criadoEm: new Date(quando ?? 0) };
        }
        token = entreTags(xml, "IsTruncated")[0] === "true" ? entreTags(xml, "NextContinuationToken")[0] : undefined;
      } while (token);
    },
  };
}
