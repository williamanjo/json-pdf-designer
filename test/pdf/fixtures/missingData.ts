import type { Binding, Template } from "../../../src/types";

// Vínculos apontando pra paths que NÃO existem no dado real (campo ausente,
// null, array vinculado que não é array) — nenhum deve travar/lançar,
// só renderizar vazio/fallback, igual documentado em cada resolver.
export function missingDataTemplate(): { template: Template; data: unknown; bindings: Binding[] } {
  const template: Template = {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: "txt1",
        name: "campo_ausente",
        type: "text",
        x: 10,
        y: 10,
        width: 100,
        height: 10,
        content: "{cliente.nome} — {cliente.endereco.cidade}",
        fontSize: 10,
        fontColor: "#000000",
        alignment: "left",
      },
      {
        id: "txt2",
        name: "campo_null",
        type: "text",
        x: 10,
        y: 25,
        width: 100,
        height: 10,
        content: "Valor: {pedido.total}",
        fontSize: 10,
        fontColor: "#000000",
        alignment: "left",
      },
      {
        id: "t1",
        name: "tabela_sem_array",
        type: "table",
        x: 10,
        y: 40,
        width: 190,
        height: 20,
        head: ["A", "B"],
        content: [["fallback1", "fallback2"]],
      },
    ],
  };
  const bindings: Binding[] = [
    // "pedido.total" existe mas é null — resolveArg/getCaseInsensitive
    // devem tratar como ausente, não lançar.
    { schemaName: "tabela_sem_array", type: "array", path: "naoExisteNoDado", columns: ["A", "B"] },
  ];
  const data = { pedido: { total: null } }; // "cliente" nem existe; "pedido.total" existe e é null.
  return { template, data, bindings };
}
