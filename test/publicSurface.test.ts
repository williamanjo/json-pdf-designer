import { readFileSync } from "./support/read";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../src/index";
import * as kit from "../src/components/ui";

// Guards da SUPERFÍCIE PÚBLICA.
//
// Export é promessa: uma vez publicado, tirar é breaking change. E o modo de
// falha é assimétrico — exportar por acidente não quebra nada hoje e custa um
// major amanhã; ESQUECER de exportar um `*Props` faz o adapter de 5 linhas do
// consumidor não compilar, e ele não tem como saber que o tipo existe.
//
// Daí dois testes de naturezas diferentes:
//
//   1. Um INVENTÁRIO explícito. Adicionar ou remover export passa a ser uma
//      edição revisada, não um efeito colateral.
//   2. Uma REGRA: todo componente exportado leva o `*Props` dele.

const FONTE = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
// A fonte de src/errors.ts — o inventário das classes de erro é derivado DELA
// (e conferido contra o barrel), em vez de repetido à mão: classe nova sem
// export vira falha, sem ninguém precisar lembrar de atualizar uma lista.
const LEITURA_ERRORS = readFileSync(join(__dirname, "..", "src", "errors.ts"), "utf8");

// Nomes de tipo que o barrel exporta, nas TRÊS formas que o arquivo usa:
//
//   export { Foo, type FooProps } from "..."     (lista mista)
//   export type { A, B } from "..."              (lista só de tipos)
//   export type Foo = ...                        (declaração local)
//
// A primeira versão deste helper era um `new RegExp("\\btype " + nome)`, e ele
// silenciosamente NÃO casava a segunda forma — ali `type` é seguido de `{`, e
// não do nome. O teste dos `*Props` passava (eles usam a forma mista) e só o
// dos tipos de estilo falhava, o que foi a pista.
function exportedTypes(fonte: string): Set<string> {
  const nomes = new Set<string>();
  for (const m of fonte.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    const soTipos = /export\s+type\s*\{/.test(m[0]);
    for (const bruto of m[1].split(",")) {
      const item = bruto.trim();
      if (!item) continue;
      const semAlias = item.split(/\s+as\s+/)[0].trim();
      if (soTipos) nomes.add(semAlias);
      else if (semAlias.startsWith("type ")) nomes.add(semAlias.slice(5).trim());
    }
  }
  for (const m of fonte.matchAll(/export\s+type\s+([A-Za-z0-9_]+)\s*=/g)) nomes.add(m[1]);
  return nomes;
}

const TIPOS = exportedTypes(FONTE);

// Componentes e o `*Props` que cada um TEM de levar junto.
const COMPONENTES_COM_PROPS = [
  // Preset e peças
  "Designer",
  "DesignerBindingEditor",
  "DesignerCanvas",
  "DesignerFieldList",
  "DesignerFilterPanel",
  "DesignerInspector",
  "DesignerPageSettings",
  "DesignerPropertyPanel",
  "DesignerProvider",
  "DesignerSidebar",
  "DesignerTabBar",
  "DesignerToolbar",
  // Registry
  "UiComponentsProvider",
  // Kit
  "Badge",
  "Button",
  "Card",
  "CardTitle",
  "Checkbox",
  "ClearFieldButton",
  "CollapsibleSection",
  "ColorInput",
  "Input",
  "MaterialIcon",
  "Modal",
  "PalettePicker",
  "PaletteSwatches",
  "Select",
  "TabPanel",
  "Textarea",
];

// Exportados SEM `*Props` próprio, e o porquê de cada grupo.
const SEM_PROPS_PROPRIO = [
  // `CardHeader` é um `<div>` puro — as props dele são `CardProps`.
  "CardHeader",
  // Os 20 ícones compartilham `IconProps`.
  "IconAlertTriangle",
  "IconArrowsHorizontal",
  "IconArrowsVertical",
  "IconBringToFront",
  "IconChevronLeft",
  "IconChevronRight",
  "IconDots",
  "IconDownload",
  "IconFolderUp",
  "IconGrip",
  "IconLink",
  "IconLock",
  "IconLockOpen",
  "IconMinus",
  "IconPlus",
  "IconRefresh",
  "IconSendToBack",
  "IconTrash",
  "IconUpload",
  "IconX",
  // Provider de i18n — as props dele são `{ locale, children }`, e `Locale`
  // já sai daqui.
  "I18nProvider",
];

describe("superfície pública — inventário de componentes", () => {
  it("exporta exatamente os componentes declarados", () => {
    const exportados = Object.entries(api)
      .filter(([nome, v]) => {
        // forwardRef é objeto com `$$typeof`.
        if (typeof v === "object" && v !== null && "$$typeof" in (v as object)) return true;
        // PascalCase + função = componente. Fábricas e helpers ficam fora
        // por convenção de nome (camelCase ou SCREAMING_CASE); as classes de
        // erro terminam em "Error".
        return typeof v === "function" && /^[A-Z]/.test(nome) && !/Error$/.test(nome);
      })
      .map(([nome]) => nome)
      .sort();
    const esperados = [...COMPONENTES_COM_PROPS, ...SEM_PROPS_PROPRIO].sort();
    const aMais = exportados.filter((n) => !esperados.includes(n));
    const aMenos = esperados.filter((n) => !exportados.includes(n));
    expect(aMais, `export NOVO não declarado — tirar depois é breaking change:\n  ${aMais.join("\n  ")}`).toEqual([]);
    expect(aMenos, `export que DESAPARECEU:\n  ${aMenos.join("\n  ")}`).toEqual([]);
  });
});

describe("superfície pública — todo componente leva o `*Props` dele", () => {
  // Tipo não existe em runtime, então a checagem é sobre a FONTE do barrel.
  // É o suficiente: se o `export type` não estiver escrito ali, o consumidor
  // não consegue importar.
  for (const nome of COMPONENTES_COM_PROPS) {
    it(`${nome}Props é exportado`, () => {
      expect(TIPOS.has(`${nome}Props`), `${nome} sai sem ${nome}Props — o adapter de 5 linhas do consumidor não compila`).toBe(true);
    });
  }

  it("IconProps é exportado (os 20 ícones compartilham)", () => {
    expect(TIPOS.has("IconProps")).toBe(true);
  });

  it("os tipos da API de estilo saem", () => {
    // Sem eles, montar `parts` num adapter exige re-derivar o tipo à mão.
    for (const t of ["PartStyle", "ClassValue", "LabeledParts"]) {
      expect(TIPOS.has(t), `${t} não sai do barrel`).toBe(true);
    }
  });

  it("os tipos dos cinco contextos saem", () => {
    for (const t of ["DesignerDataValue", "DesignerActionsValue", "DesignerSelectionValue", "DesignerUiValue", "DesignerConfigValue"]) {
      expect(TIPOS.has(t), `${t} não sai — quem escreve peça própria não consegue tipar o que lê`).toBe(true);
    }
  });

  it("controle: o extrator não inventa tipo", () => {
    // Sem isto, um extrator que devolvesse tudo faria todo teste acima
    // passar em vácuo.
    expect(TIPOS.has("NaoExisteProps")).toBe(false);
    expect(TIPOS.size).toBeGreaterThan(30);
  });
});

describe("superfície pública — o que fica DENTRO", () => {
  it("BulkLocked continua interno", () => {
    // Ele significa "travado porque você selecionou vários do mesmo tipo",
    // que é um MODO do <Designer> — fora daquele contexto não quer dizer
    // nada. Mas continua no kit, porque o próprio editor usa.
    expect("BulkLocked" in api, "BulkLocked virou público — ver o comentário em src/index.ts").toBe(false);
    expect("BulkLocked" in kit, "controle: BulkLocked saiu do kit interno também").toBe(true);
  });

  it("os componentes de chrome não são públicos", () => {
    // `PageCanvas`, `FieldList`, `PropertyPanel` e cia. continuam exportados
    // dos MÓDULOS deles (o caminho headless por props segue funcionando),
    // mas não do barrel: a superfície pública são as PEÇAS, que já vêm
    // ligadas no provider. Publicar os dois pares dobra a documentação e
    // convida a misturar os dois estilos no mesmo app.
    for (const nome of ["PageCanvas", "FieldList", "PropertyPanel", "Toolbar", "TemplateInspector", "BindingEditor", "FilterTab", "Ruler"]) {
      expect(nome in api, `${nome} virou público — a superfície são as peças Designer*`).toBe(false);
    }
  });

  it("o preview não vaza pra entry principal", () => {
    // Eles moram em "json-pdf-designer/preview" porque dependem do
    // pdfjs-dist, que é peer OPCIONAL (~35MB). Re-exportar aqui faria todo
    // consumidor do <Designer> precisar instalar pdf.js.
    for (const nome of ["PdfPreview", "PdfPreviewModal", "configurePdfWorker"]) {
      expect(nome in api, `${nome} vazou pra entry principal — obriga pdfjs-dist em todo consumidor`).toBe(false);
    }
  });
});

describe("superfície pública — o registry está completo", () => {
  it("todo slot tem o `*Props` dele exportado", () => {
    // É a condição pra escrever um adapter tipado nas duas pontas — a meta
    // declarada da API de slots. `CardHeader` é a exceção conhecida (usa
    // `CardProps`).
    for (const slot of Object.keys(api.defaultUiComponents)) {
      if (slot === "CardHeader") continue;
      expect(TIPOS.has(`${slot}Props`), `slot ${slot} sem ${slot}Props público`).toBe(true);
    }
  });

  it("defaultUiComponents, o provider e o hook saem juntos", () => {
    // Um sem o outro não serve: o provider precisa do mapa pra você compor
    // por cima, o mapa sem provider não tem onde entrar, e o hook é como a
    // sua própria peça resolve os primitivos.
    expect(typeof api.defaultUiComponents).toBe("object");
    expect(typeof api.UiComponentsProvider).toBe("function");
    expect(typeof api.useUiComponents).toBe("function");
  });
});

describe("superfície pública — os hooks de estado", () => {
  it("os cinco acessores e os cinco seletores saem", () => {
    const esperados = [
      "useDesignerActions",
      "useDesignerConfig",
      "useDesignerData",
      "useDesignerSelection",
      "useDesignerUi",
      "useDesignerBulkEdit",
      "useDesignerFieldListSchemas",
      "useDesignerFilterColumns",
      "useDesignerSelectedSchema",
      "useDesignerTabWarnings",
    ];
    const faltando = esperados.filter((h) => typeof (api as Record<string, unknown>)[h] !== "function");
    expect(faltando, `hook de estado não exportado:\n  ${faltando.join("\n  ")}`).toEqual([]);

    // A OUTRA DIREÇÃO, que faltava. Este caso só afirmava que os dez
    // existiam, então um hook NOVO entrava na API pública sem ninguém
    // declarar — foi exatamente o que aconteceu com `useDesignerZoom`: ele
    // atravessou a suíte inteira verde. O inventário de componentes acima não
    // pega hook porque filtra por PascalCase.
    const todosOsHooks = Object.keys(api)
      .filter((n) => n.startsWith("useDesigner"))
      .sort();
    const naoDeclarados = todosOsHooks.filter((h) => !esperados.includes(h) && h !== "useDesignerZoom");
    expect(
      naoDeclarados,
      `hook novo não declarado — tirar depois é breaking change:\n  ${naoDeclarados.join("\n  ")}`
    ).toEqual([]);
  });

  it("useDesignerZoom sai, com os limites que uma barra própria precisa", () => {
    // O zoom tem contexto próprio e hook próprio (ver
    // designer/context/zoomContext.ts). Sem os limites exportados, quem
    // desenha a própria barra chuta 0.25/3/0.1 e o canvas depois recusa o
    // valor — duas fontes da mesma verdade.
    const a = api as Record<string, unknown>;
    expect(typeof a.useDesignerZoom, "useDesignerZoom não exportado").toBe("function");
    expect(typeof a.clampZoom, "clampZoom não exportado").toBe("function");
    expect(a.ZOOM_MIN, "ZOOM_MIN não exportado").toBe(0.25);
    expect(a.ZOOM_MAX, "ZOOM_MAX não exportado").toBe(3);
    expect(a.ZOOM_STEP, "ZOOM_STEP não exportado").toBe(0.1);
    // E o clamp é o MESMO que o canvas aplica, senão a barra do consumidor
    // mostra um número que a folha não está usando.
    expect((a.clampZoom as (n: number) => number)(99)).toBe(3);
    expect((a.clampZoom as (n: number) => number)(-1)).toBe(0.25);
  });
});

// O contrato dos erros: `error.message` é INGLÊS, e toda falha é uma CLASSE
// com `code` + dados estruturados, mais um localizador pro texto de usuário
// final.
//
// A versão anterior deste bloco guardava o AVISO de que `message` estava em
// português e não era localizado. O desenho mudou: agora a mensagem é inglês
// (diagnóstico de desenvolvedor, ver o topo de src/errors.ts) e quem quer
// texto localizado chama `describePdfError(err, t)`. Estes testes guardam as
// DUAS metades, porque o consumidor precisa das duas: sem a classe ele volta
// pro regex, sem o localizador ele volta pra escrever texto próprio pra cada
// caso.
describe("superfície pública — o contrato dos erros", () => {
  it("o contrato está escrito junto dos exports", () => {
    // Prosa é o que evita o consumidor descobrir o desenho por tentativa. Se
    // alguém mudar o desenho outra vez, este teste força reescrever o
    // comentário no mesmo PR.
    expect(/`error\.message` de todo `throw` do pacote está em INGLÊS/.test(FONTE), "o aviso de que a mensagem é inglês saiu do src/index.ts").toBe(true);
    expect(/NÃO case regex na mensagem/.test(FONTE), "o aviso de não casar regex saiu do src/index.ts").toBe(true);
    expect(/describePdfError/.test(FONTE), "o localizador não está documentado junto dos exports").toBe(true);
  });

  it("as cinco classes de erro que já eram públicas continuam exportadas", () => {
    // São elas que substituem o casamento de mensagem. Perder uma força o
    // consumidor de volta pro regex.
    for (const c of ["PageLimitError", "UnsupportedGlyphError", "ExpressionError", "ExpressionSyntaxError", "ExpressionDepthError"]) {
      expect(c in api, `${c} deixou de ser exportado — sem ela, só resta casar mensagem`).toBe(true);
    }
  });

  it("toda classe de erro do pacote sai do barrel, com o localizador", () => {
    // Classe que existe e não é exportada é pior que classe que não existe: o
    // erro chega no `catch` do consumidor com um `name` que ele vê no log e um
    // `instanceof` que ele não consegue escrever.
    const declaradas = [...LEITURA_ERRORS.matchAll(/^export class ([A-Za-z0-9_]+) extends (?:PdfGenerationError|Error)/gm)].map((m) => m[1]);
    expect(declaradas.length, "controle: a varredura não achou classe nenhuma em src/errors.ts").toBeGreaterThan(15);
    const faltando = declaradas.filter((c) => !(c in api));
    expect(faltando, `classe de erro declarada e não exportada: ${faltando.join(", ")}`).toEqual([]);

    // A base abstrata, o guard, o localizador e a lista de codes — sem os
    // quatro, o `switch (err.code)` exaustivo não é escrevível de fora.
    for (const nome of ["PdfGenerationError", "isPdfError", "describePdfError", "PDF_ERROR_CODES"]) {
      expect(nome in api, `${nome} não sai do barrel`).toBe(true);
    }
    for (const t of ["AnyPdfError", "PdfErrorCode", "PdfErrorBlame", "PdfProblem", "PdfProblemCode"]) {
      expect(TIPOS.has(t), `${t} não sai do barrel — sem ele o consumidor não tipa o switch`).toBe(true);
    }
  });

  it("nenhum `throw` do pacote monta a mensagem com dicionário", () => {
    // O desenho é "classe + localizador na borda", justamente pra não threadar
    // dicionário pelo pipeline de render (`drawImageField` está três camadas
    // abaixo de `generatePdf`; `migrateTemplate` roda antes das opções). Um
    // `throw new Error(t.algo)` significaria que alguém threadou.
    const alvos = ["errors.ts", "pdf/generate.ts", "pdf/backgroundImage.ts", "pdf/render/renderImage.ts", "pdf/fontUtils.ts", "template.ts", "pdf/layout/layoutDocument.ts"];
    // Alvo que mudou de caminho estourava um ENOENT cru de dentro do helper de
    // leitura — mensagem que não diz que o problema é a LISTA, não o código.
    // Foi o que aconteceu quando `template/migrate.ts` virou `template.ts`.
    const sumidos = alvos.filter((rel) => !existsSync(join(__dirname, "..", "src", rel)));
    expect(sumidos, `alvo deste guard mudou de caminho — atualize a lista: ${sumidos.join(", ")}`).toEqual([]);
    const localizados = alvos.filter((rel) => /(?:throw new|super)\(\s*(?:t|dict)/.test(readFileSync(join(__dirname, "..", "src", rel), "utf8")));
    expect(
      localizados,
      `estes arquivos passaram a localizar a mensagem lançada — o desenho é classe + describePdfError: ${localizados.join(", ")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// O RESTO DA SUPERFÍCIE — tudo que NÃO é componente.
//
// O inventário de componentes acima filtra por PascalCase, então hook
// (camelCase), helper (camelCase) e constante (SCREAMING_CASE) ficavam TODOS
// de fora: 104 exports de runtime sem guard nenhum numa suíte que afirmava
// cobrir a superfície "nas duas direções".
//
// Foi assim que `useDesignerZoom`, `clampZoom` e os três `ZOOM_*` entraram
// na API pública com os 1040 testes verdes. O buraco é pior que o caso: a
// promessa de "export novo é intencional" valia pra um terço da superfície.
//
// Manter esta lista dá trabalho de propósito. Adicionar export público é
// decisão, não efeito colateral — tirar depois é breaking change.
// ---------------------------------------------------------------------------

describe("superfície pública — inventário do que não é componente", () => {
  const CLASSES_DE_ERRO = [
    "BackgroundImageUnreadableError", "ExpressionDepthError", "ExpressionError",
    "ExpressionSyntaxError", "FontDecompressFailedError", "FontDecompressTimeoutError",
    "ImageTooLargeError", "ImageUnreadableError", "ImageUploadTooLargeError",
    "ImageUploadUnreadableError", "InvalidPageSizeError", "PageLimitError",
    "PaginationStalledError", "PdfGenerationError", "TemplateMigrationMissingError",
    "TemplateNotAnObjectError", "TemplateVersionInvalidError", "TemplateVersionTooNewError",
    "TooManyImagesError", "UnsupportedGlyphError", "UnsupportedImageFormatError",
    "Woff2SupportMissingError",
  ];

  const CONSTANTES = [
    "ALL_SUGGESTIONS", "CHART_COLORS", "CHART_OTHER_COLOR", "CHART_PALETTES",
    "CHART_PALETTE_LABELS", "CHART_PALETTE_NAMES", "CHART_PALETTE_SIZE",
    "CURRENT_TEMPLATE_VERSION", "CUSTOM_FIELD_FUNCTIONS", "DEFAULT_MAX_PAGES",
    "MATERIAL_ICON_GRID", "MATERIAL_ICON_LABELS", "MATERIAL_ICON_NAMES",
    "MATERIAL_ICON_PATHS", "PAGE_SIZE_PRESETS", "PDF_ERROR_CODES",
    // Limites do zoom — exportados pra uma barra própria não divergir do canvas.
    "ZOOM_MAX", "ZOOM_MIN", "ZOOM_STEP",
  ];

  const FUNCOES = [
    // erros
    "describePdfError", "isPdfError",
    // expressões
    "applySuggestion", "braceError", "expressionError", "expressionErrors",
    "insertAtCaret", "suggestAt", "suspiciousOperator", "templateExpressionErrors",
    "templateSuspiciousOperators", "tokenAtCaret", "wordAtCaret",
    // dados e vínculos
    "buildInputs", "describeBinding", "describeBindingShort", "fieldWarning",
    "filterIncomplete", "resolveToken", "rowsFromArrayBinding",
    // gráfico e KPI
    "aggregateChartItems", "makeChartSchema", "makeKpiSchema", "resolveChartColors",
    "resolveChartItems", "resolveChartPalette", "resolveKpiValue",
    // geometria, zonas e página
    "applyOrientation", "clampToZone", "classifyZone", "isRedZone", "matchPreset",
    "mmToPt", "mmToPx", "orientationOf", "pxToMm", "clampZoom",
    // tabela e seção
    "columnKey", "columnLabel", "makeSectionColumnPair",
    // coluna de tabela: token sempre, rótulo separado da referência
    "columnFormulaFor", "segmentFor", "tokenFor", "makeBoundTable", "normalizeTableColumns",
    // PDF e template
    "downloadPdf", "generatePdf", "migrateTemplate", "normalizeFontBytes", "renderTemplate",
    // i18n e ícones
    "dictFor", "materialIconLabels", "useLocale", "useT", "withInlineCode",
    // slots
    "defaultUiComponents", "useUiComponents",
    // hooks de estado (o caso dedicado acima cobre o conteúdo da lista)
    "useDesignerActions", "useDesignerBulkEdit", "useDesignerConfig", "useDesignerData",
    "useDesignerFieldListSchemas", "useDesignerFilterColumns", "useDesignerSelectedSchema",
    "useDesignerSelection", "useDesignerTabWarnings", "useDesignerUi", "useDesignerZoom",
  ];

  // Mesmo filtro do inventário de componentes, invertido.
  const naoComponentes = Object.entries(api)
    .filter(([nome, v]) => {
      if (typeof v === "object" && v !== null && "$$typeof" in (v as object)) return false;
      if (typeof v === "function" && /^[A-Z]/.test(nome) && !/Error$/.test(nome)) return false;
      return true;
    })
    .map(([nome]) => nome)
    .sort();

  const declarados = [...CLASSES_DE_ERRO, ...CONSTANTES, ...FUNCOES].sort();

  it("controle: a varredura acha a superfície de verdade", () => {
    // Anti-vacuidade: se o filtro parar de casar, as duas comparações abaixo
    // ficam entre listas vazias e passam.
    expect(naoComponentes.length, "a varredura não achou export nenhum").toBeGreaterThan(90);
  });

  it("nenhum export novo entrou sem ser declarado", () => {
    const aMais = naoComponentes.filter((n) => !declarados.includes(n));
    expect(aMais, `export NOVO não declarado — tirar depois é breaking change:\n  ${aMais.join("\n  ")}`).toEqual([]);
  });

  it("nenhum export declarado desapareceu", () => {
    const aMenos = declarados.filter((n) => !naoComponentes.includes(n));
    expect(aMenos, `export que DESAPARECEU — isto é breaking change:\n  ${aMenos.join("\n  ")}`).toEqual([]);
  });

  it("nenhum nome duplicado na declaração", () => {
    const vistos = new Set<string>();
    const repetidos = declarados.filter((n) => (vistos.has(n) ? true : (vistos.add(n), false)));
    expect(repetidos, `nome declarado duas vezes:\n  ${repetidos.join("\n  ")}`).toEqual([]);
  });
});
