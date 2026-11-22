// Textos das mensagens de WhatsApp, idênticos aos do protótipo (msgCliente, msgCorretor, waLink).
import type { ClienteLista } from "../tipos-api";
import { nomeEtapa } from "./catalogo";
import { ativo, faltando } from "./processo";

type Cliente = Pick<ClienteLista, "nome" | "etapa" | "documentos">;

const primeiroNome = (nome: string) => nome.split(" ")[0] ?? "";

/** RF-30: mensagem para o cliente com os documentos que faltam (ou a etapa, se não falta nada). */
export function mensagemCliente(c: Cliente): string {
  const f = faltando(c);
  const pn = primeiroNome(c.nome) || "tudo bem";
  if (!f.length)
    return `Olá ${pn}, tudo bem? Recebemos toda a sua documentação. Seu processo de financiamento na Caixa está na etapa: ${nomeEtapa(c.etapa)}. Qualquer novidade eu te aviso!`;
  return `Olá ${pn}, tudo bem?\nPara darmos andamento ao seu financiamento na Caixa, ainda precisamos dos seguintes documentos:\n\n${f.map((d) => "• " + d.nome).join("\n")}\n\nPode me enviar por aqui mesmo (foto legível ou PDF). Obrigado!`;
}

/** RF-43: situação dos clientes ativos do corretor. */
export function mensagemCorretor(nomeCorretor: string, clientesDoCorretor: readonly Cliente[]): string {
  const cs = clientesDoCorretor.filter(ativo);
  let t = `Olá ${primeiroNome(nomeCorretor)}, segue a situação dos seus clientes na Caixa (${cs.length} em andamento):\n`;
  for (const c of cs) {
    const f = faltando(c);
    t += `\n▸ ${c.nome} · ${nomeEtapa(c.etapa)}${f.length ? `\n   Falta: ${f.map((d) => d.nome).join(", ")}` : "\n   Documentação completa ✓"}`;
  }
  if (cs.some((c) => faltando(c).length)) t += `\n\nConsegue ajudar a cobrar os documentos pendentes? Obrigado!`;
  return t;
}

/** RF-31: link `wa.me` com DDI 55 automático; sem link para telefone com menos de 10 dígitos. */
export function linkWhatsApp(telefone: string | null | undefined, texto: string): string {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return "";
  return `https://wa.me/${d.length <= 11 ? "55" + d : d}?text=${encodeURIComponent(texto)}`;
}
