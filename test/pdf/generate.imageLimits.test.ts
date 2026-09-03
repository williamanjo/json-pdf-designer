import { describe, expect, it } from "vitest";
import { generatePdf } from "../../src/pdf/generate";
import { estimateDataUriBytes, MAX_DISTINCT_IMAGES, MAX_IMAGE_BYTES } from "../../src/pdf/render/renderImage";
import { ImageTooLargeError, TooManyImagesError } from "../../src/errors";
import type { ImageSchema, Template } from "../../src/types";

// 1x1 PNG real (menor PNG válido possível) — usado como base pra montar data
// URIs "grandes o bastante" sem precisar de uma imagem de verdade gigante:
// o limite é checado ANTES do pdf-lib tentar decodificar a imagem (ver
// assertImageWithinSizeLimit em generate.ts), então um base64 comprido mas
// com conteúdo lixo (não decodifica de verdade como PNG) ainda serve pra
// testar o portão de tamanho sem custo de gerar um PNG de dezenas de MB.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

// Data URI válido (mesmo PNG real, decodifica normal) mas com uma STRING
// diferente por índice — o parâmetro extra antes de "base64," não afeta a
// decodificação (pdf-lib só olha o que vem depois da vírgula), só serve pra
// cada uma virar uma CHAVE diferente no `imageCache` (que dedupe por
// conteúdo exato da string), sem precisar fabricar 200 PNGs de verdade
// distintos só pra testar o limite de contagem.
function distinctTinyPng(i: number): string {
  return TINY_PNG.replace("image/png;base64,", `image/png;id=${i};base64,`);
}

function oversizedDataUri(): string {
  // base64 grande o bastante pra decodificar acima de MAX_IMAGE_BYTES —
  // (len * 3/4) > MAX_IMAGE_BYTES, então len > MAX_IMAGE_BYTES * 4/3.
  const len = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1000;
  return `data:image/png;base64,${"A".repeat(len)}`;
}

function makeImageSchema(overrides: Partial<ImageSchema> = {}): ImageSchema {
  return { id: "img1", name: "imagem", type: "image", x: 10, y: 10, width: 50, height: 50, content: TINY_PNG, ...overrides };
}

function makeTemplate(schemas: ImageSchema[]): Template {
  return { page: { width: 210, height: 297 }, schemas };
}

// O erro com que `promise` rejeita — pra afirmar sobre a CLASSE e os campos
// estruturados em vez de casar a frase da mensagem.
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the promise to reject, and it resolved");
}

describe("estimateDataUriBytes", () => {
  it("calcula o tamanho decodificado aproximado (len*3/4) a partir do base64 depois da vírgula", () => {
    // "QQQQ" (4 chars base64) decodifica pra 3 bytes reais — fórmula bate.
    expect(estimateDataUriBytes("data:image/png;base64,QQQQ")).toBe(3);
    expect(estimateDataUriBytes("data:image/png;base64,")).toBe(0);
  });
});

describe("generatePdf — limites de imagem", () => {
  it("imagem dentro do limite gera normalmente", async () => {
    const template = makeTemplate([makeImageSchema()]);
    const bytes = await generatePdf(template, {}, []);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("imagem de campo acima do limite lança ImageTooLargeError nomeando o campo (não tenta decodificar)", async () => {
    const template = makeTemplate([makeImageSchema({ content: oversizedDataUri() })]);
    const err = await rejection(generatePdf(template, {}, []));
    expect(err).toBeInstanceOf(ImageTooLargeError);
    const typed = err as ImageTooLargeError;
    expect(typed.code).toBe("imageTooLarge");
    expect(typed.field).toBe("imagem");
    expect(typed.limitBytes).toBe(MAX_IMAGE_BYTES);
    expect(typed.bytes).toBeGreaterThan(MAX_IMAGE_BYTES);
  });

  it("fundo de página acima do limite lança ImageTooLargeError com `field` null (não é campo)", async () => {
    const template: Template = { page: { width: 210, height: 297 }, schemas: [], backgroundImage: oversizedDataUri() };
    const err = await rejection(generatePdf(template, {}, []));
    expect(err).toBeInstanceOf(ImageTooLargeError);
    const typed = err as ImageTooLargeError;
    // `null` é o discriminante entre "campo de imagem" e "fundo da página":
    // antes a única pista era o rótulo colado na frase.
    expect(typed.field).toBeNull();
    expect(typed.limitBytes).toBe(MAX_IMAGE_BYTES);
  });

  it(`mais de ${MAX_DISTINCT_IMAGES} imagens DISTINTAS no mesmo documento lança TooManyImagesError com o limite`, async () => {
    const schemas = Array.from({ length: MAX_DISTINCT_IMAGES + 1 }, (_, i) =>
      makeImageSchema({ id: `img${i}`, name: `imagem${i}`, content: distinctTinyPng(i) })
    );
    const template = makeTemplate(schemas);
    const err = await rejection(generatePdf(template, {}, []));
    expect(err).toBeInstanceOf(TooManyImagesError);
    const typed = err as TooManyImagesError;
    expect(typed.code).toBe("tooManyImages");
    expect(typed.maxImages).toBe(MAX_DISTINCT_IMAGES);
  }, 20000);

  it(`até ${MAX_DISTINCT_IMAGES} imagens distintas (no limite) ainda gera normalmente`, async () => {
    const schemas = Array.from({ length: MAX_DISTINCT_IMAGES }, (_, i) =>
      makeImageSchema({ id: `img${i}`, name: `imagem${i}`, content: distinctTinyPng(i) })
    );
    const template = makeTemplate(schemas);
    const bytes = await generatePdf(template, {}, []);
    expect(bytes.length).toBeGreaterThan(0);
  }, 20000);
});
