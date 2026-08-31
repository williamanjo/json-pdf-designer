import type { Template } from "../../../src/types";

// Tabela sem NENHUMA linha de dado — só o cabeçalho. Caso de borda comum
// (fonte de dados retornou array vazio) que não deveria travar/lançar.
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
