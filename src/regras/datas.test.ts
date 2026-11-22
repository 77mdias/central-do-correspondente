import { dataBr, dataCurta, diaBr, diasAte, diasDesde, hojeBr, somarDias } from "./datas";

test("às 22h de Brasília ainda é o mesmo dia (1h UTC do dia seguinte)", () => {
  expect(hojeBr(new Date("2026-11-23T01:00:00Z"))).toBe("2026-11-22");
  expect(hojeBr(new Date("2026-11-23T03:00:00Z"))).toBe("2026-11-23");
});

test("dia em Brasília de um instante", () => expect(diaBr("2026-11-23T01:30:00Z")).toBe("2026-11-22"));

test("somar dias atravessa mês e ano", () => {
  expect(somarDias("2026-11-28", 7)).toBe("2026-12-05");
  expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
});

test("dias até", () => {
  expect(diasAte("2026-11-21", "2026-11-22")).toBe(-1);
  expect(diasAte("2026-11-22", "2026-11-22")).toBe(0);
  expect(diasAte("2026-12-01", "2026-11-22")).toBe(9);
});

test("dias desde conta horas inteiras, como o protótipo", () => {
  const agora = new Date("2026-11-22T12:00:00Z");
  expect(diasDesde("2026-11-15T12:00:00Z", agora)).toBe(7);
  expect(diasDesde("2026-11-15T12:00:01Z", agora)).toBe(6);
  expect(diasDesde(null, agora)).toBe(0);
});

test("formatos de data", () => {
  expect(dataBr("2026-03-10")).toBe("10/03/2026");
  expect(dataCurta("2026-03-10")).toBe("10/03");
  expect(dataBr(null)).toBe("");
});
