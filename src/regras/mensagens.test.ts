import { DOCUMENTOS } from "./catalogo";
import { linkWhatsApp, mensagemCliente, mensagemCorretor } from "./mensagens";

const todos = Object.fromEntries(DOCUMENTOS.map((d) => [d.codigo, "2026-11-01"]));
const quaseTodos = { ...todos, iptu: null, form: null };

test("mensagem do cliente com documentos faltando, igual à do protótipo", () => {
  expect(mensagemCliente({ nome: "Maria Souza", etapa: "documentacao_pendente", documentos: quaseTodos })).toBe(
    "Olá Maria, tudo bem?\nPara darmos andamento ao seu financiamento na Caixa, ainda precisamos dos seguintes documentos:\n\n• Carnê do IPTU\n• Formulários assinados\n\nPode me enviar por aqui mesmo (foto legível ou PDF). Obrigado!",
  );
});

test("mensagem do cliente com tudo recebido cita a etapa", () => {
  expect(mensagemCliente({ nome: "Maria", etapa: "analise_credito", documentos: todos })).toBe(
    "Olá Maria, tudo bem? Recebemos toda a sua documentação. Seu processo de financiamento na Caixa está na etapa: Análise de crédito. Qualquer novidade eu te aviso!",
  );
});

test("mensagem do corretor só com os ativos e o pedido de ajuda", () => {
  const t = mensagemCorretor("Ana Corretora", [
    { nome: "Maria", etapa: "documentacao_pendente", documentos: quaseTodos },
    { nome: "João", etapa: "analise_credito", documentos: todos },
    { nome: "Fim", etapa: "concluido", documentos: {} },
  ]);
  expect(t).toBe(
    "Olá Ana, segue a situação dos seus clientes na Caixa (2 em andamento):\n" +
      "\n▸ Maria · Documentação pendente\n   Falta: Carnê do IPTU, Formulários assinados" +
      "\n▸ João · Análise de crédito\n   Documentação completa ✓" +
      "\n\nConsegue ajudar a cobrar os documentos pendentes? Obrigado!",
  );
});

test("link do WhatsApp: 10 ou 11 dígitos ganham 55; mais dígitos ficam; menos de 10 não gera", () => {
  expect(linkWhatsApp("(11) 98888-7777", "oi")).toBe("https://wa.me/5511988887777?text=oi");
  expect(linkWhatsApp("1133334444", "a b")).toBe("https://wa.me/551133334444?text=a%20b");
  expect(linkWhatsApp("5511988887777", "oi")).toBe("https://wa.me/5511988887777?text=oi");
  expect(linkWhatsApp("988887777", "oi")).toBe("");
  expect(linkWhatsApp(null, "oi")).toBe("");
});
