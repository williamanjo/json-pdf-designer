import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import type { ImageSchema } from "../../types";
import { ImageTooLargeError, ImageUnreadableError, TooManyImagesError, UnsupportedImageFormatError } from "../../errors";

// Um template pode vir de fonte não confiável (multi-tenant: salvo num
// banco, editado por outro usuário) — sem limite nenhum, um `ImageSchema.
// content`/`Template.backgroundImage` gigante (base64 de dezenas/centenas de
// MB, ou centenas de imagens distintas repetidas por uma seção) vira um
// jeito fácil de derrubar/travar quem gera o PDF (não é mais "problema de
// PDF", vira "alguém consegue travar meu worker de geração"). Os dois
// limites abaixo protegem sem afetar nenhum uso normal (logo de
// letterhead, foto de produto etc — na faixa de KB a poucos MB).
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB decodificado, por imagem
export const MAX_DISTINCT_IMAGES = 200; // imagens ÚNICAS por documento (imageCache já dedupe por conteúdo)

// Tamanho decodificado aproximado de um data URI base64 — não precisa
// decodificar de verdade só pra medir, a fórmula (len*3/4, descontando o
// prefixo "data:...;base64,") já é suficiente pra um limite de segurança.
export function estimateDataUriBytes(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

// Exportada — generate.ts também usa pro fundo de página (Template.backgroundImage),
// não só pro campo de imagem abaixo.
//
// `field` é o nome do campo de imagem, ou `null` pro fundo da página (que não
// tem campo). Antes isto recebia um `label` JÁ FORMATADO (`Campo "logo"`), e
// era ele que ia pra mensagem — ou seja, o texto do erro nascia no chamador e
// não havia como o consumidor saber QUAL campo era sem parsear a frase.
export function assertImageWithinSizeLimit(dataUri: string, field: string | null): void {
  const bytes = estimateDataUriBytes(dataUri);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new ImageTooLargeError(field, bytes, MAX_IMAGE_BYTES);
  }
}

export async function drawImageField(
  doc: PDFDocument,
  page: PDFPage,
  schema: ImageSchema,
  imageCache: Map<string, PDFImage>,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number,
  // Valor do vínculo já resolvido (um data URI vindo do JSON). Tem prioridade
  // sobre `schema.content`, que é a imagem escolhida em tempo de design.
  // Vazio/ausente cai no content — é o que faz um campo sem vínculo continuar
  // desenhando o que foi colocado no editor.
  boundValue?: string
): Promise<void> {
  const dataUri = boundValue?.trim() ? boundValue : schema.content;
  if (!dataUri) return;
  // Vínculo que resolveu pra algo que não é data URI (path errado, URL http,
  // texto solto) não é motivo pra derrubar o documento — o campo fica vazio,
  // igual a um vínculo de texto que não resolve.
  if (!dataUri.startsWith("data:")) return;
  let embedded = imageCache.get(dataUri);
  if (!embedded) {
    if (imageCache.size >= MAX_DISTINCT_IMAGES) {
      throw new TooManyImagesError(MAX_DISTINCT_IMAGES);
    }
    const isPng = dataUri.startsWith("data:image/png");
    const isJpg = dataUri.startsWith("data:image/jpeg") || dataUri.startsWith("data:image/jpg");
    if (!isPng && !isJpg) {
      throw new UnsupportedImageFormatError(schema.name);
    }
    assertImageWithinSizeLimit(dataUri, schema.name);
    try {
      embedded = isPng ? await doc.embedPng(dataUri) : await doc.embedJpg(dataUri);
    } catch {
      throw new ImageUnreadableError(schema.name);
    }
    imageCache.set(dataUri, embedded);
  }
  page.drawImage(embedded, { x: xPt, y: yPt, width: widthPt, height: heightPt });
}
