import decompressBinding from "wawoff2/build/decompress_binding.js";
import inflate from "tiny-inflate";

const WOFF2_SIGNATURE = 0x774f4632; // "wOF2"
const WOFF1_SIGNATURE = 0x774f4646; // "wOFF"

function readUint32(view: DataView): number {
  return view.getUint32(0, false);
}

// WOFF (v1) é bem mais simples que WOFF2 — cada tabela é comprimida
// individualmente com zlib puro (RFC 1950), sem WASM nenhum. `tiny-inflate`
// já vem transitivamente via fontkit (usado pra parsear WOFF2 no editor),
// promovido aqui a dependência direta por ser usado explicitamente.
//
// Layout do arquivo (big-endian), assinatura já checada por quem chama:
//   header (44 bytes): sig(4) flavor(4) length(4) numTables(2) reserved(2)
//     totalSfntSize(4) majorVersion(2) minorVersion(2) metaOffset(4)
//     metaLength(4) metaOrigLength(4) privOffset(4) privLength(4)
//   table directory (20 bytes cada, numTables entradas, JÁ ordenada por
//     tag — exigência do próprio formato WOFF): tag(4) offset(4)
//     compLength(4) origLength(4) origChecksum(4)
//   dados de cada tabela (compLength bytes) — zlib se compLength <
//     origLength, bytes crus (sem compressão) se forem iguais
function decompressWoff1(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flavor = view.getUint32(4, false);
  const numTables = view.getUint16(12, false);

  const entries = Array.from({ length: numTables }, (_, i) => {
    const base = 44 + i * 20;
    return {
      tag: view.getUint32(base, false),
      offset: view.getUint32(base + 4, false),
      compLength: view.getUint32(base + 8, false),
      origLength: view.getUint32(base + 12, false),
      origChecksum: view.getUint32(base + 16, false),
    };
  });

  const tables = entries.map((entry) => {
    const compressed = bytes.subarray(entry.offset, entry.offset + entry.compLength);
    if (entry.compLength === entry.origLength) return compressed;
    // zlib = 2 bytes de header (CMF/FLG) + deflate cru + 4 bytes de
    // Adler32 no final — tiny-inflate só entende o deflate cru do meio;
    // pula o header, e o trailer é ignorado (o inflate já para sozinho
    // no fim do stream deflate).
    return inflate(compressed.subarray(2), new Uint8Array(entry.origLength)) as Uint8Array;
  });

  // Reconstrói um sfnt (TTF/OTF) de verdade: header (12 bytes) + table
  // directory (16 bytes/tabela) + dados de cada tabela alinhados em 4
  // bytes. searchRange/entrySelector/rangeShift seguem a fórmula padrão
  // do formato sfnt (mesmo cálculo usado por qualquer gerador de fonte).
  // Reaproveita o `origChecksum` que o próprio WOFF já guarda (calculado
  // sobre a tabela original) — sem precisar recalcular nada.
  const entrySelector = numTables > 0 ? Math.floor(Math.log2(numTables)) : 0;
  const searchRange = 2 ** entrySelector * 16;
  const rangeShift = numTables * 16 - searchRange;

  const offsets: number[] = [];
  let cursor = 12 + numTables * 16;
  for (const table of tables) {
    offsets.push(cursor);
    cursor += table.length;
    if (cursor % 4 !== 0) cursor += 4 - (cursor % 4);
  }

  const out = new Uint8Array(cursor);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, flavor, false);
  outView.setUint16(4, numTables, false);
  outView.setUint16(6, searchRange, false);
  outView.setUint16(8, entrySelector, false);
  outView.setUint16(10, rangeShift, false);

  entries.forEach((entry, i) => {
    const dirBase = 12 + i * 16;
    outView.setUint32(dirBase, entry.tag, false);
    outView.setUint32(dirBase + 4, entry.origChecksum, false);
    outView.setUint32(dirBase + 8, offsets[i], false);
    outView.setUint32(dirBase + 12, entry.origLength, false);
    out.set(tables[i], offsets[i]);
  });

  return out;
}

// O decompress() oficial do pacote "wawoff2" (src/decompress.js) tem uma
// race condition real:
//
//   const em_module = require('./build/decompress_binding.js')
//   const runtimeInit = new Promise(resolve => {
//     em_module.onRuntimeInitialized = resolve   // assina DEPOIS do require
//   })
//
// O WASM desse binding vem embutido como data URI no próprio JS (sem
// fetch de rede) — em bundlers/ambientes onde a instanciação acaba
// terminando de forma síncrona (ou antes dessa linha rodar), o runtime já
// disparou `onRuntimeInitialized` (o padrão, um no-op) ANTES do pacote
// assinar o callback — o `resolve` nunca é chamado, e a promise do
// pacote trava pra sempre (silencioso, sem erro nenhum). Isso bate exatamente
// com o relato de "às vezes trava indefinidamente, só em certos ambientes,
// mesmo funcionando certinho em Node" — depende só de UM detalhe de timing.
//
// Corrige checando a flag padrão do emscripten (`calledRun`, true depois
// que o runtime já inicializou) ANTES de assinar o callback — se já
// inicializou, roda direto; só assina o callback se realmente ainda não
// rodou. Fala com o binding direto (em vez do decompress.js do pacote)
// pra aplicar esse fix sem depender de um patch externo.
function decompressWoff2(input: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    function run() {
      const result = decompressBinding.decompress(input);
      if (result === false) reject(new Error("ConvertWOFF2ToTTF failed"));
      else resolve(result);
    }
    if (decompressBinding.calledRun) run();
    else decompressBinding.onRuntimeInitialized = run;
  });
}

// Rede de segurança pro que SOBRAR de instabilidade do WASM (fora do
// nosso controle — CSP bloqueando wasm-eval, engine muito antiga etc):
// sem isso, qualquer outra causa de travamento ainda deixaria quem chamou
// (generatePdf) esperando pra sempre, sem feedback nenhum pro usuário.
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// pdf-lib (e o formato PDF em si) só entende TTF/OTF de verdade — um arquivo
// WOFF/WOFF2 (o formato que pacotes tipo @fontsource distribuem, otimizado
// pra web) é só um WRAPPER comprimido em cima do TTF/OTF real. fontkit lê
// WOFF2 de boa (pra medir/desenhar aqui no editor), mas se você passar os
// bytes crus do WOFF2 direto pro pdf-lib, ele embute o wrapper comprimido
// como se já fosse a fonte — o PDF sai com a fonte corrompida (glifo
// errado nuns caracteres, tipo "." virando "ï", e o Acrobat chega a avisar
// "não foi possível extrair a fonte incorporada"). Aqui a gente detecta
// WOFF2 pela assinatura e descomprime pro TTF/OTF de verdade antes de
// embutir — WOFF (v1) descomprime na hora também (decompressWoff1,
// síncrono, sem WASM).
export async function normalizeFontBytes(bytes: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (arr.length < 4) return arr;

  const view = new DataView(arr.buffer, arr.byteOffset, 4);
  const signature = readUint32(view);

  if (signature === WOFF2_SIGNATURE) {
    return withTimeout(
      decompressWoff2(arr),
      8000,
      "Descompressão de WOFF2 travou (instabilidade conhecida do WASM em alguns ambientes) — " +
        "converta o arquivo pra .ttf/.otf uma vez, offline (wawoff2 rodando em Node, por exemplo), " +
        "e use esse .ttf/.otf direto como fontBytes."
    );
  }

  if (signature === WOFF1_SIGNATURE) {
    return decompressWoff1(arr);
  }

  return arr;
}
