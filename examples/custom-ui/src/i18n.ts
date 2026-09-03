import { dictFor } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";

// O DICIONÁRIO DA CASCA — o texto que é DESTE app, não do pacote.
//
// O `locale` do estado (App.tsx) alimenta dois dicionários: o do pacote (via
// prop `locale` do <Designer> e via `dictFor`) e este. Um seletor, duas
// camadas, zero sincronização manual — é a lição de i18n da lib.
//
// `Locale` vem do pacote de propósito: quando o pacote ganhar um idioma novo,
// `en: typeof pt` para de compilar até alguém traduzir aqui. Isso é desejável
// — o alternativo é uma chave faltando virar `undefined` e renderizar vazio em
// silêncio.
//
// Sem `as const`: com ele `typeof pt` seria o tipo LITERAL ("Salvar projeto"),
// e o `en` só compilaria repetindo as mesmas strings. Sem ele o tipo é
// `{ chave: string }`, que é exatamente o contrato que se quer — mesma FORMA,
// texto diferente.
//
// O que NÃO está aqui, e por quê:
// - conteúdo dos templates prontos (`data/templates/`) e o JSON de amostra
//   (`data/samples/`): é o DOCUMENTO do usuário. Um relatório em português
//   continua em português quando a interface vira inglês;
// - nome de campo / caminho de dado (`titulo_relatorio`, `rows.total`) e o
//   nome default de uma fonte (`fonte_2`): são chaves de dado, não rótulo;
// - o que o pacote já traduz (prévia do PDF, "Fechar" de modal, a palavra
//   "página", mensagens de expressão/vínculo): sai de `dictFor` — ver
//   `pageLabel` abaixo e `lib/templateProblems.ts`.
const pt = {
  // ------------------------------------------------------------ header
  // "custom-ui-example" é o NOME do example (identidade, não frase) — só a
  // aposição depois do travessão é texto de UI.
  appTitle: "custom-ui-example — casca 100% própria, sem UI pronta do pacote",
  localeSelectTitle: "Idioma da interface e do editor (não muda o PDF gerado)",
  loadExample: "Carregar exemplo…",
  saveProject: "Salvar projeto",
  loadProject: "Carregar projeto",
  generatePdf: "Gerar PDF",
  generating: "Gerando…",

  // -------------------------------------------------------- fontes JSON
  sourcesTitle: "Fontes de dados (JSON)",
  sourcesHint:
    "Cole ou arraste um ou mais arquivos .json — cada um vira uma fonte. Na hora de gerar, todas são juntadas (nível superior; em caso de chave repetida, a última fonte da lista vence) num objeto só antes de vincular campo.",
  dropzone: "Solte um ou mais arquivos .json aqui ou clique para escolher",
  removeSourceAria: (name: string) => `Remover fonte ${name}`,
  addBlankSource: "+ nova fonte em branco",
  resyncFields: "Resync campos",
  sourcesWithError: (n: number) => `${n} fonte(s) com erro`,
  fieldsFound: (n: number) => `✓ ${n} campo(s) encontrado(s)`,
  fieldsLoaded: (n: number) => `${n} campo(s) carregado(s)`,
  sourceError: (message: string) => `Erro: ${message}`,
  cantReadFile: (fileName: string) => `Não deu pra ler "${fileName}".`,
  unknownFile: "arquivo desconhecido",
  invalidJson: "JSON inválido.",
  notAnObject: "precisa ser um objeto JSON (não array/valor solto) pra poder juntar com as outras fontes.",

  // ------------------------------------------------------ árvore de campos
  fieldsTitle: "Campos do JSON",
  fieldsHint: "Arraste um campo para o relatório →",
  addFieldNoDrag: "Adicionar campo (sem arrastar)",
  addToReport: "Adicionar ao relatório",
  nativeSection: "Variáveis nativas",
  dataSection: "Dados",
  // O `{path}` fica cru: é o token que a pessoa vai digitar no template.
  nativeOnlyInBands: (path: string) => `{${path}} — só funciona no cabeçalho/rodapé/margem`,
  expandGroup: (label: string) => `Expandir ${label}`,
  collapseGroup: (label: string) => `Colapsar ${label}`,
  // Rótulo dos tokens sintéticos do motor (lib/jsonExplorer.ts::nativeFields).
  // O PATH (`pageNumber`) é dado e não muda; só o rótulo exibido é UI.
  nativePageNumber: "Nº da página",
  nativePageCount: "Total de páginas",
  pickerHint: "Clique em + pra adicionar direto no canvas (sem arrastar).",

  // -------------------------------------------------------- abas de página
  removePageAria: (n: number) => `Remover página ${n}`,
  addPageAria: "Adicionar página",

  // ---------------------------------------------------- painel de problemas
  problemsTitle: "Problemas do template",
  problemsNone: "Nenhum problema. Expressões válidas, vínculos completos.",
  // Frase inteira na função, não pedaço concatenado no JSX: em inglês o
  // número e o substantivo trocam de forma juntos ("1 suspicious expression"
  // vs "2 suspicious expressions"), e concatenar amarraria a ordem do pt-BR.
  suspectNote: (n: number) =>
    n === 1
      ? "1 expressão suspeita — compila, mas provavelmente não faz o que parece. Veja abaixo."
      : `${n} expressões suspeitas — compilam, mas provavelmente não fazem o que parece. Veja abaixo.`,
  willRenderEmptyNote: (n: number) =>
    n === 1
      ? "1 campo vai renderizar VAZIO no PDF. A geração não falha por isso — por isso este aviso existe."
      : `${n} campos vão renderizar VAZIOS no PDF. A geração não falha por isso — por isso este aviso existe.`,

  // ---------------------------------------------------- banner de geração
  blameData: "problema no dado",
  blameTemplate: "problema no template",
  blameConfig: "problema de configuração",
  blamePackage: "erro inesperado",
  errorFieldTag: "campo",
  showDetail: "ver detalhe",
  hideDetail: "esconder detalhe",
  dismissErrorAria: "Fechar aviso",

  // As mensagens de `lib/generationError.ts`: título (o que aconteceu) + ação
  // (o que a pessoa faz agora). São texto DESTE app — o pacote entrega uma
  // classe de erro, não uma frase pronta.
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
  // Função, e não string, porque o nome do painel vem do MESMO dicionário que
  // desenha o cabeçalho dele (`problemsTitle`) — assim a frase nunca manda
  // procurar um painel com outro nome. Concatenar no JSX quebraria em idioma
  // com ordem diferente.
  expressionAction: (painel: string) => `Veja o painel "${painel}" — ele lista cada expressão quebrada e onde está.`,
  // Usada quando o pacote OMITE `action`, o que ele faz de propósito quando a
  // falha é bug dele (paginationStalled, templateMigrationMissing): não há o
  // que a pessoa conserte, e o pacote não chuta um link de repositório. Quem
  // monta o app é que sabe onde reportar.
  reportBugAction: "Isso é bug do pacote, não do seu template — salve o projeto e reporte em github.com/williamanjo/json-pdf-designer.",
  // Uma ação só serve pras quatro recusas de arquivo de projeto: o arquivo é
  // que está errado, e o que se faz é escolher outro.
  projectAction: "Escolha outro arquivo, ou salve o projeto de novo pelo botão acima.",
  pageSizeTitle: "Tamanho de página inválido",
  pageSizeAction: 'Confira largura/altura na aba "Página" — precisam ser dois números maiores que zero, em mm.',
  imageTitle: "Problema com uma imagem",
  imageAction: "Reenvie a imagem pelo editor (PNG ou JPEG, até 15MB).",
  fontTitle: "Não deu pra carregar a fonte",
  fontAction: "A fonte deste example vem de src/assets/inter-regular.ttf — confira se o arquivo está lá e íntegro.",
  templateFormatTitle: "Template em formato incompatível",
  templateFormatAction:
    "O arquivo foi salvo por uma versão mais nova do json-pdf-designer, ou não é um template válido. " +
    "Atualize o pacote, ou carregue outro projeto.",
  paginationBugTitle: "Bug de paginação do pacote",
  paginationBugAction:
    "Isso não é problema do seu template — reporte em github.com/williamanjo/json-pdf-designer com o projeto que reproduz.",
  genericTitle: "Não deu pra gerar o PDF",
  genericAction: "Confira o detalhe abaixo. Se não fizer sentido, salve o projeto e reporte.",

  // ------------------------------------------------------ arquivo de projeto
  projectMissingTemplate: 'Arquivo de projeto inválido: falta "template" com "schemas".',
  projectBadBindings: 'Arquivo de projeto inválido: "bindings" precisa ser uma lista.',
  projectMalformed: "Arquivo de projeto inválido: JSON malformado.",
  projectUnreadable: "Não deu pra ler o arquivo — tente de novo.",
};

const en: typeof pt = {
  appTitle: "custom-ui-example — 100% hand-written shell, no packaged UI",
  localeSelectTitle: "Interface and editor language (doesn't change the generated PDF)",
  loadExample: "Load example…",
  saveProject: "Save project",
  loadProject: "Load project",
  generatePdf: "Generate PDF",
  generating: "Generating…",

  sourcesTitle: "JSON data sources",
  sourcesHint:
    "Paste or drop one or more .json files — each becomes a source. At generation time they are merged (top level; on a repeated key, the last source in the list wins) into a single object before any field is bound.",
  dropzone: "Drop one or more .json files here, or click to pick",
  removeSourceAria: (name: string) => `Remove source ${name}`,
  addBlankSource: "+ new blank source",
  resyncFields: "Resync fields",
  sourcesWithError: (n: number) => `${n} source(s) with errors`,
  fieldsFound: (n: number) => `✓ ${n} field(s) found`,
  fieldsLoaded: (n: number) => `${n} field(s) loaded`,
  sourceError: (message: string) => `Error: ${message}`,
  cantReadFile: (fileName: string) => `Couldn't read "${fileName}".`,
  unknownFile: "unknown file",
  invalidJson: "Invalid JSON.",
  notAnObject: "must be a JSON object (not an array or a bare value) so it can be merged with the other sources.",

  fieldsTitle: "JSON fields",
  fieldsHint: "Drag a field onto the report →",
  addFieldNoDrag: "Add field (without dragging)",
  addToReport: "Add to report",
  nativeSection: "Native variables",
  dataSection: "Data",
  nativeOnlyInBands: (path: string) => `{${path}} — only works in the header/footer/margin`,
  expandGroup: (label: string) => `Expand ${label}`,
  collapseGroup: (label: string) => `Collapse ${label}`,
  nativePageNumber: "Page number",
  nativePageCount: "Total pages",
  pickerHint: "Click + to add straight onto the canvas (no dragging).",

  removePageAria: (n: number) => `Remove page ${n}`,
  addPageAria: "Add page",

  problemsTitle: "Template problems",
  problemsNone: "No problems. Valid expressions, complete bindings.",
  suspectNote: (n: number) =>
    n === 1
      ? "1 suspicious expression — it compiles, but probably doesn't do what it looks like. See below."
      : `${n} suspicious expressions — they compile, but probably don't do what they look like. See below.`,
  willRenderEmptyNote: (n: number) =>
    n === 1
      ? "1 field will render EMPTY in the PDF. Generation doesn't fail because of it — which is why this warning exists."
      : `${n} fields will render EMPTY in the PDF. Generation doesn't fail because of it — which is why this warning exists.`,

  blameData: "data problem",
  blameTemplate: "template problem",
  blameConfig: "configuration problem",
  blamePackage: "unexpected error",
  errorFieldTag: "field",
  showDetail: "show detail",
  hideDetail: "hide detail",
  dismissErrorAria: "Dismiss warning",

  pageLimitTitle: (maxPages: number) => `The report went past ${maxPages} pages`,
  pageLimitAction:
    "Filter the data before generating, split it into several PDFs, or raise the cap " +
    "in generatePdf(..., { maxPages }) if you really do want a document that big.",
  glyphTitle: (char: string) => `The character ${char} doesn't exist in the font`,
  glyphAction:
    "Swap in a font that covers that character (generatePdf takes fontBytes), " +
    "or remove the character from the data. The package doesn't drop it silently: a report is " +
    "a signed document.",
  expressionTitle: "Invalid expression in the template",
  expressionAction: (painel: string) => `Check the "${painel}" panel — it lists every broken expression and where it is.`,
  reportBugAction: "This is a package bug, not your template — save the project and report it at github.com/williamanjo/json-pdf-designer.",
  projectAction: "Pick another file, or save the project again with the button above.",
  pageSizeTitle: "Invalid page size",
  pageSizeAction: 'Check width/height on the "Page" tab — both must be numbers greater than zero, in mm.',
  imageTitle: "Problem with an image",
  imageAction: "Re-upload the image from the editor (PNG or JPEG, up to 15MB).",
  fontTitle: "Couldn't load the font",
  fontAction: "This example's font comes from src/assets/inter-regular.ttf — check that the file is there and intact.",
  templateFormatTitle: "Template in an incompatible format",
  templateFormatAction:
    "The file was saved by a newer version of json-pdf-designer, or it isn't a valid template. " +
    "Update the package, or load a different project.",
  paginationBugTitle: "Pagination bug in the package",
  paginationBugAction:
    "This isn't your template's fault — report it at github.com/williamanjo/json-pdf-designer with the project that reproduces it.",
  genericTitle: "Couldn't generate the PDF",
  genericAction: "Check the detail below. If it doesn't make sense, save the project and report it.",

  projectMissingTemplate: 'Invalid project file: missing "template" with "schemas".',
  projectBadBindings: 'Invalid project file: "bindings" must be a list.',
  projectMalformed: "Invalid project file: malformed JSON.",
  projectUnreadable: "Couldn't read the file — try again.",
};

export type ShellDict = typeof pt;

export function t(locale: Locale): ShellDict {
  return locale === "pt-BR" ? pt : en;
}

// "Página N" / "Page N" — a palavra sai do dicionário DO PACOTE, não daqui.
// Uma página é conceito dele (`TemplatePage`, e a aba "Página" do painel de
// propriedades usa esse mesmo `tabBar.page`), então duplicar a tradução aqui
// criaria duas cópias pra dessincronizar: a aba da casca diria "Page 2"
// enquanto a aba do editor ao lado dizia "Página". `dictFor` devolve o
// dicionário como VALOR — `useT()` só funciona dentro de um <I18nProvider>, e
// isto é chamado também de fora da árvore React (lib/templateProblems.ts).
export function pageLabel(locale: Locale, oneBasedIndex: number): string {
  return `${dictFor(locale).tabBar.page} ${oneBasedIndex}`;
}
