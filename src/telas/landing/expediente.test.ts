import { ABRE, estadoAs, EVENTOS, FECHA, hora, porcento } from "./expediente";

const ids = (fichas: { id: string }[]) => fichas.map((f) => f.id);

test("relógio e percentual", () => {
  expect(hora(ABRE)).toBe("07:55");
  expect(hora(FECHA)).toBe("18:00");
  expect(porcento(1.4)).toBe("1,400%");
});

test("antes do aviso só o Diego está parado; a rotina das 08:00 traz a Patrícia para o topo", () => {
  expect(ids(estadoAs(ABRE).parados)).toEqual(["diego"]);
  expect(ids(estadoAs(8 * 60).parados)).toEqual(["patricia", "diego"]);
});

test("cobrança registrada tira a ficha dos parados (RN-12) e a fila zera", () => {
  expect(estadoAs(8 * 60).pendentes).toBe(4);
  expect(ids(estadoAs(9 * 60 + 10).parados)).toEqual(["patricia"]);
  expect(estadoAs(9 * 60 + 41).parados).toEqual([]);
  expect(estadoAs(10 * 60 + 15).pendentes).toBe(0);
});

test("o cartão abre no 'Enviou?' 15 minutos antes e fica registrado no horário", () => {
  const marcelo = (min: number) => estadoAs(min).cobrancas.find((c) => c.ficha === "marcelo")!.status;
  expect(marcelo(8 * 60 + 26)).toBe("fila");
  expect(marcelo(8 * 60 + 30)).toBe("enviou");
  expect(marcelo(8 * 60 + 42)).toBe("registrada");
});

test("anexos completam o checklist do Rafael e a etapa avança às 14:30", () => {
  const rafael = (min: number) => estadoAs(min).fichas.find((f) => f.id === "rafael")!;
  expect(rafael(10 * 60).docs).toBe(10);
  expect(rafael(11 * 60 + 35).docs).toBe(12);
  expect(rafael(14 * 60 + 29).etapa).toBe(4);
  expect(rafael(14 * 60 + 30).etapa).toBe(5);
});

test("assinatura das 16:00 soma o VGV pelo imóvel e a remuneração pelo financiado (RN-07, RN-09, RN-10)", () => {
  const antes = estadoAs(16 * 60 - 1);
  const depois = estadoAs(16 * 60);
  expect(antes.vgvCentavos).toBe(156_000_000);
  expect(depois.vgvCentavos).toBe(185_000_000);
  expect(antes.remuneracaoCentavos).toBe(1_705_600);
  expect(depois.remuneracaoCentavos).toBe(2_030_400);
  expect(depois.contratos.find((c) => c.nome === "Carla Menezes")!.taxa).toBe(1.3);
});

test("no fechamento o histórico tem um registro por evento", () => {
  const fim = estadoAs(FECHA);
  expect(fim.pendentes).toBe(0);
  expect(fim.historico).toHaveLength(EVENTOS.length);
});
