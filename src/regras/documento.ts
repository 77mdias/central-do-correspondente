/** Tira a pontuação e põe em maiúsculas: CPF fica só com dígitos; CNPJ alfanumérico mantém as letras. */
export const normalizarDocumento = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");

/**
 * Dígito verificador no padrão da Receita: soma ponderada, resto de 11 (resto < 2 vira 0).
 * Cada caractere vale o código ASCII − 48 (dígito = ele mesmo; A = 17), como no CNPJ alfanumérico (IN RFB 2.229/2024).
 */
function digito(base: string, pesos: number[]): number {
  const resto = pesos.reduce((t, p, i) => t + p * (base.charCodeAt(i) - 48), 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const repetido = (d: string) => /^(.)\1+$/.test(d);

export function validarCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || repetido(d)) return false;
  const d1 = digito(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[9]) && d2 === Number(d[10]);
}

/** CNPJ numérico ou alfanumérico (12 caracteres 0-9/A-Z + 2 dígitos verificadores). */
export function validarCnpj(d: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || repetido(d)) return false;
  const d1 = digito(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** CPF ou CNPJ, com ou sem pontuação; null se inválido. */
export function tipoDocumento(s: string): "cpf" | "cnpj" | null {
  const d = normalizarDocumento(s);
  if (validarCpf(d)) return "cpf";
  if (validarCnpj(d)) return "cnpj";
  return null;
}
