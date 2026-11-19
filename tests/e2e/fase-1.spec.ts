import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { liberarConta } from "../../scripts/conta-liberar";
import { URL_OWNER_E2E } from "../test-env";
import { ultimoLink } from "./mailpit";

test("escritório nasce, é liberado e recebe a funcionária", async ({ page, browser }) => {
  const sufixo = Date.now();
  const gestora = `gestora-${sufixo}@exemplo.com`;
  const func = `func-${sufixo}@exemplo.com`;

  await page.goto("/criar-escritorio");
  await page.getByLabel("Seu nome").fill("Marina Souza");
  await page.getByLabel("E-mail").fill(gestora);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByLabel("Nome do escritório").fill("Souza Correspondente");
  await page.getByLabel("CPF ou CNPJ do titular").fill("123.456.789-09");
  await page.getByText("Com corretores — ").click();
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole("button", { name: "Criar escritório" }).click();
  await expect(page.getByText("Enviamos um e-mail para")).toBeVisible();

  await page.goto(await ultimoLink(gestora, "verify-email"));
  await expect(page.getByText("E-mail confirmado")).toBeVisible();
  await page.getByLabel("E-mail").fill(gestora);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Conta aguardando liberação")).toBeVisible();

  const dono = new Pool({ connectionString: URL_OWNER_E2E });
  expect(await liberarConta(dono, gestora, "2099-12-31")).toMatchObject({ ok: true });
  await dono.end();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Souza Correspondente" })).toBeVisible();
  await expect(page.getByText("Conta aguardando liberação")).toHaveCount(0);

  await page.getByRole("link", { name: "Equipe e acessos" }).click();
  await page.getByLabel("E-mail da funcionária").fill(func);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText(`${func} · Funcionária`)).toBeVisible();

  const outra = await browser.newContext({ locale: "pt-BR" });
  const fp = await outra.newPage();
  await fp.goto(await ultimoLink(func, "/convite/"));
  await fp.getByLabel("Seu nome").fill("Paula Lima");
  await fp.getByLabel("Crie uma senha").fill("senha-forte-1");
  await fp.getByLabel(/Li e aceito/).check();
  await fp.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(fp.getByRole("heading", { name: "Souza Correspondente" })).toBeVisible();
  await outra.close();

  await page.reload();
  const linha = page.getByRole("row", { name: /Paula Lima/ });
  await expect(linha).toContainText("Funcionária");
  await expect(linha).toContainText("Ativo");
});
