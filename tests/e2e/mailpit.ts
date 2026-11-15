const MAILPIT = "http://localhost:8028/api/v1";

/** Primeira URL contendo `contem` no e-mail mais novo para `para` que tenha uma (espera até ~15 s). */
export async function ultimoLink(para: string, contem: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const r = (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${para}"`)}`).then((x) => x.json())) as { messages?: { ID: string }[] };
    for (const msg of r.messages ?? []) {
      const m = (await fetch(`${MAILPIT}/message/${msg.ID}`).then((x) => x.json())) as { Text: string };
      const url = (m.Text.match(/https?:\/\/\S+/g) ?? []).find((u) => u.includes(contem));
      if (url) return url;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`nenhum e-mail para ${para} com "${contem}"`);
}
