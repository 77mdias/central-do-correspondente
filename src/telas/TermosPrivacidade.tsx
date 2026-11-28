import type { ReactNode } from "react";
import { Link } from "react-router";
import { Marca } from "@/componentes/ui";
import { TERMOS_VERSAO } from "@/regras/planos";

// Texto v1 dos Termos de Uso e da Política de Privacidade (RF-67, P-12). Rascunho escrito a partir das
// decisões D-05, D-07, D-08, D-11, D-12, D-21, D-22, D-25 e D-41; precisa da revisão dos sócios, de
// preferência com um advogado, antes de ir ao ar. Os trechos <Pendente> são decisões que só eles tomam.

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

function Pagina({ titulo, rotuloNav, children }: { titulo: string; rotuloNav: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-fundo text-texto">
      <CabecalhoLegal titulo={rotuloNav} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <p className="font-mono-tabular text-xs uppercase tracking-wider text-texto-2">Versão {TERMOS_VERSAO} · Central do Correspondente</p>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">{titulo}</h1>
        <div className="flex flex-col gap-3 text-base leading-relaxed text-texto-2">{children}</div>
      </main>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="mt-2 text-lg font-medium text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

const Lista = ({ children }: { children: ReactNode }) => <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;

/** Decisão que só os sócios tomam (P-12). Nenhum destes pode sobrar quando o texto for publicado. */
function Pendente({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-aviso-fundo px-1 text-aviso-texto">[a preencher pelos sócios: {children}]</mark>;
}

export function Termos() {
  return (
    <Pagina titulo="Termos de Uso" rotuloNav="Navegação de Termos de Uso">
      <Secao titulo="1. Quem somos e o que é o serviço">
        <p>
          A Central do Correspondente é oferecida por <Pendente>razão social, CNPJ e endereço</Pendente> (“nós”). É uma ferramenta de organização
          para correspondentes bancários do crédito habitacional acompanharem os processos dos clientes: etapas, documentos, cobranças de
          documentos pelo WhatsApp e o VGV do escritório.
        </p>
        <p>
          A Central do Correspondente não é da Caixa Econômica Federal nem está ligada a ela. Ela não consulta nem envia dados aos sistemas da
          Caixa, não simula nem aprova crédito, não envia mensagens automáticas pelo WhatsApp (as mensagens saem do seu próprio WhatsApp, quando
          você toca no link) e não cobra os seus clientes: a única cobrança é a assinatura do escritório.
        </p>
      </Secao>

      <Secao titulo="2. Quem usa">
        <p>
          Cada escritório é uma conta, cadastrada pela gestora ou pelo gestor (“gestor”). O gestor pode convidar, conforme o plano, uma
          funcionária e os corretores parceiros. Cada pessoa entra com o próprio e-mail e a própria senha.
        </p>
        <Lista>
          <li>Não compartilhe a sua senha. Tudo o que for feito com o seu acesso é registrado em seu nome.</li>
          <li>O gestor responde pelos convites que envia e deve desativar o acesso de quem deixar de trabalhar com o escritório.</li>
          <li>Ao aceitar um convite, você usa o app em nome do escritório que convidou, que decide o que você pode ver e fazer.</li>
        </Lista>
      </Secao>

      <Secao titulo="3. Planos e pagamento">
        <p>
          A assinatura é mensal, por escritório: plano Simples (R$ 99 por mês, só o gestor; corretores ficam como cadastro, sem acesso) ou plano
          Com corretores (R$ 149 por mês, gestor, uma funcionária e corretores ilimitados com acesso ao portal). A cobrança é feita pelo Asaas, nas
          formas de pagamento oferecidas no momento da assinatura.
        </p>
        <p>
          Se o pagamento atrasar, há 7 dias de tolerância. Depois disso, a conta fica somente para leitura até o pagamento ser confirmado: dá para
          consultar tudo, mas nada pode ser cadastrado ou alterado. Nada é apagado por falta de pagamento.
        </p>
        <p>
          A troca de plano vale na hora, e o novo valor entra na próxima cobrança. Ao voltar para o plano Simples, os acessos da funcionária e dos
          corretores são desativados.
        </p>
      </Secao>

      <Secao titulo="4. Cancelamento">
        <p>Não há fidelidade nem multa: o escritório pode cancelar a assinatura quando quiser.</p>
        <p>
          Depois do cancelamento: <Pendente>por quanto tempo os dados do escritório ficam guardados, como o gestor pode exportá-los antes e
          quando são apagados</Pendente>.
        </p>
      </Secao>

      <Secao titulo="5. Os dados dos seus clientes">
        <p>
          O escritório decide quais dados dos clientes cadastra e para quê. Na Lei Geral de Proteção de Dados (LGPD), o escritório é o{" "}
          <b className="font-medium text-texto">controlador</b> desses dados, e nós somos <b className="font-medium text-texto">operadores</b>:
          tratamos os dados só para prestar o serviço, conforme a <Link to="/privacidade" className="text-acento hover:underline">Política de Privacidade</Link>.
        </p>
        <p>
          Cabe ao escritório ter base legal para tratar os dados dos clientes e informá-los de que os dados e documentos ficam guardados neste app e
          são compartilhados com o corretor parceiro que os indicou.
        </p>
      </Secao>

      <Secao titulo="6. Uso aceitável">
        <Lista>
          <li>Use o app só para acompanhar os processos do escritório.</li>
          <li>Não tente acessar dados de outro escritório, de outro corretor ou que o seu perfil não permite ver.</li>
          <li>Não envie arquivos que não sejam documentos dos processos nem conteúdo ilegal.</li>
        </Lista>
        <p>Podemos suspender o acesso de quem descumprir estes termos.</p>
      </Secao>

      <Secao titulo="7. Disponibilidade e responsabilidade">
        <p>
          Trabalhamos para manter o app no ar e fazemos cópia de segurança diária do banco de dados, mas não garantimos funcionamento sem
          interrupções. O app organiza o trabalho do escritório; as decisões sobre os processos e o contato com os clientes e com a Caixa continuam
          sendo do escritório.
        </p>
        <p>
          <Pendente>limites de responsabilidade, revisados por advogado</Pendente>
        </p>
      </Secao>

      <Secao titulo="8. Mudanças nestes termos">
        <p>
          Quando estes termos ou a Política de Privacidade mudarem, publicamos uma nova versão e pedimos um novo aceite no próximo acesso. Guardamos
          a versão aceita e a data do aceite de cada pessoa.
        </p>
      </Secao>

      <Secao titulo="9. Contato e foro">
        <p>
          Dúvidas sobre estes termos: <Pendente>e-mail de contato</Pendente>. Foro: <Pendente>comarca</Pendente>.
        </p>
      </Secao>
    </Pagina>
  );
}

export function Privacidade() {
  return (
    <Pagina titulo="Política de Privacidade" rotuloNav="Navegação de Privacidade">
      <Secao titulo="1. Quem é responsável por quais dados">
        <Lista>
          <li>
            <b className="font-medium text-texto">Dados dos clientes e dos corretores cadastrados por um escritório:</b> o escritório é o controlador
            e nós somos operadores. Tratamos esses dados só para prestar o serviço ao escritório.
          </li>
          <li>
            <b className="font-medium text-texto">Dados de quem usa o app</b> (gestor, funcionária e corretor com acesso): nós somos os controladores,
            para criar e proteger o seu acesso e prestar o serviço.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="2. Que dados guardamos">
        <Lista>
          <li>De quem usa o app: nome, e-mail, senha (guardada só de forma cifrada, sem como ser lida), versão e data do aceite destes termos e o registro de quem abriu uma ficha ou baixou um arquivo.</li>
          <li>Do escritório: nome, CPF ou CNPJ do titular e o plano.</li>
          <li>Dos clientes do escritório: nome, CPF, WhatsApp, e-mail, modalidade, valores do financiamento, etapa, número e data do contrato, observações, histórico do processo e os documentos anexados.</li>
          <li>Dos corretores parceiros: nome, imobiliária, WhatsApp, e-mail e CRECI.</li>
        </Lista>
      </Secao>

      <Secao titulo="3. Para que usamos">
        <Lista>
          <li>Prestar o serviço: mostrar os processos, os documentos e as cobranças a quem o escritório autorizou.</li>
          <li>Enviar os e-mails do serviço: confirmação de cadastro, convite, recuperação de senha e o aviso antes de apagar anexos.</li>
          <li>Segurança: controlar quem vê o quê e registrar quem abriu fichas, baixou arquivos e alterou dados.</li>
          <li>Cobrar a assinatura do escritório.</li>
        </Lista>
        <p>Não vendemos dados, não usamos os dados dos clientes para publicidade e não os compartilhamos com a Caixa.</p>
      </Secao>

      <Secao titulo="4. Quem vê o quê">
        <Lista>
          <li>Cada escritório só vê os próprios dados. Uma pessoa que atende mais de um escritório vê cada um separadamente.</li>
          <li>A funcionária vê e edita os processos, mas não vê percentuais, remunerações nem o VGV de comissões.</li>
          <li>
            O corretor parceiro vê só os clientes que ele indicou: dados de contato, modalidade, etapa, valor do imóvel e do financiamento, o checklist
            com os documentos anexados e o histórico de mudanças de etapa e de anexos. Ele pode anexar documentos. Ele não vê CPF, observações,
            dados do contrato, cobranças, percentuais nem remunerações.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="5. Onde os dados ficam e com quem compartilhamos">
        <p>
          O banco de dados e os documentos anexados ficam guardados em servidores no Brasil (São Paulo). Para prestar o serviço, usamos estes
          fornecedores, que tratam os dados em nosso nome:
        </p>
        <Lista>
          <li>Supabase: banco de dados e armazenamento dos documentos, em São Paulo.</li>
          <li>Cloudflare: hospedagem do app; os pedidos feitos pelo navegador passam pela rede dela.</li>
          <li>Resend: envio dos e-mails do serviço (só o e-mail de destino e o texto da mensagem).</li>
          <li>Asaas: cobrança da assinatura (só os dados do escritório que paga).</li>
        </Lista>
        <p>
          <Pendente>conferir com advogado se a passagem dos pedidos pela Cloudflare e o envio pela Resend exigem cláusula de transferência
          internacional (LGPD, art. 33)</Pendente>
        </p>
      </Secao>

      <Secao titulo="6. Por quanto tempo">
        <Lista>
          <li>
            Documentos anexados: apagados automaticamente 30 dias depois da data de assinatura do contrato (ou 30 dias depois do cancelamento, se
            o processo for cancelado sem assinatura). A gestora e a funcionária recebem um e-mail 5 dias antes, para baixar o que precisarem. A ficha
            do cliente e o histórico continuam.
          </li>
          <li>Ficha, histórico e registros de acesso: enquanto a conta do escritório existir.</li>
          <li>Depois do cancelamento da assinatura: <Pendente>prazo de guarda e de exclusão</Pendente>.</li>
          <li>Cópias de segurança: diárias, mantidas pelo prazo do plano do provedor do banco, <Pendente>conferir o prazo</Pendente>.</li>
        </Lista>
      </Secao>

      <Secao titulo="7. Segurança">
        <Lista>
          <li>Conexão sempre cifrada (HTTPS) e senhas guardadas só de forma cifrada.</li>
          <li>O banco de dados confere, a cada leitura e gravação, o escritório e o perfil de quem pede.</li>
          <li>Os documentos ficam em armazenamento privado e só abrem por links temporários, de 5 minutos, gerados para quem pode vê-los.</li>
          <li>Os registros técnicos de erro do app não guardam nome, CPF, e-mail, telefone nem conteúdo de ficha.</li>
          <li>Cada pessoa tem o próprio acesso, sem senha compartilhada.</li>
        </Lista>
      </Secao>

      <Secao titulo="8. Seus direitos">
        <p>
          A LGPD (art. 18) garante ao titular, entre outros, o direito de confirmar se tratamos seus dados, acessá-los, corrigi-los e pedir a
          exclusão dos que forem desnecessários.
        </p>
        <Lista>
          <li>Se você é cliente de um escritório, faça o pedido ao escritório, que é o controlador. Nós o ajudamos a atender.</li>
          <li>Se você usa o app, faça o pedido pelo contato do encarregado abaixo.</li>
        </Lista>
      </Secao>

      <Secao titulo="9. Cookies e dados no aparelho">
        <p>
          Usamos só o cookie de sessão, necessário para você continuar conectado. O navegador também guarda o último escritório aberto e se há uma
          sessão neste aparelho, para abrir o app mais rápido. Não usamos cookies de publicidade nem de análise de audiência.
        </p>
      </Secao>

      <Secao titulo="10. Mudanças e contato">
        <p>
          Quando esta política mudar, publicamos uma nova versão e pedimos um novo aceite no próximo acesso. Encarregado pelo tratamento de dados:{" "}
          <Pendente>nome e e-mail do encarregado</Pendente>.
        </p>
      </Secao>
    </Pagina>
  );
}
