declare module "wawoff2" {
  export function decompress(input: Uint8Array): Promise<Uint8Array>;
  export function compress(input: Uint8Array): Promise<Uint8Array>;
}

// The raw emscripten binding, underneath the decompress() above — used
// directly in fontUtils.ts to work around a real race condition in the
// official wrapper (see the comment in fontUtils.ts).
declare module "wawoff2/build/decompress_binding.js" {
  interface DecompressBinding {
    decompress(input: Uint8Array): Uint8Array | false;
    calledRun?: boolean;
    onRuntimeInitialized?: () => void;
  }
  const binding: DecompressBinding;
  export default binding;
}

// Pure inflate (zlib/deflate), used in fontUtils.ts to decompress a WOFF
// (v1)'s tables — with no @types of its own.
declare module "tiny-inflate" {
  export default function inflate(source: Uint8Array, dest: Uint8Array): Uint8Array;
}
