export type Email = { para: string; assunto: string; texto: string };
export type EnviarEmail = (e: Email) => Promise<void>;

/** "Nome <email@x>" → partes. */
function remetente(s: string): { Name?: string; Email: string } {
  const m = /^(.*)<(.+)>$/.exec(s.trim());
  return m ? { Name: m[1]!.trim(), Email: m[2]!.trim() } : { Email: s.trim() };
}

// shortcut: só a API de envio do Mailpit; o provedor de produção (P-08, proposta Resend) entra antes do deploy da fase 3
export function criarEnvioMailpit(url: string, de: string): EnviarEmail {
  return async ({ para, assunto, texto }) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ From: remetente(de), To: [{ Email: para }], Subject: assunto, Text: texto }),
    });
    if (!r.ok) throw new Error(`envio de e-mail falhou: HTTP ${r.status}`);
  };
}
