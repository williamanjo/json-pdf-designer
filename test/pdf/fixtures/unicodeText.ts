import type { Template } from "../../../src/types";

// The REAL encoding boundary with no custom font: pdf-lib's standard
// Helvetica (WinAnsi) covers Latin accents (Portuguese) with room to spare,
// but does NOT cover emoji/CJK/Arabic — that is already documented (see
// docs/USAGE.md, the "Custom font" section: `.woff`/`.woff2`/`fontBytes`
// solves it). This pair of fixtures exists to confirm/pin that behavior on
// purpose (see test/pdf/generate.torture.test.ts), not to "fix" anything.
export function ptBrAccentsTemplate(): Template {
  return {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: "txt1",
        name: "texto_acentuado",
        type: "text",
        x: 10,
        y: 10,
        width: 190,
        height: 30,
        content:
          "Relatório de operação — atenção: informação sujeita à revisão. " +
          "Número do pedido, endereço, ação, café, êxito, órgão, saída — " +
          "texto bem comprido pra também testar truncamento normal.",
        fontSize: 10,
        fontColor: "#000000",
        alignment: "left",
      },
    ],
  };
}

export function emojiTemplate(): Template {
  return {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: "txt1",
        name: "texto_emoji",
        type: "text",
        x: 10,
        y: 10,
        width: 190,
        height: 30,
        content: "Status: aprovado 😀",
        fontSize: 10,
        fontColor: "#000000",
        alignment: "left",
      },
    ],
  };
}
