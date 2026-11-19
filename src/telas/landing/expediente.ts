// Um dia de correspondente, para a landing (gramática "superfície viva", scrollcraft/builds/central-expediente/BRIEF.md).
// Dados de exemplo, rotulados assim na página. O estado da tela é função do horário, com as regras reais do SRS:
// RN-01 etapas, RN-03/RN-12 parado, RN-04 cobrança só com documento faltando, RN-07 taxa congelada,
// RN-09 remuneração sobre o financiado, RN-10 VGV pelo valor do imóvel, RN-13 próximo retorno pelo intervalo.

/** Minutos desde 00:00. A página abre às 07:55 para o aviso das 08:00 acontecer na frente de quem chega. */
export const ABRE = 7 * 60 + 55;
export const FECHA = 18 * 60;

/** RN-01, sem "Reprovado / Cancelado" (não é um passo do caminho). */
export const ETAPAS = [
  "Cadastro",
  "Documentação pendente",
  "Análise de crédito",
  "Crédito aprovado",
  "Avaliação do imóvel",
  "Conformidade",
  "Assinatura do contrato",
  "Registro em cartório",
  "Concluído",
] as const;

/** Percentual vigente da conta, em %. */
export const TAXA_ATUAL = 1.4;

type Ficha = {
  id: string;
  nome: string;
  corretor: string;
  imovelCentavos: number;
  /** índice em ETAPAS no começo do dia */
  etapa: number;
  /** documentos recebidos por grupo (RF-20: Comprador 8, Imóvel e vendedor 4) */
  comprador: number;
  imovel: number;
  /** dias sem atualização ontem; a rotina das 08:00 soma 1 */
  diasOntem: number;
  telefone: boolean;
};

export const FICHAS: Ficha[] = [
  { id: "marcelo", nome: "Marcelo Ferreira", corretor: "R. Nogueira", imovelCentavos: 34_000_000, etapa: 1, comprador: 2, imovel: 1, diasOntem: 1, telefone: true },
  { id: "patricia", nome: "Patrícia Alves", corretor: "Direto", imovelCentavos: 42_000_000, etapa: 2, comprador: 5, imovel: 2, diasOntem: 6, telefone: true },
  { id: "diego", nome: "Diego Mendes", corretor: "M. Prado", imovelCentavos: 26_500_000, etapa: 1, comprador: 4, imovel: 1, diasOntem: 7, telefone: false },
  { id: "camila", nome: "Camila Santana", corretor: "R. Nogueira", imovelCentavos: 38_000_000, etapa: 5, comprador: 8, imovel: 3, diasOntem: 2, telefone: true },
  { id: "rafael", nome: "Rafael Camargo", corretor: "C. Lima", imovelCentavos: 31_500_000, etapa: 4, comprador: 7, imovel: 3, diasOntem: 3, telefone: true },
  { id: "bruno", nome: "Bruno Costa", corretor: "C. Lima", imovelCentavos: 29_000_000, etapa: 5, comprador: 8, imovel: 4, diasOntem: 1, telefone: true },
];

/** Contratos já assinados no mês, com a taxa congelada na assinatura (RN-07). */
const ASSINADOS_ANTES = [
  { nome: "Carla Menezes", imovelCentavos: 52_000_000, financiadoCentavos: 41_600_000, taxa: 1.3, corretor: "R. Nogueira" },
  { nome: "João Batista", imovelCentavos: 61_000_000, financiadoCentavos: 48_800_000, taxa: 1.4, corretor: "M. Prado" },
  { nome: "Luana Prado", imovelCentavos: 43_000_000, financiadoCentavos: 34_400_000, taxa: 1.4, corretor: "Direto" },
];

export type Evento =
  | { min: number; tipo: "aviso" }
  | { min: number; tipo: "cobranca"; ficha: string; intervalo: 1 | 2 | 3 | 5 | 7 }
  | { min: number; tipo: "anexo"; ficha: string; arquivo: string; grupo: "comprador" | "imovel"; rotulo: string }
  | { min: number; tipo: "etapa"; ficha: string }
  | { min: number; tipo: "assinatura"; ficha: string; financiadoCentavos: number }
  | { min: number; tipo: "fim" };

export const EVENTOS: Evento[] = [
  { min: 8 * 60, tipo: "aviso" },
  { min: 8 * 60 + 42, tipo: "cobranca", ficha: "marcelo", intervalo: 3 },
  { min: 9 * 60 + 10, tipo: "cobranca", ficha: "diego", intervalo: 1 },
  { min: 9 * 60 + 40, tipo: "cobranca", ficha: "patricia", intervalo: 2 },
  { min: 10 * 60 + 15, tipo: "cobranca", ficha: "camila", intervalo: 5 },
  { min: 10 * 60 + 50, tipo: "anexo", ficha: "rafael", arquivo: "Holerite_Out.pdf", grupo: "comprador", rotulo: "Renda" },
  { min: 11 * 60 + 35, tipo: "anexo", ficha: "rafael", arquivo: "Matricula_4821.pdf", grupo: "imovel", rotulo: "Imóvel" },
  { min: 14 * 60 + 30, tipo: "etapa", ficha: "rafael" },
  { min: 16 * 60, tipo: "assinatura", ficha: "bruno", financiadoCentavos: 23_200_000 },
  { min: FECHA, tipo: "fim" },
];

/** Antes do horário de uma cobrança, o cartão fica na fila; nesta janela, aberto no "Enviou?". */
const JANELA_ENVIOU = 15;
/** Tempo que um anexo leva subindo pelo portal do corretor. */
const JANELA_UPLOAD = 15;

export const hora = (min: number) => {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const porcento = (taxa: number) => `${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}%`;

const nomeDe = (id: string) => FICHAS.find((f) => f.id === id)?.nome ?? id;

const doTipo =
  <T extends Evento["tipo"]>(tipo: T) =>
  (e: Evento): e is Extract<Evento, { tipo: T }> =>
    e.tipo === tipo;

export type StatusCobranca = "fila" | "enviou" | "registrada";

export function estadoAs(min: number) {
  const ocorridos = EVENTOS.filter((e) => e.min <= min);
  const avisou = ocorridos.some((e) => e.tipo === "aviso");

  const fichas = FICHAS.map((f) => {
    let etapa = f.etapa;
    let comprador = f.comprador;
    let imovel = f.imovel;
    let dias = avisou ? f.diasOntem + 1 : f.diasOntem;
    let atualizadaAs: number | null = null;
    for (const e of ocorridos) {
      if (!("ficha" in e) || e.ficha !== f.id) continue;
      atualizadaAs = e.min; // RN-12: qualquer alteração na ficha zera o "parado"
      dias = 0;
      if (e.tipo === "anexo" && e.grupo === "comprador") comprador = Math.min(8, comprador + 1);
      if (e.tipo === "anexo" && e.grupo === "imovel") imovel = Math.min(4, imovel + 1);
      if (e.tipo === "etapa" || e.tipo === "assinatura") etapa += 1;
    }
    return { ...f, etapa, comprador, imovel, docs: comprador + imovel, dias, atualizadaAs };
  });

  // Parados há 7+ dias (RN-03), o mais recente a cruzar a linha no topo.
  const parados = fichas
    .filter((f) => f.etapa < ETAPAS.indexOf("Concluído") && f.dias >= 7)
    .sort((a, b) => a.dias - b.dias);

  const cobrancas = EVENTOS.filter(doTipo("cobranca")).map((e) => {
    const f = fichas.find((x) => x.id === e.ficha)!;
    const status: StatusCobranca = min >= e.min ? "registrada" : min >= e.min - JANELA_ENVIOU ? "enviou" : "fila";
    return { ...e, nome: f.nome, docs: f.docs, telefone: f.telefone, imovelCentavos: f.imovelCentavos, status };
  });

  const anexos = EVENTOS.filter(doTipo("anexo")).map((e) => ({
    ...e,
    progresso: Math.min(1, Math.max(0, (min - (e.min - JANELA_UPLOAD)) / JANELA_UPLOAD)),
  }));

  const assinaturasHoje = EVENTOS.filter(doTipo("assinatura"))
    .filter((e) => min >= e.min)
    .map((e) => {
      const f = FICHAS.find((x) => x.id === e.ficha)!;
      return { nome: f.nome, imovelCentavos: f.imovelCentavos, financiadoCentavos: e.financiadoCentavos, taxa: TAXA_ATUAL, corretor: f.corretor, hoje: true };
    });
  // RN-09: remuneração = financiado × percentual congelado ÷ 100
  const contratos = [...ASSINADOS_ANTES.map((c) => ({ ...c, hoje: false })), ...assinaturasHoje].map((c) => ({
    ...c,
    remuneracaoCentavos: Math.round((c.financiadoCentavos * c.taxa) / 100),
  }));

  const historico = ocorridos.map((e) => ({ min: e.min, texto: descrever(e) }));

  return {
    min,
    relogio: hora(min),
    avisou,
    fichas,
    parados,
    cobrancas,
    pendentes: cobrancas.filter((c) => c.status !== "registrada").length,
    anexos,
    contratos,
    vgvCentavos: contratos.reduce((s, c) => s + c.imovelCentavos, 0),
    remuneracaoCentavos: contratos.reduce((s, c) => s + c.remuneracaoCentavos, 0),
    historico,
  };
}

export type Estado = ReturnType<typeof estadoAs>;

function descrever(e: Evento): string {
  switch (e.tipo) {
    case "aviso":
      return "Aviso das 08:00: 4 cobranças para hoje, 2 fichas paradas há 7+ dias";
    case "cobranca":
      return `Cobrança registrada · ${nomeDe(e.ficha)} · próximo retorno em ${e.intervalo} ${e.intervalo === 1 ? "dia" : "dias"}`;
    case "anexo":
      return `${e.arquivo} recebido · ${nomeDe(e.ficha)} · enviado por C. Lima`;
    case "etapa":
      return `${nomeDe(e.ficha)} avançou para Conformidade`;
    case "assinatura":
      return `Contrato assinado · ${nomeDe(e.ficha)} · taxa congelada em ${porcento(TAXA_ATUAL)}`;
    case "fim":
      return "Expediente encerrado · 0 cobranças pendentes";
  }
}
