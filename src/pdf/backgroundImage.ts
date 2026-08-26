import * as pdfjsLib from "pdfjs-dist";
import { ensureWorker } from "./pdfWorker";

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

// Converte um arquivo (PDF ou imagem) num PNG data URI pronto pra usar
// como fundo da página, sempre resolvido pra imagem: se for PDF, rasteriza
// a primeira página uma
// única vez no momento do upload (via pdf.js); se já for imagem, usa
// direto. Isso evita ter que lidar com embed de página de PDF dentro de
// PDF na hora de gerar (generate.ts só embute PNG, sempre).
export async function fileToBackgroundImage(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    return rasterizeFirstPdfPage(await file.arrayBuffer());
  }
  return fileToDataUrl(file);
}
