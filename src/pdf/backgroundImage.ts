import { ImageUploadTooLargeError, ImageUploadUnreadableError } from "../errors";

// Mesmo espírito do limite em generate.ts — aqui protege a PRÓPRIA aba do
// navegador de travar convertendo um arquivo enorme (o generate.ts, do
// lado do servidor, tem seu próprio limite sobre o data URI já convertido
// — este aqui é o portão de entrada, antes de gastar CPU/memória
// processando o arquivo).
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB, arquivo original

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageUploadUnreadableError("read"));
    reader.readAsDataURL(file);
  });
}

function imageToPng(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new ImageUploadUnreadableError("canvas")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new ImageUploadUnreadableError("decode"));
    img.src = dataUrl;
  });
}

// Converte uma IMAGEM enviada num PNG data URI pronto pra usar como fundo
// da página. PNG passa direto; qualquer outro formato que o navegador
// decodifique (JPEG etc) vira PNG via canvas — garante que o generate.ts
// sempre recebe PNG (doc.embedPng).
//
// Só imagem, de propósito: fundo vindo de PDF exigiria rasterizar a 1ª
// página com pdf.js, o que puxaria o pdfjs-dist (peer opcional) pra dentro
// do grafo do <Designer> e portanto da entry principal — ver src/preview.ts.
export async function fileToBackgroundImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageUploadTooLargeError(file.size, MAX_UPLOAD_BYTES);
  }
  if (file.type === "image/png") {
    return fileToDataUrl(file);
  }
  return imageToPng(await fileToDataUrl(file));
}
