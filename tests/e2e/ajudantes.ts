import { type Browser, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { liberarConta } from "../../scripts/conta-liberar";
import { URL_OWNER_E2E } from "../test-env";
import { ultimoLink } from "./mailpit";

let ip = 10;
/** Contexto com IP próprio: os limites de tentativa do login valem por IP (5 por minuto). */
export async function novoContexto(browser: Browser) {
  ip += 1;
  return browser.newContext({ locale: "pt-BR", extraHTTPHeaders: { "cf-connecting-ip": `203.0.113.${ip}` } });
}

/** Gestora com escritório criado pela API de cadastro, e-mail confirmado pelo Mailpit e conta liberada; já logada em `page`. */
export async function gestoraLiberada(page: Page, nomeEscritorio: string, plano: "simples" | "com_corretores" = "com_corretores") {
  const email = `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;
  const r = await page.request.post("/api/cadastro", {
    headers: { origin: new URL(page.url() === "about:blank" ? "http://localhost:3102" : page.url()).origin },
    data: { nome: "Marina Souza", email, senha: "senha-forte-1", nomeEscritorio, documento: "123.456.789-09", plano, aceitouTermos: true },
  });
  expect(r.ok(), await r.text()).toBe(true);
  await page.goto(await ultimoLink(email, "verify-email"));
  await expect(page.getByText("E-mail confirmado")).toBeVisible();
  const dono = new Pool({ connectionString: URL_OWNER_E2E });
  expect(await liberarConta(dono, email, "2099-12-31")).toMatchObject({ ok: true });
  await dono.end();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/e\/[0-9a-f-]{36}$/);
  const contaId = page.url().split("/e/")[1]!;
  return { email, contaId };
}
