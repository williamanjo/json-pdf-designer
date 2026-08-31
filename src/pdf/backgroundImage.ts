import * as pdfjsLib from "pdfjs-dist";
import { ensureWorker } from "./pdfWorker";

// Mesmo espírito do limite em generate.ts — aqui protege a PRÓPRIA aba do
// navegador de travar rasterizando/convertendo um arquivo enorme (o
// generate.ts, do lado do servidor, tem seu próprio limite sobre o
// data URI já convertido — este aqui é o portão de entrada, antes de
// gastar CPU/memória processando o arquivo).
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB, arquivo original

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

async function rasterizeFirstPdfPage(bytes: ArrayBuffer): Promise<string> {
  ensureWorker();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}

function imageToPng(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D indisponível")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = dataUrl;
  });
}

// Converte um arquivo (PDF ou imagem) num PNG data URI pronto pra usar
// como fundo da página. PDF → rasteriza 1ª página; imagem → converte pra
// PNG via canvas (garante que generate.ts sempre recebe PNG).
export async function fileToBackgroundImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Arquivo maior que o limite de ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB — reduza o tamanho antes de enviar.`);
  }
  if (file.type === "application/pdf") {
    return rasterizeFirstPdfPage(await file.arrayBuffer());
  }
  if (file.type === "image/png") {
    return fileToDataUrl(file);
  }
  return imageToPng(await fileToDataUrl(file));
}
