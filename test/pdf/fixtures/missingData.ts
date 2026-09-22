import type { Binding, Template } from "../../../src/types";

// Bindings pointing at paths that do NOT exist in the real data (a missing
// field, null, a bound array that is not an array) — none of them should hang
// or throw, only render empty/a fallback, as documented on each resolver.
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
    // "pedido.total" exists but is null — resolveArg/getCaseInsensitive have
    // to treat it as absent, not throw.
    { schemaName: "tabela_sem_array", type: "array", path: "naoExisteNoDado", columns: ["A", "B"] },
  ];
  const data = { pedido: { total: null } }; // "cliente" does not even exist; "pedido.total" exists and is null.
  return { template, data, bindings };
}
