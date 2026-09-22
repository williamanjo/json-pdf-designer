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

export function loadDefaultFont(): Promise<ArrayBuffer> {
  if (!cached) {
    cached = fetch(interTtfUrl).then((res) => res.arrayBuffer());
  }
  return cached;
}
