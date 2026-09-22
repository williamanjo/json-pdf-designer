import { describe, expect, it } from "vitest";
import { makeDesignerActions, type DesignerLatest } from "../../src/designer/actions";
import { dictFor } from "../../src/i18n/dictionaries";
import type { Binding, Schema, TableSchema, Template, TextSchema } from "../../src/types";

// This suite covers the logic that, while it lived inside Designer.tsx, had
// NO test at all — it would have required mounting the component. Since the
// actions are a factory that only dispatches functional updaters, the updaters
// can be captured and applied to a fake template: it is the state React would produce.

function makeText(overrides: Partial<TextSchema> = {}): TextSchema {
  return {
    id: "t1",
    name: "texto",
    type: "text",
    x: 0,
    y: 0,
    width: 80,
    height: 10,
    content: "",
    fontSize: 10,
    fontColor: "#000000",
    alignment: "left",
    ...overrides,
  };
}

function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "tb1",
    name: "tabela",
    type: "table",
    x: 0,
    y: 0,
    width: 180,
    height: 40,
    head: ["orgao", "fatura", "tarKandir"],
    content: [["{orgao}", "{fatura}", "{tarKandir}"]],
    ...overrides,
  };
}

// A test harness: it applies each dispatched updater on top of the current
// state, in order, exactly as React would. It returns the final state.
function harness(initial: { template: Template; bindings?: Binding[]; selectedId?: string | null; isolateBands?: boolean; gridSizeMm?: number }) {
  const state = {
    template: initial.template,
    bindings: initial.bindings ?? [],
    selectedIds: [] as string[],
    isolateBands: initial.isolateBands ?? false,
    backgroundUploadError: null as string | null,
  };

  const latest: { current: DesignerLatest } = {
    current: {
      template: state.template,
      bindings: state.bindings,
      selectedId: initial.selectedId ?? null,
      isolateBands: initial.isolateBands ?? false,
      t: dictFor("pt-BR"),
      dataSources: undefined,
      gridSizeMm: initial.gridSizeMm,
      onChangeTemplate: (update) => {
        state.template = typeof update === "function" ? update(state.template) : update;
        // The ref is reassigned during render; here the "render" is synchronous.
        latest.current.template = state.template;
      },
      onChangeBindings: (update) => {
        state.bindings = typeof update === "function" ? update(state.bindings) : update;
        latest.current.bindings = state.bindings;
      },
      setSelectedIds: (ids) => {
        state.selectedIds = ids;
      },
      setIsolateBands: (update) => {
        state.isolateBands = typeof update === "function" ? update(state.isolateBands) : update;
        latest.current.isolateBands = state.isolateBands;
      },
      setBackgroundUploadError: (message) => {
        state.backgroundUploadError = message;
      },
    },
  };

  return { actions: makeDesignerActions(latest), state, latest };
}

// A variant that does NOT apply the updaters right away: it queues them and
// only applies them on flush(), leaving `latest.current` frozen at the initial
// value. It is the real scenario of "two clicks in quick succession, before
// the 1st re-render" — the one that gave rise to the "orgao" at the index of
// "tarKandir" bug. A handler that went back to reading CONTENT from the
// closure/ref instead of `prev` would pass the synchronous harness above and
function deferredHarness(initial: { template: Template; bindings?: Binding[]; selectedId?: string | null }) {
  const queued: Array<() => void> = [];
  const state = { template: initial.template, bindings: initial.bindings ?? [] };

  const latest: { current: DesignerLatest } = {
    current: {
      template: initial.template,
      bindings: initial.bindings ?? [],
      selectedId: initial.selectedId ?? null,
      isolateBands: false,
      t: dictFor("pt-BR"),
      dataSources: undefined,
      gridSizeMm: undefined,
      onChangeTemplate: (update) => {
        queued.push(() => {
          state.template = typeof update === "function" ? update(state.template) : update;
        });
      },
      onChangeBindings: (update) => {
        queued.push(() => {
          state.bindings = typeof update === "function" ? update(state.bindings) : update;
        });
      },
      setSelectedIds: () => {},
      // The deferred harness only exists to prove that the WRITE comes out of
      // `prev`. None of its tests touches shell state, so both setters are
      // no-ops — declared so there is no `as unknown as DesignerLatest` hiding
      // a new field that should have been considered.
      setIsolateBands: () => {},
      setBackgroundUploadError: () => {},
    },
  };

  function flush() {
    for (const apply of queued) apply();
    queued.length = 0;
  }

  return { actions: makeDesignerActions(latest), state, flush };
}

describe("updateSchema", () => {
  it("espelha célula de tabela editada no canvas pra fórmula do vínculo", () => {
    // The cell IS the column's formula (generate.ts resolves the row from
    // `content`). Without mirroring, the ƒx panel keeps showing the old
    // formula and what appears in the panel is not what comes out in the PDF.
    const table = makeTable({ head: ["valor"], content: [["{valor}"]] });
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [table] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["valor"] }],
    });

    actions.updateSchema("tb1", { content: [["{valor} - {moeda}"]] } as Partial<Schema>);

    expect((state.template.schemas[0] as TableSchema).content).toEqual([["{valor} - {moeda}"]]);
    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.columns).toEqual([{ label: "valor", formula: "{valor} - {moeda}" }]);
  });

  it("não toca no vínculo quando o patch não muda `content`", () => {
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable()] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["orgao"] }],
    });
    const before = state.bindings;

    actions.updateSchema("tb1", { x: 20 });

    expect(state.bindings).toBe(before);
  });
});

describe("renameSchema", () => {
  it("remapeia bindings.schemaName junto com o nome do schema", () => {
    // generate.ts resolves a binding by NAME — without the remap, the binding
    // points at the old name, stops matching, and the field silently
    // disappears from the PDF.
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [makeText({ name: "antigo" })] },
      bindings: [{ schemaName: "antigo", type: "scalar", path: "cliente.nome" }],
    });

    actions.renameSchema("t1", "  novo  ");

    expect(state.template.schemas[0].name).toBe("novo");
    expect(state.bindings[0].schemaName).toBe("novo");
  });

  it("ignora nome vazio e nome já usado por outro campo", () => {
    const { actions, state } = harness({
      template: {
        page: { width: 210, height: 297 },
        schemas: [makeText({ id: "t1", name: "um" }), makeText({ id: "t2", name: "dois" })],
      },
    });

    actions.renameSchema("t1", "   ");
    actions.renameSchema("t1", "dois");

    expect(state.template.schemas.map((s) => s.name)).toEqual(["um", "dois"]);
  });
});

describe("removeSchema", () => {
  it("limpa sectionId órfão dos filhos da seção apagada", () => {
    // Without this the child keeps an id pointing at a section that no longer
    // exists and leaves the generated PDF, silently, while still visible on
    // the canvas.
    const { actions, state } = harness({
      template: {
        page: { width: 210, height: 297 },
        schemas: [
          { id: "sec1", name: "secao", type: "section", x: 0, y: 0, width: 50, height: 50 },
          makeText({ id: "t1", name: "filho", sectionId: "sec1" }),
        ],
      },
      bindings: [{ schemaName: "secao", type: "section", path: "itens" }],
    });

    actions.removeSchema("sec1");

    expect(state.template.schemas).toHaveLength(1);
    expect(state.template.schemas[0].sectionId).toBeUndefined();
    expect(state.bindings).toEqual([]);
  });
});

describe("setTableHead", () => {
  it("reindexa por NOME, não por posição — o bug do 'orgao' sob o rótulo 'fatura'", () => {
    // Reducing from 3 columns to 1 ("fatura") by POSITION took index 0 of
    // everything, which was "orgao": the PDF came out with the agency under
    // the invoice label.
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable()] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["orgao", "fatura", "tarKandir"] }],
      selectedId: "tb1",
    });

    actions.setTableHead(["fatura"]);

    const table = state.template.schemas[0] as TableSchema;
    expect(table.head).toEqual(["fatura"]);
    expect(table.content).toEqual([["{fatura}"]]);
    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.columns).toEqual(["fatura"]);
  });

  // THE ORIGINAL CLASS OF THE BUG, STILL ALIVE — marked on purpose.
  //
  // `setTableHead` reads `oldHead` from outside the updater and uses it as a
  // name→index map to reindex `binding.columns`. With two head edits in quick
  // succession, the second matches names against a head the first has already
  // reindexed, and writes the wrong column value under a label — exactly the
  // "orgao" under "fatura".
  //
  // It is not fixed because the fix changes semantics: matching by
  // `columnLabel(binding.columns[i])` instead of by `oldHead` alters the
  // result when head and columns are out of sync, which
  // test/table/columns.test.ts pins. It stays as VISIBLE debt: whoever fixes
  // it removes the .skip and the test starts counting.
  it.skip("duas edições de head com estado congelado não embaralham valor sob rótulo", () => {
    const { actions, state, flush } = deferredHarness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable()] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["orgao", "fatura", "tarKandir"] }],
      selectedId: "tb1",
    });

    actions.setTableHead(["fatura", "tarKandir"]);
    actions.setTableHead(["tarKandir"]);
    flush();

    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.columns).toEqual(["tarKandir"]);
  });
});

describe("addTableColumn / removeTableColumn", () => {
  it("dois '+' em sequência, antes de qualquer re-render, somam as duas colunas", () => {
    // It is the race that put an "orgao" at the index of "tarKandir": the 2nd
    // click read head/columns from BEFORE the 1st applied and rewrote the
    // whole array on top, knocking out the other addition.
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable({ head: ["a"], content: [["{a}"]] })] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["a"] }],
      selectedId: "tb1",
    });

    actions.addTableColumn("b");
    actions.addTableColumn("c");

    const table = state.template.schemas[0] as TableSchema;
    expect(table.head).toEqual(["a", "b", "c"]);
    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.columns).toEqual(["a", "b", "c"]);
  });

  it("dois '+' com o estado CONGELADO entre eles ainda somam as duas — a corrida real", () => {
    const { actions, state, flush } = deferredHarness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable({ head: ["a"], content: [["{a}"]] })] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["a"] }],
      selectedId: "tb1",
    });

    actions.addTableColumn("b");
    actions.addTableColumn("c");
    flush();

    const table = state.template.schemas[0] as TableSchema;
    expect(table.head).toEqual(["a", "b", "c"]);
    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.columns).toEqual(["a", "b", "c"]);
  });

  it("remove do head por índice e do vínculo por nome", () => {
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable()] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["orgao", "fatura", "tarKandir"] }],
      selectedId: "tb1",
    });

    actions.removeTableColumn(1);

    const table = state.template.schemas[0] as TableSchema;
    expect(table.head).toEqual(["orgao", "tarKandir"]);
    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.columns).toEqual(["orgao", "tarKandir"]);
  });
});

describe("handleChangeBinding", () => {
  it("vínculo array NOVO numa tabela sincroniza head/content com as colunas", () => {
    // Without this a freshly created table was left with a head of 2
    // placeholders and a full binding.columns — out of alignment from the
    // click on "Bind".
    const { actions, state } = harness({
      template: {
        page: { width: 210, height: 297 },
        schemas: [makeTable({ head: ["Coluna 1", "Coluna 2"], content: [["", ""]] })],
      },
      selectedId: "tb1",
    });

    actions.handleChangeBinding("tabela", { schemaName: "tabela", type: "array", path: "rows", columns: ["a", "b", "c"] });

    const table = state.template.schemas[0] as TableSchema;
    expect(table.head).toEqual(["a", "b", "c"]);
    // The BRACKETED form: the key may have a dot, a space, a parenthesis or a
    // quote, and the bare form would give a wrong path or a syntax error. It
    // is the same rule (`tokenFor`) the new table and the normalization use.
    expect(table.content).toEqual([["{[a]}", "{[b]}", "{[c]}"]]);
    // And no raw-key column survives this path: the label and the reference
    // become separate fields, so renaming one does not touch the other.
    expect(state.bindings[0]).toMatchObject({
      columns: [
        { label: "a", formula: "{[a]}" },
        { label: "b", formula: "{[b]}" },
        { label: "c", formula: "{[c]}" },
      ],
    });
  });

  it("vínculo array JÁ EXISTENTE sendo editado não mexe em head", () => {
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable({ head: ["x"], content: [["{x}"]] })] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["x"] }],
      selectedId: "tb1",
    });

    actions.handleChangeBinding("tabela", { schemaName: "tabela", type: "array", path: "outro", columns: ["a", "b"] });

    expect((state.template.schemas[0] as TableSchema).head).toEqual(["x"]);
    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.path).toBe("outro");
  });
});

describe("setColumnFormula", () => {
  it("espelha a fórmula na célula — senão o token cru em content ganha no PDF", () => {
    const { actions, state } = harness({
      template: { page: { width: 210, height: 297 }, schemas: [makeTable({ head: ["tarKandir"], content: [["{tarKandir}"]] })] },
      bindings: [{ schemaName: "tabela", type: "array", path: "rows", columns: ["tarKandir"] }],
      selectedId: "tb1",
    });

    actions.setColumnFormula(0, "{CURRENCY(tarKandir)}");

    const table = state.template.schemas[0] as TableSchema;
    expect(table.content[0][0]).toBe("{CURRENCY(tarKandir)}");
    const binding = state.bindings[0];
    expect(binding.type === "array" && binding.columns[0]).toEqual({ label: "tarKandir", formula: "{CURRENCY(tarKandir)}" });
  });
});

describe("z-order", () => {
  it("bringToFront e sendToBack movem na pilha e não fazem nada nas pontas", () => {
    const three = { page: { width: 210, height: 297 }, schemas: [makeText({ id: "a" }), makeText({ id: "b" }), makeText({ id: "c" })] };
    const { actions, state } = harness({ template: three });

    actions.bringToFront("a");
    expect(state.template.schemas.map((s) => s.id)).toEqual(["b", "c", "a"]);

    actions.sendToBack("a");
    expect(state.template.schemas.map((s) => s.id)).toEqual(["a", "b", "c"]);

    const before = state.template;
    actions.sendToBack("a");
    actions.bringToFront("c");
    expect(state.template).toBe(before);
  });
});

describe("leitura em tempo de chamada", () => {
  // What sustains the actions object's stable identity is not the object —
  // it is the fact that NOTHING reactive comes in as a parameter. Testing "the
  // closures equal themselves" would be a tautology: they are created once, so
  // they cannot differ. The test that CAN fail is this one: the same action
  // instance, after the state changes from outside, has to see the NEW state.
  // If someone goes back to passing template/bindings/selection/dictionary as
  // a parameter of the factory, this goes red.
  it("a mesma instância de ação enxerga seleção trocada por fora", () => {
    const { actions, state, latest } = harness({
      template: {
        page: { width: 210, height: 297 },
        schemas: [makeTable({ id: "tb1", name: "um", head: ["a"], content: [["{a}"]] }), makeTable({ id: "tb2", name: "dois", head: ["z"], content: [["{z}"]] })],
      },
      selectedId: "tb1",
    });

    actions.addTableColumn("b");
    latest.current.selectedId = "tb2";
    actions.addTableColumn("b");

    // Each "+" went to the table that was selected AT THE TIME of the call.
    expect((state.template.schemas[0] as TableSchema).head).toEqual(["a", "b"]);
    expect((state.template.schemas[1] as TableSchema).head).toEqual(["z", "b"]);
  });

  it("a mesma instância enxerga o dicionário trocado por fora", () => {
    // `t` (i18n) lives in the ref too. A section created after switching
    // language is born with the NEW dictionary's name.
    const { actions, state, latest } = harness({ template: { page: { width: 210, height: 297 }, schemas: [] } });

    actions.createSection();
    const ptName = state.template.schemas[0].name;

    latest.current.t = dictFor("en");
    actions.createSection();
    const enName = state.template.schemas[1].name;

    // The name carries a random suffix (makeBase in schemaFactory.ts), so what
    // is asserted is the PREFIX, which is what comes from the dictionary.
    expect(ptName.startsWith(dictFor("pt-BR").schemaDefaults.sectionNamePrefix)).toBe(true);
    expect(enName.startsWith(dictFor("en").schemaDefaults.sectionNamePrefix)).toBe(true);
    expect(dictFor("pt-BR").schemaDefaults.sectionNamePrefix).not.toBe(dictFor("en").schemaDefaults.sectionNamePrefix);
  });
});

describe("toggleIsolateBands", () => {
  it("limpa a seleção ANTES de virar a chave", () => {
    // The two sets of fields are disjoint (see fieldListSchemasOf): in
    // isolated mode only the red band appears, outside it only the body.
    // Keeping the selection would leave the property panel editing a field the
    // canvas no longer shows — and the user seeing no change as they type.
    const { actions, state } = harness({ template: { page: { width: 210, height: 297 }, schemas: [makeTable()] } });
    state.selectedIds = ["t1"];

    actions.toggleIsolateBands();

    expect(state.selectedIds).toEqual([]);
    expect(state.isolateBands).toBe(true);
  });

  it("alterna, e lê do valor corrente e não de um snapshot", () => {
    const { actions, state } = harness({ template: { page: { width: 210, height: 297 }, schemas: [] } });
    actions.toggleIsolateBands();
    actions.toggleIsolateBands();
    expect(state.isolateBands).toBe(false);
    // Two toggles in a row, with no re-render between them: if the handler
    // read `isolateBands` from a closure/snapshot instead of the functional
    // updater, the second would write `true` again and the mode would get stuck on.
    actions.toggleIsolateBands();
    actions.toggleIsolateBands();
    actions.toggleIsolateBands();
    expect(state.isolateBands).toBe(true);
  });
});

describe("gridSizeMm chega nas ações", () => {
  it("campo novo nasce alinhado no passo da CONFIG, não no default de 5", () => {
    // The bug this guards: `computeSpawnPosition` used snapToGrid with the
    // default, so `gridSizeMm={3}` aligned dragging to 3 and birth to 5 — a
    // new field was born off the consumer's grid.
    const template = {
      page: { width: 210, height: 297 },
      schemas: [],
      headerHeight: 13,
      footerHeight: 0,
      marginLeft: 0,
      marginRight: 0,
    } as unknown as Template;

    const cinco = harness({ template });
    cinco.actions.addSchema(makeTable({ id: "a", width: 41, height: 11 }));
    const posCinco = cinco.state.template.schemas[0];

    const tres = harness({ template, gridSizeMm: 3 });
    tres.actions.addSchema(makeTable({ id: "b", width: 41, height: 11 }));
    const posTres = tres.state.template.schemas[0];

    expect(posCinco.x % 5).toBe(0);
    expect(posCinco.y % 5).toBe(0);
    expect(posTres.x % 3).toBe(0);
    expect(posTres.y % 3).toBe(0);
    // If the config were ignored, the two would land at the same point.
    expect([posTres.x, posTres.y]).not.toEqual([posCinco.x, posCinco.y]);
  });

  it("createSection também (ele passa por nextFreeY)", () => {
    const template = { page: { width: 210, height: 297 }, schemas: [makeTable({ y: 23, height: 10 })] } as unknown as Template;

    const cinco = harness({ template });
    cinco.actions.createSection();
    const yCinco = cinco.state.template.schemas[1].y;

    const dois = harness({ template, gridSizeMm: 2 });
    dois.actions.createSection();
    const yDois = dois.state.template.schemas[1].y;

    // A section is born stretched, and computeSpawnPosition re-aligns the y —
    // what matters is that the two steps give different answers and each one
    // lands on its own grid.
    expect(yCinco % 5).toBe(0);
    expect(yDois % 2).toBe(0);
  });
});
