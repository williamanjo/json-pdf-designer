import { describe, expect, it } from "vitest";
import { renameColumnInArrayBinding, renameColumnInTable } from "../../../src/fields/table/columns";
import { columnFormulaFor, segmentFor, tokenFor } from "../../../src/fields/table/columnFormula";
import { normalizeTableColumns } from "../../../src/fields/table/normalizeColumns";
import { parse } from "../../../src/expressions/engine/parse";
import { resolveRowFromItem } from "../../../src/pdf/resolvers";
import { makeBoundTable } from "../../../src/schemaFactory";
import type { Binding, TableSchema, Template } from "../../../src/types";

// IDENTIDADE DE COLUNA DE TABELA.
//
// Os três sintomas relatados tinham três causas distintas, e cada bloco aqui
// cobre uma:
//
//   1. o `ƒx` abria vazio      -> o painel lia o depósito de FALLBACK
//                                 (`binding.columns[i]`, e só a forma de
//                                 objeto) enquanto o PDF lê o PRINCIPAL
//                                 (`content[0][i]`).
//   2. renomear perdia a ref   -> não existia operação de renomear; o único
//                                 editor de título reescrevia o head inteiro e
//                                 re-derivava todo slot casando nome novo
//                                 contra head antigo.
//   3. voltava com o token     -> consequência de (1): a célula com `{` é o
//                                 primeiro passo do resolver.

function tabela(over: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "tb1",
    name: "vendas",
    type: "table",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    head: ["Órgão", "Fatura"],
    content: [["{[orgao]}", "{[fatura]}"]],
    footer: ["a", "b"],
    columnStyles: [{ cellTextColor: "#f00" }, undefined],
    columnWidths: [30, undefined],
    ...over,
  } as TableSchema;
}

describe("renomear coluna — só o rótulo, a referência fica", () => {
  it("troca o head e NÃO toca em mais nada", () => {
    // É o caso que o bug produzia ao contrário: o `setTableHead` blanqueava
    // `content` (o token, que decide o PDF), o estilo e a largura.
    const antes = tabela();
    const depois = renameColumnInTable(antes, 1, "Nota fiscal");

    expect(depois.head).toEqual(["Órgão", "Nota fiscal"]);
    expect(depois.content).toEqual(antes.content);
    expect(depois.footer).toEqual(antes.footer);
    expect(depois.columnStyles).toEqual(antes.columnStyles);
    expect(depois.columnWidths).toEqual(antes.columnWidths);
  });

  it("rótulo vazio é ignorado", () => {
    // O campo de texto antigo fazia `filter(Boolean)` na lista inteira, então
    // apagar o nome no meio da digitação colapsava a tabela.
    const antes = tabela();
    expect(renameColumnInTable(antes, 0, "   ")).toBe(antes);
  });

  it("índice fora da faixa não inventa coluna", () => {
    const antes = tabela();
    expect(renameColumnInTable(antes, 9, "x")).toBe(antes);
    expect(renameColumnInTable(antes, -1, "x")).toBe(antes);
  });

  it("no vínculo, atualiza o label da coluna CALCULADA", () => {
    const binding = {
      schemaName: "vendas",
      type: "array" as const,
      path: "rows",
      columns: ["orgao", { label: "Fatura", formula: "{[fatura]}" }],
    };
    const columns = renameColumnInArrayBinding(binding, 1, "Nota fiscal");
    expect(columns).toEqual(["orgao", { label: "Nota fiscal", formula: "{[fatura]}" }]);
    // A FÓRMULA não é tocada — é ela que carrega a referência.
    expect(columns).not.toBeNull();
    expect((columns![1] as { formula: string }).formula).toBe("{[fatura]}");
  });

  it("coluna de chave crua não tem rótulo próprio, então devolve null", () => {
    // `null` = "não há o que gravar", e quem chama evita um dispatch de
    // bindings que não mudaria nada.
    const binding = { schemaName: "vendas", type: "array" as const, path: "rows", columns: ["orgao"] };
    expect(renameColumnInArrayBinding(binding, 0, "Órgão")).toBeNull();
  });

  it("renomear e depois RESOLVER a linha dá o mesmo valor", () => {
    // O teste que faltava, e o que o relato descreve de ponta a ponta.
    const binding = {
      schemaName: "vendas",
      type: "array" as const,
      path: "rows",
      columns: [{ label: "Órgão", formula: "{[orgao]}" }, { label: "Fatura", formula: "{[fatura]}" }],
    };
    const item = { orgao: "SEFAZ", fatura: "F-1" };
    const antes = resolveRowFromItem(tabela(), item, binding);

    const renomeada = renameColumnInTable(tabela(), 1, "Nota fiscal");
    const colsRenomeadas = renameColumnInArrayBinding(binding, 1, "Nota fiscal");
    const depois = resolveRowFromItem(renomeada, item, { ...binding, columns: colsRenomeadas! });

    expect(depois).toEqual(antes);
    expect(depois).toEqual(["SEFAZ", "F-1"]);
  });
});

describe("tokenFor — a única regra de chave -> token", () => {
  const casos: [string, string][] = [
    ["id", "{[id]}"],
    ["has_azul", "{[has_azul]}"],
    ["created_at", "{[created_at]}"],
    ["my-key", "{[my-key]}"],
    // Espaço exige quotes — o lexer recusa `[a b]` de propósito.
    ["token name", '{["token name"]}'],
    // Ponto vira segmento literal, que é o que os brackets destravam.
    ["cliente.nome", "{[cliente.nome]}"],
    // Quote escolhida por CONTEÚDO: o lexer não tem escape, então trocar a
    // quote é o que resolve sem inventar sintaxe.
    ['a"b', "{['a\"b']}"],
    ["a'b", '{["a\'b"]}'],
    // A chave cujo nome tem bracket.
    ["[a]", '{["[a]"]}'],
  ];

  for (const [chave, esperado] of casos) {
    it(`${JSON.stringify(chave)} -> ${esperado}`, () => {
      expect(tokenFor(chave)).toBe(esperado);
    });
  }

  it("ROUND-TRIP: tokenFor -> parse devolve a chave intacta", () => {
    // O teste de propriedade, e o que pega a classe inteira de uma vez: foi
    // ele que achou `segmentFor("[a]")` saindo `{[[a]]}` (o lexer fechava o
    // segmento no primeiro `]` e lia a chave como `"[a"`). Caso a caso, só a
    // chave que alguém lembrou de listar fica coberta.
    const chaves = [
      "id", "has_azul", "created_at", "my-key", "token name", "cliente.nome",
      'a"b', "a'b", "[a]", "a]b", "a[b", "  espaco  ".trim(), "AND", "SUM", "2",
      "R$ total", "a,b", "a(b)", "a + b", "a==b",
    ];
    for (const chave of chaves) {
      const token = tokenFor(chave);
      const inner = token.slice(1, -1);
      expect(parse(inner), `round-trip de ${JSON.stringify(chave)} via ${token}`).toEqual({
        kind: "path",
        segments: [chave],
      });
    }
  });

  it("segmentFor é o mesmo, sem as chaves de fora", () => {
    expect(segmentFor("id")).toBe("[id]");
    expect(segmentFor("token name")).toBe('["token name"]');
  });
});

describe("columnFormulaFor — a MESMA precedência do PDF", () => {
  const columns = ["fatura", { label: "Total", formula: "{[total] * 2}" }];

  it("célula com token vence o vínculo — o caso do relato", () => {
    // `columns[0]` é string crua, então o painel antigo mostrava "" aqui,
    // enquanto o PDF já usava o token da célula.
    expect(columnFormulaFor([["{[fatura]}", ""]], columns, 0)).toBe("{[fatura]}");
  });

  it("sem token na célula, cai pra fórmula do vínculo", () => {
    expect(columnFormulaFor([["", ""]], columns, 1)).toBe("{[total] * 2}");
  });

  it("célula SEM chave nenhuma não conta como template", () => {
    // "PNR0000" é o preview de uma tabela recém-criada; tratá-lo como
    // template deixaria o mesmo texto fixo em toda linha.
    expect(columnFormulaFor([["PNR0000"]], ["fatura"], 0)).toBe("");
  });

  it("coluna de chave crua sem célula devolve vazio", () => {
    expect(columnFormulaFor(undefined, ["fatura"], 0)).toBe("");
    expect(columnFormulaFor([[]], null, 0)).toBe("");
  });
});

describe("makeBoundTable — nasce com o token preenchido", () => {
  it("content e binding.columns saem os dois de tokenFor", () => {
    const { schema, binding } = makeBoundTable(10, "rows", ["id", "token name"]);
    expect(schema.head).toEqual(["id", "token name"]);
    expect(schema.content).toEqual([["{[id]}", '{["token name"]}']]);
    expect(binding).toMatchObject({
      type: "array",
      path: "rows",
      columns: [
        { label: "id", formula: "{[id]}" },
        { label: "token name", formula: '{["token name"]}' },
      ],
    });
  });

  it("o binding aponta pro schema pelo nome", () => {
    const { schema, binding } = makeBoundTable(10, "rows", ["id"]);
    expect(binding.schemaName).toBe(schema.name);
  });

  it("nenhuma coluna de chave crua é produzida", () => {
    // A regra do dono, verificada na origem: se um dia alguém puser a chave
    // direto em `columns`, este teste cai.
    const { binding } = makeBoundTable(10, "rows", ["a", "b", "c"]);
    const columns = (binding as Extract<Binding, { type: "array" }>).columns;
    expect(columns.every((c) => typeof c !== "string")).toBe(true);
  });

  it("o ƒx de cada coluna abre preenchido — o sintoma 1, na origem", () => {
    const { schema, binding } = makeBoundTable(10, "rows", ["id", "code"]);
    const columns = (binding as Extract<Binding, { type: "array" }>).columns;
    expect(columnFormulaFor(schema.content, columns, 0)).toBe("{[id]}");
    expect(columnFormulaFor(schema.content, columns, 1)).toBe("{[code]}");
  });
});

describe("normalizeTableColumns — chave crua vira token", () => {
  function projeto(): { template: Template; bindings: Binding[] } {
    return {
      template: {
        page: { width: 210, height: 297 },
        schemas: [
          {
            id: "tb1",
            name: "vendas",
            type: "table",
            x: 0,
            y: 0,
            width: 100,
            height: 20,
            head: ["Órgão", "Fatura"],
            // Placeholder SEM chaves — exatamente o que os examples escreviam.
            content: [["ORGAO", "FATURA"]],
          },
        ],
      } as unknown as Template,
      bindings: [{ schemaName: "vendas", type: "array", path: "rows", columns: ["orgao", "fatura"] }],
    };
  }

  it("converte os dois lados de uma vez", () => {
    const { template, bindings } = projeto();
    const out = normalizeTableColumns(template, bindings);
    const tb = out.template.schemas[0] as TableSchema;
    expect(tb.content).toEqual([["{[orgao]}", "{[fatura]}"]]);
    expect((out.bindings[0] as Extract<Binding, { type: "array" }>).columns).toEqual([
      { label: "Órgão", formula: "{[orgao]}" },
      { label: "Fatura", formula: "{[fatura]}" },
    ]);
  });

  it("é idempotente", () => {
    const { template, bindings } = projeto();
    const uma = normalizeTableColumns(template, bindings);
    const duas = normalizeTableColumns(uma.template, uma.bindings);
    expect(duas.template).toEqual(uma.template);
    expect(duas.bindings).toEqual(uma.bindings);
  });

  it("não toca em nada quando não há vínculo de array", () => {
    const { template } = projeto();
    const out = normalizeTableColumns(template, []);
    expect(out.template).toBe(template);
  });

  it("célula que já é template manda — o vínculo se alinha a ela", () => {
    // `content` é a autoridade do PDF, então normalizar nunca a sobrescreve.
    const { template, bindings } = projeto();
    (template.schemas[0] as TableSchema).content = [["{[outra_coisa]}", "FATURA"]];
    const out = normalizeTableColumns(template, bindings);
    const tb = out.template.schemas[0] as TableSchema;
    expect(tb.content[0][0]).toBe("{[outra_coisa]}");
    expect((out.bindings[0] as Extract<Binding, { type: "array" }>).columns[0]).toEqual({
      label: "Órgão",
      formula: "{[outra_coisa]}",
    });
  });

  it("EQUIVALÊNCIA: a linha resolvida é a mesma antes e depois", () => {
    // O risco real da migração. Os dois caminhos usam o mesmo
    // `stringifyOrEmpty`; a única diferença é `getCaseInsensitive` (token) vs
    // bracket direto (chave crua), e ela é mais permissiva. Este teste é o que
    // prova que nenhum tipo de valor muda de texto.
    const itens: Record<string, unknown>[] = [
      { orgao: "SEFAZ", fatura: "F-1" },
      { orgao: 42, fatura: 0 },
      { orgao: null, fatura: undefined },
      { orgao: "", fatura: false },
      { orgao: "2026-09-03T00:00:00Z", fatura: 12.5 },
      {},
    ];
    const { template, bindings } = projeto();
    // Sem token na célula, pra o resolver cair no vínculo de chave crua.
    const antesTb = template.schemas[0] as TableSchema;
    const antesBinding = bindings[0] as Extract<Binding, { type: "array" }>;

    const out = normalizeTableColumns(template, bindings);
    const depoisTb = out.template.schemas[0] as TableSchema;
    const depoisBinding = out.bindings[0] as Extract<Binding, { type: "array" }>;

    for (const item of itens) {
      expect(resolveRowFromItem(depoisTb, item, depoisBinding)).toEqual(
        resolveRowFromItem(antesTb, item, antesBinding)
      );
    }
  });

  it("chave com ponto literal sobrevive — o caso que antes não tinha forma", () => {
    const template = {
      page: { width: 210, height: 297 },
      schemas: [
        {
          id: "tb1", name: "t", type: "table", x: 0, y: 0, width: 10, height: 10,
          head: ["Nome"], content: [["NOME"]],
        },
      ],
    } as unknown as Template;
    const bindings: Binding[] = [{ schemaName: "t", type: "array", path: "rows", columns: ["cliente.nome"] }];
    const out = normalizeTableColumns(template, bindings);
    const tb = out.template.schemas[0] as TableSchema;
    expect(tb.content[0][0]).toBe("{[cliente.nome]}");
    // E resolve a chave LITERAL, não caminhando.
    expect(resolveRowFromItem(tb, { "cliente.nome": "ACME", cliente: { nome: "OUTRO" } }, out.bindings[0] as Extract<Binding, { type: "array" }>)).toEqual(["ACME"]);
  });
});
