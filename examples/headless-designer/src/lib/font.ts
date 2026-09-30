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

// A failure to FETCH the asset — distinct from THE PACKAGE's font errors,
// which are all about bytes that arrived and fontkit refused. Here the bytes
// did not even arrive: a build without the .ttf, a deploy with the wrong base
// path, the disk. It is OUR error, so `describePdfError` returns `null` and
// the text comes from the shell's dictionary (see lib/generationError.ts).
export class FontAssetError extends Error {
  constructor(detail: string) {
    super(`Could not load the bundled font: ${detail}`);
    this.name = "FontAssetError";
  }
}

export function loadDefaultFont(): Promise<ArrayBuffer> {
  if (!cached) {
    cached = fetch(interTtfUrl)
      .then((res) => {
        // `fetch` RESOLVE em 404. Sem esta checagem o corpo do erro do
        // servidor (uma página HTML) virava ArrayBuffer e seguia como se
        // fosse fonte — o fontkit então lançava um erro de PARSE, culpando o
        // arquivo por um problema que era de caminho.
        if (!res.ok) throw new FontAssetError(`HTTP ${res.status} on ${interTtfUrl}`);
        return res.arrayBuffer();
      })
      .catch((err: unknown) => {
        // Rejeição de rede (offline, CORS) chega como TypeError. Normalizada
        // aqui pra classificação a jusante ser um `instanceof` só.
        if (err instanceof FontAssetError) throw err;
        throw new FontAssetError(err instanceof Error ? err.message : String(err));
      });
    // Promise rejeitada NÃO fica no cache: senão a primeira falha (um blip de
    // rede) condenaria toda tentativa seguinte da sessão, e o botão de gerar
    // nunca mais funcionaria sem recarregar a página.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
