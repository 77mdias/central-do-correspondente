import { tipoDocumento } from "./documento";

test.each(["123.456.789-09", "12345678909"])("CPF válido %s", (d) => expect(tipoDocumento(d)).toBe("cpf"));
test.each(["12.345.678/0001-95", "12345678000195"])("CNPJ válido %s", (d) => expect(tipoDocumento(d)).toBe("cnpj"));
test.each(["111.111.111-11", "123.456.789-00", "00.000.000/0000-00", "12.345.678/0001-90", "1234", ""])("inválido %s", (d) =>
  expect(tipoDocumento(d)).toBeNull(),
);
