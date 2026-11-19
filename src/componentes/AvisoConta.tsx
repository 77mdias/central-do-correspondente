import type { EscritorioResumo } from "@/tipos-api";
import { Aviso } from "./ui";

/** Aviso fixo quando a conta não pode gravar (RF-73, D-33). */
export function AvisoConta({ escritorio }: { escritorio: EscritorioResumo }) {
  if (escritorio.ativa) return null;
  if (escritorio.statusAssinatura === "suspensa")
    return <Aviso tom="atencao">Conta suspensa por falta de pagamento: somente leitura até o pagamento ser confirmado.</Aviso>;
  return <Aviso tom="atencao">Conta aguardando liberação: por enquanto, nada pode ser cadastrado ou alterado.</Aviso>;
}
