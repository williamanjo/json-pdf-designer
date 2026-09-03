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

// A fonte é ATIVO DESTE EXAMPLE (src/assets/inter-regular.ttf), não do
// pacote — então a falha de carregar é nossa, e o pacote devolve `null` pra
// ela em `describePdfError`. Classe própria pra o banner poder dizer onde o
// arquivo mora, em vez de mostrar um "failed to fetch" cru.
export class FontAssetError extends Error {
  constructor(cause?: unknown) {
    super("Could not load the bundled font asset (src/assets/inter-regular.ttf)");
    this.name = "FontAssetError";
    this.cause = cause;
  }
}

export function loadDefaultFont(): Promise<ArrayBuffer> {
  if (!cached) {
    // `res.ok` explícito: `fetch` resolve com 404 em vez de rejeitar, então
    // sem esta checagem um arquivo ausente virava um ArrayBuffer com o HTML
    // da página de erro dentro — e o pdf-lib falhava depois, num ponto que
    // não diz nada sobre a causa.
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
