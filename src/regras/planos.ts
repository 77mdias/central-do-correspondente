export type Plano = "simples" | "com_corretores";

export const PLANOS: Record<Plano, { nome: string; precoCentavos: number }> = {
  simples: { nome: "Simples", precoCentavos: 9900 },
  com_corretores: { nome: "Com corretores", precoCentavos: 14900 },
};

/** Versão dos termos aceita no cadastro e no convite (texto provisório na fase 1, RF-67). */
export const TERMOS_VERSAO = "rascunho-1";
