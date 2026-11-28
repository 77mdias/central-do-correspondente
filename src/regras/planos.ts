export type Plano = "simples" | "com_corretores";

export const PLANOS: Record<Plano, { nome: string; precoCentavos: number }> = {
  simples: { nome: "Simples", precoCentavos: 9900 },
  com_corretores: { nome: "Com corretores", precoCentavos: 14900 },
};

/**
 * Versão dos termos aceita no cadastro, no convite e no novo aceite (RF-67). "rascunho-1" foi o texto provisório
 * da fase 1; "v1" é o texto da fase 3, revisado pelos sócios (P-12). Mudar a versão pede novo aceite a todos.
 */
export const TERMOS_VERSAO = "v1";
