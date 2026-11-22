import { z } from "zod";
import { ETAPAS, type Etapa, INTERVALOS, type Intervalo, MODALIDADES, type Modalidade } from "./catalogo";
import { normalizarDocumento, tipoDocumento, validarCpf } from "./documento";

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
    .transform(normalizarDocumento),
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

// ── Fase 2: clientes, corretores, documentos e remuneração (RF-19) ────────

/** Texto vazio (ou só espaços) vira null antes de validar. */
const vazioNulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const texto = (max: number) => z.preprocess(vazioNulo, z.string().trim().max(max).nullable());

const cpf = z.preprocess(
  vazioNulo,
  z
    .string()
    .transform((d) => d.replace(/\D/g, ""))
    .refine(validarCpf, "CPF inválido")
    .nullable(),
);

/** Telefone brasileiro com DDD: 10 ou 11 dígitos, guardado só com dígitos. */
const telefone = z.preprocess(
  vazioNulo,
  z
    .string()
    .transform((d) => d.replace(/\D/g, ""))
    .refine((d) => /^\d{10,11}$/.test(d), "Telefone com DDD: 10 ou 11 dígitos")
    .nullable(),
);

const email = z.preprocess(vazioNulo, z.email("E-mail inválido").trim().toLowerCase().nullable());
const centavos = z.preprocess(vazioNulo, z.int().min(0).max(1e13).nullable());
const dia = z.preprocess(vazioNulo, z.iso.date("Data inválida").nullable());

export const ETAPA = z.enum(ETAPAS.map((e) => e.codigo) as [Etapa, ...Etapa[]]);
export const MODALIDADE = z.enum(MODALIDADES.map((m) => m.codigo) as [Modalidade, ...Modalidade[]]);

const camposCliente = {
  nome: z.string().trim().min(1, "Informe o nome").max(160),
  cpf,
  whatsapp: telefone,
  email,
  modalidade: z.preprocess(vazioNulo, MODALIDADE.nullable()),
  corretorId: z.preprocess(vazioNulo, z.uuid().nullable()),
  etapa: ETAPA,
  valorImovelCentavos: centavos,
  valorFinanciadoCentavos: centavos,
  valorAvaliacaoCentavos: centavos,
  entradaCentavos: centavos,
  fgtsCentavos: centavos,
  subsidioCentavos: centavos,
  numeroContrato: texto(60),
  dataAssinatura: dia,
  proximaCobranca: dia,
  intervaloCobranca: z.union(INTERVALOS.map((i) => z.literal(i)) as [z.ZodLiteral<1>, ...z.ZodLiteral<Intervalo>[]]),
  observacoes: texto(5000),
};

/** Novo cliente (RF-10): só o nome é obrigatório; etapa, cobrança e intervalo vêm do RF-11. */
export const esquemaNovoCliente = z.object({
  nome: camposCliente.nome,
  cpf: camposCliente.cpf.optional(),
  whatsapp: camposCliente.whatsapp.optional(),
  email: camposCliente.email.optional(),
  modalidade: camposCliente.modalidade.optional(),
  corretorId: camposCliente.corretorId.optional(),
  valorImovelCentavos: camposCliente.valorImovelCentavos.optional(),
  valorFinanciadoCentavos: camposCliente.valorFinanciadoCentavos.optional(),
});

/** Salvamento automático (RF-15): só os campos enviados; pelo menos um. */
export const esquemaClienteParcial = z
  .object(camposCliente)
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para salvar");

export const esquemaCorretor = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(120),
  imobiliaria: texto(120).optional(),
  whatsapp: telefone.optional(),
  creci: texto(40).optional(),
  email: email.optional(),
});
export const esquemaCorretorParcial = esquemaCorretor.partial().refine((o) => Object.keys(o).length > 0, "Nada para salvar");

export const esquemaNota = z.object({ texto: z.string().trim().min(1, "Escreva a anotação").max(5000) });

export const esquemaDocumento = z.object({ recebido: z.boolean() });

export const esquemaRemuneracao = z
  .object({ pctProprio: z.preprocess(vazioNulo, z.number().min(0).max(100).nullable()), recebidaEm: dia })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para salvar");

export const esquemaPercentual = z.object({
  percentual: z
    .number()
    .min(0, "De 0 a 100")
    .max(100, "De 0 a 100")
    .refine((p) => Math.abs(Math.round(p * 1000) - p * 1000) < 1e-6, "No máximo 3 casas decimais"),
});
