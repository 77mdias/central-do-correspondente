import { z } from "zod";
import { soDigitos, tipoDocumento } from "./documento";

// Os mesmos esquemas validam o formulário na SPA e o pedido no Worker.

export const esquemaCredenciais = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.email("E-mail inválido").trim().toLowerCase(),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres").max(128),
});

export const esquemaEscritorio = z.object({
  nomeEscritorio: z.string().trim().min(2, "Informe o nome do escritório").max(120),
  documento: z
    .string()
    .refine((d) => tipoDocumento(d) !== null, "CPF ou CNPJ inválido")
    .transform(soDigitos),
  plano: z.enum(["simples", "com_corretores"]),
  aceitouTermos: z.literal(true, "É preciso aceitar os termos"),
});

/** Cadastro deslogado: credenciais + escritório. */
export const esquemaCadastro = esquemaEscritorio.extend(esquemaCredenciais.shape);

export const esquemaConvite = z.object({
  email: z.email("E-mail inválido").trim().toLowerCase(),
  perfil: z.enum(["funcionaria", "corretor"]),
  corretorId: z.uuid().optional(),
});

export const esquemaAceite = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  senha: z.string().min(8).max(128).optional(),
  aceitouTermos: z.literal(true, "É preciso aceitar os termos"),
});

/** Nomes dos campos com erro, na ordem do esquema. */
export function camposComErro(e: z.ZodError): string[] {
  return [...new Set(e.issues.map((i) => String(i.path[0])))];
}
