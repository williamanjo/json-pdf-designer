import { describe, expect, it } from "vitest";
import { parse } from "../../src/expressions/parse";
import { expressionError } from "../../src/expressions/resolve";
import {
  aggregateChartItems,
  buildInputs,
  columnKey,
  columnLabel,
  describeBinding,
  describeBindingShort,
  filteredArrayAt,
  matchesFilterGroups,
  renderTemplate,
  resolveChartItems,
  resolveKpiValue,
  resolveToken,
  rowsFromArrayBinding,
} from "../../src/bindings/bindings";
import { en } from "../../src/i18n/en";
import { CHART_OTHER_COLOR } from "../../src/chart/colors";
import type { Binding } from "../../src/types";

describe("resolveToken — funções", () => {
  const rows = { rows: [{ total: 10 }, { total: 20 }, { total: 30 }] };

  it("SUM soma uma coluna de um array", () => {
    expect(resolveToken("SUM(rows.total)", rows)).toBe("60");
  });

  it("COUNT conta itens de um array", () => {
    expect(resolveToken("COUNT(rows)", rows)).toBe("3");
  });

  it("AVG calcula a média de uma coluna", () => {
    expect(resolveToken("AVG(rows.total)", rows)).toBe("20");
  });

  it("CONCAT junta campos e texto fixo, respeitando vírgula entre aspas", () => {
    expect(resolveToken('CONCAT(a, ", ", b)', { a: "x", b: "y" })).toBe("x, y");
  });

  it("UPPER/LOWER trocam caixa", () => {
    expect(resolveToken("UPPER(name)", { name: "abc" })).toBe("ABC");
    expect(resolveToken("LOWER(name)", { name: "ABC" })).toBe("abc");
  });

  it("TRIM tira espaço do início/fim", () => {
    expect(resolveToken("TRIM(name)", { name: "  abc  " })).toBe("abc");
  });

  it("DATE sem formato de entrada lê ISO e formata DD/MM/YYYY", () => {
    expect(resolveToken("DATE(d)", { d: "2025-04-10" })).toBe("10/04/2025");
  });

  it("DATE com formato de entrada DD/MM/YYYY não inverte dia/mês (bug de fuso americano)", () => {
    expect(resolveToken('DATE(d, "DD/MM/YYYY", "DD/MM/YYYY")', { d: "10/04/2025" })).toBe("10/04/2025");
  });

  it("CURRENCY formata em pt-BR com símbolo e casas decimais", () => {
    expect(resolveToken('CURRENCY(v, "R$", 2)', { v: 1234.5 })).toBe("R$ 1.234,50");
  });

  it("NUMBER controla casas decimais sem separador de milhar", () => {
    expect(resolveToken("NUMBER(v, 2)", { v: 12 })).toBe("12.00");
  });
});

describe("resolveToken — aritmética e aninhamento", () => {
  it("resolve expressão aritmética simples entre paths", () => {
    expect(resolveToken("a + b", { a: 2, b: 3 })).toBe("5");
    expect(resolveToken("a * b", { a: 3, b: 4 })).toBe("12");
  });

  it("resolve função aninhada como argumento de outra função", () => {
    const data = { rows: [{ total: 100 }, { total: 50 }] };
    expect(resolveToken('CURRENCY(SUM(rows.total), "R$", 2)', data)).toBe("R$ 150,00");
  });

  it("path sem correspondência no dado vira string vazia", () => {
    expect(resolveToken("nao.existe", { a: 1 })).toBe("");
  });

  it("duas chamadas de função combinadas por operador SUBTRAI de verdade (bug corrigido, regex guloso não vaza mais)", () => {
    const data = { a: [{ v: 10 }, { v: 5 }], b: [{ v: 3 }] };
    expect(resolveToken("SUM(a.v) - SUM(b.v)", data)).toBe("12");
    expect(resolveToken("SUM(a.v) + SUM(b.v)", data)).toBe("18");
  });

  it("chamada aninhada de verdade continua funcionando (regressão da correção acima)", () => {
    const data = { rows: [{ total: 100 }, { total: 50 }] };
    expect(resolveToken('CURRENCY(SUM(rows.total), "R$", 2)', data)).toBe("R$ 150,00");
  });

  it("profundidade além do limite dá erro claro no parser, em vez de estourar a call stack", () => {
    // A garantia original: aninhamento absurdo NÃO derruba o V8 por stack
    // overflow, vira uma condição limitada e legível. Ela vive na API estrita
    // (`parse`, e `expressionError` em cima dela).
    const nested = "CURRENCY(".repeat(50) + "1" + ")".repeat(50);
    expect(() => parse(nested)).toThrow(/nesting too deep/i);
    expect(expressionError(nested)).toMatch(/nesting too deep/i);
  });

  it("...e na GERAÇÃO resolve pra vazio, igual erro de sintaxe", () => {
    // Mesma troca de sempre: um campo mal escrito deixa AQUELE campo em
    // branco, não derruba o PDF inteiro. O aviso do campo no editor é onde o
    // problema aparece (ver fieldWarnings.ts).
    const nested = "CURRENCY(".repeat(50) + "1" + ")".repeat(50);
    expect(resolveToken(nested, {})).toBe("");
  });

  it("aninhamento razoável (bem abaixo do limite) continua resolvendo normalmente", () => {
    const nested = "CURRENCY(".repeat(5) + "1" + ")".repeat(5);
    expect(() => resolveToken(nested, {})).not.toThrow();
  });
});

describe("resolveToken — IF", () => {
  it('comparação de igualdade (texto): escolhe o 2º ou 3º argumento', () => {
    expect(resolveToken('IF(status == "paid", "Pago", "Pendente")', { status: "paid" })).toBe("Pago");
    expect(resolveToken('IF(status == "paid", "Pago", "Pendente")', { status: "open" })).toBe("Pendente");
  });

  it("comparação numérica (>, >=, <, <=, !=)", () => {
    expect(resolveToken('IF(total > 100, "alto", "baixo")', { total: 150 })).toBe("alto");
    expect(resolveToken('IF(total > 100, "alto", "baixo")', { total: 50 })).toBe("baixo");
    expect(resolveToken('IF(total >= 100, "sim", "nao")', { total: 100 })).toBe("sim");
    expect(resolveToken('IF(total != 100, "sim", "nao")', { total: 100 })).toBe("nao");
  });

  it("sem operador de comparação: checa verdadeiro/falso do valor resolvido", () => {
    expect(resolveToken('IF(ativo, "Sim", "Não")', { ativo: "true" })).toBe("Sim");
    expect(resolveToken('IF(ativo, "Sim", "Não")', { ativo: "false" })).toBe("Não");
    expect(resolveToken('IF(ativo, "Sim", "Não")', { ativo: "0" })).toBe("Não");
    expect(resolveToken('IF(ativo, "Sim", "Não")', { ativo: "" })).toBe("Não");
    expect(resolveToken('IF(ativo, "Sim", "Não")', { ativo: "qualquer coisa" })).toBe("Sim");
  });

  it("só resolve o lado escolhido — o outro não precisa nem existir", () => {
    // "inexistente" não existe no dado — se IF resolvesse os DOIS lados
    // sempre, isso ainda funcionaria (viraria string vazia), mas o ponto
    // aqui é confirmar que o branch NÃO escolhido nem é avaliado.
    expect(resolveToken('IF(status == "paid", inexistente, "Pendente")', { status: "open" })).toBe("Pendente");
  });

  it("aceita função aninhada nos branches (mesma recursão de qualquer outro argumento)", () => {
    const data = { status: "paid", rows: [{ total: 10 }, { total: 5 }] };
    expect(resolveToken('IF(status == "paid", SUM(rows.total), "0")', data)).toBe("15");
  });
});

describe("renderTemplate", () => {
  it("troca {token} pelo valor resolvido, preservando texto fixo ao redor", () => {
    const data = { rows: [{ total: 10 }, { total: 20 }], nome: "Cliente" };
    expect(renderTemplate("Total: {SUM(rows.total)} — Cliente: {nome}", data)).toBe("Total: 30 — Cliente: Cliente");
  });
});

describe("buildInputs", () => {
  const data = {
    cliente: "Ana",
    total: 42,
    rows: [
      { produto: "A", qtd: 1 },
      { produto: "B", qtd: 2 },
    ],
  };

  it("scalar resolve o path direto", () => {
    const bindings: Binding[] = [{ schemaName: "campo_total", type: "scalar", path: "total" }];
    expect(buildInputs(data, bindings)).toEqual({ campo_total: "42" });
  });

  it("template resolve {token}s dentro de uma string livre", () => {
    const bindings: Binding[] = [{ schemaName: "saudacao", type: "template", template: "Olá, {cliente}!" }];
    expect(buildInputs(data, bindings)).toEqual({ saudacao: "Olá, Ana!" });
  });

  it("keyvalue monta pares path/valor, cada um uma linha", () => {
    const bindings: Binding[] = [{ schemaName: "resumo", type: "keyvalue", paths: ["cliente", "total"] }];
    expect(JSON.parse(buildInputs(data, bindings).resumo)).toEqual([
      ["cliente", "Ana"],
      ["total", "42"],
    ]);
  });

  it("array vira uma linha por item, uma coluna por chave", () => {
    const bindings: Binding[] = [{ schemaName: "tabela", type: "array", path: "rows", columns: ["produto", "qtd"] }];
    expect(JSON.parse(buildInputs(data, bindings).tabela)).toEqual([
      ["A", "1"],
      ["B", "2"],
    ]);
  });

  it("section não gera entrada em inputs (resolvida à parte na paginação)", () => {
    const bindings: Binding[] = [{ schemaName: "secao", type: "section", path: "rows" }];
    expect(buildInputs(data, bindings)).toEqual({});
  });

  it("array com filters só inclui linhas que batem em algum grupo (OU de grupos, E dentro do grupo)", () => {
    const bindings: Binding[] = [
      {
        schemaName: "tabela",
        type: "array",
        path: "rows",
        columns: ["produto", "qtd"],
        filters: [[{ column: "produto", op: "eq", value: "B" }]],
      },
    ];
    expect(JSON.parse(buildInputs(data, bindings).tabela)).toEqual([["B", "2"]]);
  });

  it("kpi não gera entrada em inputs (resolvido à parte via resolveKpiValue)", () => {
    const bindings: Binding[] = [{ schemaName: "indicador", type: "kpi", path: "rows", valueColumn: "qtd", aggregation: "sum" }];
    expect(buildInputs(data, bindings)).toEqual({});
  });
});

describe("resolveKpiValue", () => {
  const data = {
    rows: [
      { produto: "A", qtd: 1 },
      { produto: "B", qtd: 2 },
      { produto: "B", qtd: 5 },
    ],
  };

  it("sum agrega a coluna numérica de todas as linhas sem filtro", () => {
    expect(resolveKpiValue({ schemaName: "k", type: "kpi", path: "rows", valueColumn: "qtd", aggregation: "sum" }, data)).toBe(8);
  });

  it("count ignora valueColumn e conta as linhas filtradas", () => {
    const binding: Binding = {
      schemaName: "k",
      type: "kpi",
      path: "rows",
      aggregation: "count",
      filters: [[{ column: "produto", op: "eq", value: "B" }]],
    };
    expect(resolveKpiValue(binding, data)).toBe(2);
  });

  it("avg/min/max agregam só as linhas que batem no filtro", () => {
    const base = { schemaName: "k", path: "rows", valueColumn: "qtd", filters: [[{ column: "produto", op: "eq" as const, value: "B" }]] };
    expect(resolveKpiValue({ ...base, type: "kpi", aggregation: "avg" }, data)).toBe(3.5);
    expect(resolveKpiValue({ ...base, type: "kpi", aggregation: "min" }, data)).toBe(2);
    expect(resolveKpiValue({ ...base, type: "kpi", aggregation: "max" }, data)).toBe(5);
  });

  it("sem linha batendo no filtro, resultado é 0", () => {
    const binding: Binding = {
      schemaName: "k",
      type: "kpi",
      path: "rows",
      valueColumn: "qtd",
      aggregation: "sum",
      filters: [[{ column: "produto", op: "eq", value: "Z" }]],
    };
    expect(resolveKpiValue(binding, data)).toBe(0);
  });
});

describe("rowsFromArrayBinding", () => {
  it("resolve coluna crua e coluna calculada (formula) por linha", () => {
    const list = [
      { produto: "A", preco: 10 },
      { produto: "B", preco: 20 },
    ];
    const rows = rowsFromArrayBinding(list, ["produto", { label: "Total", formula: "{CURRENCY(preco, \"R$\", 2)}" }]);
    expect(rows).toEqual([
      ["A", "R$ 10,00"],
      ["B", "R$ 20,00"],
    ]);
  });
});

describe("columnLabel / columnKey", () => {
  it("columnLabel retorna a própria string pra coluna crua, e o label pra calculada", () => {
    expect(columnLabel("produto")).toBe("produto");
    expect(columnLabel({ label: "Total", formula: "SUM(x)" })).toBe("Total");
  });

  it("columnKey retorna a própria string pra coluna crua, e 'formula:label' pra calculada", () => {
    expect(columnKey("produto")).toBe("produto");
    expect(columnKey({ label: "Total", formula: "SUM(x)" })).toBe("formula:Total");
  });
});

describe("describeBinding", () => {
  it("scalar retorna o path", () => {
    expect(describeBinding({ schemaName: "s", type: "scalar", path: "cliente" })).toBe("cliente");
  });

  it("template retorna o template", () => {
    expect(describeBinding({ schemaName: "s", type: "template", template: "Olá, {nome}!" })).toBe("Olá, {nome}!");
  });

  it("array retorna path + colunas entre colchetes", () => {
    const binding: Binding = {
      schemaName: "s",
      type: "array",
      path: "rows",
      columns: ["produto", { label: "Total", formula: "SUM(x)" }],
    };
    expect(describeBinding(binding)).toBe("rows [produto, Total]");
  });

  it("keyvalue retorna o rótulo genérico + paths entre colchetes", () => {
    const binding: Binding = { schemaName: "s", type: "keyvalue", paths: ["cliente", "total"] };
    expect(describeBinding(binding)).toBe(`${en.binding.keyValue} [cliente, total]`);
  });

  it("section retorna path + rótulo de seção repetida", () => {
    const binding: Binding = { schemaName: "s", type: "section", path: "rows" };
    expect(describeBinding(binding)).toBe(`rows ${en.binding.repeatedSection}`);
  });

  it("chart retorna path + labelColumn/valueColumn", () => {
    const binding: Binding = { schemaName: "s", type: "chart", path: "rows", labelColumn: "produto", valueColumn: "qtd" };
    expect(describeBinding(binding)).toBe("rows [produto / qtd]");
  });

  it("kpi com valueColumn inclui a coluna após a barra", () => {
    const binding: Binding = { schemaName: "s", type: "kpi", path: "rows", valueColumn: "qtd", aggregation: "sum" };
    expect(describeBinding(binding)).toBe("rows [sum/qtd]");
  });

  it("kpi sem valueColumn (ex: count) não inclui a barra", () => {
    const binding: Binding = { schemaName: "s", type: "kpi", path: "rows", aggregation: "count" };
    expect(describeBinding(binding)).toBe("rows [count]");
  });
});

describe("describeBindingShort", () => {
  it("array omite as colunas, só o path", () => {
    const binding: Binding = { schemaName: "s", type: "array", path: "rows", columns: ["produto", "qtd"] };
    expect(describeBindingShort(binding)).toBe("rows");
  });

  it("keyvalue omite os paths, só o rótulo genérico", () => {
    const binding: Binding = { schemaName: "s", type: "keyvalue", paths: ["cliente", "total"] };
    expect(describeBindingShort(binding)).toBe(en.binding.keyValue);
  });

  it("chart e kpi retornam só o path, sem colunas/agregação", () => {
    const chart: Binding = { schemaName: "s", type: "chart", path: "rows", labelColumn: "produto", valueColumn: "qtd" };
    const kpi: Binding = { schemaName: "s", type: "kpi", path: "rows", aggregation: "sum", valueColumn: "qtd" };
    expect(describeBindingShort(chart)).toBe("rows");
    expect(describeBindingShort(kpi)).toBe("rows");
  });
});

describe("matchesFilterGroups", () => {
  const item = { produto: "B", qtd: 5 };

  it("groups undefined ou vazio sempre bate", () => {
    expect(matchesFilterGroups(item, undefined)).toBe(true);
    expect(matchesFilterGroups(item, [])).toBe(true);
  });

  it("OU entre grupos — basta um grupo bater", () => {
    const groups = [
      [{ column: "produto", op: "eq" as const, value: "Z" }],
      [{ column: "produto", op: "eq" as const, value: "B" }],
    ];
    expect(matchesFilterGroups(item, groups)).toBe(true);
  });

  it("E dentro de um grupo — todas as condições do grupo precisam bater", () => {
    const groupsAllMatch = [
      [
        { column: "produto", op: "eq" as const, value: "B" },
        { column: "qtd", op: "eq" as const, value: "5" },
      ],
    ];
    expect(matchesFilterGroups(item, groupsAllMatch)).toBe(true);

    const groupsOneFails = [
      [
        { column: "produto", op: "eq" as const, value: "B" },
        { column: "qtd", op: "eq" as const, value: "9" },
      ],
    ];
    expect(matchesFilterGroups(item, groupsOneFails)).toBe(false);
  });
});

describe("filteredArrayAt", () => {
  const data = {
    rows: [
      { produto: "A", qtd: 1 },
      { produto: "B", qtd: 2 },
    ],
  };

  it("path que não aponta pra array retorna undefined", () => {
    expect(filteredArrayAt(data, "produto_inexistente", undefined)).toBeUndefined();
    expect(filteredArrayAt({ rows: "não é array" }, "rows", undefined)).toBeUndefined();
  });

  it("sem filtros retorna o array completo", () => {
    expect(filteredArrayAt(data, "rows", undefined)).toEqual(data.rows);
  });

  it("com filtros retorna só o subconjunto que bate", () => {
    const filters = [[{ column: "produto", op: "eq" as const, value: "B" }]];
    expect(filteredArrayAt(data, "rows", filters)).toEqual([{ produto: "B", qtd: 2 }]);
  });
});

describe("resolveChartItems", () => {
  const data = {
    rows: [
      { produto: "A", qtd: 1 },
      { produto: "B", qtd: "não é número" },
      { produto: "C" },
      { produto: "D", qtd: 4 },
    ],
  };

  it("extrai label/value das colunas indicadas — valueColumn ausente/não-numérica vira 0", () => {
    const binding: Binding = { schemaName: "c", type: "chart", path: "rows", labelColumn: "produto", valueColumn: "qtd" };
    expect(resolveChartItems(binding, data)).toEqual([
      { label: "A", value: 1 },
      { label: "B", value: 0 },
      { label: "C", value: 0 },
      { label: "D", value: 4 },
    ]);
  });

  it("aplica filters antes de extrair label/value", () => {
    const binding: Binding = {
      schemaName: "c",
      type: "chart",
      path: "rows",
      labelColumn: "produto",
      valueColumn: "qtd",
      filters: [[{ column: "produto", op: "eq", value: "D" }]],
    };
    expect(resolveChartItems(binding, data)).toEqual([{ label: "D", value: 4 }]);
  });
});

describe("aggregateChartItems", () => {
  const raw = [
    { label: "A", value: 10 },
    { label: "B", value: 30 },
    { label: "C", value: 20 },
  ];

  it("value_desc (default) ordena do maior pro menor valor", () => {
    const { items } = aggregateChartItems(raw);
    expect(items.map((i) => i.label)).toEqual(["B", "C", "A"]);
  });

  it("value_asc ordena do menor pro maior valor", () => {
    const { items } = aggregateChartItems(raw, 7, "value_asc");
    expect(items.map((i) => i.label)).toEqual(["A", "C", "B"]);
  });

  it("label_asc ordena por rótulo A-Z", () => {
    const { items } = aggregateChartItems(raw, 7, "label_asc");
    expect(items.map((i) => i.label)).toEqual(["A", "B", "C"]);
  });

  it("label_desc ordena por rótulo Z-A", () => {
    const { items } = aggregateChartItems(raw, 7, "label_desc");
    expect(items.map((i) => i.label)).toEqual(["C", "B", "A"]);
  });

  it("topN <= 0 desliga o agrupamento — mostra tudo, sem 'Outros'", () => {
    const { items } = aggregateChartItems(raw, 0);
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.label.startsWith("Outros"))).toBe(false);
  });

  it("itens além de topN colapsam numa fatia 'Outros (n)'", () => {
    const many = [
      { label: "A", value: 5 },
      { label: "B", value: 4 },
      { label: "C", value: 3 },
      { label: "D", value: 2 },
      { label: "E", value: 1 },
    ];
    const { items } = aggregateChartItems(many, 2);
    expect(items).toHaveLength(3);
    expect(items[2]).toEqual({ label: "Outros (3)", value: 6, color: CHART_OTHER_COLOR });
  });

  it("cor de cada item cicla pela paleta via i % palette.length", () => {
    const palette = ["#111111", "#222222"];
    const many = [
      { label: "A", value: 3 },
      { label: "B", value: 2 },
      { label: "C", value: 1 },
    ];
    const { items } = aggregateChartItems(many, 3, "value_desc", palette);
    expect(items.map((i) => i.color)).toEqual(["#111111", "#222222", "#111111"]);
  });

  it("total soma todos os itens, inclusive os agrupados em 'Outros'", () => {
    const { total } = aggregateChartItems(raw);
    expect(total).toBe(60);
  });
});

describe("resolveKpiValue — casos extras", () => {
  it("agregação não-count sem valueColumn não lança e não propaga NaN — cai em 0", () => {
    const data = {
      rows: [{ produto: "A" }, { produto: "B" }],
    };
    const binding: Binding = { schemaName: "k", type: "kpi", path: "rows", aggregation: "sum" };
    expect(resolveKpiValue(binding, data)).toBe(0);
  });

  it("path que não resolve pra array (filteredArrayAt undefined) resolve sem lançar", () => {
    const data = { outraCoisa: "x" };
    const binding: Binding = { schemaName: "k", type: "kpi", path: "rows", valueColumn: "qtd", aggregation: "sum" };
    expect(resolveKpiValue(binding, data)).toBe(0);

    const bindingCount: Binding = { schemaName: "k", type: "kpi", path: "rows", aggregation: "count" };
    expect(resolveKpiValue(bindingCount, data)).toBe(0);
  });
});
