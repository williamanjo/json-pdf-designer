import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
// A build browser do fontkit só exporta nomeado (sem default) — import
// default quebra no bundler do app consumidor (Vite/Rollup).
import * as fontkit from "fontkit";
import type { Binding, ImageSchema, Schema, SectionSchema, TableSchema, Template, TemplatePage, TextSchema } from "../types";
import { aggregateChartItems, buildInputs, renderTemplate, resolveChartItems, resolveKpiValue } from "../bindings/bindings";
import { resolveChartColors } from "../chartColors";
import { drawChart } from "./drawChart";
import { drawKpi } from "./drawKpi";
import { drawSectionInstance, resolveSectionItems, sectionInstanceHeight, type SectionDrawContext } from "./drawSection";
import { drawTableSlice } from "./drawTable";
import { resolveFooterRow, resolveTextValue, resolveTopLevelTableRows } from "./resolvers";
import { mmToPt, ptToMm } from "../units";
import { classifyZone } from "../zones";
import { normalizeFontBytes } from "./fontUtils";
import { colorOrDefault } from "./color";
import { computeTableSlice, needsNewPageForItem } from "./pagination";

export type GeneratePdfOptions = {
  // Bytes de uma fonte TTF/OTF/WOFF/WOFF2 (ex: baixados do @fontsource/inter)
  // pra acentuação/unicode completos. Sem isso, cai no Helvetica padrão do
  // pdf-lib (WinAnsi — cobre a maioria dos acentos do português, mas não tudo).
  fontBytes?: Uint8Array | ArrayBuffer;
};

// Um item do corpo, na ordem em que aparece na página — tabela e seção
// paginam de verdade (podem consumir várias fatias/repetições, inclusive
// virando página); uma "row" (texto/imagem/gráfico/indicador) não pagina
// sozinha, só ocupa a própria altura no fluxo. Uma "row" pode ter mais de
// um schema — todo campo (não tabela/seção) que compartilha o MESMO y
// autorado vira uma linha só (ver buildBodyItems abaixo), preservando o X
// de cada um: sem isso, dois campos lado a lado (ex: dois indicadores de
// KPI na mesma linha) cascateariam um embaixo do outro, porque o fluxo
// sequencial reescreve o Y de cada item pelo cursor — sem essa junção,
// cada um vira seu próprio "próximo item da sequência" e perde a posição
// relativa aos vizinhos da mesma linha.
type BodyItem =
  | { kind: "table"; schema: TableSchema }
  | { kind: "section"; schema: SectionSchema }
  | { kind: "row"; schemas: Schema[]; y: number; height: number };

function boundsOf(item: BodyItem): { y: number; height: number } {
  return item.kind === "row" ? { y: item.y, height: item.height } : { y: item.schema.y, height: item.schema.height };
}

// Agrupa os schemas do corpo em BodyItem, na ordem em que aparecem na
// página (por Y) — tabela/seção viram um item cada; qualquer outro campo
// (texto/imagem/gráfico/indicador) que compartilhe o MESMO y autorado com
// o item anterior entra na mesma "row" em vez de virar um item à parte
// (ver comentário do BodyItem acima pro motivo).
function buildBodyItems(bodySchemas: Schema[]): BodyItem[] {
  const bodyItems: BodyItem[] = [];
  for (const s of bodySchemas.slice().sort((a, b) => a.y - b.y)) {
    if (s.type === "table") {
      bodyItems.push({ kind: "table", schema: s });
      continue;
    }
    if (s.type === "section") {
      bodyItems.push({ kind: "section", schema: s });
      continue;
    }
    const last = bodyItems[bodyItems.length - 1];
    if (last && last.kind === "row" && last.y === s.y) {
      last.schemas.push(s);
      last.height = Math.max(last.height, s.height);
      continue;
    }
    bodyItems.push({ kind: "row", schemas: [s], y: s.y, height: s.height });
  }
  return bodyItems;
}

// Espaço (mm) entre o final de um bloco (tabela ou seção) e o início do
// próximo — respeita o que foi desenhado no editor (a diferença entre
// onde o próximo foi posicionado e onde o anterior "deveria" terminar,
// segundo a altura autorada), nunca um valor fixo. Negativo (blocos
// sobrepostos no editor) vira 0 — não faz sentido empurrar pra cima.
function gapAfter(prev: { y: number; height: number }, next: { y: number; height: number }): number {
  return Math.max(next.y - (prev.y + prev.height), 0);
}

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

function drawTextField(
  page: PDFPage,
  font: PDFFont,
  schema: TextSchema,
  value: string | undefined,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number
): void {
  if (schema.backgroundColor) {
    const bg = colorOrDefault(schema.backgroundColor, rgb(0, 0, 0));
    page.drawRectangle({ x: xPt, y: yPt, width: widthPt, height: heightPt, color: bg });
  }
  if (schema.borderColor && schema.borderWidth) {
    const bc = colorOrDefault(schema.borderColor, rgb(0, 0, 0));
    page.drawRectangle({
      x: xPt,
      y: yPt,
      width: widthPt,
      height: heightPt,
      borderColor: bc,
      borderWidth: mmToPt(schema.borderWidth),
    });
  }
  const textColor = colorOrDefault(schema.fontColor || "#000000", rgb(0, 0, 0));
  const text = value ?? schema.content;
  const textWidth = font.widthOfTextAtSize(text, schema.fontSize);
  const alignOffset =
    schema.alignment === "center"
      ? Math.max(0, (widthPt - textWidth) / 2)
      : schema.alignment === "right"
        ? Math.max(0, widthPt - textWidth)
        : 0;
  page.drawText(text, {
    x: xPt + alignOffset,
    y: yPt + heightPt - schema.fontSize,
    size: schema.fontSize,
    font,
    color: textColor,
  });
}

async function drawImageField(
  doc: PDFDocument,
  page: PDFPage,
  schema: ImageSchema,
  imageCache: Map<string, PDFImage>,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number
): Promise<void> {
  const dataUri = schema.content;
  if (!dataUri) return;
  let embedded = imageCache.get(dataUri);
  if (!embedded) {
    const isPng = dataUri.startsWith("data:image/png");
    const isJpg = dataUri.startsWith("data:image/jpeg") || dataUri.startsWith("data:image/jpg");
    if (!isPng && !isJpg) {
      throw new Error(`Campo "${schema.name}": imagem em formato não suportado (só PNG/JPEG). Reenvie o arquivo pelo editor.`);
    }
    try {
      embedded = isPng ? await doc.embedPng(dataUri) : await doc.embedJpg(dataUri);
    } catch {
      throw new Error(`Campo "${schema.name}": não deu pra ler essa imagem — arquivo corrompido ou inválido.`);
    }
    imageCache.set(dataUri, embedded);
  }
  page.drawImage(embedded, { x: xPt, y: yPt, width: widthPt, height: heightPt });
}

// Normaliza um Template pro array de páginas que generatePdf desenha: se
// `template.pages` existe e não é vazio, é a fonte da verdade (várias
// páginas, cada uma com seu próprio design); senão, os campos flat de
// sempre (page/headerHeight/.../schemas) viram a única página implícita —
// mesmo caminho de código pros dois casos, sem branch "single vs multi".
function normalizePageDefs(template: Template): TemplatePage[] {
  if (template.pages && template.pages.length > 0) return template.pages;
  return [
    {
      id: "single",
      page: template.page,
      headerHeight: template.headerHeight,
      footerHeight: template.footerHeight,
      marginLeft: template.marginLeft,
      marginRight: template.marginRight,
      backgroundImage: template.backgroundImage,
      schemas: template.schemas,
    },
  ];
}

// Deriva, de UMA página (TemplatePage), tudo que a paginação/desenho
// precisam — mesma conta de sempre, só que parametrizada por pageDef em vez
// do Template inteiro (permite rodar uma vez por página quando há mais de
// uma).
function deriveBodyLayout(pageDef: TemplatePage) {
  const headerHeight = pageDef.headerHeight ?? 0;
  const footerHeight = pageDef.footerHeight ?? 0;
  const bodyBottomMm = pageDef.page.height - footerHeight;
  const bands = {
    headerHeight,
    footerHeight,
    marginLeft: pageDef.marginLeft ?? 0,
    marginRight: pageDef.marginRight ?? 0,
  };
  // Campo com sectionId nunca desenha por conta própria — só através da
  // repetição da seção dona dele (ver drawSection.ts).
  const ownedBySection = (s: Schema) => Boolean(s.sectionId);
  const repeatingSchemas = pageDef.schemas.filter((s) => !ownedBySection(s) && classifyZone(s, pageDef.page, bands) !== "body");
  const bodySchemas = pageDef.schemas.filter((s) => !ownedBySection(s) && classifyZone(s, pageDef.page, bands) === "body");
  const bodyItems = buildBodyItems(bodySchemas);
  return { headerHeight, bodyBottomMm, repeatingSchemas, bodyItems };
}

// Total de páginas que a sequência do corpo (tabela/seção/texto/imagem, em
// ordem de Y) de UMA página vai ocupar — matemática pura (sem pdf-lib),
// calculada antes de desenhar qualquer coisa, pra {pageCount} já sair certo
// desde a primeira página física de todo o documento (soma de todas as
// páginas do template). Simula a mesma conta de fatiamento/encadeamento do
// loop de desenho real, sem criar página nenhuma.
function countBodyPages(
  pageDef: TemplatePage,
  bodyItems: BodyItem[],
  bodyBottomMm: number,
  headerHeight: number,
  bindings: Binding[],
  data: unknown,
  inputs: Record<string, string>
): number {
  if (bodyItems.length === 0) return 1;
  let pages = 1;
  let cursorTopMm = boundsOf(bodyItems[0]).y;
  let prev: { y: number; height: number } | undefined;

  for (const item of bodyItems) {
    const bounds = boundsOf(item);
    if (prev) cursorTopMm += gapAfter(prev, bounds);
    prev = bounds;
    if (cursorTopMm >= bodyBottomMm) {
      pages++;
      cursorTopMm = headerHeight;
    }

    if (item.kind === "row") {
      const availableMm = bodyBottomMm - cursorTopMm;
      if (needsNewPageForItem(item.height, availableMm, cursorTopMm, headerHeight)) {
        pages++;
        cursorTopMm = headerHeight;
      }
      cursorTopMm += item.height;
      continue;
    }

    if (item.kind === "table") {
      const table = item.schema;
      const repeatHeader = table.repeatHeader !== false;
      const hasFooter = Boolean(table.footer && table.footer.length > 0);
      let remaining = resolveTopLevelTableRows(table, bindings, data, inputs).length;
      let isFirstSlice = true;
      for (let guard = 0; guard < 1000; guard++) {
        const includeHead = isFirstSlice || repeatHeader;
        const availableMm = bodyBottomMm - cursorTopMm;
        const slice = computeTableSlice(remaining, availableMm, includeHead, hasFooter);
        remaining -= slice.rowsToTake;
        cursorTopMm += slice.heightMm;
        isFirstSlice = false;
        if (remaining <= 0 || slice.capacity <= 0) break;
        pages++;
        cursorTopMm = headerHeight;
      }
    } else {
      const section = item.schema;
      const sectionItems = resolveSectionItems(section, bindings, data);
      let index = 0;
      for (let guard = 0; guard < 20000 && index < sectionItems.length; guard++) {
        const instanceHeight = sectionInstanceHeight(pageDef, section, sectionItems[index], bindings);
        const availableMm = bodyBottomMm - cursorTopMm;
        if (needsNewPageForItem(instanceHeight, availableMm, cursorTopMm, headerHeight)) {
          pages++;
          cursorTopMm = headerHeight;
          continue;
        }
        cursorTopMm += instanceHeight;
        index++;
      }
    }
  }
  return pages;
}

type PreparedPageDef = {
  pageDef: TemplatePage;
  repeatingSchemas: Schema[];
  bodyItems: BodyItem[];
  headerHeight: number;
  bodyBottomMm: number;
  pageCount: number;
};

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
  const background = pageDef.backgroundImage ? await doc.embedPng(pageDef.backgroundImage) : null;

  async function drawField(page: PDFPage, schema: Schema, value: string | undefined) {
    const xPt = mmToPt(schema.x);
    const widthPt = mmToPt(schema.width);
    const heightPt = mmToPt(schema.height);
    const yPt = pageHeightPt - mmToPt(schema.y) - heightPt;

    if (schema.type === "text") {
      drawTextField(page, font, schema, value, xPt, yPt, widthPt, heightPt);
      return;
    }

    if (schema.type === "image") {
      await drawImageField(doc, page, schema, imageCache, xPt, yPt, widthPt, heightPt);
      return;
    }

    if (schema.type === "table") {
      // Só cai aqui uma tabela repetida (header/footer/margem) — as do
      // corpo são tratadas à parte, no loop sequencial abaixo.
      const rows = resolveTopLevelTableRows(schema, bindings, data, inputs);
      const topYPt = pageHeightPt - mmToPt(schema.y);
      drawTableSlice(page, font, schema, rows, xPt, topYPt, widthPt, true, resolveFooterRow(schema, data));
      return;
    }

    // chart sem binding não desenha nada (nunca teve dado nenhum pra
    // mostrar), enquanto kpi sem binding cai pro template livre (abaixo) —
    // assimetria intencional, não esquecimento: KPI sempre tem título/
    // legenda pra mostrar mesmo sem vínculo (era o único modo antes do
    // vínculo "kpi" existir), chart sem array não tem o que desenhar.
    if (schema.type === "chart") {
      const binding = bindings.find(
        (b): b is Extract<Binding, { type: "chart" }> => b.schemaName === schema.name && b.type === "chart"
      );
      if (binding) {
        const raw = resolveChartItems(binding, data);
        const { items, total } = aggregateChartItems(raw, schema.topN ?? 7, schema.sortBy ?? "value_desc", resolveChartColors(schema.colorPalette, schema.customPaletteColors));
        drawChart(page, font, schema, items, total, xPt, yPt + heightPt, widthPt, heightPt);
      }
      return;
    }

    if (schema.type === "kpi") {
      const title = schema.title !== undefined ? renderTemplate(schema.title, data) : undefined;
      const kpiBinding = bindings.find(
        (b): b is Extract<Binding, { type: "kpi" }> => b.schemaName === schema.name && b.type === "kpi"
      );
      const value = kpiBinding
        ? String(resolveKpiValue(kpiBinding, data))
        : schema.value !== undefined
          ? renderTemplate(schema.value, data)
          : undefined;
      const subtitle = schema.subtitle !== undefined ? renderTemplate(schema.subtitle, data) : undefined;
      drawKpi(page, font, schema, title, value, subtitle, xPt, yPt, widthPt, heightPt);
    }

    // "section" nunca chega aqui direto — ver drawSection.ts.
  }

  const sectionCtx: SectionDrawContext = { template: pageDef, bindings, font, pageHeightPt, drawField };

  async function drawRepeating(page: PDFPage, pageNumber: number, pageCount: number) {
    for (const schema of repeatingSchemas) {
      if (schema.type !== "text") {
        await drawField(page, schema, inputs[schema.name]);
        continue;
      }
      const binding = bindings.find((b) => b.schemaName === schema.name);
      const text = resolveTextValue(schema.content, binding, pageData(data, pageNumber, pageCount));
      await drawField(page, schema, text);
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
          await drawField(lastPage, shifted, value);
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
// normalizePageDefs/renderPageDef acima). Um Template sem `pages` (todo
// template de hoje) vira um array de 1, passando pelo mesmíssimo caminho.
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
