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

export function loadDefaultFont(): Promise<ArrayBuffer> {
  if (!cached) {
    cached = fetch(interTtfUrl).then((res) => res.arrayBuffer());
  }
  return cached;
}
