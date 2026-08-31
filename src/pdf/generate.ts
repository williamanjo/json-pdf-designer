import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
// A build browser do fontkit só exporta nomeado (sem default) — import
// default quebra no bundler do app consumidor (Vite/Rollup).
import * as fontkit from "fontkit";
import type { Binding, Template } from "../types";
import { buildInputs } from "../bindings/bindings";
import { drawSectionInstance, resolveSectionItems, sectionInstanceHeight, type SectionDrawContext } from "./render/renderSection";
import { drawTableSlice } from "./render/renderTable";
import { assertImageWithinSizeLimit } from "./render/renderImage";
import { drawFieldOfType, type DrawFieldContext } from "./render";
import { resolveFooterRow, resolveTextValue, resolveTopLevelTableRows } from "./resolvers";
import { mmToPt, ptToMm } from "../units";
import { normalizeFontBytes } from "./fontUtils";
import { computeTableSlice, needsNewPageForItem } from "./pagination";
import { boundsOf, deriveBodyLayout, gapAfter } from "./layout/bodyLayout";
import { countBodyPages, normalizePageDefs } from "./layout/pageLayout";
import type { PreparedPageDef } from "./layout/layoutTypes";

export type GeneratePdfOptions = {
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

// Fundo (letterhead) — a mesma imagem embutida uma vez, desenhada em toda
// página gerada, sempre por baixo do resto.
function drawBackground(page: PDFPage, background: PDFImage | null, pageWidthPt: number, pageHeightPt: number) {
  if (background) page.drawImage(background, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
}

// Desenha UMA página-design (todas as suas páginas físicas) dentro do
// PDFDocument/font compartilhados por todo o Template — `startPageNumber`/
// `totalPages` já vêm prontos (somados entre TODAS as páginas do template,
// ver generatePdf) pra numeração ficar contínua entre uma página-design e a
// próxima. Retorna o último `pageNumber` usado, pra a próxima página-design
// continuar dali.
async function renderPageDef(
  doc: PDFDocument,
  font: PDFFont,
  prepared: PreparedPageDef,
  data: unknown,
  bindings: Binding[],
  inputs: Record<string, string>,
  imageCache: Map<string, PDFImage>,
  startPageNumber: number,
  totalPages: number
): Promise<number> {
  const { pageDef, repeatingSchemas, bodyItems, headerHeight, bodyBottomMm } = prepared;
  const pageWidthPt = mmToPt(pageDef.page.width);
  const pageHeightPt = mmToPt(pageDef.page.height);
  if (pageDef.backgroundImage) assertImageWithinSizeLimit(pageDef.backgroundImage, "Imagem de fundo da página");
  const background = pageDef.backgroundImage ? await doc.embedPng(pageDef.backgroundImage) : null;
  const fieldCtx: DrawFieldContext = { doc, font, pageHeightPt, imageCache, bindings, data, inputs };

  const sectionCtx: SectionDrawContext = {
    template: pageDef,
    bindings,
    font,
    pageHeightPt,
    drawField: (page, schema, value) => drawFieldOfType(fieldCtx, page, schema, value),
  };

  async function drawRepeating(page: PDFPage, pageNumber: number, pageCount: number) {
    for (const schema of repeatingSchemas) {
      if (schema.type !== "text") {
        await drawFieldOfType(fieldCtx, page, schema, inputs[schema.name]);
        continue;
      }
      const binding = bindings.find((b) => b.schemaName === schema.name);
      const text = resolveTextValue(schema.content, binding, pageData(data, pageNumber, pageCount));
      await drawFieldOfType(fieldCtx, page, schema, text);
    }
  }

  let pageNumber = startPageNumber;
  let lastPage = doc.addPage([pageWidthPt, pageHeightPt]);
  drawBackground(lastPage, background, pageWidthPt, pageHeightPt);
  await drawRepeating(lastPage, pageNumber, totalPages);

  async function newPage() {
    pageNumber++;
    lastPage = doc.addPage([pageWidthPt, pageHeightPt]);
    drawBackground(lastPage, background, pageWidthPt, pageHeightPt);
    await drawRepeating(lastPage, pageNumber, totalPages);
  }

  if (bodyItems.length > 0) {
    let cursorTopMm = boundsOf(bodyItems[0]).y;
    let prev: { y: number; height: number } | undefined;

    for (const item of bodyItems) {
      const bounds = boundsOf(item);
      if (prev) cursorTopMm += gapAfter(prev, bounds);
      prev = bounds;

      // Nem o começo deste item cabe onde o anterior parou — começa numa
      // página nova.
      if (cursorTopMm >= bodyBottomMm) {
        await newPage();
        cursorTopMm = headerHeight;
      }

      if (item.kind === "row") {
        // Uma linha não pagina sozinha — se nem a própria altura cabe no
        // que resta da página (e não é o topo dela ainda), joga a linha
        // INTEIRA (todo mundo que compartilha essa mesma linha) pra
        // próxima em vez de cortar.
        const availableMm = bodyBottomMm - cursorTopMm;
        if (needsNewPageForItem(item.height, availableMm, cursorTopMm, headerHeight)) {
          await newPage();
          cursorTopMm = headerHeight;
        }
        // Todo schema da linha recebe o MESMO Y (o cursor) — só o Y muda,
        // o X de cada um fica exatamente onde foi desenhado no editor, daí
        // uma linha preservar o layout lado a lado (grade de KPIs, por
        // exemplo) em vez de cascatear um embaixo do outro.
        for (const schema of item.schemas) {
          const shifted = { ...schema, y: cursorTopMm };
          const value =
            schema.type === "text"
              ? resolveTextValue(schema.content, bindings.find((b) => b.schemaName === schema.name), data)
              : inputs[schema.name];
          await drawFieldOfType(fieldCtx, lastPage, shifted, value);
        }
        cursorTopMm += item.height;
        continue;
      }

      if (item.kind === "table") {
        const tableSchema = item.schema;
        const repeatHeader = tableSchema.repeatHeader !== false;
        const hasFooter = Boolean(tableSchema.footer && tableSchema.footer.length > 0);
        const footerRow = hasFooter ? resolveFooterRow(tableSchema, data) : undefined;
        const xPt = mmToPt(tableSchema.x);
        const widthPt = mmToPt(tableSchema.width);
        let remaining = resolveTopLevelTableRows(tableSchema, bindings, data, inputs);
        let isFirstSlice = true;

        while (true) {
          const includeHead = isFirstSlice || repeatHeader;
          const availableMm = bodyBottomMm - cursorTopMm;
          const decision = computeTableSlice(remaining.length, availableMm, includeHead, hasFooter);
          const slice = remaining.slice(0, decision.rowsToTake);
          const topYPt = pageHeightPt - mmToPt(cursorTopMm);
          const bottomYPt = drawTableSlice(
            lastPage,
            font,
            tableSchema,
            slice,
            xPt,
            topYPt,
            widthPt,
            includeHead,
            decision.isLastSlice ? footerRow : undefined,
            decision.isLastSlice
          );
          remaining = remaining.slice(slice.length);
          isFirstSlice = false;

          if (remaining.length === 0 || decision.capacity <= 0) {
            cursorTopMm = pageDef.page.height - ptToMm(bottomYPt);
            break;
          }

          await newPage();
          cursorTopMm = headerHeight;
        }
      } else {
        const sectionSchema = item.schema;
        const sectionItems = resolveSectionItems(sectionSchema, bindings, data);
        let index = 0;

        for (let guard = 0; guard < 20000 && index < sectionItems.length; guard++) {
          const instanceHeight = sectionInstanceHeight(pageDef, sectionSchema, sectionItems[index], bindings);
          const availableMm = bodyBottomMm - cursorTopMm;
          if (needsNewPageForItem(instanceHeight, availableMm, cursorTopMm, headerHeight)) {
            await newPage();
            cursorTopMm = headerHeight;
            continue;
          }

          await drawSectionInstance(sectionCtx, lastPage, sectionSchema, sectionItems[index], index + 1, cursorTopMm);
          cursorTopMm += instanceHeight;
          index++;
        }
      }
    }
  }

  return pageNumber;
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
  template: Template,
  data: unknown,
  bindings: Binding[],
  options: GeneratePdfOptions = {}
): Promise<Uint8Array> {
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

  const pageDefs = normalizePageDefs(template);
  const prepared: PreparedPageDef[] = pageDefs.map((pageDef) => {
    const { headerHeight, bodyBottomMm, repeatingSchemas, bodyItems } = deriveBodyLayout(pageDef);
    const pageCount = countBodyPages(pageDef, bodyItems, bodyBottomMm, headerHeight, bindings, data, inputs);
    return { pageDef, repeatingSchemas, bodyItems, headerHeight, bodyBottomMm, pageCount };
  });
  const totalPages = prepared.reduce((sum, p) => sum + p.pageCount, 0);

  let pageNumber = 0;
  for (const p of prepared) {
    pageNumber = await renderPageDef(doc, font, p, data, bindings, inputs, imageCache, pageNumber + 1, totalPages);
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
