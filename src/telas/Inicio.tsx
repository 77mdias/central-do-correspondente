import { Link, useOutletContext } from "react-router";
import { Cartao } from "@/componentes/ui";
import { ROTULO_PERFIL } from "@/regras/rotulos";
import type { EscritorioResumo } from "@/tipos-api";

export function Inicio() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const ehGestor = escritorio.perfil === "gestor";

  const indicadores = [
    { titulo: "Cobrar hoje", valor: "0", detalhe: "Fila diária via wa.me com confirmação" },
    { titulo: "Parados há 7+ dias", valor: "0", detalhe: "Processos sem retorno ou anexo" },
    { titulo: "Docs pendentes", valor: "0 / 12", detalhe: "Checklist de comprador e imóvel" },
    ...(ehGestor
      ? [{ titulo: "VGV no período", valor: "R$ 0,00", detalhe: "Taxa congelada na assinatura" }]
      : []),
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-5">
        <div className="flex flex-col gap-1">
          <p className="font-mono-tabular text-xs uppercase tracking-wider text-texto-2">
            Mesa de controle · {ROTULO_PERFIL[escritorio.perfil]}
          </p>
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">{escritorio.nomeEscritorio}</h1>
          <p className="text-sm text-texto-2">
            Em breve aqui: as cobranças do dia, os processos parados e os documentos que faltam.
          </p>
        </div>
        {ehGestor && (
          <Link
            to={`/e/${escritorio.contaId}/equipe`}
            className="inline-flex min-h-10 items-center rounded-lg border border-borda bg-superficie px-3.5 text-sm font-medium text-texto transition-colors hover:border-borda-campo hover:bg-superficie-sutil"
          >
            Configurar membros
          </Link>
        )}
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${ehGestor ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {indicadores.map((item) => (
          <Cartao key={item.titulo} className="flex flex-col gap-2 p-5">
            <span className="font-mono-tabular text-xs uppercase tracking-wide text-texto-2">{item.titulo}</span>
            <strong className="font-mono-tabular text-2xl font-medium tracking-tight text-texto">{item.valor}</strong>
            <span className="text-xs text-texto-2">{item.detalhe}</span>
          </Cartao>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Cartao className="flex flex-col gap-3 p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-borda pb-3">
            <h2 className="text-base font-medium text-texto">Fila do dia</h2>
            <span className="font-mono-tabular text-xs text-texto-2">10 etapas · Lembrete 08:00</span>
          </div>
          <p className="text-sm text-texto-2">
            Base multi-escritório pronta (autenticação, sigilo RLS e gestão de equipe). Na Fase 2 entram o cadastro de compradores, a cobrança guiada via WhatsApp e o checklist de 12 documentos.
          </p>
        </Cartao>

        <Cartao className="flex flex-col gap-3 p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-borda pb-3">
            <h2 className="text-base font-medium text-texto">Regras ativas da conta</h2>
            <span className="font-mono-tabular text-xs text-acento">
              {escritorio.ativa ? "Ativa" : "Somente leitura"}
            </span>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-texto-2">
            <li className="flex items-center justify-between gap-2">
              <span>Plano contratado</span>
              <span className="font-mono-tabular font-medium text-texto">
                {escritorio.plano === "com_corretores" ? "Com corretores (R$ 149)" : "Simples (R$ 99)"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Sigilo de receita (RLS)</span>
              <span className="font-mono-tabular font-medium text-texto">
                {ehGestor ? "Visível ao gestor" : "Oculto por perfil"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Expurgo de PDFs</span>
              <span className="font-mono-tabular font-medium text-texto">30 dias pós-conclusão</span>
            </li>
          </ul>
        </Cartao>
      </div>
    </section>
  );
}
