import type { Binding, Template, TableSchema, TableColumn } from "../../types";
import { tokenFor } from "./columnFormula";

// NORMALIZAR COLUNA DE CHAVE CRUA PRA TOKEN.
//
// O modelo tinha duas formas pra "de onde vem o valor desta coluna":
//
//   binding.columns[i] = "fatura"                      // chave crua
//   binding.columns[i] = { label, formula: "{fatura}" } // calculada
//
// e a chave crua era a fonte de três problemas de uma vez: o `ƒx` abria vazio
// (o painel só mostrava a forma de objeto), renomear o título reescrevia a
// chave crua com o título novo, e o resolver tinha três níveis de fallback
// pra decidir a célula. Com o token, a referência mora na fórmula e nada mais
// depende do rótulo.
//
// NÃO tem bump de `TemplateVersion` de propósito: a chave da coluna vive nos
// BINDINGS, que não fazem parte do `Template` — `migrateTemplate` não
// conseguiria fazer isto sozinho, e um migrador que só olha o template
// deixaria metade do trabalho pela metade.
//
// Também não é chamado no `<DesignerProvider>`: reescrever o template do
// consumidor na montagem é efeito colateral invisível. Quem carrega projeto
// salvo chama isto explicitamente (ver examples/report-builder).
//
// Idempotente: rodar duas vezes não muda nada, porque a segunda passada
// encontra `content` já com `{` e só confirma o vínculo.
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

      // A célula já é template: ela é a autoridade do PDF, então o vínculo é
      // que se alinha a ela — nunca o contrário.
      if (cell && cell.includes("{")) {
        if (typeof col === "string" || col === undefined) {
          columns[i] = { label: rotulo, formula: cell };
        }
        return;
      }

      // Chave crua: a referência vira token nos dois lugares.
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
    // Só a linha 0 é a linha de DESIGN (a fórmula da coluna); as outras são
    // preview e acompanham a mesma troca por índice.
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
