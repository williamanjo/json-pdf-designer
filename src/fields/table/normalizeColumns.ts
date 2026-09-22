import type { Binding, Template, TableSchema, TableColumn } from "../../types";
import { tokenFor } from "./columnFormula";

// NORMALIZING A RAW-KEY COLUMN INTO A TOKEN.
//
// The model had two forms for "where does this column's value come from":
//
//   binding.columns[i] = "fatura"                      // a raw key
//   binding.columns[i] = { label, formula: "{fatura}" } // calculated
//
// and the raw key was the source of three problems at once: the `ƒx` opened
// empty (the panel only showed the object form), renaming the title rewrote
// the raw key with the new title, and the resolver had three levels of
// fallback to decide the cell. With the token, the reference lives in the
// formula and nothing else depends on the label.
//
// There is deliberately NO `TemplateVersion` bump: the column key lives in
// the BINDINGS, which are not part of the `Template` — `migrateTemplate`
// could not do this on its own, and a migrator that only looks at the
// template would leave half the work undone.
//
// It is also not called in the `<DesignerProvider>`: rewriting the consumer's
// template on mount is an invisible side effect. Whoever loads a saved
// project calls this explicitly (see examples/report-builder).
//
// Idempotent: running it twice changes nothing, because the second pass finds
// `content` already holding a `{` and only confirms the binding.
export function normalizeTableColumns(
  template: Template,
  bindings: Binding[]
): { template: Template; bindings: Binding[] } {
  let mudouTemplate = false;
  const porNome = new Map<string, Extract<Binding, { type: "array" }>>();
  for (const b of bindings) {
    if (b.type === "array") porNome.set(b.schemaName, b);
  }
  if (porNome.size === 0) return { template, bindings };

  const colunasNovas = new Map<string, TableColumn[]>();

  function normalizaTabela(tabela: TableSchema): TableSchema {
    const binding = porNome.get(tabela.name);
    if (!binding) return tabela;

    const content = (tabela.content[0] ?? []).slice();
    const columns = binding.columns.slice();
    let mudou = false;

    tabela.head.forEach((rotulo, i) => {
      const cell = content[i];
      const col = columns[i];

      // The cell is already a template: it is the PDF's authority, so the
      // binding is what aligns to it — never the other way around.
      if (cell && cell.includes("{")) {
        if (typeof col === "string" || col === undefined) {
          columns[i] = { label: rotulo, formula: cell };
        }
        return;
      }

      // A raw key: the reference becomes a token in both places.
      if (typeof col === "string") {
        const token = tokenFor(col);
        content[i] = token;
        columns[i] = { label: rotulo, formula: token };
        mudou = true;
      }
    });

    colunasNovas.set(tabela.name, columns);
    if (!mudou) return tabela;
    mudouTemplate = true;
    // Only row 0 is the DESIGN row (the column's formula); the others are
    // preview and follow the same swap by index.
    return { ...tabela, content: [content, ...tabela.content.slice(1)] };
  }

  const schemas = template.schemas.map((s) => (s.type === "table" ? normalizaTabela(s) : s));
  const pages = template.pages?.map((p) => ({
    ...p,
    schemas: p.schemas.map((s) => (s.type === "table" ? normalizaTabela(s) : s)),
  }));

  const bindingsNovos = bindings.map((b) => {
    if (b.type !== "array") return b;
    const columns = colunasNovas.get(b.schemaName);
    if (!columns) return b;
    const igual = columns.length === b.columns.length && columns.every((c, i) => c === b.columns[i]);
    return igual ? b : { ...b, columns };
  });

  const mudouBindings = bindingsNovos.some((b, i) => b !== bindings[i]);
  return {
    template: mudouTemplate || pages !== template.pages ? { ...template, schemas, ...(pages ? { pages } : {}) } : template,
    bindings: mudouBindings ? bindingsNovos : bindings,
  };
}
