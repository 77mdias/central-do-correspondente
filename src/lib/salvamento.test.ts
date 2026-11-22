import { FilaSalvamento } from "./salvamento";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("digitar 3 vezes em 500 ms gera um envio só, com o último valor", async () => {
  const envios: Record<string, unknown>[] = [];
  const f = new FilaSalvamento(async (c) => void envios.push(c));
  f.agendar("nome", "M");
  vi.advanceTimersByTime(200);
  f.agendar("nome", "Ma");
  vi.advanceTimersByTime(200);
  f.agendar("nome", "Mar");
  vi.advanceTimersByTime(699);
  expect(envios).toEqual([]);
  vi.advanceTimersByTime(1);
  await f.descarregar();
  expect(envios).toEqual([{ nome: "Mar" }]);
  expect(f.estado).toBe("salvo");
});

test("campos diferentes na mesma janela vão juntos", async () => {
  const envios: Record<string, unknown>[] = [];
  const f = new FilaSalvamento(async (c) => void envios.push(c));
  f.agendar("nome", "Maria");
  f.agendar("email", "m@x.com");
  vi.advanceTimersByTime(700);
  await f.descarregar();
  expect(envios).toEqual([{ nome: "Maria", email: "m@x.com" }]);
});

test("descarregar envia na hora o que está pendente", async () => {
  const envios: Record<string, unknown>[] = [];
  const f = new FilaSalvamento(async (c) => void envios.push(c));
  f.agendar("observacoes", "liga à tarde");
  await f.descarregar();
  expect(envios).toEqual([{ observacoes: "liga à tarde" }]);
  vi.advanceTimersByTime(1000);
  expect(envios).toHaveLength(1);
});

test("erro no envio deixa o estado em erro e guarda o motivo", async () => {
  const estados: string[] = [];
  const f = new FilaSalvamento(() => Promise.reject(new Error("cpf")), (e) => estados.push(e));
  f.agendar("cpf", "123");
  await f.descarregar();
  expect(estados).toEqual(["salvando", "erro"]);
  expect((f.erro as Error).message).toBe("cpf");
});
