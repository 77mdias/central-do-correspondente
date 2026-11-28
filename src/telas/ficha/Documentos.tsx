import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, enviarArquivo, ErroApi } from "@/api";
import { Aviso } from "@/componentes/ui";
import { atualizarNaLista } from "@/consultas-escritorio";
import { cn } from "@/lib/cn";
import { prepararArquivo } from "@/lib/preparar-arquivo";
import { DOCUMENTOS, NOME_GRUPO, OUTROS_ARQUIVOS } from "@/regras/catalogo";
import { dataBr } from "@/regras/datas";
import type { ArquivoResumo, ClienteLista } from "@/tipos-api";

const ERROS_ANEXO: Record<string, string> = {
  arquivo_grande: "Arquivo grande demais (máx. 20 MB).",
  tipo_nao_aceito: "Formato não aceito: envie PDF ou foto (JPG, PNG, WebP ou HEIC).",
  armazenamento: "O armazenamento não respondeu. Tente de novo em instantes.",
  sem_permissao: "Esta conta não pode anexar agora.",
};

const tamanho = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(b / 1024)} KB`);

export type Permissoes = { marcar: boolean; anexar: boolean; remover: boolean };

/**
 * Checklist dos 12 documentos e "Outros arquivos" (RF-20 a RF-24, RF-26). O escritório marca, anexa e remove;
 * o corretor só anexa e abre (RF-82). `recarregar` atualiza as consultas de quem está vendo.
 */
export function Documentos({
  conta,
  cliente: c,
  anexos,
  pode,
  recarregar,
}: {
  conta: string;
  cliente: Pick<ClienteLista, "id" | "documentos">;
  anexos: ArquivoResumo[];
  pode: Permissoes;
  recarregar: () => void;
}) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);
  const base = `/api/contas/${conta}`;
  const recebidos = DOCUMENTOS.filter((d) => c.documentos[d.codigo]).length;

  async function marcar(tipo: string, recebido: boolean) {
    setErro("");
    try {
      const novo = await api<ClienteLista>(`${base}/clientes/${c.id}/documentos/${tipo}`, { method: "PUT", body: { recebido } });
      atualizarNaLista(qc, conta, novo);
      recarregar();
    } catch {
      setErro("Não foi possível marcar o documento.");
    }
  }

  async function anexar(tipo: string, arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    setEnviando(tipo);
    for (const bruto of Array.from(arquivos)) {
      try {
        const arquivo = await prepararArquivo(bruto);
        const form = new FormData();
        form.set("tipo", tipo);
        form.set("arquivo", arquivo);
        await enviarArquivo<ArquivoResumo>(`${base}/clientes/${c.id}/arquivos`, form);
      } catch (e) {
        setErro(e instanceof ErroApi ? `${bruto.name}: ${ERROS_ANEXO[e.codigo] ?? "não foi possível enviar."}` : (e as Error).message);
      }
    }
    setEnviando(null);
    recarregar();
  }

  async function abrir(a: ArquivoResumo) {
    const janela = window.open("", "_blank"); // aberta já no clique, para o navegador não bloquear
    try {
      const { url } = await api<{ url: string }>(`${base}/arquivos/${a.id}/link`);
      if (janela) janela.location.replace(url);
      else window.location.assign(url);
    } catch {
      janela?.close();
      setErro("Não foi possível abrir o arquivo.");
    }
  }

  async function remover(a: ArquivoResumo) {
    if (removendo !== a.id) return setRemovendo(a.id);
    setRemovendo(null);
    try {
      await api(`${base}/arquivos/${a.id}`, { method: "DELETE" });
      recarregar();
    } catch {
      setErro("Não foi possível remover o arquivo.");
    }
  }

  const itens = [...DOCUMENTOS.map((d) => ({ codigo: d.codigo as string, nome: d.nome, grupo: NOME_GRUPO[d.grupo] })), { codigo: "outros", nome: OUTROS_ARQUIVOS, grupo: "Outros" }];
  const totalArquivos = anexos.length;

  return (
    <Secao titulo={`Documentos · ${recebidos}/${DOCUMENTOS.length} recebidos${totalArquivos ? ` · ${totalArquivos} arquivo${totalArquivos === 1 ? "" : "s"}` : ""}`}>
      {pode.anexar && (
        <p className="text-xs text-texto-2">Use Anexar para guardar a foto ou o PDF de cada documento. Ao anexar, o item já fica marcado como recebido.</p>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-col">
        {itens.map((d, i) => {
          const recebidoEm = d.codigo === "outros" ? null : c.documentos[d.codigo as keyof typeof c.documentos];
          const arqs = anexos.filter((a) => a.tipo === d.codigo);
          return (
            <div key={d.codigo}>
              {(i === 0 || itens[i - 1]!.grupo !== d.grupo) && (
                <p className="font-mono-tabular mt-3 mb-1 text-xs uppercase tracking-wide text-texto-2">{d.grupo}</p>
              )}
              <div className="flex items-center justify-between gap-3 border-b border-borda py-2">
                {d.codigo === "outros" ? (
                  <span className="pl-7 text-sm text-texto">{d.nome}</span>
                ) : (
                  <label className="flex min-w-0 items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-[var(--acento)]"
                      checked={!!recebidoEm}
                      disabled={!pode.marcar}
                      onChange={(e) => void marcar(d.codigo, e.target.checked)}
                    />
                    <span className={cn("min-w-0", recebidoEm ? "text-texto" : "text-texto")}>{d.nome}</span>
                    {recebidoEm && <small className="font-mono-tabular shrink-0 text-xs text-ok-texto">recebido {dataBr(recebidoEm).slice(0, 5)}</small>}
                  </label>
                )}
                {pode.anexar && (
                  <label className="relative inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-lg border border-borda bg-superficie px-3 text-xs font-medium hover:bg-superficie-sutil">
                    {enviando === d.codigo ? "Enviando…" : "Anexar"}
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,image/*,.heic,.heif"
                      aria-label={`Anexar ${d.nome}`}
                      disabled={enviando !== null}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(e) => {
                        void anexar(d.codigo, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              {arqs.length > 0 && (
                <ul className="flex flex-wrap gap-2 py-2 pl-7">
                  {arqs.map((a) => (
                    <li key={a.id} className="flex items-center gap-1.5 rounded-lg border border-borda bg-superficie px-2 py-1 text-xs">
                      <span className="font-mono-tabular rounded bg-superficie-sutil px-1 text-[10px] uppercase text-texto-2">{a.mime === "application/pdf" ? "PDF" : "Foto"}</span>
                      <button type="button" className="max-w-48 truncate text-acento hover:underline" title={`${a.nome} · ${tamanho(a.tamanho)}`} onClick={() => void abrir(a)}>
                        {a.nome}
                      </button>
                      {pode.remover && (
                        <button
                          type="button"
                          className={cn("rounded px-1", removendo === a.id ? "bg-perigo text-white" : "text-texto-2 hover:text-perigo")}
                          aria-label={removendo === a.id ? `Confirmar remoção de ${a.nome}` : `Remover ${a.nome}`}
                          onClick={() => void remover(a)}
                        >
                          {removendo === a.id ? "Remover?" : "✕"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Secao>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
      <h3 className="text-sm font-medium text-texto">{titulo}</h3>
      {children}
    </section>
  );
}
