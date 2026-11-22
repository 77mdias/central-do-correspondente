import { decidirPreparo } from "./preparar-arquivo";

const MB = 1024 * 1024;

test.each([
  ["contrato.pdf", "application/pdf", 5 * MB, "enviar"],
  ["foto.jpg", "image/jpeg", 2 * MB, "enviar"],
  ["foto.jpg", "image/jpeg", 3 * MB, "reduzir"],
  ["foto.png", "image/png", 10 * MB, "reduzir"],
  ["IMG_0001.HEIC", "", 1 * MB, "reduzir"],
  ["foto.heic", "image/heic", 1 * MB, "reduzir"],
  ["planilha.xlsx", "application/vnd.ms-excel", 1 * MB, "recusar"],
  ["grande.pdf", "application/pdf", 21 * MB, "recusar"],
])("%s (%s, %d bytes) → %s", (nome, tipo, tamanho, acao) => {
  expect(decidirPreparo(nome, tipo, tamanho).acao).toBe(acao);
});

test("a recusa explica o motivo", () => {
  expect(decidirPreparo("grande.pdf", "application/pdf", 21 * MB)).toEqual({ acao: "recusar", mensagem: "grande.pdf: arquivo grande demais (máx. 20 MB)" });
});
