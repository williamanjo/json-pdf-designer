declare module "wawoff2" {
  export function decompress(input: Uint8Array): Promise<Uint8Array>;
  export function compress(input: Uint8Array): Promise<Uint8Array>;
}

// Binding emscripten cru, por baixo do decompress() de cima — usado direto
// em fontUtils.ts pra contornar uma race condition real do wrapper oficial
// (ver comentário em fontUtils.ts).
declare module "wawoff2/build/decompress_binding.js" {
  interface DecompressBinding {
    decompress(input: Uint8Array): Uint8Array | false;
    calledRun?: boolean;
    onRuntimeInitialized?: () => void;
  }
  const binding: DecompressBinding;
  export default binding;
}

// Inflate (zlib/deflate) puro, usado em fontUtils.ts pra descomprimir as
// tabelas de um WOFF (v1) — sem @types próprio.
declare module "tiny-inflate" {
  export default function inflate(source: Uint8Array, dest: Uint8Array): Uint8Array;
}
