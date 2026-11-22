// Preparo do anexo no navegador, como no protótipo (função preparar): RF-22.
// PDF vai como está (até 20 MB). Foto acima de 2,5 MB, ou HEIC, vira JPG de até 2.200 px (qualidade 0,85).

export const TAMANHO_MAXIMO = 20 * 1024 * 1024;
export const FOTO_GRANDE = 2.5 * 1024 * 1024;
const LADO_MAXIMO = 2200;

export type Preparo = { acao: "enviar" } | { acao: "reduzir" } | { acao: "recusar"; mensagem: string };

const ehHeic = (nome: string, tipo: string) => /heic|heif/i.test(tipo) || /\.(heic|heif)$/i.test(nome);

/** O que fazer com o arquivo escolhido (regra pura; o canvas fica em prepararArquivo). */
export function decidirPreparo(nome: string, tipo: string, tamanho: number): Preparo {
  const pdf = tipo === "application/pdf" || /\.pdf$/i.test(nome);
  const foto = /^image\/(jpeg|png|webp|heic|heif)$/.test(tipo) || /\.(jpe?g|png|webp|heic|heif)$/i.test(nome);
  if (!pdf && !foto) return { acao: "recusar", mensagem: `${nome}: envie PDF ou foto (JPG, PNG, WebP ou HEIC)` };
  if (pdf) return tamanho > TAMANHO_MAXIMO ? { acao: "recusar", mensagem: `${nome}: arquivo grande demais (máx. 20 MB)` } : { acao: "enviar" };
  if (ehHeic(nome, tipo) || tamanho > FOTO_GRANDE) return { acao: "reduzir" };
  return { acao: "enviar" };
}

async function decodificar(arquivo: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(arquivo);
  } catch (e) {
    // só o Safari decodifica HEIC; nos outros, a biblioteca entra só nesta hora
    if (!ehHeic(arquivo.name, arquivo.type)) throw e;
    const { default: heic2any } = await import("heic2any");
    const jpg = (await heic2any({ blob: arquivo, toType: "image/jpeg", quality: 0.92 })) as Blob;
    return createImageBitmap(jpg);
  }
}

/** Devolve o arquivo pronto para enviar ou lança um Error com a mensagem para a tela. */
export async function prepararArquivo(arquivo: File): Promise<File> {
  const d = decidirPreparo(arquivo.name, arquivo.type, arquivo.size);
  if (d.acao === "recusar") throw new Error(d.mensagem);
  if (d.acao === "enviar") return arquivo;
  try {
    const bmp = await decodificar(arquivo);
    const k = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob) throw new Error("sem blob");
    return new File([blob], arquivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    if (arquivo.size <= TAMANHO_MAXIMO && !ehHeic(arquivo.name, arquivo.type)) return arquivo;
    throw new Error(`${arquivo.name}: formato de foto não suportado, envie JPG ou PDF`);
  }
}
