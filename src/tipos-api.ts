import type { CodigoDocumento, Etapa, Intervalo, Modalidade } from "./regras/catalogo";
import type { Plano } from "./regras/planos";

export type Perfil = "gestor" | "funcionaria" | "corretor";
export type StatusAssinatura = "pendente" | "ativa" | "em_atraso" | "suspensa" | "cancelada";

export type EscritorioResumo = {
  contaId: string;
  nomeEscritorio: string;
  perfil: Perfil;
  plano: Plano;
  statusAssinatura: StatusAssinatura;
  ativa: boolean; // pode gravar (conta_ativa)
};

export type Eu = { usuario: { id: string; nome: string; email: string }; escritorios: EscritorioResumo[] };

export type Equipe = {
  membros: { id: string; nome: string; email: string; perfil: Perfil; status: "ativo" | "desativado" }[];
  convites: { id: string; email: string; perfil: Exclude<Perfil, "gestor">; expiraEm: string }[];
};

/** Convite visto pelo link. Fechado ou desconhecido não revela nada. */
export type ConvitePublico =
  | { estado: "invalido" }
  | { estado: "aberto"; nomeEscritorio: string; email: string; perfil: Exclude<Perfil, "gestor">; temConta: boolean };

// ── Fase 2 ────────────────────────────────────────────────────────────────


/** Cliente como vem em `GET …/clientes`: sem nenhum campo de percentual ou remuneração (RN-17). */
export type ClienteLista = {
  id: string;
  corretorId: string | null;
  nome: string;
  cpf: string | null;
  whatsapp: string | null;
  email: string | null;
  modalidade: Modalidade | null;
  etapa: Etapa;
  valorImovelCentavos: number | null;
  valorFinanciadoCentavos: number | null;
  valorAvaliacaoCentavos: number | null;
  entradaCentavos: number | null;
  fgtsCentavos: number | null;
  subsidioCentavos: number | null;
  numeroContrato: string | null;
  dataAssinatura: string | null;
  proximaCobranca: string | null;
  intervaloCobranca: Intervalo;
  qtdCobrancas: number;
  ultimaCobranca: string | null;
  observacoes: string | null;
  finalizadoEm: string | null;
  anexosApagarEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Data de recebimento por documento; ausente ou null = pendente. */
  documentos: Partial<Record<CodigoDocumento, string | null>>;
  /** Quantidade de anexos por documento (e "outros"). */
  anexos: Partial<Record<CodigoDocumento | "outros", number>>;
};

/** Corretor como as regras de tela precisam (nome e imobiliária). */
export type CorretorResumo = { id: string; nome: string; imobiliaria: string | null };

export type ArquivoResumo = { id: string; tipo: CodigoDocumento | "outros"; nome: string; tamanho: number; mime: string; enviadoEm: string };
export type NotaHistorico = { id: string; tipo: "nota" | "etapa" | "cobranca" | "documento" | "contrato" | "sistema"; texto: string; criadoEm: string };
/** Só para o gestor (RN-17). Percentuais em número (até 3 casas). */
export type Remuneracao = {
  pctUsado: number | null;
  remuneracaoCentavos: number | null;
  pctContrato: number | null;
  pctProprio: number | null;
  recebidaEm: string | null;
};
/** `GET …/clientes/:id`. `remuneracao` só existe na resposta do gestor. */
export type Ficha = { cliente: ClienteLista; anexos: ArquivoResumo[]; historico: NotaHistorico[]; remuneracao?: Remuneracao };
