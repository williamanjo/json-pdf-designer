import interTtfUrl from "../assets/inter-regular.ttf?url";

// Fonte custom pro PDF gerado (fontkit, via json-pdf-designer) — Inter cobre
// acentuação/unicode bem mais completo que o Helvetica padrão do pdf-lib.
// TTF de verdade (não .woff2) — testamos descomprimir o .woff2 do
// @fontsource/inter em tempo de execução (via wawoff2/WASM) e travava
// infinitamente em navegador real (funcionava certinho em Node, então é
// específico do WASM rodando em browser). Pra não depender disso, o
// arquivo já vem convertido pra TTF de uma vez só — ver histórico do
// commit pra como gerar de novo (decompress do wawoff2, rodado em Node).
let cached: Promise<ArrayBuffer> | null = null;

// Falha de carregar o ASSET de fonte DESTE example. O pacote não sabe nada
// disso (`describePdfError` devolve `null` pra ela, ver lib/generationError.ts),
// então ela tem CLASSE própria — pelo mesmo motivo que o pacote tem as dele:
// dá pra classificar sem casar texto de mensagem. A `message` fica em inglês,
// como as do pacote, porque é a camada técnica que vai pro console.
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
