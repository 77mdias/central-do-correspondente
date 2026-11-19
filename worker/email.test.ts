import { afterEach, describe, expect, it, vi } from "vitest";
import { criarEnvio } from "./email";

const DE = "Central do Correspondente <nao-responda@exemplo.com.br>";
const EMAIL = { para: "ana@exemplo.com.br", assunto: "Confirme seu e-mail", texto: "Abra o link." };

function comFetch(resposta: Response) {
  const fetchFalso = vi.fn<typeof fetch>(async () => resposta);
  vi.stubGlobal("fetch", fetchFalso);
  return () => {
    const [url, init] = fetchFalso.mock.calls[0]!;
    return { url, headers: new Headers(init!.headers), corpo: JSON.parse(init!.body as string) as unknown };
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("criarEnvio", () => {
  it("com chave, envia pela Resend com a chave no cabeçalho", async () => {
    const pedido = comFetch(Response.json({ id: "1" }));
    await criarEnvio({ EMAIL_API_KEY: "re_teste", EMAIL_API_URL: "http://mailpit/ignorado", EMAIL_REMETENTE: DE })(EMAIL);
    const { url, headers, corpo } = pedido();
    expect(url).toBe("https://api.resend.com/emails");
    expect(headers.get("authorization")).toBe("Bearer re_teste");
    expect(corpo).toEqual({ from: DE, to: [EMAIL.para], subject: EMAIL.assunto, text: EMAIL.texto });
  });

  it("sem chave, envia pela API do Mailpit", async () => {
    const pedido = comFetch(Response.json({ ID: "1" }));
    await criarEnvio({ EMAIL_API_URL: "http://mailpit:8025/api/v1/send", EMAIL_REMETENTE: DE })(EMAIL);
    const { url, headers, corpo } = pedido();
    expect(url).toBe("http://mailpit:8025/api/v1/send");
    expect(headers.has("authorization")).toBe(false);
    expect(corpo).toEqual({
      From: { Name: "Central do Correspondente", Email: "nao-responda@exemplo.com.br" },
      To: [{ Email: EMAIL.para }],
      Subject: EMAIL.assunto,
      Text: EMAIL.texto,
    });
  });

  it("falha com o status e o motivo do provedor, sem a chave", async () => {
    comFetch(Response.json({ message: "The exemplo.com.br domain is not verified." }, { status: 403 }));
    const envio = criarEnvio({ EMAIL_API_KEY: "re_teste", EMAIL_REMETENTE: DE })(EMAIL);
    await expect(envio).rejects.toThrow(/HTTP 403.*domain is not verified/);
    await expect(envio).rejects.not.toThrow(/re_teste/);
  });

  it("sem chave e sem endereço do Mailpit, não cria o envio", () => {
    expect(() => criarEnvio({ EMAIL_REMETENTE: DE })).toThrow(/EMAIL_API_KEY/);
  });
});
