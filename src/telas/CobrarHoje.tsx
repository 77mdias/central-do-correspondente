import { useOutletContext } from "react-router";
import { BotaoCobrar, useEnviou } from "@/componentes/Enviou";
import { OssosLista } from "@/componentes/Esqueleto";
import { Aviso, Botao } from "@/componentes/ui";
import { useClientes, useCorretores } from "@/consultas-escritorio";
import { hojeBr } from "@/regras/datas";
import { faltando, nomeOrigem, situacaoCobranca } from "@/regras/processo";
import type { EscritorioResumo } from "@/tipos-api";
import { LinkFicha } from "./Inicio";

/** Cobrar hoje (RF-30 a RF-36): cobranças atrasadas e do dia, com WhatsApp ou Copiar e o "Enviou?". */
export function CobrarHoje() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const conta = escritorio.contaId;
  const clientes = useClientes(conta);
  const corretores = useCorretores(conta).data ?? [];
  const { abertas, perguntar } = useEnviou();
  const hoje = hojeBr();
  const fila = (clientes.data ?? [])
    .filter((c) => situacaoCobranca(c, hoje)?.vence)
    .sort((a, b) => (a.proximaCobranca ?? hoje).localeCompare(b.proximaCobranca ?? hoje) || a.nome.localeCompare(b.nome));

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-borda pb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">Cobrar hoje</h1>
        <p className="text-sm text-texto-2">
          Cobranças vencidas e do dia. O WhatsApp abre com a mensagem pronta; ao voltar, confirme se enviou para registrar a cobrança.
        </p>
      </div>

      {abertas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-borda bg-superficie p-4">
          <h2 className="text-sm font-medium">Cobranças abertas</h2>
          <ul className="flex flex-col divide-y divide-borda">
            {abertas.map((a) => (
              <li key={a.clienteId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <b className="font-medium">{a.nome}</b> · {a.meio === "whatsapp" ? "WhatsApp aberto" : "mensagem copiada"}
                </span>
                <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={() => perguntar(a.clienteId)}>
                  Cobrança aberta: enviou?
                </Botao>
              </li>
            ))}
          </ul>
        </div>
      )}

      {clientes.error && <Aviso tom="erro">Os dados ainda não carregaram. A página continua tentando.</Aviso>}
      {clientes.isPending ? (
        <OssosLista linhas={4} />
      ) : !fila.length ? (
        <div className="rounded-xl border border-borda bg-superficie p-8 text-center">
          <h2 className="text-lg font-medium">Nenhuma cobrança para hoje</h2>
          <p className="mt-1 text-sm text-texto-2">Tudo em dia.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-superficie">
          {fila.map((c) => {
            const f = faltando(c);
            const cob = situacaoCobranca(c, hoje)!;
            return (
              <li key={c.id} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <LinkFicha id={c.id} className="flex min-w-0 flex-col">
                  <b className="truncate text-sm font-medium text-texto">{c.nome}</b>
                  <span className="truncate text-xs text-texto-2">
                    {nomeOrigem(c.corretorId, corretores)} · faltam {f.length} doc{f.length === 1 ? "" : "s"}
                    {c.qtdCobrancas ? ` · já cobrado ${c.qtdCobrancas}x` : ""}
                  </span>
                  <span className="text-xs text-perigo">{cob.texto}</span>
                </LinkFicha>
                <span className="flex shrink-0 gap-2">
                  <BotaoCobrar cliente={c} desativado={!escritorio.ativa} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
