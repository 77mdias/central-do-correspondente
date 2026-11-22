// Conversão do arquivo do botão "Exportar JSON" do protótipo (D-40) para o formato da função importar_prototipo.
// Mapeamento: spec da fase 2, seção 10.3. Nada barra a importação por dado ruim: o que não cabe no banco
// vira aviso e, quando é dado de contato, uma nota com o valor original (escolha 5 da spec).
import { z } from "zod";
import { DOCUMENTOS, ETAPAS, type Etapa, INTERVALOS, type Intervalo, MODALIDADES, type Modalidade } from "./catalogo";
import { diaBr, hojeBr } from "./datas";
import { lerReais } from "./dinheiro";
import { validarCpf } from "./documento";

const valor = z.union([z.number(), z.string()]).nullish();
const textoSolto = z.unknown();

/** O arquivo exportado. Campos desconhecidos são tolerados; só formato, versão e origem são exigidos. */
export const esquemaArquivoPrototipo = z.object({
  formato: z.literal("central-prototipo", "Este arquivo não é uma exportação do protótipo"),
  versao: z.literal(1, "Versão de exportação desconhecida"),
  origem: z.uuid("Arquivo sem a identificação da cópia do protótipo"),
  exportadoEm: z.string().nullish(),
  config: z.looseObject({ percentual: valor, historicoPct: z.array(z.looseObject({ t: textoSolto, pct: valor })).nullish() }).nullish(),
  corretores: z.array(z.looseObject({ id: z.string() })).default([]),
  clientes: z.array(z.looseObject({ id: z.string() })).default([]),
});
export type ArquivoPrototipo = z.infer<typeof esquemaArquivoPrototipo>;

const diaValido = z.iso.date();
const instante = z.string().refine((s) => !Number.isNaN(Date.parse(s)));

/** Formato que a função importar_prototipo recebe (campos de clientes com os nomes das colunas). */
export const esquemaDadosImportacao = z.object({
  origem: z.uuid(),
  percentual: z.number().min(0).max(100).nullable(),
  historicoPercentual: z.array(z.object({ percentual: z.number().min(0).max(100), criadoEm: instante })),
  corretores: z.array(
    z.object({
      idOrigem: z.string(),
      nome: z.string().min(1).max(120),
      imobiliaria: z.string().nullable(),
      whatsapp: z.string().regex(/^\d{10,11}$/).nullable(),
      creci: z.string().nullable(),
      email: z.string().nullable(),
      criadoEm: instante.nullable(),
    }),
  ),
  clientes: z.array(
    z.object({
      idOrigem: z.string(),
      corretorIdOrigem: z.string().nullable(),
      nome: z.string().min(1).max(160),
      cpf: z.string().regex(/^\d{11}$/).nullable(),
      whatsapp: z.string().regex(/^\d{10,11}$/).nullable(),
      email: z.string().nullable(),
      modalidade: z.enum(MODALIDADES.map((m) => m.codigo) as [Modalidade, ...Modalidade[]]).nullable(),
      etapa: z.enum(ETAPAS.map((e) => e.codigo) as [Etapa, ...Etapa[]]),
      valor_imovel_centavos: z.int().min(0).nullable(),
      valor_financiado_centavos: z.int().min(0).nullable(),
      valor_avaliacao_centavos: z.int().min(0).nullable(),
      entrada_centavos: z.int().min(0).nullable(),
      fgts_centavos: z.int().min(0).nullable(),
      subsidio_centavos: z.int().min(0).nullable(),
      numero_contrato: z.string().nullable(),
      data_assinatura: diaValido.nullable(),
      proxima_cobranca: diaValido.nullable(),
      intervalo_cobranca: z.union(INTERVALOS.map((i) => z.literal(i)) as [z.ZodLiteral<1>, ...z.ZodLiteral<Intervalo>[]]),
      qtd_cobrancas: z.int().min(0),
      ultima_cobranca: instante.nullable(),
      observacoes: z.string().nullable(),
      criado_em: instante,
      atualizado_em: instante,
      remuneracao: z.object({
        pctContrato: z.number().min(0).max(100).nullable(),
        pctProprio: z.number().min(0).max(100).nullable(),
        recebidaEm: diaValido.nullable(),
      }),
      documentos: z.array(z.object({ tipo: z.enum(DOCUMENTOS.map((d) => d.codigo) as [string, ...string[]]), recebidoEm: diaValido })),
      historico: z.array(z.object({ texto: z.string().min(1), criadoEm: instante.nullable() })),
    }),
  ),
});
export type DadosImportacao = z.infer<typeof esquemaDadosImportacao>;

export type Previa = {
  corretores: number;
  clientes: number;
  documentos: number;
  notas: number;
  anexosParaReenviar: number;
  percentual: number | null;
};
export type Aviso = { cliente: string | null; campo: string; mensagem: string };

// ── leitura tolerante dos campos do protótipo ──────────────────────────────

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
function texto(v: unknown, max: number): string | null {
  const s = str(v).trim();
  return s ? s.slice(0, max) : null;
}
const ehInstante = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const ehDia = (v: unknown): v is string => typeof v === "string" && diaValido.safeParse(v).success;

/** Número como o `num()` do protótipo (aceita "1,5", "R$ 350.000,00"). */
function numero(v: unknown): number | null {
  const c = lerReais(v as string | number | null | undefined);
  return c == null ? null : c / 100;
}
function percentual(v: unknown): number | null {
  const n = numero(v);
  return n == null || n < 0 || n > 100 ? null : Math.round(n * 1000) / 1000;
}

/** Telefone com DDD; tira o 55 de quem salvou com o DDI. null se não couber em 10 ou 11 dígitos. */
function telefone(v: unknown): { valor: string | null; perdido: string | null } {
  const bruto = str(v).trim();
  if (!bruto) return { valor: null, perdido: null };
  let d = bruto.replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(d)) d = d.slice(2);
  return /^\d{10,11}$/.test(d) ? { valor: d, perdido: null } : { valor: null, perdido: bruto };
}

const ETAPA_POR_NOME = new Map(ETAPAS.map((e) => [e.nome.toLowerCase(), e.codigo]));
const MODALIDADE_POR_NOME = new Map(MODALIDADES.map((m) => [m.nome.toLowerCase(), m.codigo]));
const CODIGOS_DOC = new Set<string>(DOCUMENTOS.map((d) => d.codigo));

/**
 * Converte o arquivo do protótipo. `agora` decide o "hoje" da remuneração recebida sem data
 * e substitui datas de criação ausentes.
 */
export function converterPrototipo(arquivo: ArquivoPrototipo, agora: Date = new Date()): { dados: DadosImportacao; previa: Previa; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const hoje = hojeBr(agora);
  const padraoInstante = ehInstante(arquivo.exportadoEm) ? arquivo.exportadoEm : agora.toISOString();

  // config/geral
  const pct = percentual(arquivo.config?.percentual);
  if (arquivo.config?.percentual != null && str(arquivo.config.percentual).trim() !== "" && pct == null)
    avisos.push({ cliente: null, campo: "percentual", mensagem: "Percentual atual inválido; continua o que está no app" });
  const historicoPercentual = (arquivo.config?.historicoPct ?? []).flatMap((h) => {
    const p = percentual(h.pct);
    return p != null && ehInstante(h.t) ? [{ percentual: p, criadoEm: h.t }] : [];
  });

  // corretores
  const corretores: DadosImportacao["corretores"] = arquivo.corretores.map((k) => {
    const nome = texto(k.nome, 120) ?? "Sem nome";
    const tel = telefone(k.telefone ?? k.whatsapp);
    if (tel.perdido) avisos.push({ cliente: null, campo: "whatsapp", mensagem: `Corretor ${nome}: telefone "${tel.perdido}" não importado (precisa de DDD e 10 ou 11 dígitos)` });
    return {
      idOrigem: k.id,
      nome,
      imobiliaria: texto(k.imobiliaria, 120),
      whatsapp: tel.valor,
      creci: texto(k.creci, 40),
      email: texto(k.email, 200)?.toLowerCase() ?? null,
      criadoEm: ehInstante(k.criadoEm) ? k.criadoEm : null,
    };
  });
  const idsCorretores = new Set(corretores.map((k) => k.idOrigem));

  // clientes
  let documentos = 0;
  let notas = 0;
  let anexos = 0;
  const clientes: DadosImportacao["clientes"] = arquivo.clientes.map((c) => {
    const nome = texto(c.nome, 160) ?? "Sem nome";
    const aviso = (campo: string, mensagem: string) => avisos.push({ cliente: nome, campo, mensagem });
    const perdidos: string[] = [];

    // contato
    let cpf: string | null = null;
    const cpfBruto = str(c.cpf).trim();
    if (cpfBruto) {
      const d = cpfBruto.replace(/\D/g, "");
      if (d.length === 11) {
        cpf = d;
        if (!validarCpf(d)) aviso("cpf", "CPF com dígito verificador inválido; importado assim mesmo");
      } else {
        aviso("cpf", `CPF "${cpfBruto}" não importado (não tem 11 dígitos); fica numa nota do histórico`);
        perdidos.push(`CPF: ${cpfBruto}`);
      }
    }
    const tel = telefone(c.telefone ?? c.whatsapp);
    if (tel.perdido) {
      aviso("whatsapp", `Telefone "${tel.perdido}" não importado (precisa de DDD e 10 ou 11 dígitos); fica numa nota do histórico`);
      perdidos.push(`Telefone: ${tel.perdido}`);
    }
    const email = texto(c.email, 200)?.toLowerCase() ?? null;
    if (email && !z.email().safeParse(email).success) aviso("email", "E-mail com formato inválido; importado assim mesmo");

    // classificação
    let modalidade: Modalidade | null = null;
    const modNome = texto(c.modalidade, 100);
    if (modNome) {
      modalidade = MODALIDADE_POR_NOME.get(modNome.toLowerCase()) ?? "outra";
      if (!MODALIDADE_POR_NOME.has(modNome.toLowerCase())) aviso("modalidade", `Modalidade "${modNome}" desconhecida; entra como Habitacional Caixa (outros)`);
    }
    let etapa: Etapa = "cadastro"; // o protótipo mostra "Cadastro" quando não há etapa
    const etapaNome = texto(c.etapa, 100);
    if (etapaNome) {
      const e = ETAPA_POR_NOME.get(etapaNome.toLowerCase());
      if (e) etapa = e;
      else {
        etapa = "documentacao_pendente";
        aviso("etapa", `Etapa "${etapaNome}" desconhecida; entra como Documentação pendente`);
      }
    }

    // corretor
    const corId = texto(c.corretorId, 200);
    let corretorIdOrigem: string | null = null;
    if (corId) {
      if (idsCorretores.has(corId)) corretorIdOrigem = corId;
      else aviso("corretorId", "Corretor removido no protótipo; entra como cliente direto");
    }

    // valores
    const centavos = (campo: string, v: unknown): number | null => {
      const n = lerReais(v as string | number | null | undefined);
      if (n != null && n < 0) {
        aviso(campo, "Valor negativo não importado");
        return null;
      }
      return n;
    };

    // contrato e remuneração
    let dataAssinatura: string | null = null;
    if (ehDia(c.dataContrato)) dataAssinatura = c.dataContrato;
    else if (texto(c.dataContrato, 40)) aviso("dataAssinatura", `Data de assinatura "${str(c.dataContrato)}" inválida; não importada`);
    const pctContrato = percentual(c.pctContrato);
    const pctProprio = percentual(c.pctOverride);
    if (c.pctOverride != null && str(c.pctOverride).trim() !== "" && pctProprio == null) aviso("pctProprio", "Percentual próprio inválido; não importado");

    const historicoArquivo = Array.isArray(c.historico) ? (c.historico as { t?: unknown; txt?: unknown }[]) : [];
    let recebidaEm: string | null = null;
    if (c.remRecebida) {
      const nota = historicoArquivo.filter((h) => str(h.txt).startsWith("Remuneração recebida") && ehInstante(h.t)).at(-1);
      recebidaEm = nota ? diaBr(nota.t as string) : hoje;
    }

    // documentos (data ISO → dia em Brasília; false ou vazio = pendente)
    const docs = (c.docs && typeof c.docs === "object" ? c.docs : {}) as Record<string, unknown>;
    const docsConvertidos = Object.entries(docs).flatMap(([tipo, v]) =>
      CODIGOS_DOC.has(tipo) && ehInstante(v) ? [{ tipo, recebidoEm: diaBr(v) }] : [],
    );
    documentos += docsConvertidos.length;

    // anexos: só contados
    const arqs = (c.arquivos && typeof c.arquivos === "object" ? c.arquivos : {}) as Record<string, unknown>;
    anexos += Object.values(arqs).reduce<number>((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);

    // histórico
    const historico = historicoArquivo.flatMap((h) => {
      const t = texto(h.txt, 5000);
      return t ? [{ texto: t, criadoEm: ehInstante(h.t) ? h.t : null }] : [];
    });
    if (perdidos.length) historico.push({ texto: `Dado do protótipo não importado · ${perdidos.join(" · ")}`, criadoEm: null });
    notas += historico.length;

    // cobrança
    const intervaloNum = numero(c.intervalo);
    const intervalo = (INTERVALOS as readonly number[]).includes(intervaloNum ?? -1) ? (intervaloNum as Intervalo) : 3;
    if (c.intervalo != null && intervalo !== intervaloNum) aviso("intervaloCobranca", "Intervalo de cobrança inválido; entra 3 dias");
    const qtd = numero(c.cobrancas);

    const criado = ehInstante(c.criadoEm) ? c.criadoEm : padraoInstante;
    return {
      idOrigem: c.id,
      corretorIdOrigem,
      nome,
      cpf,
      whatsapp: tel.valor,
      email,
      modalidade,
      etapa,
      valor_imovel_centavos: centavos("valorImovel", c.valorImovel ?? c.valor),
      valor_financiado_centavos: centavos("valorFinanciado", c.valorFinanciado),
      valor_avaliacao_centavos: centavos("valorAvaliacao", c.valorAvaliacao),
      entrada_centavos: centavos("entrada", c.entrada),
      fgts_centavos: centavos("fgtsUsado", c.fgtsUsado),
      subsidio_centavos: centavos("subsidio", c.subsidio),
      numero_contrato: texto(c.contrato, 200),
      data_assinatura: dataAssinatura,
      proxima_cobranca: ehDia(c.proximaCobranca) ? c.proximaCobranca : null,
      intervalo_cobranca: intervalo,
      qtd_cobrancas: qtd != null && qtd >= 0 ? Math.floor(qtd) : 0,
      ultima_cobranca: ehInstante(c.ultimaCobranca) ? c.ultimaCobranca : null,
      observacoes: texto(c.obs, 5000),
      criado_em: criado,
      atualizado_em: ehInstante(c.atualizadoEm) ? c.atualizadoEm : criado,
      remuneracao: { pctContrato, pctProprio, recebidaEm },
      documentos: docsConvertidos,
      historico,
    };
  });

  const dados: DadosImportacao = { origem: arquivo.origem, percentual: pct, historicoPercentual, corretores, clientes };
  return {
    dados,
    previa: { corretores: corretores.length, clientes: clientes.length, documentos, notas, anexosParaReenviar: anexos, percentual: pct },
    avisos,
  };
}
