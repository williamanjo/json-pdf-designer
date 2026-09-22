import interTtfUrl from "../assets/inter-regular.ttf?url";

// A custom font for the generated PDF (fontkit, through json-pdf-designer) —
// Inter covers accents/unicode far more completely than pdf-lib's standard
// Helvetica. A real TTF (not a .woff2) — we tried decompressing
// @fontsource/inter's .woff2 at runtime (through wawoff2/WASM) and it hung
// forever in a real browser (it worked fine in Node, so it is specific to WASM
// running in a browser). So as not to depend on that, the file comes already
// converted to TTF once and for all — see the commit history for how to
// regenerate it (wawoff2's decompress, run in Node).
let cached: Promise<ArrayBuffer> | null = null;

// The font is THIS EXAMPLE'S ASSET (src/assets/inter-regular.ttf), not the
// package's — so the failure to load it is ours, and the package returns
// `null` for it in `describePdfError`. A class of its own so the banner can
// say where the file lives, instead of showing a raw "failed to fetch".
export class FontAssetError extends Error {
  constructor(cause?: unknown) {
    super("Could not load the bundled font asset (src/assets/inter-regular.ttf)");
    this.name = "FontAssetError";
    this.cause = cause;
  }
}

export function loadDefaultFont(): Promise<ArrayBuffer> {
  if (!cached) {
    // An explicit `res.ok`: `fetch` resolves with a 404 instead of rejecting,
    // so without this check a missing file became an ArrayBuffer with the error
    // page's HTML inside — and pdf-lib failed later, at a point that says
    // nothing about the cause.
    cached = fetch(interTtfUrl)
      .then((res) => {
        if (!res.ok) throw new FontAssetError(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .catch((cause) => {
        // Não re-embrulha o que já é nosso, senão a causa vira uma boneca
        // russa de FontAssetError.
        throw cause instanceof FontAssetError ? cause : new FontAssetError(cause);
      });
  }
  return cached;
}
