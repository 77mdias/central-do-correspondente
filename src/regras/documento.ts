export const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Dígito verificador no padrão da Receita: soma ponderada, resto de 11 (resto < 2 vira 0). */
function digito(base: string, pesos: number[]): number {
  const resto = pesos.reduce((t, p, i) => t + p * Number(base[i]), 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const repetido = (d: string) => /^(\d)\1+$/.test(d);

export function validarCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || repetido(d)) return false;
  const d1 = digito(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[9]) && d2 === Number(d[10]);
}

export function validarCnpj(d: string): boolean {
  if (!/^\d{14}$/.test(d) || repetido(d)) return false;
  const d1 = digito(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** CPF ou CNPJ, com ou sem pontuação; null se inválido. */
export function tipoDocumento(s: string): "cpf" | "cnpj" | null {
  const d = soDigitos(s);
  if (validarCpf(d)) return "cpf";
  if (validarCnpj(d)) return "cnpj";
  return null;
}
