import { normalizarDocumento, tipoDocumento } from "./documento";

test.each(["123.456.789-09", "12345678909"])("CPF válido %s", (d) => expect(tipoDocumento(d)).toBe("cpf"));
test.each(["12.345.678/0001-95", "12345678000195"])("CNPJ válido %s", (d) => expect(tipoDocumento(d)).toBe("cnpj"));
test.each(["111.111.111-11", "123.456.789-00", "00.000.000/0000-00", "12.345.678/0001-90", "1234", ""])("inválido %s", (d) =>
  expect(tipoDocumento(d)).toBeNull(),
);

test.each(["12.ABC.345/01DE-35", "12abc34501de35"])("CNPJ alfanumérico válido %s", (d) => expect(tipoDocumento(d)).toBe("cnpj"));
test("CNPJ alfanumérico com dígito errado", () => expect(tipoDocumento("12.ABC.345/01DE-36")).toBeNull());
test("documento normalizado mantém as letras do CNPJ", () => expect(normalizarDocumento("12.abc.345/01de-35")).toBe("12ABC34501DE35"));
