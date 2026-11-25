import { limpar, logAuth, registrarErro, resumir } from "./log";

const saida = (f: () => void, metodo: "error" | "warn" = "error") => {
  const espiao = vi.spyOn(console, metodo).mockImplementation(() => {});
  try {
    f();
    return JSON.stringify(espiao.mock.calls);
  } finally {
    espiao.mockRestore();
  }
};

/** Como o driver `pg` monta um erro do servidor. */
function erroPg(campos: Record<string, string>) {
  return Object.assign(new Error(campos.message ?? "erro"), { severity: "ERROR", routine: "ExecConstraints", ...campos });
}

test("erro do Postgres sai sem detail, sem mensagem e sem where", () => {
  const e = erroPg({
    code: "23514", constraint: "clientes_cpf_check", table: "clientes",
    message: 'new row for relation "clientes" violates check constraint "clientes_cpf_check"',
    detail: "Failing row contains (…, Maria Souza, 52998224725, maria@x.com, …)",
    where: "SQL statement \"insert into clientes … 'Maria Souza'\"",
  });
  const s = saida(() => registrarErro("rota POST /api/contas/:contaId/clientes", e));
  expect(s).not.toMatch(/52998224725|Maria|maria@x\.com|Failing row/);
  expect(JSON.parse(s)[0][0]).toEqual({
    onde: "rota POST /api/contas/:contaId/clientes", nome: "ErroPostgres", codigo: "23514", constraint: "clientes_cpf_check", tabela: "clientes",
  });
});

test("mensagem do Postgres com o valor digitado também não sai", () => {
  const e = erroPg({ code: "22P02", message: 'invalid input syntax for type uuid: "Maria Souza 11988887777"' });
  expect(saida(() => registrarErro("x", e))).not.toMatch(/Maria|11988887777/);
});

test("erro de e-mail sai sem o endereço e sem números longos", () => {
  const e = new Error('envio de e-mail falhou: HTTP 422 {"message":"maria.souza@exemplo.com.br is invalid","to":"(11) 98888-7777"}');
  const s = saida(() => registrarErro("email", e));
  expect(s).not.toMatch(/maria\.souza|exemplo\.com|98888|7777/);
  expect(s).toContain("HTTP 422");
});

test("extra só aceita ids e números", () => {
  const id = crypto.randomUUID();
  const s = saida(() => registrarErro("x", new Error("falhou"), { arquivo: id, n: 3, nomeArquivo: "rg-maria.pdf", email: "a@b.com" }));
  const linha = JSON.parse(s)[0][0];
  expect(linha).toMatchObject({ arquivo: id, n: 3 });
  expect(linha).not.toHaveProperty("nomeArquivo");
  expect(linha).not.toHaveProperty("email");
});

test("pilha sai só com as linhas 'at', limpas", () => {
  const r = resumir(new Error("falhou com 529.982.247-25"));
  expect(r.mensagem).toBe("falhou com [número]");
  expect(r.pilha?.every((l) => l.startsWith("at "))).toBe(true);
});

test("limpar corta e tira e-mail e telefone, mas deixa códigos curtos", () => {
  expect(limpar("HTTP 503 de x@y.com.br, tel +55 11 98888-7777, código 42501")).toBe("HTTP 503 de [e-mail], tel [número], código 42501");
  expect(limpar("a".repeat(500))).toHaveLength(300);
});

test("logger do Better Auth: ignora info e debug e limpa avisos e erros", () => {
  expect(saida(() => logAuth("info", "usuario maria@x.com entrou"))).toBe("[]");
  expect(saida(() => logAuth("warn", "e-mail maria@x.com já existe"), "warn")).not.toContain("maria@x.com");
  const s = saida(() => logAuth("error", "falhou", erroPg({ code: "23505", constraint: "user_email_key", detail: "Key (email)=(maria@x.com)" })));
  expect(s).not.toContain("maria@x.com");
  expect(s).toContain("user_email_key");
});
