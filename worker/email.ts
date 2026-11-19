import type { Env } from "./env";

export type Email = { para: string; assunto: string; texto: string };
export type EnviarEmail = (e: Email) => Promise<void>;

/** "Nome <email@x>" → partes. */
function remetente(s: string): { Name?: string; Email: string } {
  const m = /^(.*)<(.+)>$/.exec(s.trim());
  return m ? { Name: m[1]!.trim(), Email: m[2]!.trim() } : { Email: s.trim() };
}

async function postar(url: string, corpo: unknown, cabecalhos: Record<string, string> = {}): Promise<void> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
  });
  // O motivo vem no corpo (ex.: domínio não verificado); cortado para caber no log.
  if (!r.ok) throw new Error(`envio de e-mail falhou: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
}

/**
 * Com `EMAIL_API_KEY` (produção), envia pela Resend (P-08). Sem ela (desenvolvimento, testes e e2e),
 * pela API de envio do Mailpit em `EMAIL_API_URL`.
 */
export function criarEnvio(env: Pick<Env, "EMAIL_API_KEY" | "EMAIL_API_URL" | "EMAIL_REMETENTE">): EnviarEmail {
  const { EMAIL_API_KEY: chave, EMAIL_API_URL: mailpit, EMAIL_REMETENTE: de } = env;
  if (chave) {
    return ({ para, assunto, texto }) =>
      postar("https://api.resend.com/emails", { from: de, to: [para], subject: assunto, text: texto }, { authorization: `Bearer ${chave}` });
  }
  if (!mailpit) throw new Error("envio de e-mail sem configuração: defina EMAIL_API_KEY (Resend) ou EMAIL_API_URL (Mailpit)");
  return ({ para, assunto, texto }) => postar(mailpit, { From: remetente(de), To: [{ Email: para }], Subject: assunto, Text: texto });
}
