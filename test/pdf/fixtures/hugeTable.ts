import type { Template } from "../../../src/types";

// Tabela com centenas de linhas — precisa quebrar em várias páginas físicas
// de verdade (não só testar a MATEMÁTICA de paginação, como
// test/pdf/pagination.test.ts já faz, mas o pipeline `generatePdf` inteiro
// rodando até o fim sem travar/demorar demais com um volume realista).
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
