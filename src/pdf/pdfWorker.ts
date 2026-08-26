import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

// Sem hook de bundler pra achar o worker do pdf.js dentro de uma lib
// pré-compilada (tsup não faz o asset-URL handling que o Vite faz em
// código de app) — usa o CDN oficial casado com a versão instalada.
// Pra self-host, chame configurePdfWorker(url) antes do primeiro render.
export function ensureWorker() {
  if (workerConfigured || pdfjsLib.GlobalWorkerOptions.workerSrc) {
    workerConfigured = true;
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  workerConfigured = true;
}

export function configurePdfWorker(url: string) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = url;
  workerConfigured = true;
}
