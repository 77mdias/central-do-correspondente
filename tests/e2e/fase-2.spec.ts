import { expect, test } from "@playwright/test";
import { gestoraLiberada, novoContexto } from "./ajudantes";
import { ultimoLink } from "./mailpit";

const PDF = Buffer.from("%PDF-1.4\n%documento de teste\n");

test("rotina do escritório: corretor, cliente, anexo, cobrança com 'Enviou?', contrato e VGV; funcionária sem receita; outra conta sem acesso", async ({ browser }) => {
  const ctx = await novoContexto(browser);
  // o WhatsApp abre numa aba nova: responde ali mesmo, sem sair para a internet
  await ctx.route("https://wa.me/**", (r) => r.fulfill({ contentType: "text/html", body: "<p>WhatsApp</p>" }));
  const page = await ctx.newPage();
  const { contaId } = await gestoraLiberada(page, "Souza Correspondente");
  const raiz = `/e/${contaId}`;

  // corretor parceiro
  await page.getByRole("link", { name: "Corretores parceiros" }).click();
  await page.getByLabel("Nome do corretor").fill("Ana Lima");
  await page.getByLabel("Imobiliária / casa").fill("Casa Boa Imóveis");
  await page.getByRole("button", { name: "Cadastrar corretor" }).click();
  await expect(page.getByRole("heading", { name: "Ana Lima" })).toBeVisible();

  // percentual antes do contrato: é ele que fica congelado na assinatura (RN-07)
  await page.getByRole("link", { name: "VGV e comissões" }).click();
  await page.getByLabel("Atualizar percentual (%)").fill("1,2");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("1,2%").first()).toBeVisible();

  // novo cliente (RF-10, RF-11)
  await page.goto(`${raiz}/clientes`);
  await page.getByRole("link", { name: "+ Novo cliente" }).click();
  const painel = page.getByRole("dialog");
  await painel.getByLabel("Nome completo").fill("Maria Souza");
  await painel.getByLabel("WhatsApp").fill("(11) 98888-7777");
  await painel.getByLabel("Corretor parceiro ou cliente direto").selectOption({ label: "Ana Lima · Casa Boa Imóveis" });
  await painel.getByLabel("Valor do imóvel").fill("250.000");
  await painel.getByLabel("Valor a financiar").fill("200.000");
  await painel.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(painel.getByText("Dados do cliente")).toBeVisible();
  const clienteId = new URL(page.url()).searchParams.get("cliente")!;
  expect(clienteId).toMatch(/^[0-9a-f-]{36}$/);

  // anexar marca o documento como recebido (RF-23)
  await painel.getByLabel("Anexar RG ou CNH").setInputFiles({ name: "rg.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(painel.getByRole("button", { name: "rg.pdf", exact: true })).toBeVisible();
  await expect(painel.getByRole("checkbox", { name: /RG ou CNH/ })).toBeChecked();
  await painel.getByRole("button", { name: "Fechar" }).click();

  // Cobrar hoje: WhatsApp, volta para a aba, "Enviou?" → Sim (RF-36, D-39)
  await page.goto(`${raiz}/cobrar`);
  const linha = page.getByRole("listitem").filter({ hasText: "Maria Souza" });
  const [aba] = await Promise.all([ctx.waitForEvent("page"), linha.getByRole("link", { name: "WhatsApp" }).click()]);
  expect(aba.url()).toContain("https://wa.me/5511988887777?text=");
  await aba.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus"))); // a volta para a aba
  await expect(page.getByRole("heading", { name: "Enviou a cobrança para Maria?" })).toBeVisible();
  await page.getByRole("button", { name: "Sim, enviei" }).click();
  await expect(page.getByText("Nenhuma cobrança para hoje")).toBeVisible();

  // contrato: etapa e data de assinatura na ficha; o VGV mostra o contrato com o percentual congelado
  await page.goto(`${raiz}/clientes?cliente=${clienteId}&card=todos`);
  await expect(painel.getByText(/já cobrado 1x/)).toBeVisible();
  await painel.getByLabel("Etapa do processo").selectOption("assinatura_contrato");
  await painel.getByLabel("Data da assinatura do contrato").fill("2026-03-10");
  await expect(painel.getByText("Salvo.")).toBeVisible();
  await expect(painel.getByText(/percentual de 1,200% congelado no contrato/)).toBeVisible();
  await page.goto(`${raiz}/vgv`);
  await page.getByRole("button", { name: "Tudo" }).click();
  await expect(page.getByText("1 contrato assinado")).toBeVisible();
  await expect(page.getByText("R$ 2.400,00").first()).toBeVisible();

  // a funcionária entra pelo convite e não vê VGV nem remuneração (RN-17)
  await page.getByRole("link", { name: "Equipe e acessos" }).click();
  const func = `f-${Date.now()}@exemplo.com`;
  await page.getByLabel("E-mail da funcionária").fill(func);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  const fctx = await novoContexto(browser);
  const fp = await fctx.newPage();
  await fp.goto(await ultimoLink(func, "/convite/"));
  await fp.getByLabel("Seu nome").fill("Paula Lima");
  await fp.getByLabel("Crie uma senha").fill("senha-forte-1");
  await fp.getByLabel(/Li e aceito/).check();
  await fp.getByRole("button", { name: "Aceitar convite" }).click();
  // o título da tela do convite também tem o nome do escritório: esperar a chegada no escritório
  await expect(fp).toHaveURL(new RegExp(`${raiz}$`));
  await expect(fp.getByRole("heading", { name: "Souza Correspondente", exact: true })).toBeVisible();
  await expect(fp.getByRole("link", { name: "VGV e comissões" })).toHaveCount(0);
  await fp.goto(`${raiz}/clientes?cliente=${clienteId}&card=todos`);
  await expect(fp.getByRole("dialog").getByText("Dados do cliente")).toBeVisible();
  await expect(fp.getByText("Percentual usado")).toHaveCount(0);
  await expect(fp.getByText("Percentual próprio (%)")).toHaveCount(0);
  await fp.goto(`${raiz}/vgv`);
  await expect(fp).toHaveURL(new RegExp(`${raiz}$`));
  await fctx.close();

  // gestora de outro escritório não abre o cliente pelo endereço
  const octx = await novoContexto(browser);
  const op = await octx.newPage();
  const outra = await gestoraLiberada(op, "Outro Escritório");
  await op.goto(`${raiz}/clientes?cliente=${clienteId}`);
  await expect(op).toHaveURL(new RegExp(`/e/${outra.contaId}`));
  await expect(op.getByText("Maria Souza")).toHaveCount(0);
  await octx.close();
  await ctx.close();
});

test("importa o arquivo exportado pelo protótipo num escritório vazio (RF-90)", async ({ browser }) => {
  const ctx = await novoContexto(browser);
  const page = await ctx.newPage();
  const { contaId } = await gestoraLiberada(page, "Escritório Importado");
  await page.getByRole("link", { name: "Importar do protótipo" }).first().click();
  await page.getByLabel(/Arquivo exportado/).setInputFiles("tests/fixtures/prototipo-exemplo.json");
  await expect(page.getByText("Prévia ·")).toBeVisible();
  await page.getByRole("button", { name: "Importar 4 clientes" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${contaId}/clientes`));
  for (const nome of ["Carla Inventada", "Diego Inventado", "Elisa Inventada"]) await expect(page.getByText(nome).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Importar do protótipo" })).toHaveCount(0); // o atalho some com o escritório preenchido
  await ctx.close();
});
