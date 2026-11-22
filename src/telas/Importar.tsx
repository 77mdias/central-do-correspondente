import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate, useOutletContext } from "react-router";
import { api, ErroApi } from "@/api";
import { Aviso, Botao, Cartao } from "@/componentes/ui";
import { chavesEscritorio, useClientes } from "@/consultas-escritorio";
import { formatarPercentual } from "@/regras/dinheiro";
import { type ArquivoPrototipo, type Aviso as AvisoImportacao, converterPrototipo, esquemaArquivoPrototipo, type Previa } from "@/regras/importacao";
import type { EscritorioResumo } from "@/tipos-api";

const ERROS: Record<string, string> = {
  ja_importado: "Este escritório já importou os dados do protótipo.",
  conta_nao_vazia: "A importação só funciona num escritório vazio, sem clientes nem corretores cadastrados.",
  origem_usada: "Estes dados já foram importados em outro escritório.",
  conta_inativa: "Esta conta ainda não pode receber dados (aguardando liberação ou suspensa).",
  sem_permissao: "Só a gestora pode importar.",
  arquivo_grande: "Arquivo grande demais (máx. 10 MB).",
};

type Lido = { arquivo: ArquivoPrototipo; previa: Previa; avisos: AvisoImportacao[]; nome: string };

/** RF-90 / D-40: importar o arquivo do botão "Exportar JSON" do protótipo, com prévia antes de gravar. */
export function Importar() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const conta = escritorio.contaId;
  const clientes = useClientes(conta);
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [lido, setLido] = useState<Lido | null>(null);
  const [erroArquivo, setErroArquivo] = useState("");
  const [colado, setColado] = useState("");
  const importar = useMutation({
    mutationFn: (arquivo: ArquivoPrototipo) => api<{ clientes: number }>(`/api/contas/${conta}/importacao`, { body: arquivo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesEscritorio.clientes(conta) });
      void qc.invalidateQueries({ queryKey: chavesEscritorio.corretores(conta) });
      void qc.invalidateQueries({ queryKey: chavesEscritorio.historico(conta) });
      navegar(`/e/${conta}/clientes?card=todos`);
    },
  });

  if (escritorio.perfil !== "gestor") return <Navigate to={`/e/${conta}`} replace />;

  async function ler(texto: string | undefined, nome: string) {
    setLido(null);
    setErroArquivo("");
    importar.reset();
    if (!texto?.trim()) return;
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      return setErroArquivo("Este arquivo não é um JSON. Use o arquivo baixado pelo botão Exportar JSON do protótipo.");
    }
    const r = esquemaArquivoPrototipo.safeParse(json);
    if (!r.success) return setErroArquivo(r.error.issues[0]?.message ?? "Arquivo inválido.");
    const { previa, avisos } = converterPrototipo(r.data);
    setLido({ arquivo: r.data, previa, avisos, nome });
  }

  const contaComDados = (clientes.data?.length ?? 0) > 0;
  const porCliente = new Map<string, AvisoImportacao[]>();
  for (const a of lido?.avisos ?? []) porCliente.set(a.cliente ?? "Escritório", [...(porCliente.get(a.cliente ?? "Escritório") ?? []), a]);

  return (
    <section className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-borda pb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">Importar do protótipo</h1>
        <p className="text-sm text-texto-2">
          No protótipo, use o botão <b>Exportar JSON</b> do menu e escolha o arquivo baixado aqui. Nada é gravado antes de você conferir a prévia. Os anexos não vêm junto: depois da
          importação, reenvie os arquivos pela ficha de cada cliente.
        </p>
      </div>

      {contaComDados && <Aviso tom="atencao">Este escritório já tem clientes. A importação só funciona num escritório vazio.</Aviso>}
      {!escritorio.ativa && <Aviso tom="atencao">{ERROS.conta_inativa}</Aviso>}

      <Cartao className="flex flex-col gap-3 p-5">
        <label htmlFor="arquivo-prototipo" className="text-sm font-medium">
          Arquivo exportado (central-AAAA-MM-DD.json)
        </label>
        <input
          id="arquivo-prototipo"
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            await ler(await f?.text(), f?.name ?? "");
          }}
          className="text-sm"
        />
        <details className="text-sm">
          <summary className="cursor-pointer text-texto-2">O download não funcionou no protótipo? Cole o conteúdo copiado</summary>
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              aria-label="Conteúdo exportado"
              rows={5}
              value={colado}
              onChange={(e) => setColado(e.target.value)}
              className="rounded-[6px] border border-borda-campo bg-superficie p-2 font-mono text-xs"
            />
            <Botao variante="secundario" className="self-start" onClick={() => void ler(colado, "conteúdo colado")}>
              Ler conteúdo colado
            </Botao>
          </div>
        </details>
        {erroArquivo && <Aviso tom="erro">{erroArquivo}</Aviso>}
      </Cartao>

      {lido && (
        <Cartao className="flex flex-col gap-4 p-5">
          <h2 className="text-base font-medium">Prévia · {lido.nome}</h2>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Clientes", lido.previa.clientes],
              ["Corretores", lido.previa.corretores],
              ["Documentos recebidos", lido.previa.documentos],
              ["Notas de histórico", lido.previa.notas],
              ["Percentual atual", lido.previa.percentual == null ? "—" : formatarPercentual(lido.previa.percentual)],
              ["Anexos para reenviar", lido.previa.anexosParaReenviar],
            ].map(([rotulo, valor]) => (
              <div key={rotulo as string} className="rounded-lg border border-borda p-3">
                <dd className="font-mono-tabular text-xl">{valor}</dd>
                <dt className="text-xs uppercase tracking-wide text-texto-2">{rotulo}</dt>
              </div>
            ))}
          </dl>
          {lido.avisos.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {lido.avisos.length} aviso{lido.avisos.length === 1 ? "" : "s"} (nada disso impede a importação)
              </h3>
              <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-lg border border-borda p-3 text-sm">
                {[...porCliente].map(([cliente, avisos]) => (
                  <li key={cliente}>
                    <b className="font-medium">{cliente}</b>
                    <ul className="list-disc pl-5 text-texto-2">
                      {avisos.map((a, i) => (
                        <li key={i}>{a.mensagem}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {importar.isError && (
            <Aviso tom="erro">{(importar.error instanceof ErroApi && ERROS[importar.error.codigo]) || "Não foi possível importar. Nada foi gravado; tente de novo."}</Aviso>
          )}
          <Botao className="self-start" carregando={importar.isPending} disabled={contaComDados || !escritorio.ativa} onClick={() => importar.mutate(lido.arquivo)}>
            Importar {lido.previa.clientes} cliente{lido.previa.clientes === 1 ? "" : "s"}
          </Botao>
        </Cartao>
      )}
    </section>
  );
}
