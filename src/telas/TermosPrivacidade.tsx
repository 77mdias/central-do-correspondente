import { Link } from "react-router";
import { Marca } from "@/componentes/ui";

function CabecalhoLegal({ titulo }: { titulo: string }) {
  return (
    <header className="border-b border-borda bg-superficie">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2.5 text-sm font-medium text-texto">
          <Marca />
          <span>Central do Correspondente</span>
        </Link>
        <nav aria-label={titulo} className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-texto-2 hover:text-texto">Voltar</Link>
          <Link to="/criar-escritorio" className="font-medium text-acento hover:underline">Assinar plano</Link>
        </nav>
      </div>
    </header>
  );
}

export function Termos() {
  return (
    <div className="min-h-dvh bg-fundo text-texto">
      <CabecalhoLegal titulo="Navegação de Termos de Uso" />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <p className="font-mono-tabular text-xs uppercase tracking-wider text-texto-2">Versão provisória · Central do Correspondente</p>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">Termos de Uso</h1>
        <section className="flex flex-col gap-3 text-base leading-relaxed text-texto-2">
          <h2 className="text-lg font-medium text-texto">1. Objeto do serviço</h2>
          <p>
            A Central do Correspondente é uma ferramenta operacional para correspondentes bancários habitacionais acompanharem processos em 10 etapas, documentos, cobranças via link wa.me com confirmação e cálculo interno de VGV.
          </p>
          <p>
            O aplicativo não possui integração com sistemas da Caixa Econômica Federal, não simula crédito habitacional e não realiza disparos automáticos pela API oficial do WhatsApp.
          </p>
          <h2 className="mt-2 text-lg font-medium text-texto">2. Planos e inadimplência</h2>
          <p>
            A assinatura mensal via Asaas oferece os planos Simples (R$ 99/mês, 1 acesso de gestor) e Com corretores (R$ 149/mês, gestor, 1 funcionária e corretores ilimitados com portal). Em atraso, a conta entra em tolerância de 7 dias antes de passar ao modo somente leitura.
          </p>
          <h2 className="mt-2 text-lg font-medium text-texto">3. Troca e cancelamento</h2>
          <p>
            A alteração de plano tem efeito imediato e o novo valor é aplicado na próxima cobrança mensal. Não há multa rescisória ou fidelidade mínima.
          </p>
        </section>
      </main>
    </div>
  );
}

export function Privacidade() {
  return (
    <div className="min-h-dvh bg-fundo text-texto">
      <CabecalhoLegal titulo="Navegação de Privacidade" />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <p className="font-mono-tabular text-xs uppercase tracking-wider text-texto-2">LGPD e Sigilo · Central do Correspondente</p>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">Política de Privacidade</h1>
        <section className="flex flex-col gap-3 text-base leading-relaxed text-texto-2">
          <h2 className="text-lg font-medium text-texto">1. Isolamento de dados por escritório e perfil</h2>
          <p>
            Cada conta mantém seus processos e documentos isolados por políticas Row-Level Security (RLS) no banco Postgres. Funcionárias e corretores parceiros não têm acesso a percentuais de comissão nem ao VGV financeiro do gestor.
          </p>
          <h2 className="mt-2 text-lg font-medium text-texto">2. Retenção e expurgo de documentos</h2>
          <p>
            Trinta dias após a marcação de contrato assinado ou cancelado, os anexos dos compradores são removidos automaticamente do storage privado, mediante aviso prévio de 5 dias dentro do aplicativo. A ficha resumida e a trilha de auditoria permanecem registradas.
          </p>
          <h2 className="mt-2 text-lg font-medium text-texto">3. Armazenamento e downloads privados</h2>
          <p>
            Os PDFs trafegam por links temporários privados vinculados à sessão autenticada do usuário autorizado no escritório correspondente.
          </p>
        </section>
      </main>
    </div>
  );
}
