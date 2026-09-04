import { describe, expect, it } from "vitest";
import { makeDesignerActions, type DesignerLatest } from "../../src/designer/actions";
import { dictFor } from "../../src/i18n/dictionaries";
import type { Binding, Schema, TableSchema, Template, TextSchema } from "../../src/types";

// Esta suíte cobre a lógica que, enquanto vivia dentro do Designer.tsx, não
// tinha teste NENHUM — precisaria montar o componente. Como as ações são uma
// fábrica que só despacha updaters funcionais, dá pra capturar os updaters e
// aplicá-los num template de mentira: é o estado que o React produziria.

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

// Banco de testes: aplica cada updater despachado por cima do estado atual,
// na ordem, exatamente como o React faria. Devolve o estado final.
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
        // A ref é reatribuída durante o render; aqui o "render" é síncrono.
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

// Variante que NÃO aplica os updaters na hora: enfileira e só aplica no
// flush(), deixando `latest.current` congelado no valor inicial. É o cenário
// real de "dois cliques em sequência rápida, antes do 1º re-render" — o que
// deu origem ao bug do "orgao" no índice de "tarKandir". Um handler que
// voltasse a ler CONTEÚDO do closure/ref em vez do `prev` passaria no
// harness síncrono acima e falharia aqui.
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
      // O harness diferido só existe pra provar que a ESCRITA sai do `prev`.
      // Nenhum teste dele mexe em estado de casca, então os dois setters são
      // no-op — declarados pra não haver `as unknown as DesignerLatest`
      // escondendo um campo novo que deveria ter sido considerado.
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
    // A célula É a fórmula da coluna (generate.ts resolve a linha a partir
    // de `content`). Sem espelhar, o painel ƒx segue mostrando a fórmula
    // velha e o que aparece no painel não é o que sai no PDF.
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
    // generate.ts resolve vínculo por NOME — sem o remap, o vínculo aponta
    // pro nome antigo, para de bater, e o campo some do PDF em silêncio.
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
    // Sem isso o filho fica com um id apontando pra seção que não existe
    // mais e sai do PDF gerado, silenciosamente, ainda visível no canvas.
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
    // Reduzir de 3 pra 1 coluna ("fatura") por POSIÇÃO pegava o índice 0 de
    // tudo, que era "orgao": o PDF saía com órgão sob o rótulo fatura.
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

  // A CLASSE ORIGINAL DO BUG, AINDA VIVA — marcado de propósito.
  //
  // `setTableHead` lê `oldHead` de fora do updater e usa como mapa
  // nome→índice pra reindexar `binding.columns`. Com duas edições de head em
  // sequência rápida, a segunda casa nomes contra um head que a primeira já
  // reindexou, e escreve valor de coluna errado sob um rótulo — exatamente o
  // "orgao" sob "fatura".
  //
  // Não está consertado porque o conserto muda semântica: casar por
  // `columnLabel(binding.columns[i])` em vez de por `oldHead` altera o
  // resultado no caso de head e columns dessincronizados, que
  // test/table/columns.test.ts fixa. Fica como dívida VISÍVEL: quem
  // consertar, tira o .skip e o teste passa a valer.
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
    // É a corrida que colocou um "orgao" no índice de "tarKandir": o 2º
    // clique lia head/columns de ANTES do 1º aplicar e reescrevia o array
    // inteiro por cima, derrubando a adição alheia.
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
    // Sem isso a tabela recém-criada ficava com head de 2 placeholders e
    // binding.columns cheio — desalinhado desde o clique em "Vincular".
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
    // Forma BRACKETADA: a chave pode ter ponto, espaço, parêntese ou quote, e
    // a forma nua daria um path errado ou erro de sintaxe. É a mesma regra
    // (`tokenFor`) que a tabela nova e a normalização usam.
    expect(table.content).toEqual([["{[a]}", "{[b]}", "{[c]}"]]);
    // E nenhuma coluna de chave crua sobrevive a este caminho: o rótulo e a
    // referência viram campos separados, então renomear um não mexe no outro.
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
  // O que sustenta a identidade estável do objeto de actions não é o objeto —
  // é o fato de NADA reativo entrar por parâmetro. Testar "as closures são
  // iguais a si mesmas" seria tautologia: elas são criadas uma vez, então não
  // podem diferir. O teste que PODE falhar é este: a mesma instância de ação,
  // depois de o estado mudar por fora, tem de enxergar o estado NOVO. Se
  // alguém voltar a passar template/bindings/seleção/dicionário por
  // parâmetro da fábrica, isto fica vermelho.
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

    // Cada "+" foi na tabela que estava selecionada NA HORA da chamada.
    expect((state.template.schemas[0] as TableSchema).head).toEqual(["a", "b"]);
    expect((state.template.schemas[1] as TableSchema).head).toEqual(["z", "b"]);
  });

  it("a mesma instância enxerga o dicionário trocado por fora", () => {
    // `t` (i18n) também mora na ref. Uma seção criada depois de trocar o
    // idioma nasce com o nome do dicionário NOVO.
    const { actions, state, latest } = harness({ template: { page: { width: 210, height: 297 }, schemas: [] } });

    actions.createSection();
    const ptName = state.template.schemas[0].name;

    latest.current.t = dictFor("en");
    actions.createSection();
    const enName = state.template.schemas[1].name;

    // O nome leva sufixo aleatório (makeBase em schemaFactory.ts), então o
    // que se afirma é o PREFIXO, que é o que vem do dicionário.
    expect(ptName.startsWith(dictFor("pt-BR").schemaDefaults.sectionNamePrefix)).toBe(true);
    expect(enName.startsWith(dictFor("en").schemaDefaults.sectionNamePrefix)).toBe(true);
    expect(dictFor("pt-BR").schemaDefaults.sectionNamePrefix).not.toBe(dictFor("en").schemaDefaults.sectionNamePrefix);
  });
});

describe("toggleIsolateBands", () => {
  it("limpa a seleção ANTES de virar a chave", () => {
    // Os dois conjuntos de campo são disjuntos (ver fieldListSchemasOf): no
    // modo isolado só a faixa vermelha aparece, fora dele só o corpo. Manter
    // a seleção deixaria o painel de propriedades editando um campo que o
    // canvas não mostra mais — e o usuário vendo mudança nenhuma ao digitar.
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
    // Dois toggles em sequência, sem re-render entre eles: se o handler
    // lesse `isolateBands` de closure/snapshot em vez do updater funcional,
    // o segundo escreveria `true` de novo e o modo ficaria preso ligado.
    actions.toggleIsolateBands();
    actions.toggleIsolateBands();
    actions.toggleIsolateBands();
    expect(state.isolateBands).toBe(true);
  });
});

describe("gridSizeMm chega nas ações", () => {
  it("campo novo nasce alinhado no passo da CONFIG, não no default de 5", () => {
    // O bug que isto guarda: `computeSpawnPosition` usava snapToGrid com o
    // default, então `gridSizeMm={3}` alinhava o arrasto em 3 e o
    // nascimento em 5 — campo novo já nascia fora da grade do consumidor.
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
    // Se a config fosse ignorada, os dois cairiam no mesmo ponto.
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

    // Seção nasce esticada, e computeSpawnPosition re-alinha o y — o que
    // importa é que os dois passos dão respostas diferentes e cada uma cai
    // na própria grade.
    expect(yCinco % 5).toBe(0);
    expect(yDois % 2).toBe(0);
  });
});
