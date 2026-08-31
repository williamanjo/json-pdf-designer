import type { Template } from "../../../src/types";

// Fronteira REAL de codificação sem fonte customizada: o Helvetica padrão
// do pdf-lib (WinAnsi) cobre acentuação latina (português) de sobra, mas
// NÃO cobre emoji/CJK/árabe — isso já é documentado (ver docs/USAGE.md,
// seção "Custom font": `.woff`/`.woff2`/`fontBytes` resolve). Este par de
// fixtures existe pra confirmar/travar esse comportamento de propósito
// (ver test/pdf/generate.torture.test.ts), não pra "consertar" nada.
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
