import inflate from "tiny-inflate";
import { FontDecompressFailedError, FontDecompressTimeoutError, Woff2SupportMissingError } from "../errors";

const WOFF2_SIGNATURE = 0x774f4632; // "wOF2"
const WOFF1_SIGNATURE = 0x774f4646; // "wOFF"

// The ceiling on waiting for the WOFF2 decompression (see withTimeout below).
// It lives in a constant because it goes into the error's DATA
// (FontDecompressTimeoutError.timeoutMs) — the number used to appear only
// inside the message's sentence, and the catcher had no way to know the wait.
const WOFF2_TIMEOUT_MS = 8000;

function readUint32(view: DataView): number {
  return view.getUint32(0, false);
}

// WOFF (v1) is far simpler than WOFF2 — each table is compressed
// individually with plain zlib (RFC 1950), with no WASM at all.
// `tiny-inflate` already comes in transitively through fontkit (used to parse
// WOFF2 in the editor), promoted here to a direct dependency since it is used
// explicitly.
//
// The file layout (big-endian), signature already checked by the caller:
//   header (44 bytes): sig(4) flavor(4) length(4) numTables(2) reserved(2)
//     totalSfntSize(4) majorVersion(2) minorVersion(2) metaOffset(4)
//     metaLength(4) metaOrigLength(4) privOffset(4) privLength(4)
//   table directory (20 bytes each, numTables entries, ALREADY sorted by
//     tag — a requirement of the WOFF format itself): tag(4) offset(4)
//     compLength(4) origLength(4) origChecksum(4)
//   each table's data (compLength bytes) — zlib if compressed, raw if not
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
    // zlib = a 2-byte header (CMF/FLG) + raw deflate + a 4-byte Adler32 at
    // the end — tiny-inflate only understands the raw deflate in the middle;
    // skip the header, and the trailer is ignored (the inflate already stops
    // by itself at the end of the deflate stream).
    return inflate(compressed.subarray(2), new Uint8Array(entry.origLength)) as Uint8Array;
  });

  // It rebuilds a real sfnt (TTF/OTF): the header (12 bytes) + the table
  // directory (16 bytes/table) + each table's data aligned to 4 bytes.
  // searchRange/entrySelector/rangeShift follow the sfnt format's standard
  // formula (the same computation any font generator uses). It reuses the
  // `origChecksum` the WOFF itself already stores (computed over the original
  // table) — with no need to recompute anything.
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

// The official decompress() of the "wawoff2" package (src/decompress.js) has
// a real race condition:
//
//   const em_module = require('./build/decompress_binding.js')
//   const runtimeInit = new Promise(resolve => {
//     em_module.onRuntimeInitialized = resolve   // subscribes AFTER the require
//   })
//
// That binding's WASM comes embedded as a data URI in the JS itself (with no
// network fetch) — in bundlers/environments where the instantiation ends up
// finishing synchronously (or before that line runs), the runtime has already
// fired `onRuntimeInitialized` (the default, a no-op) BEFORE the package
// subscribed its callback — the `resolve` is never called, and the package's
// promise hangs forever (silently, with no error at all). That matches exactly
// the report of "sometimes it hangs indefinitely, only in certain
// environments, even though it works fine in Node" — one timing detail.
//
// It is fixed by checking emscripten's standard flag (`calledRun`, true once
// the runtime has initialized) BEFORE subscribing the callback — if it has
// already initialized, run straight away; only subscribe the callback if it
// really has not run yet. It talks to the binding directly (instead of the
// package's decompress.js) to apply that fix without an external patch.
// `wawoff2` is an OPTIONAL dependency (a peerDependency, not installed along
// by default) — only whoever really embeds a .woff2 font needs it; most
// projects using this package never call this, and forcing wawoff2 as a
// direct dependency for everyone has 2 real costs that are not worth it for
// those who do not use it: it pulls in a large WASM binary needlessly, and its
// `decompress_binding.js` has a Node code path (`fs`/`path`) that bundlers
// like Vite warn about as "externalized for browser compatibility" even though
// that path never runs in the browser (a harmless false positive, but reported
// as confusing). A dynamic import (not a static one) + `@vite-ignore` avoids
// the bundler trying to resolve/bundle the module at build time — it is only
// loaded (and only FAILS, with a clear message, if not installed) when a
// WOFF2 really has to be decompressed.
async function loadDecompressBinding(): Promise<{
  decompress(input: Uint8Array): Uint8Array | false;
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
}> {
  try {
    const mod = await import(/* @vite-ignore */ "wawoff2/build/decompress_binding.js");
    return mod.default ?? mod;
  } catch {
    throw new Woff2SupportMissingError();
  }
}

function decompressWoff2(input: Uint8Array): Promise<Uint8Array> {
  return loadDecompressBinding().then(
    (decompressBinding) =>
      new Promise((resolve, reject) => {
        function run() {
          const result = decompressBinding.decompress(input);
          if (result === false) reject(new FontDecompressFailedError("woff2"));
          else resolve(result);
        }
        if (decompressBinding.calledRun) run();
        else decompressBinding.onRuntimeInitialized = run;
      })
  );
}

// A safety net for whatever WASM instability is LEFT (outside our control —
// a CSP blocking wasm-eval, a very old engine and so on): without it, any
// other cause of a hang would still leave the caller (generatePdf) waiting
// forever, with no feedback at all for the user.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new FontDecompressTimeoutError("woff2", ms)), ms);
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

// pdf-lib (and the PDF format itself) only understands real TTF/OTF — a
// WOFF/WOFF2 file (the format packages like @fontsource distribute, optimized
// for the web) is only a compressed WRAPPER over the real TTF/OTF. fontkit
// reads WOFF2 just fine (to measure/draw here in the editor), but if you pass
// the raw WOFF2 bytes straight to pdf-lib, it embeds the compressed wrapper
// as though it were already the font — the PDF comes out with a corrupt font
// (a wrong glyph on some characters, like "." becoming "ï", and Acrobat even
// warns "could not extract the embedded font"). Here we detect WOFF2 by its
// signature and decompress it into the real TTF/OTF before embedding — a WOFF
// (v1) is decompressed on the spot too (decompressWoff1, synchronous, no
// WASM).
export async function normalizeFontBytes(bytes: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (arr.length < 4) return arr;

  const view = new DataView(arr.buffer, arr.byteOffset, 4);
  const signature = readUint32(view);

  if (signature === WOFF2_SIGNATURE) {
    return withTimeout(decompressWoff2(arr), WOFF2_TIMEOUT_MS);
  }

  if (signature === WOFF1_SIGNATURE) {
    return decompressWoff1(arr);
  }

  return arr;
}
