const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatarReais = (centavos: number) => reais.format(centavos / 100);
