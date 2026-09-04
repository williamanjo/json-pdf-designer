import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
// A build browser do fontkit só exporta nomeado (sem default) — import
// default quebra no bundler do app consumidor (Vite/Rollup).
import * as fontkit from "fontkit";
import type { Binding, Template } from "../types";
import { buildInputs } from "../bindings/bindings";
import { drawSectionInstance, type SectionDrawContext } from "./render/renderSection";
import { drawTableSlice } from "./render/renderTable";
import { assertImageWithinSizeLimit } from "./render/renderImage";
import { drawFieldOfType, type DrawFieldContext } from "./render";
import { resolveTextValue } from "./resolvers";
import { mmToPt } from "../page/units";
import { normalizeFontBytes } from "./fontUtils";
import { layoutDocument, type LayoutPage, type Placement } from "./layout/layoutDocument";
import { normalizePageDefs } from "./layout/pageLayout";
import { migrateTemplate } from "../template";
import { evaluateConditionLenient } from "../expressions/resolve";
import { BackgroundImageUnreadableError, InvalidPageSizeError } from "../errors";

export type GeneratePdfOptions = {
  // Teto de páginas físicas do documento — default DEFAULT_MAX_PAGES (5000).
  // Estourá-lo lança PageLimitError em vez de devolver um PDF truncado. Suba
  // se você gera relatório gigante de propósito e tem memória pra isso.
  maxPages?: number;
  // Bytes de uma fonte TTF/OTF/WOFF/WOFF2 (ex: baixados do @fontsource/inter)
  // pra acentuação/unicode completos. Sem isso, cai no Helvetica padrão do
  // pdf-lib (WinAnsi — cobre a maioria dos acentos do português, mas não tudo).
  fontBytes?: Uint8Array | ArrayBuffer;
};

// Dados extras vistos só pelos campos repetidos (header/footer/margem) —
// {pageNumber} e {pageCount} funcionam como qualquer outro token de
// template ({caminho.do.json}), só que resolvidos de novo a cada página
// em vez de uma vez só (por isso não passam pelo buildInputs, que roda
// antes da paginação existir).
function pageData(data: unknown, pageNumber: number, pageCount: number): unknown {
  const base = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return { ...base, pageNumber, pageCount };
}

// Tipo do parâmetro FROUXO de propósito (`page?`, `unknown` nos campos), e
// isso é o ponto: `migrateTemplate` recebe `unknown` — template vem de banco,
// de arquivo, de API, editado à mão. O `TemplatePage` diz que `page` existe e
// que os lados são `number`, mas em runtime pode não ser nada disso. Tipar
// estreito aqui faria o TypeScript considerar as checagens redundantes e
// convidaria alguém a apagá-las.
function assertFinitePageSize(pageDef: { id: string; page?: { width?: unknown; height?: unknown } }): void {
  // `?? {}` porque `page` pode simplesmente NÃO EXISTIR. Antes isto era
  // `const { width, height } = pageDef.page`, então ESTA função — que é o
  // guard — estourava um TypeError cru sobre a entrada que ela existe pra
  // recusar.
  const { width, height } = pageDef.page ?? {};
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    // `Number(...)` só pra preencher os campos do erro: ausente e "banana"
    // viram NaN, que é o que a mensagem precisa dizer ("esperado dois números
    // finitos maiores que zero"). A DECISÃO acima não coage nada — string
    // "210" continua sendo recusada, como era antes.
    throw new InvalidPageSizeError(pageDef.id, Number(width), Number(height));
  }
}

// Visibilidade condicional de um campo de faixa repetida. O corpo é filtrado
// pelo layout; as faixas só aqui, porque a condição delas pode depender do
// número da página.
function isRepeatingVisible(schema: { visibleWhen?: string }, pageScopedData: unknown): boolean {
  const condition = schema.visibleWhen?.trim();
  if (!condition) return true;
  return evaluateConditionLenient(condition, pageScopedData, true);
}

// Fundo (letterhead) — a mesma imagem embutida uma vez, desenhada em toda
// página gerada, sempre por baixo do resto.
function drawBackground(page: PDFPage, background: PDFImage | null, pageWidthPt: number, pageHeightPt: number) {
  if (background) page.drawImage(background, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
}

// Desenha UMA página física a partir do que o layout já decidiu. Nenhuma
// decisão de paginação acontece aqui — `layoutDocument` (layout/layoutDocument.ts)
// já resolveu onde cada coisa cai e com que valor; este laço só põe no papel.
//
// `pageNumber`/`pageCount` chegam prontos porque o layout terminou antes do
// primeiro traço: é o que faz {pageNumber}/{pageCount} sair certo já na página
// 1 sem precisar de uma segunda travessia só pra contar.
async function renderLayoutPage(
  doc: PDFDocument,
  font: PDFFont,
  layoutPage: LayoutPage,
  data: unknown,
  bindings: Binding[],
  inputs: Record<string, string>,
  imageCache: Map<string, PDFImage>,
  backgroundCache: Map<string, PDFImage>,
  pageNumber: number,
  pageCount: number
): Promise<void> {
  const { pageDef, repeatingSchemas, placements } = layoutPage;
  // Tamanho de página é estrutural: não há default sensato pra adivinhar, e o
  // pdf-lib devolveria um TypeError opaco ("`width` must be of type `number`,
  // but was actually of type `NaN`") sem dizer de qual página. Um NaN aqui vem
  // de template montado por código (`width: Number(input)`) — JSON não
  // representa NaN.
  assertFinitePageSize(pageDef);
  const pageWidthPt = mmToPt(pageDef.page.width);
  const pageHeightPt = mmToPt(pageDef.page.height);

  // Uma imagem de fundo por página-DESIGN, embutida uma vez e reusada em todas
  // as páginas físicas dela (o cache é por data URI, então duas páginas-design
  // com o mesmo fundo também compartilham).
  let background: PDFImage | null = null;
  if (pageDef.backgroundImage) {
    // `null` = fundo de página, que não tem nome de campo.
    assertImageWithinSizeLimit(pageDef.backgroundImage, null);
    const cached = backgroundCache.get(pageDef.backgroundImage);
    if (cached) {
      background = cached;
    } else {
      try {
        background = await doc.embedPng(pageDef.backgroundImage);
      } catch {
        // O pdf-lib/pako lança uma STRING crua aqui ("The input is not a PNG
        // file!"), não um Error — então `catch (e) { e.message }` de quem chama
        // dava `undefined`. Mesmo tratamento que drawImageField já dava ao
        // campo de imagem.
        throw new BackgroundImageUnreadableError();
      }
      backgroundCache.set(pageDef.backgroundImage, background);
    }
  }

  const page = doc.addPage([pageWidthPt, pageHeightPt]);
  drawBackground(page, background, pageWidthPt, pageHeightPt);

  const fieldCtx: DrawFieldContext = { doc, font, pageHeightPt, imageCache, bindings, data, inputs };
  const sectionCtx: SectionDrawContext = {
    template: pageDef,
    bindings,
    font,
    pageHeightPt,
    drawField: (target, schema, value) => drawFieldOfType(fieldCtx, target, schema, value),
  };

  // Faixas repetidas (cabeçalho/rodapé/margem) — resolvidas AQUI, e não no
  // layout, porque {pageNumber}/{pageCount} só existem depois que o layout
  // terminou. Nenhum campo do corpo depende desses tokens, então o corpo já
  // chega com valor pronto.
  for (const schema of repeatingSchemas) {
    // Faixas repetidas também respeitam visibleWhen. Resolvido aqui, e não no
    // layout, porque a condição pode usar {pageNumber}/{pageCount} — ex:
    // esconder um aviso na última página com `pageNumber != pageCount`.
    if (!isRepeatingVisible(schema, pageData(data, pageNumber, pageCount))) continue;
    if (schema.type !== "text") {
      await drawFieldOfType(fieldCtx, page, schema, inputs[schema.name]);
      continue;
    }
    const binding = bindings.find((b) => b.schemaName === schema.name);
    const text = resolveTextValue(schema.content, binding, pageData(data, pageNumber, pageCount));
    await drawFieldOfType(fieldCtx, page, schema, text);
  }

  for (const placement of placements) {
    await drawPlacement(placement, page, font, pageHeightPt, fieldCtx, sectionCtx);
  }
}

async function drawPlacement(
  placement: Placement,
  page: PDFPage,
  font: PDFFont,
  pageHeightPt: number,
  fieldCtx: DrawFieldContext,
  sectionCtx: SectionDrawContext
): Promise<void> {
  if (placement.kind === "field") {
    // Só o Y vem do fluxo; o X fica exatamente onde foi desenhado no editor —
    // é isso que preserva uma grade de campos lado a lado em vez de cascatear
    // um embaixo do outro.
    await drawFieldOfType(fieldCtx, page, { ...placement.schema, y: placement.yMm }, placement.value);
    return;
  }

  if (placement.kind === "tableSlice") {
    drawTableSlice(
      page,
      font,
      placement.schema,
      placement.rows,
      mmToPt(placement.schema.x),
      pageHeightPt - mmToPt(placement.yMm),
      mmToPt(placement.schema.width),
      placement.includeHead,
      placement.footer,
      placement.isLastSlice
    );
    return;
  }

  await drawSectionInstance(sectionCtx, page, placement.schema, placement.item, placement.index + 1, placement.yMm);
}

// Gera o PDF final: resolve os vínculos contra o JSON real (buildInputs, já
// existente e sem nenhuma dependência de motor de PDF) e desenha cada
// schema no formato certo. Roda 100% no navegador (pdf-lib é JS puro).
//
// Paginação: um campo do corpo entra automaticamente no cabeçalho/rodapé
// (repete em toda página) quando sua posição Y cai dentro da faixa
// headerHeight/footerHeight — sem campo de "zona" no schema, é só a
// posição. TODO item do corpo (tabela, seção repetida, texto, imagem) é
// processado em UMA sequência só, ordenada por Y: quando um termina, o
// próximo continua logo abaixo (mesma página ou nova, o que couber) — como
// se fosse um bloco só emendado. Tabela e seção podem consumir várias
// fatias/repetições (inclusive página nova) até acabar; texto/imagem só
// ocupa a própria altura autorada. Isso já cobre título/legenda ENTRE duas
// tabelas, texto antes/depois de uma seção etc — a posição relativa entre
// itens é sempre preservada (mesmo gap autorado no editor), mesmo que algo
// anterior tenha crescido (seção mestre-detalhe) ou mudado de página.
//
// Multi-página: `template.pages` (opcional) deixa desenhar várias páginas-
// design DIFERENTES num PDF só, com numeração contínua entre elas — mesmo
// PDFDocument/font embed, sem gerar/mesclar PDFs separados (ver
// normalizePageDefs em layout/pageLayout.ts, renderPageDef acima). Um
// Template sem `pages` (todo template de hoje) vira um array de 1, passando
// pelo mesmíssimo caminho.
export async function generatePdf(
  rawTemplate: Template,
  data: unknown,
  bindings: Binding[],
  options: GeneratePdfOptions = {}
): Promise<Uint8Array> {
  // Ponto único: todo template que gera PDF passa por aqui, venha de banco,
  // arquivo ou do <Designer> em memória. Um template já na versão corrente
  // atravessa sem custo (nenhuma migração é aplicada).
  const template = migrateTemplate(rawTemplate);

  // TAMANHO DE PÁGINA É VALIDADO AQUI, antes do layout — e não só no render.
  //
  // O guard morava dentro do `renderLayoutPage`, que roda DEPOIS do
  // `layoutDocument`. E o layout lê o tamanho direto (`bodyLayout.ts` faz
  // `pageDef.page.height - footerHeight`), então um template cujo `page` não
  // existe estourava `TypeError: Cannot read properties of undefined
  // (reading 'height')` dentro do layout, antes de o guard ter chance.
  //
  // O efeito colateral era pior que a mensagem feia: `describePdfError`
  // devolve `null` pra um TypeError, porque ele não é um erro nosso. Então o
  // consumidor classificava como `blame: "package"` — "não é culpa sua,
  // reporte" — uma falha que era do TEMPLATE dele. Exatamente a confusão que
  // a superfície de erro tipada existe pra acabar.
  //
  // Validar TODAS as páginas de uma vez, e não sob demanda, também é de
  // propósito: quem carrega um arquivo quer saber que a página 7 está torta
  // antes de esperar a geração das seis primeiras.
  // Sobre `normalizePageDefs` e não `template.pages`: `pages` é OPCIONAL —
  // ausente ou vazio, os campos planos do template viram a página implícita
  // (ver layout/pageLayout.ts). Validar o array cru pularia justamente o
  // template de página única, que é o caso mais comum, e é o mesmo conjunto
  // de páginas que o layout vai percorrer daqui a três linhas.
  for (const pageDef of normalizePageDefs(template)) assertFinitePageSize(pageDef);
  const doc = await PDFDocument.create();
  let font: PDFFont;
  if (options.fontBytes) {
    // @types/fontkit e o tipo interno do pdf-lib pra Fontkit divergem um
    // pouco na forma exata do retorno de create() — incompatibilidade de
    // tipos conhecida entre os dois pacotes, não um erro de fato (funciona
    // certinho em runtime).
    doc.registerFontkit(fontkit as unknown as Parameters<typeof doc.registerFontkit>[0]);
    const sfntBytes = await normalizeFontBytes(options.fontBytes);
    font = await doc.embedFont(sfntBytes);
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  // buildInputs/imageCache dependem só de data+bindings (globais no
  // Template inteiro, não por página) — computados uma vez, reusados por
  // todas as páginas-design.
  const inputs = buildInputs(data, bindings);
  const imageCache = new Map<string, PDFImage>();

  // Uma travessia só decide TODA a paginação, de todas as páginas-design.
  // `pages.length` é a contagem de páginas — não uma estimativa que precise
  // concordar com o desenho depois.
  const layout = layoutDocument(template, data, bindings, inputs, { maxPages: options.maxPages });
  const backgroundCache = new Map<string, PDFImage>();

  for (const [index, layoutPage] of layout.pages.entries()) {
    await renderLayoutPage(doc, font, layoutPage, data, bindings, inputs, imageCache, backgroundCache, index + 1, layout.pages.length);
  }

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename = "relatorio.pdf") {
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
