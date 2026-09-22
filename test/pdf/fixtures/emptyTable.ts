import type { Template } from "../../../src/types";

// A table with NO data rows at all — only the header. A common edge case (the
// data source returned an empty array) that should not hang or throw.
export function emptyTableTemplate(): Template {
  return {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: "t1",
        name: "tabela_vazia",
        type: "table",
        x: 10,
        y: 20,
        width: 190,
        height: 20,
        head: ["Produto", "Qtd", "Total"],
        content: [],
      },
    ],
  };
}
