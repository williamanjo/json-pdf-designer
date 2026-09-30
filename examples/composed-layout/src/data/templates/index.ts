import { kandirExample } from "./kandir";
import { reciboExample } from "./recibo";
import { pedidosExample } from "./pedidos";
import { turmaExample } from "./turma";
import { financeiroExample } from "./financeiro";
import { dashboardExample } from "./dashboard";
import type { ExampleDefinition } from "./types";

export type { ExampleDefinition } from "./types";

// The ready-made examples of the "Load example…" dropdown — each one swaps
// template/binding AND the data source for its own sample JSON. Each
// template/binding lives in its own file (./kandir.ts, ./recibo.ts...), and
// this index only builds the map the dropdown iterates. A Record type (not
// inferred) on purpose — App.tsx indexes it by a dynamic key (EXAMPLES[key],
// with key coming from the <select>).
export const EXAMPLES: Record<string, ExampleDefinition> = {
  kandir: kandirExample,
  recibo: reciboExample,
  pedidos: pedidosExample,
  turma: turmaExample,
  financeiro: financeiroExample,
  dashboard: dashboardExample,
};
