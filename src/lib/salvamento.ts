// Salvamento automático (RF-15): cada campo espera 700 ms depois da última digitação, e o que estiver
// pendente na hora vai junto num PATCH só, com apenas os campos alterados.

export type EstadoSalvamento = "ocioso" | "salvando" | "salvo" | "erro";

type Relogio = { agendar(fn: () => void, ms: number): unknown; cancelar(t: unknown): void };
const relogioPadrao: Relogio = { agendar: (fn, ms) => setTimeout(fn, ms), cancelar: (t) => clearTimeout(t as number) };

export class FilaSalvamento {
  private pendentes: Record<string, unknown> = {};
  private timer: unknown = null;
  private emVoo: Promise<void> = Promise.resolve();
  estado: EstadoSalvamento = "ocioso";
  erro: unknown = null;

  constructor(
    private enviar: (campos: Record<string, unknown>) => Promise<void>,
    private aoMudar: (estado: EstadoSalvamento) => void = () => {},
    private atraso = 700,
    private relogio: Relogio = relogioPadrao,
  ) {}

  agendar(campo: string, valor: unknown) {
    this.pendentes[campo] = valor;
    if (this.timer !== null) this.relogio.cancelar(this.timer);
    this.timer = this.relogio.agendar(() => void this.descarregar(), this.atraso);
  }

  /** Envia já o que está pendente (ao fechar a ficha, por exemplo). Envios saem um depois do outro. */
  descarregar(): Promise<void> {
    if (this.timer !== null) this.relogio.cancelar(this.timer);
    this.timer = null;
    const campos = this.pendentes;
    this.pendentes = {};
    if (!Object.keys(campos).length) return this.emVoo;
    this.mudar("salvando");
    this.emVoo = this.emVoo.then(() =>
      this.enviar(campos).then(
        () => this.mudar(Object.keys(this.pendentes).length || this.timer !== null ? "salvando" : "salvo"),
        (e) => {
          this.erro = e;
          this.mudar("erro");
        },
      ),
    );
    return this.emVoo;
  }

  get temPendencia() {
    return Object.keys(this.pendentes).length > 0;
  }

  private mudar(e: EstadoSalvamento) {
    this.estado = e;
    this.aoMudar(e);
  }
}
