import type { Locale } from "json-pdf-designer";

// Dicionário da CASCA deste app — o texto que é NOSSO, não do pacote.
//
// O `locale` do estado do App alimenta os dois dicionários: este e o do
// pacote (via `<I18nProvider locale>`, ver App.tsx). Um seletor, duas
// camadas, zero sincronização manual.
//
// O que NÃO mora aqui, de propósito:
//
// - Rótulo cujo CONCEITO é do pacote. As abas do `<Designer>` ("Dados",
//   "Estilo", "Filtro", "Página", "Inspetor") e o título do editor de
//   vínculo vêm de `dictFor(locale)` — duplicar seria criar duas traduções
//   pra dessincronizar. Só o QUALIFICADOR é nosso, e ele mora nas funções
//   de composição abaixo (`doCampo`, `deLinhas`, `noCanvas`, `doJson`).
// - Qualquer coisa que seja DADO: o conteúdo dos templates de
//   `data/templates/`, o sample de `data.ts`, o nome das fontes de dados
//   (`principal`, `fonte_2`), nome de campo, caminho de dado e o texto que
//   sai no PDF. Um relatório em português continua em português quando a
//   UI vira inglês — o idioma da interface não é o idioma do documento.
// - Título e "o que fazer" das falhas de GERAÇÃO. Isso o pacote entrega já
//   localizado, por `describePdfError(err, dictFor(locale))` — entrada
//   própria aqui seria uma segunda tradução da mesma frase, pra
//   dessincronizar. Ver `lib/generationError.ts`.
// - O `message` cru que o PACOTE lança. É INGLÊS de propósito (diagnóstico
//   de desenvolvedor: vai pro log, pro stack e pro Sentry) e aparece só no
//   "ver detalhe" do banner, que é justamente "a mensagem crua".
//
// `Locale` vem do pacote: quando ele ganhar um idioma novo, este arquivo
// para de compilar até alguém traduzir. É de propósito.

const pt = {
  // ---- header ------------------------------------------------------------
  subtitulo: "— editor montado peça por peça, sem barra de abas",
  formatoTitle: "Versão do formato de template",
  // Número no meio da frase => função, não concatenação no JSX: a ordem das
  // palavras muda de idioma pra idioma.
  formato: (versao: number, maxPaginas: number) => `formato v${versao} · até ${maxPaginas} páginas`,
  undoRedoTitle: "Undo/redo do template e dos vínculos, juntos",
  autosaveTitle: "Autosalvo no navegador (localStorage) a cada mudança",
  autosaveChip: "autosalvo",
  idiomaTitle: "Idioma da interface — troca a casca deste app E a UI do editor (não muda o PDF gerado)",
  carregarExemplo: "Carregar exemplo…",
  salvarProjeto: "Salvar projeto",
  carregarProjeto: "Carregar projeto",
  gerando: "Gerando…",
  gerarPdf: "Gerar PDF",
  zoomMenos: "Diminuir zoom",
  zoomMais: "Aumentar zoom",
  zoomNivel: "Nível de zoom",
  zoomLargura: "Largura",
  zoomAltura: "Altura",

  // ---- composição em cima do dicionário do PACOTE ------------------------
  // O substantivo entra pronto de `dictFor(locale)` (é aba do <Designer>);
  // aqui só mora o qualificador. Função porque em inglês ele vem ANTES:
  // "Dados do campo" / "Field data".
  doCampo: (conceito: string) => `${conceito} do campo`,
  deLinhas: (conceito: string) => `${conceito} de linhas`,
  noCanvas: (conceito: string) => `${conceito} no canvas`,
  doJson: (conceito: string) => `${conceito} do JSON`,

  // ---- coluna esquerda: fontes de dados ----------------------------------
  fontesTitulo: "Fontes de dados (JSON)",
  fontesNota:
    "Cole ou arraste um ou mais arquivos .json — cada um vira uma fonte. Na " +
    "hora de gerar, todas são juntadas (nível superior; em caso de chave " +
    "repetida, a última fonte da lista vence) num objeto só.",
  dropzone: "Solte .json aqui ou clique para escolher",
  naoLeuArquivos: (nomes: string[]) => `Não deu pra ler ${nomes.length === 1 ? "o arquivo" : "os arquivos"}: ${nomes.join(", ")}.`,
  removerFonte: (nome: string) => `Remover fonte ${nome}`,
  erroPrefixo: "Erro:",
  // As duas falhas de fonte que `lib/sources.ts` reporta. Ele devolve CÓDIGO
  // e a tradução acontece aqui, na renderização — se guardasse a frase
  // pronta no estado, trocar de idioma deixaria o aviso velho na tela até o
  // próximo "Resync".
  fonteJsonInvalido: "JSON inválido.",
  fonteNaoObjeto: "precisa ser um objeto JSON (não array/valor solto) pra poder juntar com as outras fontes.",
  novaFonte: "nova fonte em branco",
  resync: "Resync campos",
  fontesComErro: (n: number) => `${n} fonte(s) com erro`,
  camposSincronizados: (n: number) => `✓ ${n} campo(s)`,
  camposCarregados: (n: number) => `${n} campo(s) carregado(s)`,

  // ---- coluna esquerda: árvore de campos ---------------------------------
  arvoreNota: "Arraste um campo pro canvas (coluna do meio), ou use o +.",
  variaveisNativas: "Variáveis nativas",
  // Bate letra por letra com `tabBar.data` do pacote e mesmo assim é NOSSO:
  // ali é a aba que mostra o painel de dados do campo, aqui é a seção da
  // árvore que separa o JSON carregado das variáveis nativas. Conceito
  // diferente, palavra igual por coincidência — reusar seria acoplar dois
  // textos que podem divergir.
  grupoDados: "Dados",
  nativoTitle: (path: string) => `{${path}} — só funciona no cabeçalho/rodapé/margem`,
  adicionarAoCanvas: "Adicionar ao canvas",
  expandir: (label: string) => `Expandir ${label}`,
  colapsar: (label: string) => `Colapsar ${label}`,
  // Rótulo dos tokens sintéticos do motor (`pageNumber`/`pageCount`). O PATH
  // é dado — só o rótulo de exibição é UI. O pacote não tem esses dois no
  // dicionário dele, então a tradução é nossa mesmo.
  campoNumeroPagina: "Nº da página",
  campoTotalPaginas: "Total de páginas",

  // ---- abas de PÁGINA (não são as abas do editor) ------------------------
  pagina: (n: number) => `Página ${n}`,
  removerPagina: (n: number) => `Remover página ${n}`,
  adicionarPagina: "Adicionar página",

  // ---- banner de falha de geração ----------------------------------------
  // Rótulo dos quatro valores de `blame` do pacote ("data" | "template" |
  // "config" | "package"). O CONCEITO é dele, o rótulo é nosso: `blame` é
  // dado estruturado (serve pra status HTTP num backend, onde ninguém
  // renderiza nada), então o pacote não localiza a etiqueta.
  culpaDado: "problema no dado",
  culpaTemplate: "problema no template",
  culpaConfiguracao: "problema de configuração",
  culpaPacote: "erro inesperado",
  bannerCampo: "campo",
  verDetalhe: "ver detalhe",
  esconderDetalhe: "esconder detalhe",
  fecharAviso: "Fechar aviso",

  // ---- painel de problemas do template -----------------------------------
  problemasTitulo: "Problemas do template",
  semProblemas: "Nenhum problema. Expressões válidas, vínculos completos.",
  suspeitas: (n: number) =>
    `${n === 1 ? "1 expressão suspeita" : `${n} expressões suspeitas`} — compila, mas provavelmente não faz o que parece.`,
  vaoRenderizarVazio: (n: number) =>
    `${n === 1 ? "1 campo vai renderizar VAZIO no PDF." : `${n} campos vão renderizar VAZIOS no PDF.`} ` +
    "A geração não falha por isso — por isso este aviso existe.",

  // ---- falhas de geração (lib/generationError.ts) ------------------------
  // Sobraram TRÊS entradas. As outras quinze (páginas, glifo, expressão,
  // imagem, fonte, versão de template, paginação travada) foram apagadas
  // nesta rodada: `describePdfError` do pacote devolve título e ação já
  // localizados, e manter cópia aqui era garantir duas frases divergentes
  // pra mesma falha.
  //
  // Esta primeira fica por ESTRUTURA, não por falta de API: a ação do pacote
  // pra `invalidPageSize` manda definir largura/altura "na aba Página", e
  // este example não tem barra de abas — a peça é um cartão na coluna da
  // direita. A classificação (`code`, `blame`, título, campo) continua vindo
  // do pacote; só esta orientação de navegação é nossa.
  erroTamanhoAcao:
    'Confira largura/altura no cartão "Página" da coluna da direita — precisam ser dois números maiores que zero, em mm.',
  // As duas do genérico: o que sobra quando o erro não é nosso NEM do pacote
  // (fetch da fonte que falhou, TypeError de dentro do pdf-lib).
  erroGenericoTitulo: "Não deu pra gerar o PDF",
  erroGenericoAcao: "Confira o detalhe abaixo. Se não fizer sentido, salve o projeto e reporte.",

  // ---- leitura de arquivo de projeto (lib/projectFile.ts) ----------------
  projetoTitulo: "Arquivo de projeto inválido",
  projetoAcao: 'Carregue um arquivo salvo pelo botão "Salvar projeto" deste example. O detalhe abaixo diz o que faltou.',
  projetoSemTemplate: 'Falta "template" com "schemas".',
  projetoBindingsNaoLista: '"bindings" precisa ser uma lista.',
  projetoJsonMalformado: "JSON malformado.",
  projetoNaoLeu: "Não deu pra ler o arquivo — tente de novo.",
};

// `typeof pt` é o detalhe que importa: chave faltando NÃO COMPILA. Sem isso,
// uma tradução esquecida viraria `undefined` renderizado como vazio na tela,
// em silêncio. (E sem `as const` no `pt` de propósito — com ele o tipo seria
// o literal em português e nada aqui poderia ser diferente.)
const en: typeof pt = {
  // ---- header ------------------------------------------------------------
  subtitulo: "— editor assembled piece by piece, no tab bar",
  formatoTitle: "Template format version",
  formato: (versao, maxPaginas) => `format v${versao} · up to ${maxPaginas} pages`,
  undoRedoTitle: "Undo/redo of the template and the bindings, together",
  autosaveTitle: "Autosaved in the browser (localStorage) on every change",
  autosaveChip: "autosaved",
  idiomaTitle: "Interface language — switches this app's shell AND the editor UI (does not change the generated PDF)",
  carregarExemplo: "Load example…",
  salvarProjeto: "Save project",
  carregarProjeto: "Load project",
  gerando: "Generating…",
  gerarPdf: "Generate PDF",
  zoomMenos: "Zoom out",
  zoomMais: "Zoom in",
  zoomNivel: "Zoom level",
  zoomLargura: "Width",
  zoomAltura: "Height",

  // ---- composição em cima do dicionário do PACOTE ------------------------
  // `toLowerCase()` porque o substantivo chega capitalizado do pacote
  // ("Data", "Filter") e em inglês ele deixa de ser a primeira palavra.
  doCampo: (conceito) => `Field ${conceito.toLowerCase()}`,
  deLinhas: (conceito) => `Row ${conceito.toLowerCase()}`,
  noCanvas: (conceito) => `${conceito} on canvas`,
  doJson: (conceito) => `JSON ${conceito.toLowerCase()}`,

  // ---- coluna esquerda: fontes de dados ----------------------------------
  fontesTitulo: "JSON data sources",
  fontesNota:
    "Paste or drop one or more .json files — each becomes a source. At " +
    "generation time they are all merged (top level; on a repeated key, the " +
    "last source in the list wins) into a single object.",
  dropzone: "Drop .json here, or click to pick",
  naoLeuArquivos: (nomes) => `Could not read ${nomes.length === 1 ? "the file" : "the files"}: ${nomes.join(", ")}.`,
  removerFonte: (nome) => `Remove source ${nome}`,
  erroPrefixo: "Error:",
  fonteJsonInvalido: "Invalid JSON.",
  fonteNaoObjeto: "must be a JSON object (not an array or a bare value) so it can be merged with the other sources.",
  novaFonte: "new blank source",
  resync: "Resync fields",
  fontesComErro: (n) => `${n} source(s) with errors`,
  camposSincronizados: (n) => `✓ ${n} field(s)`,
  camposCarregados: (n) => `${n} field(s) loaded`,

  // ---- coluna esquerda: árvore de campos ---------------------------------
  arvoreNota: "Drag a field onto the canvas (middle column), or use the +.",
  variaveisNativas: "Native variables",
  grupoDados: "Data",
  nativoTitle: (path) => `{${path}} — only resolves in the header/footer/margin`,
  adicionarAoCanvas: "Add to canvas",
  expandir: (label) => `Expand ${label}`,
  colapsar: (label) => `Collapse ${label}`,
  campoNumeroPagina: "Page no.",
  campoTotalPaginas: "Total pages",

  // ---- abas de PÁGINA ----------------------------------------------------
  pagina: (n) => `Page ${n}`,
  removerPagina: (n) => `Remove page ${n}`,
  adicionarPagina: "Add page",

  // ---- banner de falha de geração ----------------------------------------
  culpaDado: "data problem",
  culpaTemplate: "template problem",
  culpaConfiguracao: "configuration problem",
  culpaPacote: "unexpected error",
  bannerCampo: "field",
  verDetalhe: "show detail",
  esconderDetalhe: "hide detail",
  fecharAviso: "Dismiss warning",

  // ---- painel de problemas do template -----------------------------------
  problemasTitulo: "Template problems",
  semProblemas: "No problems. Valid expressions, complete bindings.",
  suspeitas: (n) =>
    `${n === 1 ? "1 suspicious expression" : `${n} suspicious expressions`} — it compiles, but probably does not do what it looks like.`,
  vaoRenderizarVazio: (n) =>
    `${n === 1 ? "1 field will render EMPTY in the PDF." : `${n} fields will render EMPTY in the PDF.`} ` +
    "Generation does not fail because of it — which is exactly why this warning exists.",

  // ---- falhas de geração -------------------------------------------------
  erroTamanhoAcao:
    'Check width/height in the "Page" card of the right column — they must be two numbers greater than zero, in mm.',
  erroGenericoTitulo: "Could not generate the PDF",
  erroGenericoAcao: "Check the detail below. If it makes no sense, save the project and report it.",

  // ---- leitura de arquivo de projeto -------------------------------------
  projetoTitulo: "Invalid project file",
  projetoAcao: 'Load a file saved by this example\'s "Save project" button. The detail below says what was missing.',
  projetoSemTemplate: 'Missing "template" with "schemas".',
  projetoBindingsNaoLista: '"bindings" must be a list.',
  projetoJsonMalformado: "Malformed JSON.",
  projetoNaoLeu: "Could not read the file — try again.",
};

export type Ui = typeof pt;

export function t(locale: Locale): Ui {
  return locale === "pt-BR" ? pt : en;
}
