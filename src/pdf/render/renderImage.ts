import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import type { ImageSchema } from "../../types";

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
export function assertImageWithinSizeLimit(dataUri: string, label: string): void {
  if (estimateDataUriBytes(dataUri) > MAX_IMAGE_BYTES) {
    throw new Error(`${label}: imagem maior que o limite de ${MAX_IMAGE_BYTES / (1024 * 1024)}MB — reduza o arquivo antes de usar.`);
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
  heightPt: number
): Promise<void> {
  const dataUri = schema.content;
  if (!dataUri) return;
  let embedded = imageCache.get(dataUri);
  if (!embedded) {
    if (imageCache.size >= MAX_DISTINCT_IMAGES) {
      throw new Error(`Documento excede o limite de ${MAX_DISTINCT_IMAGES} imagens distintas — reduza a quantidade de imagens diferentes usadas.`);
    }
    const isPng = dataUri.startsWith("data:image/png");
    const isJpg = dataUri.startsWith("data:image/jpeg") || dataUri.startsWith("data:image/jpg");
    if (!isPng && !isJpg) {
      throw new Error(`Campo "${schema.name}": imagem em formato não suportado (só PNG/JPEG). Reenvie o arquivo pelo editor.`);
    }
    assertImageWithinSizeLimit(dataUri, `Campo "${schema.name}"`);
    try {
      embedded = isPng ? await doc.embedPng(dataUri) : await doc.embedJpg(dataUri);
    } catch {
      throw new Error(`Campo "${schema.name}": não deu pra ler essa imagem — arquivo corrompido ou inválido.`);
    }
    imageCache.set(dataUri, embedded);
  }
  page.drawImage(embedded, { x: xPt, y: yPt, width: widthPt, height: heightPt });
}
