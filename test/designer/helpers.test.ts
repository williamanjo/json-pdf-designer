import { afterEach, describe, expect, it, vi } from "vitest";
import { bandSpawnPosition, computeSpawnPosition, findTableDataSource, uniqueSchemaName } from "../../src/designer/helpers";
import type { Binding, DataSourceOption, SectionSchema, TableSchema, Template, TextSchema } from "../../src/types";

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    page: { width: 210, height: 297 },
    schemas: [],
    ...overrides,
  };
}

function makeText(overrides: Partial<TextSchema> = {}): TextSchema {
  return {
    id: "f1",
    name: "campo",
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

function makeSection(overrides: Partial<SectionSchema> = {}): SectionSchema {
  return {
    id: "sec1",
    name: "secao",
    type: "section",
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    ...overrides,
  };
}

function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "t1",
    name: "tabela",
    type: "table",
    x: 0,
    y: 0,
    width: 150,
    height: 30,
    head: ["Coluna 1", "Coluna 2"],
    content: [["{col1}", "{col2}"]],
    ...overrides,
  };
}

describe("bandSpawnPosition", () => {
  it("header disponível (>2mm) -> primeira prioridade", () => {
    const result = bandSpawnPosition(makeTemplate({ headerHeight: 20, footerHeight: 20, marginLeft: 20, marginRight: 20 }));
    expect(result).toEqual({ x: 20 + 2, y: 2, maxHeight: 20 - 3 });
  });

  it("sem header, footer disponível -> segunda prioridade", () => {
    const template = makeTemplate({ footerHeight: 15, marginLeft: 10, marginRight: 10 });
    const result = bandSpawnPosition(template);
    expect(result).toEqual({ x: 10 + 2, y: 297 - 15 + 2, maxHeight: 15 - 3 });
  });

  it("sem header/footer, margem esquerda disponível -> terceira prioridade", () => {
    const template = makeTemplate({ marginLeft: 10, marginRight: 10 });
    const result = bandSpawnPosition(template);
    expect(result).toEqual({ x: 2, y: 2, maxWidth: 10 - 3 });
  });

  it("sem header/footer/margem esquerda, margem direita disponível -> quarta prioridade", () => {
    const template = makeTemplate({ marginRight: 8 });
    const result = bandSpawnPosition(template);
    expect(result).toEqual({ x: 210 - 8 + 2, y: 2, maxWidth: 8 - 3 });
  });

  it("nenhuma faixa com espaço (todas <=2mm ou ausentes) -> null", () => {
    const template = makeTemplate({ headerHeight: 2, footerHeight: 1, marginLeft: 0, marginRight: 2 });
    expect(bandSpawnPosition(template)).toBeNull();
  });

  it("template sem nenhuma faixa definida -> null", () => {
    expect(bandSpawnPosition(makeTemplate())).toBeNull();
  });
});

describe("computeSpawnPosition", () => {
  it("isolateBands true com faixa disponível -> nasce dentro da faixa, altura/largura limitadas ao máximo da faixa", () => {
    const template = makeTemplate({ headerHeight: 10, marginLeft: 5 });
    const schema = makeText({ width: 80, height: 20 });
    const result = computeSpawnPosition(template, schema, true);
    // bandSpawnPosition -> { x: 5+2, y: 2, maxHeight: 10-3=7 }
    expect(result.x).toBe(7);
    expect(result.y).toBe(2);
    // altura original (20) excede maxHeight (7) -> trava em 7
    expect(result.height).toBe(7);
    // sem maxWidth nessa faixa (é a de header) -> largura não muda
    expect(result.width).toBe(80);
  });

  it("isolateBands true com faixa de margem (maxWidth) -> largura travada, altura não muda", () => {
    const template = makeTemplate({ marginLeft: 10 });
    const schema = makeText({ width: 80, height: 20 });
    const result = computeSpawnPosition(template, schema, true);
    // bandSpawnPosition -> { x: 2, y: 2, maxWidth: 10-3=7 }
    expect(result.x).toBe(2);
    expect(result.y).toBe(2);
    expect(result.width).toBe(7);
    expect(result.height).toBe(20);
  });

  it("isolateBands true mas altura/largura originais já cabem na faixa -> não encolhe abaixo do próprio tamanho", () => {
    const template = makeTemplate({ headerHeight: 30 });
    const schema = makeText({ width: 80, height: 5 });
    const result = computeSpawnPosition(template, schema, true);
    // maxHeight = 30-3 = 27, altura original 5 é menor -> mantém 5
    expect(result.height).toBe(5);
  });

  it("isolateBands true sem nenhuma faixa disponível -> devolve o schema original, sem mudar posição", () => {
    const template = makeTemplate();
    const schema = makeText({ x: 33, y: 44, width: 80, height: 20 });
    const result = computeSpawnPosition(template, schema, true);
    expect(result).toBe(schema);
  });

  it("isolateBands false, campo comum -> nasce centralizado no corpo, largura preservada", () => {
    const template = makeTemplate({ headerHeight: 0, footerHeight: 0, marginLeft: 0, marginRight: 0 });
    const schema = makeText({ width: 80, height: 10 });
    const result = computeSpawnPosition(template, schema, false);
    // corpo: bodyTop=0, bodyBottom=297; x centralizado = (210-80)/2=65 -> snapToGrid(65)=65
    // y centralizado = (297-10)/2=143.5 -> snapToGrid(143.5)=145 (múltiplo de 5 mais próximo)
    expect(result.x).toBe(65);
    expect(result.y).toBe(145);
    expect(result.width).toBe(80);
  });

  it("isolateBands false, seção -> sempre esticada de margem a margem, x = marginLeft", () => {
    const template = makeTemplate({ marginLeft: 10, marginRight: 10 });
    const schema = makeSection({ width: 50, height: 40 });
    const result = computeSpawnPosition(template, schema, false);
    // largura = max(20, 210-10-10) = 190
    expect(result.width).toBe(190);
    expect(result.x).toBe(10);
  });

  it("isolateBands false respeita header/footer/margens na centralização", () => {
    const template = makeTemplate({ headerHeight: 20, footerHeight: 20, marginLeft: 10, marginRight: 10 });
    const schema = makeText({ width: 60, height: 10 });
    const result = computeSpawnPosition(template, schema, false);
    // bodyTop=20, bodyBottom=297-20=277; x = max(12, 10+(210-10-10-60)/2) = max(12, 10+65)=75 -> snapToGrid(75)=75
    // y = max(22, 20+(277-20-10)/2) = max(22, 20+123.5=143.5) -> snapToGrid(143.5)=145
    expect(result.x).toBe(75);
    expect(result.y).toBe(145);
  });
});

describe("uniqueSchemaName", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("nome base livre -> usa o determinístico ${base}_${suffix} e registra no Set", () => {
    const usedNames = new Set<string>(["outra_coisa"]);
    const result = uniqueSchemaName("campo", usedNames, "copia");
    expect(result).toBe("campo_copia");
    expect(usedNames.has("campo_copia")).toBe(true);
  });

  it("nome determinístico já em uso -> cai pro sufixo aleatório, e o registra", () => {
    const usedNames = new Set<string>(["campo_copia"]);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    const result = uniqueSchemaName("campo", usedNames, "copia");
    expect(result).not.toBe("campo_copia");
    expect(result.startsWith("campo_copia_")).toBe(true);
    expect(usedNames.has(result)).toBe(true);
  });

  it("duas chamadas seguidas com o MESMO base nunca colidem entre si (usedNames mutado a cada chamada)", () => {
    const usedNames = new Set<string>();
    const first = uniqueSchemaName("campo", usedNames, "copia");
    const second = uniqueSchemaName("campo", usedNames, "copia");
    expect(first).toBe("campo_copia");
    expect(second).not.toBe("campo_copia");
    expect(second).not.toBe(first);
  });

  it("continua tentando até achar um sufixo aleatório livre (retry em cadeia)", () => {
    const collisionValue = 0.111111;
    // Mesma fórmula do candidato aleatório em uniqueSchemaName — calculada
    // aqui em runtime (não "chutada" à mão) pra garantir que bate exatamente
    // com o que a primeira (e segunda) tentativa aleatória vai produzir.
    const collisionCandidate = `campo_copia_${collisionValue.toString(36).slice(2, 5)}`;
    const usedNames = new Set<string>(["campo_copia", collisionCandidate]);
    const values = [collisionValue, collisionValue, 0.999999];
    let call = 0;
    vi.spyOn(Math, "random").mockImplementation(() => values[Math.min(call++, values.length - 1)]);
    const result = uniqueSchemaName("campo", usedNames, "copia");
    // As duas primeiras tentativas aleatórias colidem (mesmo valor mockado
    // duas vezes, candidato já em usedNames) — só a terceira (valor
    // diferente) sai do loop.
    expect(result).not.toBe("campo_copia");
    expect(result).not.toBe(collisionCandidate);
    expect(usedNames.has(result)).toBe(true);
  });
});

describe("findTableDataSource", () => {
  const dataSources: DataSourceOption[] = [
    { path: "itens", label: "Itens", columns: ["nome", "valor"], columnTypes: { valor: "number" } },
    { path: "vazio", label: "Vazio", columns: [] },
  ];

  it("schema null -> undefined", () => {
    expect(findTableDataSource(null, [], [], dataSources)).toBeUndefined();
  });

  it("schema não é tabela -> undefined", () => {
    const text = makeText();
    expect(findTableDataSource(text, [text], [], dataSources)).toBeUndefined();
  });

  it("tabela membro de seção vinculada a uma fonte conhecida -> usa as colunas da fonte da SEÇÃO", () => {
    const section = makeSection({ id: "sec1", name: "secao" });
    const table = makeTable({ id: "t1", name: "tabela", sectionId: "sec1" });
    const sectionBinding: Binding = { schemaName: "secao", type: "section", path: "itens" };
    const result = findTableDataSource(table, [section, table], [sectionBinding], dataSources);
    expect(result).toEqual({ path: "itens", columns: ["nome", "valor"], columnTypes: { valor: "number" } });
  });

  it("tabela solta com vínculo array próprio batendo um dataSource conhecido -> usa as colunas dele", () => {
    const table = makeTable({ id: "t1", name: "tabela" });
    const ownBinding: Binding = { schemaName: "tabela", type: "array", path: "itens", columns: ["nome"] };
    const result = findTableDataSource(table, [table], [ownBinding], dataSources);
    expect(result).toEqual({ path: "itens", columns: ["nome", "valor"], columnTypes: { valor: "number" } });
  });

  it("tabela membro de seção sem fonte conhecida (columns vazio) cai pro próprio vínculo array, se houver", () => {
    const section = makeSection({ id: "sec1", name: "secao" });
    const table = makeTable({ id: "t1", name: "tabela", sectionId: "sec1" });
    const sectionBinding: Binding = { schemaName: "secao", type: "section", path: "vazio" };
    const ownBinding: Binding = { schemaName: "tabela", type: "array", path: "itens", columns: ["nome"] };
    const result = findTableDataSource(table, [section, table], [sectionBinding, ownBinding], dataSources);
    expect(result).toEqual({ path: "itens", columns: ["nome", "valor"], columnTypes: { valor: "number" } });
  });

  it("nem seção nem vínculo próprio batem um dataSource conhecido -> undefined", () => {
    const table = makeTable({ id: "t1", name: "tabela" });
    const result = findTableDataSource(table, [table], [], dataSources);
    expect(result).toBeUndefined();
  });

  it("sem dataSources nenhum -> undefined mesmo com vínculo válido", () => {
    const table = makeTable({ id: "t1", name: "tabela" });
    const ownBinding: Binding = { schemaName: "tabela", type: "array", path: "itens", columns: ["nome"] };
    const result = findTableDataSource(table, [table], [ownBinding], undefined);
    expect(result).toBeUndefined();
  });
});
