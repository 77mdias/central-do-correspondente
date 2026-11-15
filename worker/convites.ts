/** sha-256 em hex: o banco guarda só isto; o token vai no link. */
export async function hashToken(token: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 32 bytes aleatórios em base64url. */
export async function gerarToken(): Promise<{ token: string; hash: string }> {
  const b = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { token, hash: await hashToken(token) };
}
