import type { Template } from "../../../src/types";

// A table with hundreds of rows — it has to break across several real
// physical pages (not only testing the pagination ARITHMETIC, as
// test/pdf/pagination.test.ts already does, but the whole `generatePdf`
// pipeline running to the end without hanging or taking too long on a
// realistic volume).
export function hugeTableTemplate(rows = 600): Template {
  return {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: "t1",
        name: "tabela_grande",
        type: "table",
        x: 10,
        y: 20,
        width: 190,
        height: 20,
        head: ["Item", "Quantidade", "Valor"],
        content: Array.from({ length: rows }, (_, i) => [`Item ${i + 1}`, String(i % 10), String((i * 1.5).toFixed(2))]),
      },
    ],
  };
}
