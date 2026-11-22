import { camposComErro, esquemaClienteParcial, esquemaCorretor, esquemaNovoCliente, esquemaPercentual } from "./esquemas";

test("novo cliente só exige o nome; vazios viram null e máscaras saem", () => {
  const r = esquemaNovoCliente.parse({ nome: " Maria ", cpf: "529.982.247-25", whatsapp: "(11) 98888-7777", email: "", valorImovelCentavos: 35000000 });
  expect(r).toEqual({ nome: "Maria", cpf: "52998224725", whatsapp: "11988887777", email: null, valorImovelCentavos: 35000000 });
});

test("CPF, telefone e e-mail inválidos apontam o campo (RF-19)", () => {
  const r = esquemaNovoCliente.safeParse({ nome: "X", cpf: "123.456.789-00", whatsapp: "98888-777", email: "x@" });
  expect(r.success).toBe(false);
  if (!r.success) expect(camposComErro(r.error)).toEqual(["cpf", "whatsapp", "email"]);
});

test("parcial mantém só os campos enviados", () => {
  expect(esquemaClienteParcial.parse({ email: "A@B.com" })).toEqual({ email: "a@b.com" });
  expect(esquemaClienteParcial.parse({ observacoes: "" })).toEqual({ observacoes: null });
  expect(esquemaClienteParcial.safeParse({}).success).toBe(false);
});

test("parcial valida etapa, intervalo e data", () => {
  expect(esquemaClienteParcial.safeParse({ etapa: "concluido" }).success).toBe(true);
  expect(esquemaClienteParcial.safeParse({ etapa: "Concluído" }).success).toBe(false);
  expect(esquemaClienteParcial.safeParse({ intervaloCobranca: 4 }).success).toBe(false);
  expect(esquemaClienteParcial.safeParse({ intervaloCobranca: 7 }).success).toBe(true);
  expect(esquemaClienteParcial.safeParse({ dataAssinatura: "2026-02-30" }).success).toBe(false);
  expect(esquemaClienteParcial.parse({ dataAssinatura: "" })).toEqual({ dataAssinatura: null });
});

test("corretor exige nome", () => {
  expect(esquemaCorretor.safeParse({ nome: "" }).success).toBe(false);
  expect(esquemaCorretor.parse({ nome: "Ana", whatsapp: "11 98888 7777" })).toEqual({ nome: "Ana", whatsapp: "11988887777" });
});

test("percentual de 0 a 100 com até 3 casas", () => {
  expect(esquemaPercentual.safeParse({ percentual: 1.125 }).success).toBe(true);
  expect(esquemaPercentual.safeParse({ percentual: 0.123 }).success).toBe(true);
  expect(esquemaPercentual.safeParse({ percentual: 1.1234 }).success).toBe(false);
  expect(esquemaPercentual.safeParse({ percentual: 101 }).success).toBe(false);
});
