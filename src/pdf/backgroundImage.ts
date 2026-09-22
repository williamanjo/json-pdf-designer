import { ImageUploadTooLargeError, ImageUploadUnreadableError } from "../errors";

// The same spirit as the limit in generate.ts — here it protects the
// browser's OWN tab from freezing while converting a huge file (generate.ts,
// on the server side, has its own limit over the already-converted data URI
// — this one is the entrance gate, before spending CPU/memory processing the
// file).
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB, the original file

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

// Converts an uploaded IMAGE into a PNG data URI ready to use as the page's
// background. A PNG passes straight through; any other format the browser can
// decode (JPEG and so on) becomes a PNG through a canvas — it guarantees that
// generate.ts always receives a PNG (doc.embedPng).
//
// Images only, on purpose: a background coming from a PDF would require
// rasterizing the 1st page with pdf.js, which would pull pdfjs-dist (an
// optional peer) into the <Designer>'s graph and therefore the main entry.
export async function fileToBackgroundImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageUploadTooLargeError(file.size, MAX_UPLOAD_BYTES);
  }
  if (file.type === "image/png") {
    return fileToDataUrl(file);
  }
  return imageToPng(await fileToDataUrl(file));
}
