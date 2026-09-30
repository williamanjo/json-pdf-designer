import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import type { ImageSchema } from "../../types";
import { ImageTooLargeError, ImageUnreadableError, TooManyImagesError, UnsupportedImageFormatError } from "../../errors";

// A template may come from an untrusted source (multi-tenant: saved in a
// database, edited by another user) — with no limit at all, a giant
// `ImageSchema.content`/`Template.backgroundImage` (a base64 of tens/hundreds
// of MB, or hundreds of distinct images repeated by a section) becomes an easy
// way to bring down/freeze whoever generates the PDF (it stops being a "PDF
// problem" and becomes "someone can freeze my generation worker"). The two
// limits below protect without affecting any normal use (a letterhead logo, a
// product photo and so on — in the KB to a few MB range).
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB decodificado, por imagem
export const MAX_DISTINCT_IMAGES = 200; // UNIQUE images per document (imageCache already dedupes by content)

// The approximate decoded size of a base64 data URI — there is no need to
// really decode it just to measure, the formula (len*3/4, minus the
// "data:...;base64," prefix) is already enough for a safety limit.
export function estimateDataUriBytes(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

// Exported — generate.ts also uses it for the page background
// (Template.backgroundImage), not only for the image field below.
//
// `field` is the image field's name, or `null` for the page background (which
// has no field). This used to receive an ALREADY FORMATTED `label` (`Field
// "logo"`), and it was that which went into the message — that is, the error's
// text was born in the caller and the consumer had no way to know WHICH field
// it was without parsing the sentence.
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
  // The already-resolved binding value (a data URI coming from the JSON). It
  // takes priority over `schema.content`, which is the image chosen at design
  // time. Empty/absent falls back to content — that is what keeps a field
  // with no binding drawing what was placed in the editor.
  boundValue?: string
): Promise<void> {
  const dataUri = boundValue?.trim() ? boundValue : schema.content;
  if (!dataUri) return;
  // A binding that resolved to something that is not a data URI (a wrong path,
  // an http URL, loose text) is no reason to bring the document down — the
  // field is left empty, like a text binding that does not resolve.
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
