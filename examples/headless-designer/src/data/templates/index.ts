import { kandirExample } from "./kandir";
import { reciboExample } from "./recibo";
import { pedidosExample } from "./pedidos";
import { turmaExample } from "./turma";
import { financeiroExample } from "./financeiro";
import { dashboardExample } from "./dashboard";
import type { ExampleDefinition } from "./types";

export type { ExampleDefinition } from "./types";

// Exemplos prontos do dropdown "Carregar exemplo…" — cada um troca
// template/binding E a fonte de dados pro JSON de exemplo dele. Cada
// template/binding mora no próprio arquivo (./kandir.ts, ./recibo.ts...),
// esse índice só monta o mapa que o dropdown itera. Tipo Record (não
// inferido) de propósito — App.tsx indexa por chave dinâmica
// (EXAMPLES[key], key vindo do <select>).
export const EXAMPLES: Record<string, ExampleDefinition> = {
  kandir: kandirExample,
  recibo: reciboExample,
  pedidos: pedidosExample,
  turma: turmaExample,
  financeiro: financeiroExample,
  dashboard: dashboardExample,
};
