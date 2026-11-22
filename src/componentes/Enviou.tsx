import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ErroApi } from "@/api";
import { atualizarNaLista, recarregarCliente } from "@/consultas-escritorio";
import { abrirCobranca, type CobrancaAberta, cobrancasAbertas, fecharCobranca, type MeioCobranca, ultimaAberta } from "@/lib/cobranca-aberta";
import { linkWhatsApp, mensagemCliente } from "@/regras/mensagens";
import type { ClienteLista, EscritorioResumo } from "@/tipos-api";
import { Aviso, Botao } from "./ui";

type Ctx = { abertas: CobrancaAberta[]; abrir: (c: ClienteLista, meio: MeioCobranca) => void; perguntar: (clienteId: string) => void };
const Contexto = createContext<Ctx | null>(null);

export const useEnviou = () => {
  const c = useContext(Contexto);
  if (!c) throw new Error("useEnviou fora do ProvedorEnviou");
  return c;
};

/**
 * RF-36 / D-39: ao voltar do WhatsApp (aba visível de novo) ou logo depois de copiar a mensagem, pergunta
 * "Enviou?". Só o Sim registra a cobrança (RN-13). Sem resposta, a cobrança fica aberta em Cobrar hoje.
 */
export function ProvedorEnviou({ escritorio, children }: { escritorio: EscritorioResumo; children: ReactNode }) {
  const conta = escritorio.contaId;
  const qc = useQueryClient();
  const [abertas, setAbertas] = useState(() => cobrancasAbertas(conta));
  const [pergunta, setPergunta] = useState<CobrancaAberta | null>(null);
  const [erro, setErro] = useState("");
  const esperandoVolta = useRef(false);
  const dialogo = useRef<HTMLDialogElement>(null);

  const sincronizar = useCallback(() => setAbertas(cobrancasAbertas(conta)), [conta]);

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible" || !esperandoVolta.current) return;
      esperandoVolta.current = false;
      setPergunta(ultimaAberta(conta));
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [conta]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (pergunta && !d.open) d.showModal();
    if (!pergunta && d.open) d.close();
  }, [pergunta]);

  const abrir = useCallback(
    (c: ClienteLista, meio: MeioCobranca) => {
      abrirCobranca(conta, { clienteId: c.id, nome: c.nome, meio });
      sincronizar();
      setErro("");
      if (meio === "copiada") setPergunta(ultimaAberta(conta));
      else esperandoVolta.current = true;
    },
    [conta, sincronizar],
  );

  const perguntar = useCallback(
    (clienteId: string) => {
      setErro("");
      setPergunta(cobrancasAbertas(conta).find((x) => x.clienteId === clienteId) ?? null);
    },
    [conta],
  );

  const registrar = useMutation({
    mutationFn: (p: CobrancaAberta) => api<ClienteLista>(`/api/contas/${conta}/clientes/${p.clienteId}/cobrancas`, { body: { meio: p.meio } }),
    onSuccess: (c, p) => {
      atualizarNaLista(qc, conta, c);
      recarregarCliente(qc, conta, p.clienteId);
      fecharCobranca(conta, p.clienteId);
      sincronizar();
      setPergunta(null);
    },
    onError: (e, p) => {
      if (e instanceof ErroApi && e.codigo === "sem_cobranca") {
        fecharCobranca(conta, p.clienteId);
        sincronizar();
        setPergunta(null);
        return;
      }
      setErro(e instanceof ErroApi && e.status === 403 ? "Esta conta não pode registrar cobranças agora." : "Não foi possível registrar. Tente de novo.");
    },
  });

  const nao = () => {
    if (!pergunta) return;
    fecharCobranca(conta, pergunta.clienteId);
    sincronizar();
    setPergunta(null);
  };

  return (
    <Contexto.Provider value={{ abertas, abrir, perguntar }}>
      {children}
      <dialog
        ref={dialogo}
        aria-labelledby="enviou-titulo"
        onCancel={(e) => {
          e.preventDefault();
          setPergunta(null); // Esc = responder depois
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-borda bg-superficie p-0 text-texto backdrop:bg-black/40"
      >
        {pergunta && (
          <div className="flex flex-col gap-4 p-5">
            <h2 id="enviou-titulo" className="text-lg font-medium tracking-tight">
              Enviou a cobrança para {pergunta.nome.split(" ")[0]}?
            </h2>
            <p className="text-sm text-texto-2">
              {pergunta.meio === "whatsapp" ? "A mensagem foi aberta no WhatsApp." : "A mensagem foi copiada."} A cobrança só é registrada se você
              confirmar o envio.
            </p>
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Botao carregando={registrar.isPending} onClick={() => registrar.mutate(pergunta)}>
                Sim, enviei
              </Botao>
              <Botao variante="secundario" onClick={nao}>
                Não enviei
              </Botao>
              <Botao variante="fantasma" onClick={() => setPergunta(null)}>
                Responder depois
              </Botao>
            </div>
          </div>
        )}
      </dialog>
    </Contexto.Provider>
  );
}

/** WhatsApp com a mensagem pronta (RF-30, RF-31) ou, sem telefone, "Copiar mensagem" (RF-34). */
export function BotaoCobrar({ cliente, desativado, className }: { cliente: ClienteLista; desativado?: boolean; className?: string }) {
  const { abrir } = useEnviou();
  const [copiou, setCopiou] = useState(false);
  const texto = mensagemCliente(cliente);
  const link = linkWhatsApp(cliente.whatsapp, texto);
  const classe =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors " +
    (desativado ? "pointer-events-none opacity-50 " : "") +
    (className ?? "");
  if (link)
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={desativado || undefined}
        onClick={() => abrir(cliente, "whatsapp")}
        className={`${classe} bg-marca text-marca-texto hover:bg-marca-forte`}
      >
        WhatsApp
      </a>
    );
  return (
    <button
      type="button"
      disabled={desativado}
      className={`${classe} border border-borda bg-superficie text-texto hover:bg-superficie-sutil`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiou(true);
          abrir(cliente, "copiada");
        } catch {
          setCopiou(false);
          window.prompt("Copie a mensagem:", texto);
          abrir(cliente, "copiada");
        }
      }}
    >
      {copiou ? "Copiada" : "Copiar mensagem"}
    </button>
  );
}
