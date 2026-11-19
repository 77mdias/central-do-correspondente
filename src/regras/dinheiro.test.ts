import { formatarReais } from "./dinheiro";

test("reais no padrão brasileiro", () => {
  expect(formatarReais(9900)).toBe("R$ 99,00");
  expect(formatarReais(123456789)).toBe("R$ 1.234.567,89");
});
