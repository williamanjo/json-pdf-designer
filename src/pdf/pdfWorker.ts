import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

// There is no bundler hook to find pdf.js's worker inside a precompiled
// library (tsup does not do the asset-URL handling Vite does in app code) —
// it uses the official CDN matched to the installed version. To self-host,
// call configurePdfWorker(url) before the first render.
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
