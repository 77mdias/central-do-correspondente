import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { api, ErroApi } from "@/api";
import { CampoTexto, classeEntrada } from "@/componentes/campos";
import { OssosLista } from "@/componentes/Esqueleto";
import { errosPorCampo, mensagemDeErro } from "@/componentes/formulario";
import { PainelLateral } from "@/componentes/PainelLateral";
import { Aviso, Botao, Campo, Cartao } from "@/componentes/ui";
import { chavesEscritorio, useClientes, useCorretores } from "@/consultas-escritorio";
import { cn } from "@/lib/cn";
import { FilaSalvamento } from "@/lib/salvamento";
import { hojeBr } from "@/regras/datas";
import { formatarReaisCurto } from "@/regras/dinheiro";
import { esquemaCorretor } from "@/regras/esquemas";
import { linkWhatsApp, mensagemCorretor } from "@/regras/mensagens";
import { contratado, daOrigem, resumo } from "@/regras/processo";
import type { ClienteLista, Corretor, EscritorioResumo } from "@/tipos-api";

const ACESSO = { sem_acesso: "Sem acesso ao portal", convidado: "Convidado", ativo: "Acesso ativo" } as const;

/** Corretores parceiros (RF-40 a RF-45), como no protótipo: cadastro, busca e um card por origem. */
export function Corretores() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const conta = escritorio.contaId;
  const corretores = useCorretores(conta);
  const clientes = useClientes(conta).data ?? [];
  const [busca, setBusca] = useState("");
  const [params, setParams] = useSearchParams();
  const aberto = params.get("corretor");
  const modo = params.get("modo") === "cobranca" ? "cobranca" : "editar";
  const ks = [...(corretores.data ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
  const q = busca.trim().toLowerCase();
  const visiveis = ks.filter((k) => !q || [k.nome, k.imobiliaria ?? "", k.creci ?? ""].join(" ").toLowerCase().includes(q));
  const abrir = (id: string, m: "editar" | "cobranca") => setParams({ corretor: id, modo: m });
  const fechar = () => setParams({});
  const k = ks.find((x) => x.id === aberto);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-borda pb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">Corretores parceiros</h1>
        <p className="text-sm text-texto-2">Toque em um corretor para ver os clientes dele</p>
      </div>

      {escritorio.ativa && <Cadastro conta={conta} />}

      <input type="search" aria-label="Buscar corretor" placeholder="Buscar corretor ou imobiliária" value={busca} onChange={(e) => setBusca(e.target.value)} className={cn(classeEntrada, "max-w-md")} />

      {corretores.isPending ? (
        <OssosLista />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {!q && <CardOrigem escritorio={escritorio} id="diretos" corretor={null} clientes={clientes} />}
          {visiveis.map((x) => (
            <CardOrigem key={x.id} escritorio={escritorio} id={x.id} corretor={x} clientes={clientes} aoAbrir={abrir} />
          ))}
          {!ks.length && <p className="text-sm text-texto-2 md:col-span-2">Nenhum corretor parceiro cadastrado ainda. Use o formulário acima.</p>}
          {ks.length > 0 && q && !visiveis.length && <p className="text-sm text-texto-2">Nenhum corretor encontrado.</p>}
        </div>
      )}

      <PainelLateral aberto={!!k} aoFechar={fechar} titulo={k ? (modo === "cobranca" ? `Cobrança para ${k.nome}` : k.nome) : "Corretor"}>
        {k && (modo === "cobranca" ? <CobrancaCorretor corretor={k} clientes={clientes} /> : <FichaCorretor key={k.id} escritorio={escritorio} corretor={k} clientes={clientes} aoRemover={fechar} />)}
      </PainelLateral>
    </section>
  );
}

function Cadastro({ conta }: { conta: string }) {
  const qc = useQueryClient();
  const [erros, setErros] = useState<Record<string, string>>({});
  const criar = useMutation({
    mutationFn: (d: unknown) => api<{ id: string }>(`/api/contas/${conta}/corretores`, { body: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesEscritorio.corretores(conta) }),
  });
  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const v = esquemaCorretor.safeParse({ nome: f.get("nome"), imobiliaria: f.get("imobiliaria"), whatsapp: f.get("whatsapp"), creci: f.get("creci") });
    if (!v.success) return setErros(errosPorCampo(v.error));
    setErros({});
    criar.mutate(v.data, { onSuccess: () => form.reset() });
  }
  return (
    <Cartao className="p-5">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Cadastrar corretor parceiro</h2>
        {criar.isError && <Aviso tom="erro">{mensagemDeErro(criar.error)}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="k-nome" name="nome" rotulo="Nome do corretor" placeholder="Ex.: Ana Paula Souza" erro={erros.nome} />
          <Campo id="k-casa" name="imobiliaria" rotulo="Imobiliária / casa" placeholder="Ex.: Imobiliária Central" erro={erros.imobiliaria} />
          <Campo id="k-tel" name="whatsapp" rotulo="WhatsApp" inputMode="tel" placeholder="(18) 99999-9999" erro={erros.whatsapp} />
          <Campo id="k-creci" name="creci" rotulo="CRECI" placeholder="Ex.: 123456-F" erro={erros.creci} />
        </div>
        <Botao type="submit" className="self-start" carregando={criar.isPending}>
          Cadastrar corretor
        </Botao>
      </form>
    </Cartao>
  );
}

/** RF-41 / RF-42: ativos, contratados, VGV ativo (só gestora) e os alertas. */
function CardOrigem({
  escritorio,
  id,
  corretor,
  clientes,
  aoAbrir,
}: { escritorio: EscritorioResumo; id: string; corretor: Corretor | null; clientes: ClienteLista[]; aoAbrir?: (id: string, m: "editar" | "cobranca") => void }) {
  const cs = clientes.filter((c) => daOrigem(c, id));
  const r = resumo(cs, hojeBr(), new Date());
  const contr = cs.filter(contratado).length;
  const ehGestor = escritorio.perfil === "gestor";
  return (
    <article className={cn("flex flex-col gap-3 rounded-xl border bg-superficie p-4", corretor ? "border-borda" : "border-dashed border-borda-campo/40")}>
      <div className="flex flex-col">
        <h3 className="text-base font-medium">{corretor ? corretor.nome : "Clientes diretos"}</h3>
        {corretor ? (
          <>
            <span className="text-sm text-texto-2">{corretor.imobiliaria ?? "Imobiliária não informada"}</span>
            <span className="text-xs text-texto-2">
              {corretor.creci ? `CRECI ${corretor.creci} · ` : ""}
              <span className="font-mono-tabular">{corretor.whatsapp ?? "sem WhatsApp"}</span>
            </span>
          </>
        ) : (
          <span className="text-sm text-texto-2">Clientes sem corretor parceiro</span>
        )}
      </div>
      <dl className={cn("grid gap-2 text-center", ehGestor ? "grid-cols-3" : "grid-cols-2")}>
        <div className="rounded-lg bg-superficie-sutil p-2">
          <dt className="text-[11px] uppercase text-texto-2">Ativos</dt>
          <dd className="font-mono-tabular text-lg">{r.ativos}</dd>
        </div>
        <div className="rounded-lg bg-superficie-sutil p-2">
          <dt className="text-[11px] uppercase text-texto-2">Contratados</dt>
          <dd className="font-mono-tabular text-lg">{contr}</dd>
        </div>
        {ehGestor && (
          <div className="rounded-lg bg-superficie-sutil p-2">
            <dt className="text-[11px] uppercase text-texto-2">VGV ativo</dt>
            <dd className="font-mono-tabular text-lg">{formatarReaisCurto(r.vgvAtivoCentavos)}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {r.hoje > 0 && <span className="rounded-full bg-acento-suave px-2 py-0.5 text-acento">{r.hoje} p/ cobrar</span>}
        {r.pendentes > 0 && <span className="rounded-full bg-aviso-fundo px-2 py-0.5 text-aviso-texto">{r.pendentes} c/ pendência</span>}
        {r.parados > 0 && (
          <span className="rounded-full border border-perigo px-2 py-0.5 text-perigo">
            {r.parados} parado{r.parados === 1 ? "" : "s"}
          </span>
        )}
        {!r.hoje && !r.pendentes && !r.parados && <span className="text-texto-2">Tudo em dia</span>}
        {corretor && escritorio.plano === "com_corretores" && <span className="rounded-full bg-superficie-sutil px-2 py-0.5 text-texto-2">{ACESSO[corretor.acesso]}</span>}
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link
          to={`/e/${escritorio.contaId}/clientes?origem=${id}&card=todos`}
          className="inline-flex min-h-9 items-center rounded-lg bg-marca px-3 text-xs font-medium text-marca-texto hover:bg-marca-forte"
        >
          Ver {cs.length} cliente{cs.length === 1 ? "" : "s"}
        </Link>
        {corretor && aoAbrir && (
          <>
            <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={() => aoAbrir(corretor.id, "editar")}>
              Editar
            </Botao>
            <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={() => aoAbrir(corretor.id, "cobranca")}>
              Cobrança
            </Botao>
          </>
        )}
      </div>
    </article>
  );
}

const ERROS_CONVITE: Record<string, string> = {
  limite_plano: "O portal do corretor faz parte do plano Com corretores.",
  ja_membro: "Esse e-mail já tem acesso a este escritório.",
  sem_permissao: "Esta conta não pode convidar agora.",
};

function FichaCorretor({ escritorio, corretor, clientes, aoRemover }: { escritorio: EscritorioResumo; corretor: Corretor; clientes: ClienteLista[]; aoRemover: () => void }) {
  const conta = escritorio.contaId;
  const qc = useQueryClient();
  const pode = escritorio.ativa;
  const [erros, setErros] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState(false);
  const n = clientes.filter((c) => c.corretorId === corretor.id).length;
  const recarregar = () => qc.invalidateQueries({ queryKey: chavesEscritorio.corretores(conta) });

  const fila = useMemo(
    () =>
      new FilaSalvamento(async (campos) => {
        try {
          await api(`/api/contas/${conta}/corretores/${corretor.id}`, { method: "PATCH", body: campos });
          setErros({});
          void recarregar();
        } catch (e) {
          if (e instanceof ErroApi) setErros(Object.fromEntries((e.campos.length ? e.campos : Object.keys(campos)).map((k) => [k, "Valor inválido"])));
          throw e;
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conta, corretor.id],
  );
  useEffect(() => () => void fila.descarregar().catch(() => undefined), [fila]);

  const convidar = useMutation({
    mutationFn: () => api(`/api/contas/${conta}/convites`, { body: { email: corretor.email, perfil: "corretor", corretorId: corretor.id } }),
    onSuccess: recarregar,
  });
  const remover = useMutation({
    mutationFn: () => api(`/api/contas/${conta}/corretores/${corretor.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void recarregar();
      aoRemover();
    },
  });
  const campo = (k: keyof Corretor, rotulo: string, extra: Partial<Parameters<typeof CampoTexto>[0]> = {}) => (
    <CampoTexto id={`k-${k}`} rotulo={rotulo} valor={corretor[k] as string | null} erro={erros[k]} desativado={!pode} aoMudar={(v) => fila.agendar(k, v)} {...extra} />
  );

  return (
    <>
      <section className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
        <h3 className="text-sm font-medium">Dados do corretor parceiro</h3>
        {campo("nome", "Nome")}
        <div className="grid gap-3 sm:grid-cols-2">
          {campo("imobiliaria", "Imobiliária / casa")}
          {campo("creci", "CRECI")}
          {campo("whatsapp", "WhatsApp", { modo: "tel" })}
          {campo("email", "E-mail", { tipo: "email" })}
        </div>
        <p className="text-xs text-texto-2">Alterações são salvas automaticamente.</p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
        <h3 className="text-sm font-medium">Portal do corretor</h3>
        {escritorio.plano !== "com_corretores" ? (
          <p className="text-sm text-texto-2">O portal, em que o corretor acompanha e anexa documentos dos clientes dele, faz parte do plano Com corretores.</p>
        ) : (
          <>
            <p className="text-sm">
              Situação: <b className="font-medium">{ACESSO[corretor.acesso]}</b>
            </p>
            {convidar.isError && <Aviso tom="erro">{(convidar.error instanceof ErroApi && ERROS_CONVITE[convidar.error.codigo]) || mensagemDeErro(convidar.error)}</Aviso>}
            {convidar.isSuccess && <Aviso tom="ok">Convite enviado para {corretor.email}.</Aviso>}
            {corretor.acesso === "sem_acesso" &&
              (corretor.email ? (
                <Botao className="self-start" carregando={convidar.isPending} disabled={!pode} onClick={() => convidar.mutate()}>
                  Convidar para o portal
                </Botao>
              ) : (
                <p className="text-sm text-texto-2">Preencha o e-mail do corretor para convidar.</p>
              ))}
            {corretor.acesso === "convidado" && <p className="text-xs text-texto-2">O convite vale 7 dias. Reenvie ou cancele em Equipe e acessos.</p>}
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/e/${conta}/clientes?origem=${corretor.id}&card=todos`}
          className="inline-flex min-h-11 items-center rounded-lg bg-marca px-4 text-sm font-medium text-marca-texto hover:bg-marca-forte"
        >
          Ver {n} cliente{n === 1 ? "" : "s"}
        </Link>
        {pode &&
          (n ? (
            <span className="text-xs text-texto-2">
              Para remover este corretor, transfira antes {n === 1 ? "o cliente" : `os ${n} clientes`} dele.
            </span>
          ) : (
            <Botao variante="perigo" carregando={remover.isPending} onClick={() => (confirmar ? remover.mutate() : setConfirmar(true))}>
              {confirmar ? "Confirmar remoção" : "Remover corretor"}
            </Botao>
          ))}
      </div>
      {remover.isError && (
        <Aviso tom="erro">
          {remover.error instanceof ErroApi && remover.error.codigo === "corretor_com_acesso"
            ? "Este corretor tem acesso ao portal: desative o acesso em Equipe e acessos antes de remover."
            : mensagemDeErro(remover.error)}
        </Aviso>
      )}
    </>
  );
}

/** RF-43: mensagem de situação para o corretor. */
function CobrancaCorretor({ corretor, clientes }: { corretor: Corretor; clientes: ClienteLista[] }) {
  const texto = mensagemCorretor(corretor.nome, clientes.filter((c) => c.corretorId === corretor.id));
  const link = linkWhatsApp(corretor.whatsapp, texto);
  const [copiou, setCopiou] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
      <h3 className="text-sm font-medium">Mensagem pronta</h3>
      <pre className="whitespace-pre-wrap rounded-lg border border-borda bg-superficie-sutil p-3 font-sans text-sm">{texto}</pre>
      <div className="flex flex-wrap gap-2">
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-marca px-4 text-sm font-medium text-marca-texto hover:bg-marca-forte">
            Enviar no WhatsApp
          </a>
        )}
        <Botao
          variante={link ? "secundario" : "primario"}
          onClick={async () => {
            await navigator.clipboard.writeText(texto).catch(() => window.prompt("Copie a mensagem:", texto));
            setCopiou(true);
          }}
        >
          {copiou ? "Copiada" : "Copiar mensagem"}
        </Botao>
      </div>
      {!link && <p className="text-xs text-texto-2">Cadastre o WhatsApp do corretor para enviar com um toque.</p>}
    </section>
  );
}
