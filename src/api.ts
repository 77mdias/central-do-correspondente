export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    public campos: string[] = [],
  ) {
    super(codigo);
  }
}

/** Envio de anexo (multipart). Mesmo tratamento de erro do `api`. */
export async function enviarArquivo<T>(caminho: string, form: FormData): Promise<T> {
  const r = await fetch(caminho, { method: "POST", body: form, credentials: "same-origin" });
  const dados = (await r.json().catch(() => ({}))) as { erro?: string; campos?: string[] };
  if (!r.ok) throw new ErroApi(r.status, dados.erro ?? "interno", dados.campos ?? []);
  return dados as T;
}

/** Chamada à API do Worker (mesma origem, cookie de sessão). Erro vira ErroApi com o `erro` do JSON. */
export async function api<T>(caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const temCorpo = init.body !== undefined;
  const r = await fetch(caminho, {
    method: init.method ?? (temCorpo ? "POST" : "GET"),
    headers: temCorpo ? { "content-type": "application/json" } : undefined,
    body: temCorpo ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  if (r.status === 204) return undefined as T;
  const dados = (await r.json().catch(() => ({}))) as { erro?: string; campos?: string[] };
  if (!r.ok) throw new ErroApi(r.status, dados.erro ?? "interno", dados.campos ?? []);
  return dados as T;
}
