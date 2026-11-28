import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErroApi } from "@/api";
import { OssosFormulario } from "@/componentes/Esqueleto";
import { Aviso } from "@/componentes/ui";
import { recarregarPortal, useFichaPortal } from "@/consultas-portal";
import { cn } from "@/lib/cn";
import { nomeEtapa, nomeModalidade } from "@/regras/catalogo";
import { formatarReais } from "@/regras/dinheiro";
import { linkWhatsApp } from "@/regras/mensagens";
import type { EscritorioResumo, FichaPortal as TFicha } from "@/tipos-api";
import { classeEtapa } from "../Clientes";
import { Documentos, Secao } from "./Documentos";

const dataCurtaHora = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });

/** (11) 98888-7777 */
function telefone(d: string) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Ficha do portal (RF-81 a RF-83): dados em leitura, checklist com Anexar e histórico de etapa e anexos. */
export function FichaPortal({ escritorio, id }: { escritorio: EscritorioResumo; id: string }) {
  const ficha = useFichaPortal(escritorio.contaId, id);
  if (ficha.isPending) return <OssosFormulario campos={4} />;
  if (ficha.error)
    return <Aviso tom="erro">{ficha.error instanceof ErroApi && ficha.error.status === 404 ? "Cliente não encontrado." : "Não foi possível abrir a ficha."}</Aviso>;
  return <Conteudo escritorio={escritorio} ficha={ficha.data} />;
}

function Conteudo({ escritorio, ficha }: { escritorio: EscritorioResumo; ficha: TFicha }) {
  const qc = useQueryClient();
  const conta = escritorio.contaId;
  const c = ficha.cliente;
  const wa = linkWhatsApp(c.whatsapp, "");
  const valor = (v: number | null) => (v == null ? "Não informado" : formatarReais(v));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("font-mono-tabular inline-flex rounded-full px-2 py-0.5 text-xs", classeEtapa(c.etapa))}>{nomeEtapa(c.etapa)}</span>
        <span className="text-xs text-texto-2">
          {c.modalidade ? nomeModalidade(c.modalidade) : "Modalidade não informada"} · cadastrado em {dataCurtaHora(c.criadoEm)}
        </span>
      </div>

      <Secao titulo="Dados do cliente">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Dado rotulo="Nome">{c.nome}</Dado>
          <Dado rotulo="WhatsApp">
            {c.whatsapp ? (
              wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="text-acento hover:underline">
                  {telefone(c.whatsapp)}
                </a>
              ) : (
                telefone(c.whatsapp)
              )
            ) : (
              "Não informado"
            )}
          </Dado>
          <Dado rotulo="E-mail">
            {c.email ? (
              <a href={`mailto:${c.email}`} className="break-all text-acento hover:underline">
                {c.email}
              </a>
            ) : (
              "Não informado"
            )}
          </Dado>
          <Dado rotulo="Modalidade">{c.modalidade ? nomeModalidade(c.modalidade) : "Não informada"}</Dado>
          <Dado rotulo="Valor do imóvel">{valor(c.valorImovelCentavos)}</Dado>
          <Dado rotulo="Valor financiado">{valor(c.valorFinanciadoCentavos)}</Dado>
        </dl>
        <p className="text-xs text-texto-2">Para corrigir algum dado, fale com o escritório.</p>
      </Secao>

      <Documentos
        conta={conta}
        cliente={c}
        anexos={ficha.anexos}
        pode={{ marcar: false, anexar: escritorio.ativa, remover: false }}
        recarregar={() => recarregarPortal(qc, conta, c.id)}
      />

      <Secao titulo="Histórico">
        <p className="text-xs text-texto-2">Mudanças de etapa e documentos recebidos.</p>
        <ul className="flex flex-col divide-y divide-borda">
          {ficha.historico.map((h) => (
            <li key={h.id} className="flex gap-3 py-2 text-sm">
              <time className="font-mono-tabular shrink-0 text-xs leading-5 text-texto-2">{dataCurtaHora(h.criadoEm)}</time>
              <span className="text-texto">{h.texto}</span>
            </li>
          ))}
          {!ficha.historico.length && <li className="py-2 text-sm text-texto-2">Sem registros ainda.</li>}
        </ul>
      </Secao>
    </>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-texto-2">{rotulo}</dt>
      <dd className="text-texto">{children}</dd>
    </div>
  );
}
