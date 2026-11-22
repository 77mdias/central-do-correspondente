// "Enviou?" (RF-36, D-39): quem abriu o WhatsApp ou copiou a mensagem fica com uma cobrança aberta até
// responder. Guardada na sessionStorage da aba, por escritório; sem armazenamento, vive só na memória.

export type MeioCobranca = "whatsapp" | "copiada";
export type CobrancaAberta = { clienteId: string; nome: string; meio: MeioCobranca; em: number };

const memoria = new Map<string, string>();
const armazenamento = {
  ler(chave: string): string | null {
    try {
      return sessionStorage.getItem(chave);
    } catch {
      return memoria.get(chave) ?? null;
    }
  },
  gravar(chave: string, valor: string) {
    try {
      sessionStorage.setItem(chave, valor);
    } catch {
      memoria.set(chave, valor);
    }
  },
};

const chave = (contaId: string) => `cobrancas-abertas:${contaId}`;

export function cobrancasAbertas(contaId: string): CobrancaAberta[] {
  try {
    const v = JSON.parse(armazenamento.ler(chave(contaId)) ?? "[]");
    return Array.isArray(v) ? (v as CobrancaAberta[]) : [];
  } catch {
    return [];
  }
}

/** Abre (ou renova) a cobrança do cliente; a mais recente fica por último. */
export function abrirCobranca(contaId: string, c: Omit<CobrancaAberta, "em">, agora = Date.now()) {
  const outras = cobrancasAbertas(contaId).filter((x) => x.clienteId !== c.clienteId);
  armazenamento.gravar(chave(contaId), JSON.stringify([...outras, { ...c, em: agora }]));
}

export function fecharCobranca(contaId: string, clienteId: string) {
  armazenamento.gravar(chave(contaId), JSON.stringify(cobrancasAbertas(contaId).filter((x) => x.clienteId !== clienteId)));
}

/** A pergunta da vez: a cobrança aberta mais recente. */
export const ultimaAberta = (contaId: string): CobrancaAberta | null => cobrancasAbertas(contaId).at(-1) ?? null;
