import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api, ErroApi } from "@/api";
import { classeEntrada } from "@/componentes/campos";
import { errosPorCampo, mensagemDeErro } from "@/componentes/formulario";
import { Aviso, Botao, Campo } from "@/componentes/ui";
import { recarregarCliente, useCorretores } from "@/consultas-escritorio";
import { MODALIDADES } from "@/regras/catalogo";
import { lerReais } from "@/regras/dinheiro";
import { esquemaNovoCliente } from "@/regras/esquemas";
import type { EscritorioResumo } from "@/tipos-api";

/** RF-10 / RF-11: nome obrigatório; entra em Documentação pendente com cobrança para hoje. */
export function NovoCliente({ escritorio, corretorInicial, aoCriar }: { escritorio: EscritorioResumo; corretorInicial: string | null; aoCriar: (id: string) => void }) {
  const conta = escritorio.contaId;
  const corretores = useCorretores(conta).data ?? [];
  const qc = useQueryClient();
  const [erros, setErros] = useState<Record<string, string>>({});
  const criar = useMutation({
    mutationFn: (dados: unknown) => api<{ id: string }>(`/api/contas/${conta}/clientes`, { body: dados }),
    onSuccess: ({ id }) => {
      recarregarCliente(qc, conta);
      aoCriar(id);
    },
    onError: (e) => {
      if (e instanceof ErroApi && e.codigo === "validacao") setErros(Object.fromEntries(e.campos.map((c) => [c, "Valor inválido"])));
    },
  });

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const dados = {
      nome: f.get("nome"),
      cpf: f.get("cpf"),
      whatsapp: f.get("whatsapp"),
      email: f.get("email"),
      modalidade: f.get("modalidade") || null,
      corretorId: f.get("corretorId") || null,
      valorImovelCentavos: lerReais(String(f.get("valorImovel") ?? "")),
      valorFinanciadoCentavos: lerReais(String(f.get("valorFinanciado") ?? "")),
    };
    const v = esquemaNovoCliente.safeParse(dados);
    if (!v.success) return setErros(errosPorCampo(v.error));
    setErros({});
    criar.mutate(v.data);
  }

  if (!escritorio.ativa) return <Aviso tom="atencao">Esta conta ainda não pode cadastrar clientes.</Aviso>;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4 rounded-xl border border-borda bg-superficie p-4">
      {criar.isError && !(criar.error instanceof ErroApi && criar.error.codigo === "validacao") && <Aviso tom="erro">{mensagemDeErro(criar.error)}</Aviso>}
      <Campo id="n-nome" name="nome" rotulo="Nome completo" placeholder="Nome do comprador" erro={erros.nome} autoFocus />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="n-cpf" name="cpf" rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" erro={erros.cpf} />
        <Campo id="n-whatsapp" name="whatsapp" rotulo="WhatsApp" inputMode="tel" placeholder="(18) 99999-9999" erro={erros.whatsapp} />
        <Campo id="n-email" name="email" type="email" rotulo="E-mail" erro={erros.email} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-modalidade" className="text-sm font-medium">
            Modalidade Caixa
          </label>
          <select id="n-modalidade" name="modalidade" defaultValue={MODALIDADES[0]!.codigo} className={classeEntrada}>
            {MODALIDADES.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="n-corretor" className="text-sm font-medium">
          Corretor parceiro ou cliente direto
        </label>
        <select id="n-corretor" name="corretorId" defaultValue={corretorInicial ?? ""} className={classeEntrada}>
          <option value="">Cliente direto (sem corretor)</option>
          {[...corretores]
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.imobiliaria ? `${k.nome} · ${k.imobiliaria}` : k.nome}
              </option>
            ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="n-valor" name="valorImovel" rotulo="Valor do imóvel" inputMode="decimal" placeholder="R$ 0,00" erro={erros.valorImovelCentavos} />
        <Campo id="n-fin" name="valorFinanciado" rotulo="Valor a financiar" inputMode="decimal" placeholder="R$ 0,00" erro={erros.valorFinanciadoCentavos} />
      </div>
      <Botao type="submit" carregando={criar.isPending}>
        Cadastrar cliente
      </Botao>
    </form>
  );
}
