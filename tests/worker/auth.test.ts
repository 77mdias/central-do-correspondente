import { criarCenario } from "../db/ajudantes";
import { emailContaExistente } from "../../worker/emails";
import { TEST_ENV } from "../test-env";
import { appDeTeste, authDeTeste, criarUsuarioVerificado, ctxDeTeste, entrar } from "./ajudantes";

beforeEach(async () => {
  await criarCenario();
});

test("login sem e-mail confirmado é recusado", async () => {
  const { req } = appDeTeste();
  await authDeTeste().api.signUpEmail({ body: { email: "nova@x.com", password: "senha-forte-1", name: "Nova" } });
  const r = await req("/api/auth/sign-in/email", { body: { email: "nova@x.com", password: "senha-forte-1" } });
  expect(r.status).toBe(403);
});

test("login confirmado devolve cookie de sessão", async () => {
  const { req } = appDeTeste();
  await criarUsuarioVerificado("ok@x.com", "senha-forte-1", "Ok");
  expect(await entrar(req, "ok@x.com", "senha-forte-1")).toContain("better-auth.session_token");
});

test("cadastro com e-mail existente manda aviso e não revela", async () => {
  const emails: Parameters<typeof authDeTeste>[0] = [];
  const auth = authDeTeste(emails);
  const corpo = { email: "dup@x.com", password: "senha-forte-1", name: "Dup" };
  const primeira = await auth.api.signUpEmail({ body: corpo });
  const segunda = await auth.api.signUpEmail({ body: corpo });
  expect(Object.keys(segunda)).toEqual(Object.keys(primeira));
  expect(emails.map((e) => e.assunto)).toEqual(["Confirme seu e-mail — Central do Correspondente", emailContaExistente("", "").assunto]);
});

test("limite de login conta por IP do cliente (cf-connecting-ip)", async () => {
  const { app } = appDeTeste();
  const tentar = (ip: string) =>
    app.request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { origin: TEST_ENV.APP_URL, "content-type": "application/json", "cf-connecting-ip": ip },
        body: JSON.stringify({ email: "ninguem@x.com", password: "errada-123" }),
      },
      TEST_ENV,
      ctxDeTeste,
    );
  const status: number[] = [];
  for (let i = 0; i < 6; i++) status.push((await tentar("203.0.113.7")).status);
  expect(status.at(-1)).toBe(429);
  expect((await tentar("203.0.113.8")).status).toBe(401);
});
