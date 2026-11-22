import { formatarReais } from "./dinheiro";

test("reais no padrão brasileiro", () => {
  expect(formatarReais(9900)).toBe("R$ 99,00");
  expect(formatarReais(123456789)).toBe("R$ 1.234.567,89");
});

import { formatarPercentual, formatarReaisCurto, lerReais } from "./dinheiro";

test.each([
  ["R$ 1.234,56", 123456],
  ["1234,5", 123450],
  ["350.000", 35000000],
  ["350000", 35000000],
  ["1.5", 150],
  ["", null],
  ["abc", null],
])("lerReais(%j) = %j", (v, esperado) => expect(lerReais(v)).toBe(esperado));

test("lerReais de número e de nulo", () => {
  expect(lerReais(350000)).toBe(35000000);
  expect(lerReais(1234.565)).toBe(123457);
  expect(lerReais(null)).toBeNull();
});

test("valor curto dos cards", () => {
  expect(formatarReaisCurto(125000000)).toBe("R$ 1,25 mi");
  expect(formatarReaisCurto(35000000)).toBe("R$ 350 mil");
  expect(formatarReaisCurto(980000)).toBe("R$\u00a09.800"); // Intl usa espaço não separável
  expect(formatarReaisCurto(null)).toBe("—");
});

test("percentual", () => {
  expect(formatarPercentual(1.2)).toBe("1,2%");
  expect(formatarPercentual(1.125)).toBe("1,125%");
  expect(formatarPercentual(null)).toBe("—");
});
