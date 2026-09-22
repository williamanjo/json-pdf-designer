import type { ReactNode } from "react";
import type { Locale } from "json-pdf-designer/server";

// This app's SHELL dictionary — the labels that are OURS.
//
// This example is the repo's extreme case: it renders neither the
// `<Designer>` nor any `Designer*` part, so almost everything on screen is its
// own shell. The App state's `locale` feeds TWO dictionaries:
//
//   - `dictFor(locale)`, from the package — for every concept that is ITS OWN:
//     a field type's name, the geometry (X/Y/width/height), `visibleWhen`, the
//     text/KPI/chart properties, "missing binding", "incomplete filter", an
//     expression error message. Duplicating any of those here would create two
//     translations to fall out of sync.
//   - this file — for what exists only in THIS app: the header, the view tabs,
//     the data sources panel, the field explorer, the problems panel, the
//     generation error banner, and the three things in the property panel the
//     package has no equivalent concept for (the read-only "header + JSON
//     column" list, the static row editor, and the notice that an image/
//     section is not editable here).
//
// WHAT IS DELIBERATELY NOT HERE: anything that is DATA. The content of the
// templates in `data/templates/` (including each one's `label`, which is the
// document's NAME, not a UI label), the sample JSON, the field names
// (`kandir_tabela`, `rows.total`) and what comes out in the PDF stay in the
// language they were written in. Switching the UI to English does not
// translate a report written in Portuguese — the package's `<Designer locale>`
// documents that distinction and the shell honors it.
//
// SHAPE: `en` is the canonical one (it is this example's picker default, and
// it is what the screen already said before this round) and `ptBR: typeof en`
// is the contract — the same convention as the package itself
// (`src/i18n/locales/en.ts` + `src/i18n/locales/pt-BR.ts`). A missing key does
// not compile; without that a forgotten translation would come out
// `undefined`, rendered as empty, in silence.
//
// A message with a number/name is a FUNCTION, not concatenation in the JSX: in
// pt-BR the order of the parts changes ("3 campos carregados" vs "3 field(s)
// loaded"), and concatenating pins the sentence to English's order.

const en = {
  header: {
    // "headless-designer" is the folder's/the example's name — a proper noun,
    // not translated; only the word around it is.
    title: "headless-designer example",
    formatVersionTitle: "Template format version",
    formatMeta: (version: number, maxPages: number) => `format v${version} · up to ${maxPages} pages`,
    // Os nomes de símbolo (`<Designer>`, `json-pdf-designer/server`,
    // `react-rnd`) são identificadores de código: entram como argumento
    // renderizado por quem chama, e a frase em volta é que muda de idioma.
    // Devolver a lista de pedaços (em vez de concatenar no JSX) deixa pt-BR
    // reordenar à vontade.
    subtitle: (code: (text: string) => ReactNode): ReactNode[] => [
      "No ",
      code("<Designer>"),
      " and no ",
      code("Designer*"),
      " pieces — a hand-built canvas (drag/resize by hand, no react-rnd) over ",
      code("json-pdf-designer/server"),
      " + ",
      code("PdfPreview"),
      ".",
    ],
    localeTitle: "Language of this app's own chrome and of the package labels (dictFor(locale)) — does not change the generated PDF",
    loadExample: "Load example…",
    saveProject: "Save project",
    loadProject: "Load project",
    reset: "Reset",
    resetTitle: "Back to the initial template, and wipe the autosave",
    generating: "Generating…",
    generate: "Generate PDF",
  },

  view: {
    canvas: "Canvas",
    preview: "Preview",
    downloadPdf: "Download PDF",
    emptyHint: "Generate a PDF to preview it here.",
  },

  // A dica do painel de campos. NÃO vem de `t.fieldsPanel.selectHint` do
  // pacote de propósito: lá a frase termina em "…, or add a new one:" porque
  // no `<Designer>` ela fica logo acima dos botões de adicionar campo. Neste
  // app os botões "+ texto/tabela/…" moram na barra sobre o canvas, do outro
  // lado da tela — usar o rótulo do pacote aqui prometeria uma ação que este
  // painel não tem. O `t.fieldsPanel.heading` ("Fields"/"Campos"), esse sim,
  // continua vindo do pacote: é o mesmo conceito.
  fields: {
    selectHint: "Select a field in the list or on the canvas to edit it.",
  },

  pages: {
    // Rótulo de aba de página, e também o nome de página que aparece em cada
    // linha do painel de problemas — mesma frase, um lugar só.
    tab: (n: number) => `Page ${n}`,
    removeAria: (n: number) => `Remove page ${n}`,
    addAria: "Add page",
  },

  sources: {
    title: "JSON data sources",
    hint:
      "Paste, or drop one or more .json files — each becomes a source. At generation time they are " +
      "merged (top level; on a repeated key the last source in the list wins) into a single object " +
      "before any field is bound.",
    dropzone: "Drop .json files here, or click to pick",
    readError: (fileName: string) => `Could not read "${fileName}".`,
    unknownFile: "unknown file",
    removeAria: (name: string) => `Remove source ${name}`,
    parseError: (message: string) => `Error: ${message}`,
    // As duas razões de uma fonte ficar de fora da mescla. Ficam AQUI e não em
    // lib/sources.ts porque são interface: aparecem embaixo da fonte no
    // painel. O DADO mesclado não passa por tradução nenhuma.
    invalidJson: "Invalid JSON.",
    notAnObject: "must be a JSON object (not an array or a bare value) to be merged with the other sources.",
    addBlank: "+ blank source",
    resync: "Resync fields",
    withErrors: (n: number) => `${n} source(s) with errors`,
    found: (n: number) => `${n} field(s) found`,
    loaded: (n: number) => `${n} field(s) loaded`,
  },

  tree: {
    title: "JSON fields",
    hint: 'Drag a field onto the page, or press "+" to drop it in the middle.',
    nativeSection: "Native variables",
    dataSection: "Data",
    // Rótulo dos tokens sintéticos do motor. O `path` (`pageNumber`,
    // `pageCount`) é identificador e não muda; só o rótulo legível muda.
    nativeLabels: {
      pageNumber: "Page number",
      pageCount: "Total pages",
    } as Record<string, string>,
    nativeTitle: (path: string) => `{${path}} — only resolves in header/footer/margin`,
    addTitle: "Add to the current page",
    addAria: (label: string) => `Add ${label}`,
    expandAria: (label: string) => `Expand ${label}`,
    collapseAria: (label: string) => `Collapse ${label}`,
  },

  problems: {
    title: "Template problems",
    none: "No problems. Valid expressions, complete bindings.",
    // Frase inteira na função: em pt-BR o plural muda o meio da frase, não
    // só o número na frente.
    suspicious: (n: number) =>
      n === 1
        ? "1 suspicious expression — it compiles, but probably does not do what it looks like."
        : `${n} suspicious expressions — they compile, but probably do not do what they look like.`,
    willRenderEmpty: (n: number) =>
      n === 1
        ? "1 field will render EMPTY in the PDF. Generation does not fail for this — that is why this warning exists."
        : `${n} fields will render EMPTY in the PDF. Generation does not fail for this — that is why this warning exists.`,
  },

  props: {
    columnsHint: "Columns — header label, and the JSON column feeding it:",
    addColumn: "+ column",
    rowsLabel: "Rows (one per line, comma-separated cells)",
    // Complementa o `t.bindingEditor.boundLabel(path)` do pacote (o conceito
    // "está vinculado a X" é dele); o que é nosso é só o COMO revincular,
    // que neste example é arrastar do explorador.
    tableBoundHint: "drag another column of that array from the field tree onto this table to add it.",
    chartBoundHint: "drop another array on it to rebind.",
    chartUnboundHint: "drop an array from the field tree onto this chart.",
    unsupportedType: (typeLabel: string) =>
      `This example's own panel does not edit ${typeLabel} fields — they exist here because a loaded ` +
      `template can carry them, and they still generate. Editing them would mean writing an image ` +
      `uploader / section editor by hand; see the report-builder for those.`,
  },

  banner: {
    blame: {
      data: "problem in the data",
      template: "problem in the template",
      config: "setup problem",
      package: "unexpected error",
    },
    fieldLabel: "field",
    showDetail: "show detail",
    hideDetail: "hide detail",
    dismiss: "Dismiss",
  },

  // Text ONLY for the failures the package does NOT know about. Before 3.0.0
  // this section had nine entries — one per generation error code — because
  // the shell owned all the copy. Now `describePdfError` returns an
  // already-localized title and action for ITS errors (see
  // lib/generationError.ts), so keeping the nine here would be keeping a
  // second translation to fall out of sync.
  //
  // Four things are left: one action this example deliberately rewrites, and
  // the three errors that are our own concept.
  failures: {
    // The ONLY rewrite of the package's text. Its action is "fix the
    // expression — <message>"; here there is a panel that already lists ALL
    // the broken expressions with each one's location, and sending the person
    // there is better than repeating a single message. The title, code and
    expressionAction: 'See the "Template problems" panel — it lists every broken expression and where it is.',

    // A project file: the JSON this example saves and reloads. The three
    // reasons call for different ACTIONS, and that is the only reason there
    // are three.
    projectFile: {
      shape: {
        title: "This project file is in an unexpected shape",
        action:
          'The file opened and the JSON parsed, but it has no "template" with "schemas" — or its ' +
          '"bindings" is not a list. It was probably saved by another app, or edited by hand.',
      },
      malformed: {
        title: "This file is not valid JSON",
        action: "Pick a file exported by this example's Save button — not a PDF, not a spreadsheet.",
      },
      unreadable: {
        title: "Could not read the file",
        action: "The browser failed to read it. If it lives on a network drive or USB stick, copy it locally first.",
      },
    },

    // This example's font asset (src/assets/inter-regular.ttf). Failing to
    // FETCH it is a build/installation problem — nothing to do with the
    // package's font errors, which are about bytes that arrived and fontkit refused.
    fontAsset: {
      title: "Could not load the bundled font",
      action:
        "This example's font is src/assets/inter-regular.ttf, served by Vite. Check the file is there " +
        "and reload — the PDF cannot be generated without it.",
    },

    // An HONEST generic: it does not pretend to know. Before 3.0.0 every
    // failure landed here, because the classification was by a regex on a
    // message in Portuguese that 3.0.0 started emitting in English.
    unknown: {
      title: "Could not generate the PDF",
      action: "Check the detail below. If it makes no sense, save the project and report it.",
    },
  },
};

// `typeof en` is the contract: a missing key or a different argument type
// does not compile.
const ptBR: typeof en = {
  header: {
    title: "exemplo headless-designer",
    formatVersionTitle: "Versão do formato de template",
    formatMeta: (version, maxPages) => `formato v${version} · até ${maxPages} páginas`,
    subtitle: (code) => [
      "Sem ",
      code("<Designer>"),
      " e sem peças ",
      code("Designer*"),
      " — um canvas feito à mão (arrastar/redimensionar na mão, sem react-rnd) sobre ",
      code("json-pdf-designer/server"),
      " + ",
      code("PdfPreview"),
      ".",
    ],
    localeTitle: "Idioma da casca deste app e dos rótulos do pacote (dictFor(locale)) — não muda o PDF gerado",
    loadExample: "Carregar exemplo…",
    saveProject: "Salvar projeto",
    loadProject: "Carregar projeto",
    reset: "Resetar",
    resetTitle: "Volta ao template inicial e apaga o autosave",
    generating: "Gerando…",
    generate: "Gerar PDF",
  },

  view: {
    canvas: "Canvas",
    preview: "Prévia",
    downloadPdf: "Baixar PDF",
    emptyHint: "Gere um PDF pra ver a prévia aqui.",
  },

  fields: {
    selectHint: "Selecione um campo na lista ou no canvas pra editar.",
  },

  pages: {
    tab: (n) => `Página ${n}`,
    removeAria: (n) => `Remover a página ${n}`,
    addAria: "Adicionar página",
  },

  sources: {
    title: "Fontes de dados (JSON)",
    hint:
      "Cole, ou solte um ou mais arquivos .json — cada um vira uma fonte. Na hora de gerar, todas são " +
      "mescladas (nível superior; em chave repetida vence a última fonte da lista) num objeto só, antes " +
      "de qualquer campo ser vinculado.",
    dropzone: "Solte arquivos .json aqui, ou clique pra escolher",
    readError: (fileName) => `Não foi possível ler "${fileName}".`,
    unknownFile: "arquivo desconhecido",
    removeAria: (name) => `Remover a fonte ${name}`,
    parseError: (message) => `Erro: ${message}`,
    invalidJson: "JSON inválido.",
    notAnObject: "precisa ser um objeto JSON (não um array nem um valor solto) pra poder ser mesclado com as outras fontes.",
    addBlank: "+ fonte vazia",
    resync: "Ressincronizar",
    withErrors: (n) => `${n} fonte(s) com erro`,
    found: (n) => `${n} campo(s) encontrado(s)`,
    loaded: (n) => `${n} campo(s) carregado(s)`,
  },

  tree: {
    title: "Campos do JSON",
    hint: 'Arraste um campo pra página, ou clique no "+" pra soltar no meio.',
    nativeSection: "Variáveis nativas",
    dataSection: "Dados",
    nativeLabels: {
      pageNumber: "Número da página",
      pageCount: "Total de páginas",
    },
    nativeTitle: (path) => `{${path}} — só resolve no cabeçalho/rodapé/margem`,
    addTitle: "Adicionar na página atual",
    addAria: (label) => `Adicionar ${label}`,
    expandAria: (label) => `Expandir ${label}`,
    collapseAria: (label) => `Recolher ${label}`,
  },

  problems: {
    title: "Problemas do template",
    none: "Nenhum problema. Expressões válidas, vínculos completos.",
    suspicious: (n) =>
      n === 1
        ? "1 expressão suspeita — ela compila, mas provavelmente não faz o que parece."
        : `${n} expressões suspeitas — elas compilam, mas provavelmente não fazem o que parecem.`,
    willRenderEmpty: (n) =>
      n === 1
        ? "1 campo vai sair VAZIO no PDF. A geração não falha por isso — é justamente por isso que este aviso existe."
        : `${n} campos vão sair VAZIOS no PDF. A geração não falha por isso — é justamente por isso que este aviso existe.`,
  },

  props: {
    columnsHint: "Colunas — rótulo do cabeçalho, e a coluna do JSON que o alimenta:",
    addColumn: "+ coluna",
    rowsLabel: "Linhas (uma por linha, células separadas por vírgula)",
    tableBoundHint: "arraste outra coluna desse array, do explorador de campos, pra cima desta tabela pra acrescentá-la.",
    chartBoundHint: "solte outro array em cima dele pra revincular.",
    chartUnboundHint: "solte um array do explorador de campos em cima deste gráfico.",
    unsupportedType: (typeLabel) =>
      `O painel deste example não edita campos de ${typeLabel} — eles existem aqui porque um template ` +
      `carregado pode trazê-los, e geram normalmente. Editá-los seria escrever um uploader de imagem / ` +
      `um editor de seção à mão; pra isso, ver o report-builder.`,
  },

  banner: {
    blame: {
      data: "problema no dado",
      template: "problema no template",
      config: "problema de setup",
      package: "erro inesperado",
    },
    fieldLabel: "campo",
    showDetail: "ver detalhe",
    hideDetail: "esconder detalhe",
    dismiss: "Descartar",
  },

  failures: {
    expressionAction: 'Veja o painel "Problemas do template" — ele lista cada expressão quebrada e onde ela está.',

    projectFile: {
      shape: {
        title: "Este arquivo de projeto está numa forma inesperada",
        action:
          'O arquivo abriu e o JSON era válido, mas não tem um "template" com "schemas" — ou o ' +
          '"bindings" dele não é uma lista. Provavelmente foi salvo por outro app, ou editado à mão.',
      },
      malformed: {
        title: "Este arquivo não é JSON válido",
        action: "Escolha um arquivo exportado pelo botão Salvar deste example — não um PDF, não uma planilha.",
      },
      unreadable: {
        title: "Não foi possível ler o arquivo",
        action:
          "O navegador falhou em lê-lo. Se ele está num drive de rede ou pendrive, copie pra máquina primeiro.",
      },
    },

    fontAsset: {
      title: "Não foi possível carregar a fonte embutida",
      action:
        "A fonte deste example é src/assets/inter-regular.ttf, servida pelo Vite. Confira se o arquivo " +
        "está lá e recarregue — sem ela o PDF não é gerado.",
    },

    unknown: {
      title: "Não foi possível gerar o PDF",
      action: "Veja o detalhe abaixo. Se ele não fizer sentido, salve o projeto e reporte.",
    },
  },
};

export type ShellDict = typeof en;

// `Record<Locale, ShellDict>`, e não um ternário: `Locale` é o tipo DO
// PACOTE, então no dia em que ele ganhar um terceiro idioma este mapa deixa
// de compilar até a casca ser traduzida junto. Com um ternário
// (`locale === "pt-BR" ? ptBR : en`) o idioma novo cairia calado no inglês.
// Mesma estrutura do `DICTIONARIES` do pacote (src/i18n/dictionaries.ts).
const SHELL_DICTIONARIES: Record<Locale, ShellDict> = { en, "pt-BR": ptBR };

// Dicionário da casca como VALOR — de propósito igual ao `dictFor(locale)`
// do pacote, e não um hook: nada aqui depende de contexto React, então o
// mesmo `locale` do estado do App serve as duas camadas sem provider nenhum.
export function shellDict(locale: Locale): ShellDict {
  return SHELL_DICTIONARIES[locale] ?? en;
}
