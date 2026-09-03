import type { Locale } from "json-pdf-designer";

// Dicionário da CASCA deste app — header, painéis, abas de página, avisos.
//
// O ponto da lição: o `locale` que já existia no estado (e que alimentava o
// `<I18nProvider>` do editor) alimenta AGORA os dois dicionários — o do
// pacote e este. Um `<select>`, duas camadas, zero sincronização manual.
//
// O tipo `Locale` vem do PACOTE de propósito: quando o pacote ganhar um
// idioma novo, `en: typeof pt` deixa de cobrir o `Record<Locale, …>` e este
// example para de compilar até alguém traduzir. Isso é desejável.
//
// O que NÃO está aqui, e por quê:
//   - conteúdo dos templates prontos (`data/templates/`) e o JSON de amostra
//     (`data/samples/`): é DOCUMENTO do usuário. Um relatório em português
//     continua em português quando a UI vira inglês;
//   - nome de campo / path (`titulo_relatorio`, `rows.total`), nome de fonte
//     (`fonte_2`, `principal`) e nome de schema (`total_a3f2`): são
//     IDENTIFICADORES, gerados iguais em qualquer idioma;
//   - `Português` / `English` no seletor: nome de idioma fica no próprio
//     idioma, como é convenção;
//   - rótulo que o PACOTE já traduz (tipo de campo, aviso de vínculo, erro de
//     expressão, nome da aba "Página"): vem de `useT()`/`dictFor()`, ver
//     `components/SelectedFieldBar.tsx`;
//   - título e ação de FALHA do pacote (limite de páginas, glifo fora da
//     fonte, imagem inválida...): vêm de `describePdfError(err, dictFor(…))`,
//     ver `lib/generationError.ts`. Reescrever aqui seria manter duas
//     traduções da mesma frase.

// Sem `as const`: os valores widen pra `string` / `(n: number) => string`, e
// assim o inglês pode ter TEXTO diferente. O que `en: typeof pt` continua
// cobrando é a FORMA — chave faltando (ou com aridade errada) não compila.
// Sem isso, uma tradução esquecida vira `undefined` e renderiza vazio, calada.
const pt = {
  // ---- header ----
  appTitle: "Gerador de Relatórios",
  formatBadge: (version: number, maxPages: number) => `formato v${version} · até ${maxPages} páginas`,
  formatBadgeTitle: "Versão do formato de template",
  // O seletor troca as DUAS camadas agora (editor + casca) — o título diz isso.
  localeTitle: "Idioma da interface (editor e app) — não muda o PDF gerado",
  loadExample: "Carregar exemplo…",
  saveProject: "Salvar projeto",
  loadProject: "Carregar projeto",
  generating: "Gerando...",
  generatePdf: "Gerar PDF",

  // ---- fontes de dados (DataSourcePanel) ----
  sourcesTitle: "Fontes de dados (JSON)",
  sourcesHelp:
    "Cole ou arraste um ou mais arquivos .json — cada um vira uma fonte. Na hora de gerar, todas são juntadas (nível superior; em caso de chave repetida, a última fonte da lista vence) num objeto só antes de vincular campo.",
  sourcesDropzone: "Solte um ou mais arquivos .json aqui ou clique para escolher",
  sourceRemoveAria: (name: string) => `Remover fonte ${name}`,
  sourceErrorPrefix: "Erro:",
  sourceAddBlank: "nova fonte em branco",
  sourcesResync: "Resync campos",
  sourcesWithError: (n: number) => `${n} fonte(s) com erro`,
  fieldsFound: (n: number) => `✓ ${n} campo(s) encontrado(s)`,
  fieldsLoaded: (n: number) => `${n} campo(s) carregado(s)`,
  sourceReadFailed: (fileName: string) => `Não deu pra ler "${fileName}".`,
  sourceInvalidJson: "JSON inválido.",
  sourceNotObject: "precisa ser um objeto JSON (não array/valor solto) pra poder juntar com as outras fontes.",

  // ---- árvore de campos (FieldTree) ----
  fieldsTitle: "Campos do JSON",
  fieldsAddWithoutDrag: "Adicionar campo (sem arrastar)",
  fieldsDragHint: "Arraste um campo para o relatório →",
  fieldsNativeGroup: "Variáveis nativas",
  fieldsDataGroup: "Dados",
  fieldAddToReport: "Adicionar ao relatório",
  fieldNativeOnlyBands: (path: string) => `{${path}} — só funciona no cabeçalho/rodapé/margem`,
  fieldGroupExpandAria: (label: string) => `Expandir ${label}`,
  fieldGroupCollapseAria: (label: string) => `Colapsar ${label}`,
  // Rótulo dos tokens sintéticos. O PATH (`pageNumber`) é dado — é o que vai
  // pro template e sai no PDF; só o rótulo humano é UI.
  nativePageNumber: "Nº da página",
  nativePageCount: "Total de páginas",

  // ---- seletor de campos, modal (DesignerPanel) ----
  pickerHint: "Clique em + pra adicionar direto no canvas (sem arrastar).",

  // ---- abas de página (PageTabs) ----
  pageLabel: (n: number) => `Página ${n}`,
  pageRemoveAria: (n: number) => `Remover página ${n}`,
  pageAddAria: "Adicionar página",

  // ---- painel de problemas (ProblemsPanel) ----
  problemsTitle: "Problemas do template",
  problemsNone: "Nenhum problema. Expressões válidas, vínculos completos.",
  // Plural (e a frase inteira) dentro da entrada do dicionário, não
  // concatenado no JSX: em inglês a ordem/flexão é outra.
  problemsSuspect: (n: number) =>
    n === 1
      ? "1 expressão suspeita — compila, mas provavelmente não faz o que parece. Veja abaixo."
      : `${n} expressões suspeitas — compilam, mas provavelmente não fazem o que parecem. Veja abaixo.`,
  problemsEmpty: (n: number) =>
    n === 1
      ? "1 campo vai renderizar VAZIO no PDF. A geração não falha por isso — por isso este aviso existe."
      : `${n} campos vão renderizar VAZIOS no PDF. A geração não falha por isso — por isso este aviso existe.`,

  // ---- banner de falha de geração (GenerationErrorBanner) ----
  blameData: "problema no dado",
  blameTemplate: "problema no template",
  blameConfig: "problema de configuração",
  blamePackage: "erro inesperado",
  bannerFieldLabel: "campo",
  bannerHideDetail: "esconder detalhe",
  bannerShowDetail: "ver detalhe",

  // ---- barra do campo selecionado (SelectedFieldBar) ----
  selectedNone: "Nenhum campo selecionado — clique num campo no canvas ou na lista.",
  selectedBulkEditing: (n: number) => `editando ${n} em bloco`,
  selectedCount: (n: number) => `${n} selecionados`,
  // Verbos curtos de propósito: a barra tem 32px de altura e os três botões
  // dividem espaço com nome + tipo + coordenadas. O pacote tem os rótulos
  // longos ("Trazer para frente") em `fieldList`, mas usá-los aqui mudaria o
  // desenho da barra — e este example é a referência de estilo do repo.
  selectedBringToFront: "trazer",
  selectedSendToBack: "enviar",
  selectedRemove: "remover",

  // ---- arquivo de projeto (lib/projectFile.ts) ----
  // Estes viram `Error.message` e chegam à tela como o `detail` do banner.
  // Traduzem porque são mensagens NOSSAS, escritas pra quem usa o app — ao
  // contrário do texto cru que o PACOTE lança, que é sempre inglês (ver
  // lib/generationError.ts). O NOME do arquivo baixado não traduz.
  // Arquivo de projeto: título e AÇÃO por razão, em vez das quatro mensagens
  // que existiam aqui antes. Mensagem sozinha descrevia o defeito; o banner
  // precisa dizer o que fazer.
  projectShapeTitle: "Este arquivo de projeto está numa forma inesperada",
  projectShapeAction:
    'O arquivo abriu e o JSON era válido, mas não tem um "template" com "schemas" — ou o "bindings" ' +
    "dele não é uma lista. Provavelmente foi salvo por outro app, ou editado à mão.",
  projectMalformedTitle: "Este arquivo não é JSON válido",
  projectMalformedAction:
    "Escolha um arquivo exportado pelo botão de salvar deste example — não um PDF, não uma planilha.",
  projectUnreadableTitle: "Não deu pra ler o arquivo",
  projectUnreadableAction:
    "O navegador falhou em lê-lo. Se ele está num drive de rede ou pendrive, copie pra máquina primeiro.",

  // ---- erros de geração (lib/generationError.ts) ----
  // Só o que é NOSSO. Título e ação de falha do PACOTE saem de
  // `describePdfError(err, dictFor(locale))`, já localizados — 13 entradas
  // daqui (limite de páginas, glifo, tamanho de página, imagem, versão de
  // template, bug de paginação) foram APAGADAS quando o pacote passou a
  // entregá-las: entrada duplicada é tradução pra dessincronizar.
  //
  // A única sobrescrita de cópia que ficou, e por quê: o pacote não sabe que
  // este app tem um painel de problemas, então a AÇÃO de expressão inválida é
  // nossa (o título continua vindo dele). Ver `withAppCopy` em
  // lib/generationError.ts.
  genExpressionAction: (problemsPanel: string) =>
    `Veja o painel "${problemsPanel}" — ele lista cada expressão quebrada e onde está.`,
  // O asset de fonte é deste example (src/assets/inter-regular.ttf), não do
  // pacote — a falha tem classe nossa (FontLoadError, em lib/font.ts) e frase
  // nossa. O pacote só conhece as falhas de .woff2, que este example não usa.
  genFontTitle: "Não deu pra carregar a fonte",
  genFontAction: "A fonte deste example vem de src/assets/inter-regular.ttf — confira se o arquivo está lá e íntegro.",
  // Ramo de tudo que `describePdfError` devolve `null`: arquivo de projeto
  // inválido, falha de leitura, ou erro de fora do pacote.
  genUnknownTitle: "Não deu pra gerar o PDF",
  genUnknownAction: "Confira o detalhe abaixo. Se não fizer sentido, salve o projeto e reporte.",
};

const en: typeof pt = {
  // ---- header ----
  appTitle: "Report Builder",
  formatBadge: (version, maxPages) => `format v${version} · up to ${maxPages} pages`,
  formatBadgeTitle: "Template format version",
  localeTitle: "Interface language (editor and app) — does not change the generated PDF",
  loadExample: "Load example…",
  saveProject: "Save project",
  loadProject: "Load project",
  generating: "Generating...",
  generatePdf: "Generate PDF",

  // ---- data sources (DataSourcePanel) ----
  sourcesTitle: "JSON data sources",
  sourcesHelp:
    "Paste or drop one or more .json files — each becomes a source. At generation time they are all merged (top level; on a repeated key, the last source in the list wins) into a single object before fields are bound.",
  sourcesDropzone: "Drop one or more .json files here, or click to choose",
  sourceRemoveAria: (name) => `Remove source ${name}`,
  sourceErrorPrefix: "Error:",
  sourceAddBlank: "new blank source",
  sourcesResync: "Resync fields",
  sourcesWithError: (n) => `${n} source(s) with errors`,
  fieldsFound: (n) => `✓ ${n} field(s) found`,
  fieldsLoaded: (n) => `${n} field(s) loaded`,
  sourceReadFailed: (fileName) => `Could not read "${fileName}".`,
  sourceInvalidJson: "Invalid JSON.",
  sourceNotObject: "must be a JSON object (not an array or a bare value) so it can be merged with the other sources.",

  // ---- field tree (FieldTree) ----
  fieldsTitle: "JSON fields",
  fieldsAddWithoutDrag: "Add field (without dragging)",
  fieldsDragHint: "Drag a field onto the report →",
  fieldsNativeGroup: "Built-in variables",
  fieldsDataGroup: "Data",
  fieldAddToReport: "Add to the report",
  fieldNativeOnlyBands: (path) => `{${path}} — only works in the header/footer/margin`,
  fieldGroupExpandAria: (label) => `Expand ${label}`,
  fieldGroupCollapseAria: (label) => `Collapse ${label}`,
  nativePageNumber: "Page number",
  nativePageCount: "Total pages",

  // ---- field picker modal (DesignerPanel) ----
  pickerHint: "Click + to add it straight to the canvas (no dragging).",

  // ---- page tabs (PageTabs) ----
  pageLabel: (n) => `Page ${n}`,
  pageRemoveAria: (n) => `Remove page ${n}`,
  pageAddAria: "Add page",

  // ---- problems panel (ProblemsPanel) ----
  problemsTitle: "Template problems",
  problemsNone: "No problems. Valid expressions, complete bindings.",
  problemsSuspect: (n) =>
    n === 1
      ? "1 suspicious expression — it compiles, but probably does not do what it looks like. See below."
      : `${n} suspicious expressions — they compile, but probably do not do what they look like. See below.`,
  problemsEmpty: (n) =>
    n === 1
      ? "1 field will render EMPTY in the PDF. Generation does not fail because of it — which is why this warning exists."
      : `${n} fields will render EMPTY in the PDF. Generation does not fail because of it — which is why this warning exists.`,

  // ---- generation failure banner (GenerationErrorBanner) ----
  blameData: "data problem",
  blameTemplate: "template problem",
  blameConfig: "configuration problem",
  blamePackage: "unexpected error",
  bannerFieldLabel: "field",
  bannerHideDetail: "hide detail",
  bannerShowDetail: "see detail",

  // ---- selected field bar (SelectedFieldBar) ----
  selectedNone: "No field selected — click a field on the canvas or in the list.",
  selectedBulkEditing: (n) => `editing ${n} together`,
  selectedCount: (n) => `${n} selected`,
  selectedBringToFront: "front",
  selectedSendToBack: "back",
  selectedRemove: "remove",

  // ---- project file (lib/projectFile.ts) ----
  projectShapeTitle: "This project file is in an unexpected shape",
  projectShapeAction:
    'The file opened and the JSON parsed, but it has no "template" with "schemas" — or its "bindings" ' +
    "is not a list. It was probably saved by another app, or edited by hand.",
  projectMalformedTitle: "This file is not valid JSON",
  projectMalformedAction:
    "Pick a file exported by this example's save button — not a PDF, not a spreadsheet.",
  projectUnreadableTitle: "Could not read the file",
  projectUnreadableAction:
    "The browser failed to read it. If it lives on a network drive or USB stick, copy it locally first.",

  // ---- generation errors (lib/generationError.ts) ----
  genExpressionAction: (problemsPanel) => `See the "${problemsPanel}" panel — it lists every broken expression and where it is.`,
  genFontTitle: "Could not load the font",
  genFontAction: "This example's font comes from src/assets/inter-regular.ttf — check that the file is there and intact.",
  genUnknownTitle: "Could not generate the PDF",
  genUnknownAction: "Check the detail below. If it makes no sense, save the project and report it.",
};

export type AppDict = typeof pt;

export function t(locale: Locale): AppDict {
  return locale === "pt-BR" ? pt : en;
}
