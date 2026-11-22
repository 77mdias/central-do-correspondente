import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, ErroApi } from "@/api";
import { CampoDinheiro, CampoEscolha, CampoTexto, classeEntrada } from "@/componentes/campos";
import { BotaoCobrar, useEnviou } from "@/componentes/Enviou";
import { OssosFormulario } from "@/componentes/Esqueleto";
import { Aviso, Botao } from "@/componentes/ui";
import { chavesEscritorio, recarregarCliente, useCorretores, useFicha } from "@/consultas-escritorio";
import { cn } from "@/lib/cn";
import { FilaSalvamento } from "@/lib/salvamento";
import { ETAPAS, INTERVALOS, MODALIDADES, nomeModalidade } from "@/regras/catalogo";
import { dataBr, diasDesde, hojeBr } from "@/regras/datas";
import { formatarPercentual, formatarReais } from "@/regras/dinheiro";
import { mensagemCliente } from "@/regras/mensagens";
import { faltando, nomeOrigem, situacaoCobranca } from "@/regras/processo";
import type { ClienteLista, EscritorioResumo, Ficha as TFicha } from "@/tipos-api";
import { Documentos, Secao } from "./Documentos";
import { TEXTO_ESTADO, useSalvarCliente } from "./useSalvar";

const dataCurtaHora = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });

/** Ficha do cliente no painel lateral (RF-15 a RF-36), na ordem do protótipo. */
export function Ficha({ escritorio, id, aoExcluir }: { escritorio: EscritorioResumo; id: string; aoExcluir: () => void }) {
  const ficha = useFicha(escritorio.contaId, id);
  if (ficha.isPending) return <OssosFormulario campos={5} />;
  if (ficha.error)
    return <Aviso tom="erro">{ficha.error instanceof ErroApi && ficha.error.status === 404 ? "Cliente não encontrado." : "Não foi possível abrir a ficha."}</Aviso>;
  return <Conteudo escritorio={escritorio} ficha={ficha.data} aoExcluir={aoExcluir} />;
}

function Conteudo({ escritorio, ficha, aoExcluir }: { escritorio: EscritorioResumo; ficha: TFicha; aoExcluir: () => void }) {
  const conta = escritorio.contaId;
  const c = ficha.cliente;
  const pode = escritorio.ativa;
  const ehGestor = escritorio.perfil === "gestor";
  const corretores = useCorretores(conta).data ?? [];
  const s = useSalvarCliente(conta, c.id);
  const qc = useQueryClient();
  const hoje = hojeBr();
  const agora = new Date();
  const kc = corretores.find((k) => k.id === c.corretorId);
  const cob = situacaoCobranca(c, hoje);
  const f = faltando(c);
  const { abertas, perguntar } = useEnviou();
  const aberta = abertas.find((a) => a.clienteId === c.id);

  const campo = (k: string) => ({ id: `f-${k}`, erro: s.erros[k], desativado: !pode });
  const texto = (k: keyof ClienteLista) => (v: string) => s.agendar(k, v);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-xs text-texto-2">
          {c.modalidade ? nomeModalidade(c.modalidade) : "Modalidade não informada"} · criado em {dataCurtaHora(c.criadoEm)}
        </p>
        <p className={cn("text-xs", s.estado === "erro" ? "text-perigo" : "text-texto-2")} role="status">
          {TEXTO_ESTADO[s.estado]}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-superficie-sutil p-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-texto-2">{c.corretorId ? "Corretor parceiro" : "Origem"}</span>
          <b className="truncate text-sm font-medium">{nomeOrigem(c.corretorId, corretores)}</b>
          <span className="truncate text-xs text-texto-2">
            {kc ? `${kc.imobiliaria ?? "Imobiliária não informada"}${kc.whatsapp ? ` · ${kc.whatsapp}` : ""}` : "Cliente que veio direto"}
          </span>
        </div>
      </div>

      <Secao titulo="Dados do cliente">
        <CampoTexto {...campo("nome")} rotulo="Nome completo" valor={c.nome} aoMudar={texto("nome")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto {...campo("cpf")} rotulo="CPF" modo="numeric" valor={c.cpf} aoMudar={texto("cpf")} />
          <CampoTexto {...campo("whatsapp")} rotulo="WhatsApp" modo="tel" valor={c.whatsapp} aoMudar={texto("whatsapp")} />
          <CampoTexto {...campo("email")} rotulo="E-mail" tipo="email" valor={c.email} aoMudar={texto("email")} />
          <CampoEscolha
            {...campo("modalidade")}
            rotulo="Modalidade Caixa"
            valor={c.modalidade}
            vazio="Não informada"
            opcoes={MODALIDADES.map((m) => ({ valor: m.codigo, rotulo: m.nome }))}
            aoMudar={(v) => s.agendar("modalidade", v)}
          />
        </div>
        <CampoEscolha
          {...campo("corretorId")}
          rotulo="Corretor parceiro ou cliente direto"
          valor={c.corretorId}
          vazio="Cliente direto (sem corretor)"
          opcoes={[...corretores].sort((a, b) => a.nome.localeCompare(b.nome)).map((k) => ({ valor: k.id, rotulo: k.imobiliaria ? `${k.nome} · ${k.imobiliaria}` : k.nome }))}
          aoMudar={(v) => {
            s.agendar("corretorId", v);
            void s.agora();
          }}
        />
      </Secao>

      <Secao titulo="Valores do financiamento Caixa">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDinheiro {...campo("valorImovelCentavos")} rotulo="Valor do imóvel (compra e venda)" valor={c.valorImovelCentavos} aoMudar={(v) => s.agendar("valorImovelCentavos", v)} />
          <CampoDinheiro {...campo("valorFinanciadoCentavos")} rotulo="Valor financiado" valor={c.valorFinanciadoCentavos} aoMudar={(v) => s.agendar("valorFinanciadoCentavos", v)} />
          <CampoDinheiro {...campo("valorAvaliacaoCentavos")} rotulo="Valor de avaliação Caixa" valor={c.valorAvaliacaoCentavos} aoMudar={(v) => s.agendar("valorAvaliacaoCentavos", v)} />
          <CampoDinheiro {...campo("entradaCentavos")} rotulo="Recursos próprios / entrada" valor={c.entradaCentavos} aoMudar={(v) => s.agendar("entradaCentavos", v)} />
          <CampoDinheiro {...campo("fgtsCentavos")} rotulo="FGTS utilizado" valor={c.fgtsCentavos} aoMudar={(v) => s.agendar("fgtsCentavos", v)} />
          <CampoDinheiro {...campo("subsidioCentavos")} rotulo="Subsídio" valor={c.subsidioCentavos} aoMudar={(v) => s.agendar("subsidioCentavos", v)} />
          <CampoTexto {...campo("numeroContrato")} rotulo="Nº do contrato / proposta" valor={c.numeroContrato} aoMudar={texto("numeroContrato")} />
          <CampoTexto
            {...campo("dataAssinatura")}
            rotulo="Data da assinatura do contrato"
            tipo="date"
            valor={c.dataAssinatura}
            aoMudar={(v) => {
              s.agendar("dataAssinatura", v);
              void s.agora();
            }}
          />
        </div>
        <Calculo c={c} ficha={ficha} />
        {ehGestor && ficha.remuneracao && <Remuneracao conta={conta} c={c} ficha={ficha} pode={pode} />}
      </Secao>

      <Secao titulo="Andamento">
        <CampoEscolha
          {...campo("etapa")}
          rotulo="Etapa do processo"
          valor={c.etapa}
          opcoes={ETAPAS.map((e) => ({ valor: e.codigo, rotulo: e.nome }))}
          aoMudar={(v) => {
            if (!v) return;
            s.agendar("etapa", v);
            void s.agora();
          }}
        />
        <CampoTexto {...campo("observacoes")} rotulo="Observações" multilinha valor={c.observacoes} aoMudar={texto("observacoes")} />
      </Secao>

      <Documentos conta={conta} ficha={ficha} podeGravar={pode} />

      <Secao titulo={f.length ? `Cobrança · faltam ${f.length}` : "Mensagem para o cliente"}>
        {cob && (
          <p className={cn("text-sm", cob.vence ? "text-perigo" : "text-texto-2")}>
            {cob.texto}
            {c.qtdCobrancas ? ` · já cobrado ${c.qtdCobrancas}x` : ""}
          </p>
        )}
        <pre className="whitespace-pre-wrap rounded-lg border border-borda bg-superficie-sutil p-3 font-sans text-sm text-texto">{mensagemCliente(c)}</pre>
        <div className="flex flex-wrap items-center gap-2">
          <BotaoCobrar cliente={c} desativado={!pode} />
          {aberta && (
            <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={() => perguntar(c.id)}>
              Cobrança aberta: enviou?
            </Botao>
          )}
        </div>
        <p className="text-xs text-texto-2">
          {c.whatsapp
            ? "Abre a conversa com o cliente já com a mensagem escrita. Ao voltar, o app pergunta se você enviou."
            : "Preencha o WhatsApp do cliente em Dados do cliente para enviar com um toque."}
        </p>
        {f.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              {...campo("proximaCobranca")}
              rotulo="Próxima cobrança"
              tipo="date"
              valor={c.proximaCobranca ?? hoje}
              aoMudar={(v) => {
                s.agendar("proximaCobranca", v);
                void s.agora();
              }}
            />
            <CampoEscolha
              {...campo("intervaloCobranca")}
              rotulo="Cobrar de novo a cada"
              valor={String(c.intervaloCobranca)}
              opcoes={INTERVALOS.map((n) => ({ valor: String(n), rotulo: `${n} dia${n === 1 ? "" : "s"}` }))}
              aoMudar={(v) => {
                s.agendar("intervaloCobranca", Number(v));
                void s.agora();
              }}
            />
          </div>
        )}
        {c.ultimaCobranca && (
          <p className="text-xs text-texto-2">
            Última cobrança: {dataCurtaHora(c.ultimaCobranca)} (há {diasDesde(c.ultimaCobranca, agora)} dia{diasDesde(c.ultimaCobranca, agora) === 1 ? "" : "s"})
          </p>
        )}
      </Secao>

      <Historico conta={conta} ficha={ficha} pode={pode} />

      {pode && <Excluir conta={conta} id={c.id} aoExcluir={() => {
        qc.removeQueries({ queryKey: chavesEscritorio.ficha(conta, c.id) });
        recarregarCliente(qc, conta);
        aoExcluir();
      }} />}
    </>
  );
}

/** Cota e, para a gestora, percentual e remuneração (RN-08 a RN-10, vindos da view). */
function Calculo({ c, ficha }: { c: ClienteLista; ficha: TFicha }) {
  const cota = c.valorImovelCentavos && c.valorFinanciadoCentavos != null ? (c.valorFinanciadoCentavos / c.valorImovelCentavos) * 100 : null;
  const r = ficha.remuneracao;
  const origemPct = r ? (r.pctProprio != null ? " (próprio)" : r.pctContrato != null ? " (do contrato)" : " (atual)") : "";
  return (
    <dl className="grid grid-cols-1 gap-2 rounded-lg border border-borda bg-superficie-sutil p-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-xs text-texto-2">Cota financiada</dt>
        <dd className="font-mono-tabular">{cota == null ? "—" : formatarPercentual(Math.round(cota * 1000) / 1000)}</dd>
      </div>
      {r && (
        <>
          <div>
            <dt className="text-xs text-texto-2">Percentual usado</dt>
            <dd className="font-mono-tabular">
              {formatarPercentual(r.pctUsado)}
              {origemPct}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-texto-2">Remuneração</dt>
            <dd className="font-mono-tabular">{r.remuneracaoCentavos == null ? "—" : formatarReais(r.remuneracaoCentavos)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}

function Remuneracao({ conta, c, ficha, pode }: { conta: string; c: ClienteLista; ficha: TFicha; pode: boolean }) {
  const qc = useQueryClient();
  const r = ficha.remuneracao!;
  const [erro, setErro] = useState("");
  const fila = useMemo(
    () =>
      new FilaSalvamento(async (campos) => {
        try {
          await api(`/api/contas/${conta}/clientes/${c.id}/remuneracao`, { method: "PATCH", body: campos });
          setErro("");
          void qc.invalidateQueries({ queryKey: chavesEscritorio.ficha(conta, c.id) });
        } catch (e) {
          setErro("Percentual inválido: use de 0 a 100, com até 3 casas.");
          throw e;
        }
      }),
    [conta, c.id, qc],
  );
  useEffect(() => () => void fila.descarregar().catch(() => undefined), [fila]);
  const pctTexto = r.pctProprio == null ? "" : String(r.pctProprio).replace(".", ",");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CampoTexto
        id="f-pctProprio"
        rotulo="Percentual próprio (%)"
        modo="numeric"
        valor={pctTexto}
        desativado={!pode}
        erro={erro}
        dica={`Vazio = ${formatarPercentual(r.pctContrato ?? r.pctUsado)}`}
        aoMudar={(v) => {
          const t = v.trim().replace(",", ".");
          fila.agendar("pctProprio", t === "" ? null : Number(t));
        }}
      />
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--acento)]"
          checked={!!r.recebidaEm}
          disabled={!pode}
          onChange={(e) => {
            fila.agendar("recebidaEm", e.target.checked ? hojeBr() : null);
            void fila.descarregar().catch(() => undefined);
          }}
        />
        Remuneração recebida{r.recebidaEm ? ` em ${dataBr(r.recebidaEm)}` : ""}
      </label>
    </div>
  );
}

function Historico({ conta, ficha, pode }: { conta: string; ficha: TFicha; pode: boolean }) {
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const anotar = useMutation({
    mutationFn: (textoNota: string) => api(`/api/contas/${conta}/clientes/${ficha.cliente.id}/historico`, { body: { texto: textoNota } }),
    onSuccess: () => {
      if (entrada.current) entrada.current.value = "";
      recarregarCliente(qc, conta, ficha.cliente.id);
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const v = entrada.current?.value.trim();
    if (v) anotar.mutate(v);
  };
  return (
    <Secao titulo="Histórico">
      {pode && (
        <form onSubmit={enviar} className="flex gap-2">
          <input ref={entrada} aria-label="Anotar atualização" placeholder="Anotar atualização (ex.: enviado para conformidade)" className={classeEntrada} />
          <Botao type="submit" variante="secundario" carregando={anotar.isPending}>
            Anotar
          </Botao>
        </form>
      )}
      {anotar.isError && <Aviso tom="erro">Não foi possível anotar.</Aviso>}
      <ul className="flex flex-col divide-y divide-borda">
        {ficha.historico.map((h) => (
          <li key={h.id} className="flex gap-3 py-2 text-sm">
            <time className="font-mono-tabular shrink-0 text-xs leading-5 text-texto-2">{dataCurtaHora(h.criadoEm)}</time>
            <span className="text-texto">{h.texto}</span>
          </li>
        ))}
        {!ficha.historico.length && <li className="py-2 text-sm text-texto-2">Sem registros.</li>}
      </ul>
    </Secao>
  );
}

/** RF-18: excluir com confirmação em dois cliques. */
function Excluir({ conta, id, aoExcluir }: { conta: string; id: string; aoExcluir: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const excluir = useMutation({ mutationFn: () => api(`/api/contas/${conta}/clientes/${id}`, { method: "DELETE" }), onSuccess: aoExcluir });
  return (
    <div className="flex flex-col gap-2">
      {excluir.isError && <Aviso tom="erro">Não foi possível excluir.</Aviso>}
      <Botao variante="perigo" className="self-start" carregando={excluir.isPending} onClick={() => (confirmando ? excluir.mutate() : setConfirmando(true))}>
        {confirmando ? "Confirmar exclusão do cliente" : "Excluir cliente"}
      </Botao>
    </div>
  );
}
