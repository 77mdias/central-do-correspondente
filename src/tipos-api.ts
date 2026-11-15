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
