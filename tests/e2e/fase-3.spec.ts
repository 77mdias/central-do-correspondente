import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { URL_OWNER_E2E } from "../test-env";
import { gestoraLiberada, novoContexto } from "./ajudantes";
import { ultimoLink } from "./mailpit";

const PDF = Buffer.from("%PDF-1.4\n%documento de teste\n");
const ORIGEM = { origin: "http://localhost:3102" };

test("portal do corretor: convite, só os próprios clientes, sem dados do escritório, anexo visto pela gestora (RF-80 a RF-84)", async ({ browser }) => {
  const ctx = await novoContexto(browser);
  const page = await ctx.newPage();
  const { contaId } = await gestoraLiberada(page, "Souza Correspondente");
  const raiz = `/e/${contaId}`;

  // a gestora cadastra o corretor com e-mail e o convida pela ficha dele
  const emailK = `k-${Date.now()}@exemplo.com`;
  await page.getByRole("link", { name: "Corretores parceiros" }).click();
  await page.getByLabel("Nome do corretor").fill("Ana Lima");
  await page.getByLabel("Imobiliária / casa").fill("Casa Boa Imóveis");
  await page.getByRole("button", { name: "Cadastrar corretor" }).click();
  await expect(page.getByRole("heading", { name: "Ana Lima" })).toBeVisible();
  const corretorId = ((await (await page.request.get(`/api/contas/${contaId}/corretores`, { headers: ORIGEM })).json()) as { id: string }[])[0]!.id;

  // dois clientes (um dele, com CPF e observação, e um direto), pela API para o teste ficar curto
  const novo = async (data: Record<string, unknown>) =>
    ((await (await page.request.post(`/api/contas/${contaId}/clientes`, { headers: ORIGEM, data })).json()) as { id: string }).id;
  const dele = await novo({ nome: "Maria Souza", cpf: "529.982.247-25", whatsapp: "(11) 98888-7777", corretorId, valorImovelCentavos: 25000000 });
  await page.request.patch(`/api/contas/${contaId}/clientes/${dele}`, { headers: ORIGEM, data: { observacoes: "observação interna do escritório" } });
  await novo({ nome: "Carla Direta" });

  await page.goto(`${raiz}/corretores`);
  await page.getByRole("button", { name: "Editar" }).first().click();
  await page.getByRole("dialog").getByLabel("E-mail").fill(emailK);
  // o botão só aparece depois que o e-mail foi salvo (salvamento automático)
  await page.getByRole("button", { name: "Convidar para o portal" }).click();
  await expect(page.getByText(`Convite enviado para ${emailK}.`)).toBeVisible();

  // o corretor aceita pelo e-mail e cai em "Meus clientes", só com o cliente dele
  const kctx = await novoContexto(browser);
  const kp = await kctx.newPage();
  const respostas404: string[] = [];
  kp.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() === 404) respostas404.push(r.url());
  });
  await kp.goto(await ultimoLink(emailK, "/convite/"));
  await kp.getByLabel("Seu nome").fill("Ana Lima");
  await kp.getByLabel("Crie uma senha").fill("senha-forte-1");
  await kp.getByLabel(/Li e aceito/).check();
  await kp.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(kp).toHaveURL(new RegExp(`${raiz}$`));
  await expect(kp.getByRole("heading", { name: "Meus clientes" })).toBeVisible();
  const lista = kp.getByRole("list", { name: "Meus clientes" });
  await expect(lista.getByText("Maria Souza")).toBeVisible();
  await expect(kp.getByText("Carla Direta")).toHaveCount(0);
  await expect(kp.getByRole("link", { name: "VGV e comissões" })).toHaveCount(0);

  // na ficha: nada de CPF, observação nem cobrança; anexa um PDF e o RG fica recebido
  await lista.getByRole("link", { name: /Maria Souza/ }).click();
  const painel = kp.getByRole("dialog");
  await expect(painel.getByText("Dados do cliente")).toBeVisible();
  await expect(painel.getByText(/529\.?982/)).toHaveCount(0);
  await expect(painel.getByText("observação interna do escritório")).toHaveCount(0);
  await expect(painel.getByText(/[Cc]obran/)).toHaveCount(0);
  await painel.getByLabel("Anexar RG ou CNH").setInputFiles({ name: "rg.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(painel.getByRole("button", { name: "rg.pdf", exact: true })).toBeVisible();
  await expect(painel.getByRole("checkbox", { name: /RG ou CNH/ })).toBeChecked();
  await expect(painel.getByRole("button", { name: /Remover/ })).toHaveCount(0);

  // tela do escritório pelo endereço: volta para "Meus clientes"
  await kp.goto(`${raiz}/clientes`);
  await expect(kp).toHaveURL(new RegExp(`${raiz}$`));
  await expect(kp.getByRole("heading", { name: "Meus clientes" })).toBeVisible();
  expect(respostas404).toEqual([]); // a casca do corretor não chama as rotas do escritório
  await kctx.close();

  // a gestora vê o documento recebido e "Anexado por Ana Lima" no histórico
  await page.goto(`${raiz}/clientes?cliente=${dele}&card=todos`);
  const fichaG = page.getByRole("dialog");
  await expect(fichaG.getByRole("checkbox", { name: /RG ou CNH/ })).toBeChecked();
  await expect(fichaG.getByText(/Anexado por Ana Lima: RG ou CNH \(rg\.pdf\)/)).toBeVisible();
  await ctx.close();
});

test("termos atualizados: quem aceitou uma versão antiga aceita a atual antes de continuar (RF-67)", async ({ browser }) => {
  const ctx = await novoContexto(browser);
  const page = await ctx.newPage();
  const { email, contaId } = await gestoraLiberada(page, "Escritório Termos");
  const dono = new Pool({ connectionString: URL_OWNER_E2E });
  await dono.query(`update "user" set "termosVersao" = 'antiga' where email = $1`, [email]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Termos atualizados" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${contaId}$`));
  await expect(page.getByRole("heading", { name: "Escritório Termos", exact: true })).toBeVisible();

  const r = await dono.query<{ v: string }>(`select "termosVersao" as v from "user" where email = $1`, [email]);
  expect(r.rows[0]!.v).not.toBe("antiga");
  await dono.end();
  await ctx.close();
});
