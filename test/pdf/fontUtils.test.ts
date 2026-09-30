import { describe, expect, it } from "vitest";
import { normalizeFontBytes } from "../../src/pdf/fontUtils";

describe("normalizeFontBytes", () => {
  it("assinatura nem WOFF2 (wOF2) nem WOFF1 (wOFF) -> retorna os bytes de entrada sem alteração", async () => {
    // A real TTF/OTF sfnt tag (0x00010000), not a WOFF signature — that
    // branch is entirely synchronous (no WASM/decompression), it only does
    // `return arr` after checking both signatures.
    const bytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef]);

    const result = await normalizeFontBytes(bytes);

    expect(result).toEqual(bytes);
    expect(Array.from(result)).toEqual([0x00, 0x01, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef]);
  });

  it("aceita ArrayBuffer (não só Uint8Array) e retorna os bytes sem alteração pra assinatura desconhecida", async () => {
    const buffer = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]).buffer;

    const result = await normalizeFontBytes(buffer);

    expect(Array.from(result)).toEqual([0x00, 0x01, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]);
  });
});
