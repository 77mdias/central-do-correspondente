import type { z } from "zod";
import { ErroApi } from "@/api";

/** Primeiro erro de cada campo, para mostrar embaixo dele. */
export function errosPorCampo(e: z.ZodError): Record<string, string> {
  const r: Record<string, string> = {};
  for (const i of e.issues) r[String(i.path[0])] ??= i.message;
  return r;
}

/** Mensagem de erro da API para o topo do formulário. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroApi) {
    if (e.status === 429) return "Muitas tentativas. Espere um pouco e tente de novo.";
    if (e.codigo === "validacao") return "Confira os campos marcados.";
  }
  return "Não deu certo agora. Tente de novo em instantes.";
}
