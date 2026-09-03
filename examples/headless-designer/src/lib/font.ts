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

// Falha em BUSCAR o asset — distinta dos erros de fonte DO PACOTE, que são
// todos sobre bytes que chegaram e o fontkit recusou. Aqui os bytes nem
// chegaram: build sem o .ttf, deploy com base path errado, disco. É erro
// NOSSO, então `describePdfError` devolve `null` e o texto sai do dicionário
// da casca (ver lib/generationError.ts).
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
