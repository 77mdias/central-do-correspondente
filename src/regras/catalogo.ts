// Listas fixas do processo, iguais às do protótipo (docs/prototipo/prototipo.html: ETAPAS, MODALIDADES, DOCS).

export type Etapa =
  | "cadastro"
  | "documentacao_pendente"
  | "analise_credito"
  | "credito_aprovado"
  | "avaliacao_imovel"
  | "conformidade"
  | "assinatura_contrato"
  | "registro_cartorio"
  | "concluido"
  | "reprovado_cancelado";

export type Modalidade = "mcmv" | "sbpe" | "pro_cotista" | "outra";

/** As 10 etapas de RN-01, na ordem. */
export const ETAPAS: readonly { codigo: Etapa; nome: string }[] = [
  { codigo: "cadastro", nome: "Cadastro" },
  { codigo: "documentacao_pendente", nome: "Documentação pendente" },
  { codigo: "analise_credito", nome: "Análise de crédito" },
  { codigo: "credito_aprovado", nome: "Crédito aprovado" },
  { codigo: "avaliacao_imovel", nome: "Avaliação do imóvel" },
  { codigo: "conformidade", nome: "Conformidade" },
  { codigo: "assinatura_contrato", nome: "Assinatura do contrato" },
  { codigo: "registro_cartorio", nome: "Registro em cartório" },
  { codigo: "concluido", nome: "Concluído" },
  { codigo: "reprovado_cancelado", nome: "Reprovado / Cancelado" },
];

/** Etapas que encerram o processo (RN-02). */
export const ETAPAS_FIM: readonly Etapa[] = ["concluido", "reprovado_cancelado"];

export const MODALIDADES: readonly { codigo: Modalidade; nome: string }[] = [
  { codigo: "mcmv", nome: "Minha Casa Minha Vida" },
  { codigo: "sbpe", nome: "SBPE" },
  { codigo: "pro_cotista", nome: "Pró-Cotista FGTS" },
  { codigo: "outra", nome: "Habitacional Caixa (outros)" },
];

export type GrupoDocumento = "comprador" | "imovel_vendedor";
export type CodigoDocumento = "rg" | "cpf" | "civil" | "resid" | "renda" | "ctps" | "ir" | "fgts" | "matr" | "iptu" | "vend" | "form";

/** Os 12 documentos (P-01), na ordem do checklist. Iguais à tabela tipos_documento (teste de banco compara). */
export const DOCUMENTOS: readonly { codigo: CodigoDocumento; nome: string; grupo: GrupoDocumento }[] = [
  { codigo: "rg", nome: "RG ou CNH", grupo: "comprador" },
  { codigo: "cpf", nome: "CPF", grupo: "comprador" },
  { codigo: "civil", nome: "Certidão de nascimento ou casamento", grupo: "comprador" },
  { codigo: "resid", nome: "Comprovante de residência", grupo: "comprador" },
  { codigo: "renda", nome: "Comprovante de renda (3 últimos holerites)", grupo: "comprador" },
  { codigo: "ctps", nome: "Carteira de trabalho", grupo: "comprador" },
  { codigo: "ir", nome: "Declaração de Imposto de Renda", grupo: "comprador" },
  { codigo: "fgts", nome: "Extrato do FGTS", grupo: "comprador" },
  { codigo: "matr", nome: "Matrícula atualizada do imóvel", grupo: "imovel_vendedor" },
  { codigo: "iptu", nome: "Carnê do IPTU", grupo: "imovel_vendedor" },
  { codigo: "vend", nome: "Documentos do vendedor", grupo: "imovel_vendedor" },
  { codigo: "form", nome: "Formulários assinados", grupo: "imovel_vendedor" },
];

export const NOME_GRUPO: Record<GrupoDocumento, string> = { comprador: "Comprador", imovel_vendedor: "Imóvel e vendedor" };

/** "Outros arquivos" não é documento do checklist: é anexo sem tipo. */
export const OUTROS_ARQUIVOS = "Outros arquivos (simulação, laudo, contrato…)";

export const INTERVALOS = [1, 2, 3, 5, 7] as const;
export type Intervalo = (typeof INTERVALOS)[number];

/** Processo ativo sem atualização há este número de dias ou mais está parado (RN-03). */
export const DIAS_PARADO = 7;

export const nomeEtapa = (e: Etapa) => ETAPAS.find((x) => x.codigo === e)!.nome;
export const nomeModalidade = (m: Modalidade) => MODALIDADES.find((x) => x.codigo === m)!.nome;
