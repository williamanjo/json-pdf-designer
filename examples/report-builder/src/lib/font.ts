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

// A failure to load THIS example's font ASSET. The package knows nothing
// about it (`describePdfError` returns `null` for it, see
// lib/generationError.ts), so it has a CLASS of its own — for the same reason
// the package has its own: it can be classified without matching message text.
// The `message` stays in English, like the package's, because it is the
export class FontLoadError extends Error {
  constructor(reason: string) {
    super(`Could not load the bundled font asset (src/assets/inter-regular.ttf): ${reason}`);
    this.name = "FontLoadError";
  }
}

export function loadDefaultFont(): Promise<ArrayBuffer> {
  if (!cached) {
    cached = fetch(interTtfUrl)
      .then((res) => {
        if (!res.ok) throw new FontLoadError(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .catch((err: unknown) => {
        // Promessa REJEITADA em cache faria o segundo "Gerar PDF" falhar sem
        // nem tentar de novo — limpa o cache antes de propagar.
        cached = null;
        throw err instanceof FontLoadError ? err : new FontLoadError(String(err));
      });
  }
  return cached;
}
