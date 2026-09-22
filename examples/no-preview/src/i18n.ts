import type { Locale } from "json-pdf-designer";

// THE SHELL'S DICTIONARY — only what this app says, nothing of what the
// editor says.
//
// The lib's i18n lesson lives here: the state's `locale` (App.tsx) feeds TWO
// dictionaries. The package's (`<Designer locale>`, and `dictFor(locale)` for
// whoever needs the text outside the React tree) translates what is ITS OWN —
// tabs, toolbar, binding warnings, expression errors. This one translates what
// is OURS — a panel's title, a header button, a hint, an `aria-label`. One
// switch, two responsibilities, zero manual syncing.
//
// `Locale` comes from THE PACKAGE on purpose: when it gains a new language,
// this example stops compiling until someone translates. That is desirable.
//
// WHAT IS NOT HERE, and not by oversight:
//
// - A label the package already translates. The slotted `<Select>`'s `label`
//   (src/uiSlots.tsx) arrives ready from the editor's dictionary; each
//   template problem's `message` comes from `expressionErrors`/`fieldWarning`
//   with `dictFor(locale)` (src/lib/templateProblems.ts); the `aria-label` of
//   the field explorer modal's "×" comes from `dictFor(locale).modal.close`
//   (src/components/DesignerPanel.tsx). Duplicating any of them would create
//   two translations to fall out of sync.
//
// - DATA. Template content (`data/templates/`), the sample JSON, a field name
//   (`titulo_relatorio`), a data path (`rows.total`), a source's name
//   (`principal`, `fonte_2`), the downloaded file's name (`relatorio.pdf`) and
//   the text that comes out IN THE PDF stay as they are in both languages: the
//   INTERFACE's language is not the DOCUMENT's language. A report in
//   Portuguese stays in Portuguese with the UI in English.
//
// - A language's name in the picker. `Português` and `English` each stay in
//   their own language, as is the convention.
//
// A message with a number or a name inside is a FUNCTION in the entry, never
// concatenation in the JSX: word order changes from language to language, and
// concatenating freezes Portuguese's order.
//
// No `as const`: with it each value's type would become the Portuguese
// literal, and `en: typeof pt` would start requiring the SAME text (nothing
// would compile translated). Without it, `typeof pt` is
// `{ header: { save: string, ... } }` — which is exactly the check that is
// wanted: a key missing from `en` does not compile, instead of rendering empty.
const pt = {
  header: {
    // "no-preview-example" is the folder's name, not a phrase — it stays the same
    title: "no-preview-example — gera o PDF sem pdf.js instalado",
    formatBadgeTitle: "Versão do formato de template",
    formatBadge: (version: number, maxPages: number) => `formato v${version} · até ${maxPages} páginas`,
    // Backticks viram <code> na renderização (ver `withInlineCode`, export do
    // pacote): a frase inteira fica numa entrada só, em vez de picada em
    // pedaços de JSX que nenhum tradutor consegue reordenar.
    subtitle:
      "Só o entry `json-pdf-designer` (nada de `/preview`), e `pdfjs-dist` ausente do `package.json`. " +
      "Clicar em gerar baixa o arquivo direto, sem tela de preview.",
    localeTitle: "Idioma da UI do designer (não muda o PDF gerado)",
    loadExample: "Carregar exemplo…",
    saveProject: "Salvar projeto",
    loadProject: "Carregar projeto",
    toLight: "Mudar para tema claro",
    toDark: "Mudar para tema escuro",
    light: "claro",
    dark: "escuro",
  },

  generate: {
    idle: "Gerar e baixar PDF",
    running: "Gerando…",
    // O nome do arquivo e o tamanho entram como estão — o nome é dado.
    downloaded: (file: string) => `Baixado: ${file}`,
    hint:
      "Nenhum recurso fica de fora por não instalar o `pdfjs-dist`: ele só habilita ver o PDF na tela " +
      "antes de baixar, via `json-pdf-designer/preview`.",
  },

  sources: {
    title: "Fontes de dados (JSON)",
    hint:
      "Cole ou arraste um ou mais arquivos .json — cada um vira uma fonte. Na hora de gerar, todas são " +
      "juntadas (nível superior; em caso de chave repetida, a última fonte da lista vence) num objeto só " +
      "antes de vincular campo.",
    dropzone: "Solte um ou mais arquivos .json aqui ou clique para escolher",
    unreadable: (file: string) => `Não deu pra ler "${file}".`,
    unknownFile: "arquivo desconhecido",
    // O nome da fonte é dado (vai pro autosave e é editável), então só o verbo
    // do `aria-label` é traduzido.
    remove: (name: string) => `Remover fonte ${name}`,
    errorPrefix: (message: string) => `Erro: ${message}`,
    addBlank: "+ nova fonte em branco",
    resync: "Resync campos",
    withError: (n: number) => `${n} fonte(s) com erro`,
    found: (n: number) => `✓ ${n} campo(s) encontrado(s)`,
    loaded: (n: number) => `${n} campo(s) carregado(s)`,
    invalidJson: "JSON inválido.",
    notAnObject: "precisa ser um objeto JSON (não array/valor solto) pra poder juntar com as outras fontes.",
  },

  fields: {
    title: "Campos do JSON",
    hint: "Arraste um campo para o relatório →",
    nativeSection: "Variáveis nativas",
    dataSection: "Dados",
    // Rótulo dos tokens sintéticos do motor de PDF. O `path` (`pageNumber`,
    // `pageCount`) é DADO — vai dentro do template como `{pageNumber}` e não
    // muda com o idioma; só o rótulo na árvore é nosso.
    nativePageNumber: "Nº da página",
    nativePageCount: "Total de páginas",
    nativeTitle: (path: string) => `{${path}} — só funciona no cabeçalho/rodapé/margem`,
    add: "Adicionar ao relatório",
    openPicker: "Adicionar campo (sem arrastar)",
    // O nome do grupo é dado (vem do JSON do usuário).
    expand: (label: string) => `Expandir ${label}`,
    collapse: (label: string) => `Colapsar ${label}`,
    pickerHint: "Clique em + pra adicionar direto no canvas (sem arrastar).",
  },

  problems: {
    title: "Problemas do template",
    none: "Nenhum problema. Expressões válidas, vínculos completos.",
    suspicious: (n: number) =>
      n === 1
        ? "1 expressão suspeita — compila, mas provavelmente não faz o que parece. Veja abaixo."
        : `${n} expressões suspeitas — compilam, mas provavelmente não fazem o que parecem. Veja abaixo.`,
    empty: (n: number) =>
      n === 1
        ? "1 campo vai renderizar VAZIO no PDF. A geração não falha por isso — por isso este aviso existe."
        : `${n} campos vão renderizar VAZIOS no PDF. A geração não falha por isso — por isso este aviso existe.`,
  },

  pages: {
    label: (n: number) => `Página ${n}`,
    remove: (n: number) => `Remover página ${n}`,
    add: "Adicionar página",
  },

  banner: {
    blameData: "problema no dado",
    blameTemplate: "problema no template",
    blameConfig: "problema de configuração",
    blamePackage: "erro inesperado",
    // O nome do campo entra depois, como <code> — daí a palavra sozinha.
    field: "campo",
    showDetail: "ver detalhe",
    hideDetail: "esconder detalhe",
    dismiss: "Fechar aviso",
  },

  project: {
    missingTemplate: 'Arquivo de projeto inválido: falta "template" com "schemas".',
    bindingsNotAList: 'Arquivo de projeto inválido: "bindings" precisa ser uma lista.',
    malformed: "Arquivo de projeto inválido: JSON malformado.",
    unreadable: "Não deu pra ler o arquivo — tente de novo.",
    // Uma ação só serve pros quatro casos: o arquivo está errado, e o que se
    // faz é escolher outro.
    action: "Escolha outro arquivo, ou salve o projeto de novo pelo botão acima.",
  },

  // Falha de geração já traduzida por CLASSE de erro (ver lib/generationError.ts).
  // O `detail` cru que acompanha cada uma NÃO passa por aqui: é a mensagem que
  // o pacote lançou, ou seja, dado de diagnóstico — traduzir seria reescrever o
  // que aconteceu.
  genError: {
    pageLimitTitle: (maxPages: number) => `O relatório passou de ${maxPages} páginas`,
    pageLimitAction:
      "Filtre os dados antes de gerar, divida em vários PDFs, ou aumente o teto " +
      "em generatePdf(..., { maxPages }) se você realmente quer um documento desse tamanho.",
    glyphTitle: (char: string) => `O caractere ${char} não existe na fonte`,
    glyphAction:
      "Troque a fonte por uma que cubra esse caractere (generatePdf aceita fontBytes), " +
      "ou remova o caractere do dado. O pacote não descarta em silêncio: um relatório é " +
      "documento assinado.",
    expressionTitle: "Expressão inválida no template",
    expressionAction: 'Veja o painel "Problemas do template" — ele lista cada expressão quebrada e onde está.',
    pageSizeTitle: "Tamanho de página inválido",
    pageSizeAction: 'Confira largura/altura na aba "Página" — precisam ser dois números maiores que zero, em mm.',
    imageTitle: "Problema com uma imagem",
    imageAction: "Reenvie a imagem pelo editor (PNG ou JPEG, até 15MB).",
    fontTitle: "Não deu pra carregar a fonte",
    fontAction: "A fonte deste example vem de src/assets/inter-regular.ttf — confira se o arquivo está lá e íntegro.",
    formatTitle: "Template em formato incompatível",
    formatAction:
      "O arquivo foi salvo por uma versão mais nova do json-pdf-designer, ou não é um template válido. " +
      "Atualize o pacote, ou carregue outro projeto.",
    paginationTitle: "Bug de paginação do pacote",
    paginationAction:
      "Isso não é problema do seu template — reporte em github.com/williamanjo/json-pdf-designer com o projeto que reproduz.",
    genericTitle: "Não deu pra gerar o PDF",
    genericAction: "Confira o detalhe abaixo. Se não fizer sentido, salve o projeto e reporte.",
  },
};

// `en: typeof pt` é a checagem que importa: chave faltando aqui não compila.
const en: typeof pt = {
  header: {
    title: "no-preview-example — generates the PDF with pdf.js not installed",
    formatBadgeTitle: "Template format version",
    formatBadge: (version: number, maxPages: number) => `format v${version} · up to ${maxPages} pages`,
    subtitle:
      "Only the `json-pdf-designer` entry (no `/preview`), and `pdfjs-dist` absent from `package.json`. " +
      "Clicking generate downloads the file straight away, with no preview screen.",
    localeTitle: "Designer UI language (does not change the generated PDF)",
    loadExample: "Load example…",
    saveProject: "Save project",
    loadProject: "Load project",
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
    light: "light",
    dark: "dark",
  },

  generate: {
    idle: "Generate and download PDF",
    running: "Generating…",
    downloaded: (file: string) => `Downloaded: ${file}`,
    hint:
      "Nothing is left out by not installing `pdfjs-dist`: it only enables seeing the PDF on screen " +
      "before downloading, via `json-pdf-designer/preview`.",
  },

  sources: {
    title: "JSON data sources",
    hint:
      "Paste or drop one or more .json files — each becomes a source. At generation time they are all " +
      "merged (top level; on a repeated key, the last source in the list wins) into a single object " +
      "before binding fields.",
    dropzone: "Drop one or more .json files here, or click to pick",
    unreadable: (file: string) => `Could not read "${file}".`,
    unknownFile: "unknown file",
    remove: (name: string) => `Remove source ${name}`,
    errorPrefix: (message: string) => `Error: ${message}`,
    addBlank: "+ new blank source",
    resync: "Resync fields",
    withError: (n: number) => `${n} source(s) with errors`,
    found: (n: number) => `✓ ${n} field(s) found`,
    loaded: (n: number) => `${n} field(s) loaded`,
    invalidJson: "Invalid JSON.",
    notAnObject: "must be a JSON object (not an array or bare value) so it can be merged with the other sources.",
  },

  fields: {
    title: "JSON fields",
    hint: "Drag a field onto the report →",
    nativeSection: "Native variables",
    dataSection: "Data",
    nativePageNumber: "Page number",
    nativePageCount: "Total pages",
    nativeTitle: (path: string) => `{${path}} — only works in the header/footer/margin`,
    add: "Add to the report",
    openPicker: "Add field (without dragging)",
    expand: (label: string) => `Expand ${label}`,
    collapse: (label: string) => `Collapse ${label}`,
    pickerHint: "Click + to add straight onto the canvas (no dragging).",
  },

  problems: {
    title: "Template problems",
    none: "No problems. Valid expressions, complete bindings.",
    suspicious: (n: number) =>
      n === 1
        ? "1 suspicious expression — it compiles, but probably does not do what it looks like. See below."
        : `${n} suspicious expressions — they compile, but probably do not do what they look like. See below.`,
    empty: (n: number) =>
      n === 1
        ? "1 field will render EMPTY in the PDF. Generation does not fail because of it — that is why this warning exists."
        : `${n} fields will render EMPTY in the PDF. Generation does not fail because of it — that is why this warning exists.`,
  },

  pages: {
    label: (n: number) => `Page ${n}`,
    remove: (n: number) => `Remove page ${n}`,
    add: "Add page",
  },

  banner: {
    blameData: "data problem",
    blameTemplate: "template problem",
    blameConfig: "configuration problem",
    blamePackage: "unexpected error",
    field: "field",
    showDetail: "show detail",
    hideDetail: "hide detail",
    dismiss: "Dismiss warning",
  },

  project: {
    missingTemplate: 'Invalid project file: missing "template" with "schemas".',
    bindingsNotAList: 'Invalid project file: "bindings" must be a list.',
    malformed: "Invalid project file: malformed JSON.",
    unreadable: "Could not read the file — try again.",
    action: "Pick another file, or save the project again with the button above.",
  },

  genError: {
    pageLimitTitle: (maxPages: number) => `The report went past ${maxPages} pages`,
    pageLimitAction:
      "Filter the data before generating, split it into several PDFs, or raise the cap in " +
      "generatePdf(..., { maxPages }) if you really do want a document that big.",
    glyphTitle: (char: string) => `The character ${char} does not exist in the font`,
    glyphAction:
      "Swap in a font that covers that character (generatePdf takes fontBytes), or remove the character " +
      "from the data. The package does not drop it silently: a report is a signed document.",
    expressionTitle: "Invalid expression in the template",
    expressionAction: 'See the "Template problems" panel — it lists every broken expression and where it is.',
    pageSizeTitle: "Invalid page size",
    pageSizeAction: 'Check width/height on the "Page" tab — they must be two numbers greater than zero, in mm.',
    imageTitle: "Problem with an image",
    imageAction: "Re-upload the image through the editor (PNG or JPEG, up to 15MB).",
    fontTitle: "Could not load the font",
    fontAction: "This example's font comes from src/assets/inter-regular.ttf — check that the file is there and intact.",
    formatTitle: "Template in an incompatible format",
    formatAction:
      "The file was saved by a newer version of json-pdf-designer, or it is not a valid template. " +
      "Update the package, or load another project.",
    paginationTitle: "Pagination bug in the package",
    paginationAction:
      "This is not your template's fault — report it at github.com/williamanjo/json-pdf-designer with the project that reproduces it.",
    genericTitle: "Could not generate the PDF",
    genericAction: "Check the detail below. If it makes no sense, save the project and report it.",
  },
};

export type ShellDict = typeof pt;

export function t(locale: Locale): ShellDict {
  return locale === "pt-BR" ? pt : en;
}
