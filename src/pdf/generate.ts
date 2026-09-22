import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
// fontkit's browser build only exports named (no default) — a default import
// breaks in the consumer app's bundler (Vite/Rollup).
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
  // The document's physical page ceiling — default DEFAULT_MAX_PAGES (5000).
  // Going past it throws PageLimitError instead of returning a truncated PDF.
  // Raise it if you generate a giant report on purpose and have memory for it.
  maxPages?: number;
  // The bytes of a TTF/OTF/WOFF/WOFF2 font (e.g. downloaded from
  // @fontsource/inter) for full accents/unicode. Without it, it falls back to
  // pdf-lib's standard Helvetica (WinAnsi — it covers most Portuguese accents).
  fontBytes?: Uint8Array | ArrayBuffer;
};

// Extra data seen only by the repeating fields (header/footer/margin) —
// {pageNumber} and {pageCount} work like any other template token
// ({path.in.the.json}), except they are resolved again on every page instead
// of only once (which is why they do not go through buildInputs, which runs
// before pagination exists).
function pageData(data: unknown, pageNumber: number, pageCount: number): unknown {
  const base = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return { ...base, pageNumber, pageCount };
}

// The parameter's type is deliberately LOOSE (`page?`, `unknown` on the
// fields), and that is the point: `migrateTemplate` receives `unknown` — a
// template comes from a database, a file, an API, hand-edited. `TemplatePage`
// says `page` exists and that the sides are `number`, but at runtime it may be
// none of that. Typing it narrowly here would make TypeScript consider the
// checks redundant and invite someone to delete them.
function assertFinitePageSize(pageDef: { id: string; page?: { width?: unknown; height?: unknown } }): void {
  // `?? {}` because `page` may simply NOT EXIST. This used to be
  // `const { width, height } = pageDef.page`, so THIS function — which is the
  // guard — threw a raw TypeError about the very input it exists to refuse.
  // The destructuring ran before any check could.
  const { width, height } = pageDef.page ?? {};
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    // `Number(...)` only to fill in the error's fields: absent and "banana"
    // both become NaN, which is what the message has to say ("expected two
    // finite numbers greater than zero"). The DECISION above coerces nothing —
    // the string "210" is still refused, as it was before.
    throw new InvalidPageSizeError(pageDef.id, Number(width), Number(height));
  }
}

// The conditional visibility of a repeating band's field. The body is
// filtered by the layout; the bands only here, because their condition may
// depend on the page number.
function isRepeatingVisible(schema: { visibleWhen?: string }, pageScopedData: unknown): boolean {
  const condition = schema.visibleWhen?.trim();
  if (!condition) return true;
  return evaluateConditionLenient(condition, pageScopedData, true);
}

// The background (letterhead) — the same image embedded once, drawn on every
// generated page, always beneath everything else.
function drawBackground(page: PDFPage, background: PDFImage | null, pageWidthPt: number, pageHeightPt: number) {
  if (background) page.drawImage(background, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
}

// Draws ONE physical page from what the layout has already decided. No
// pagination decision happens here — `layoutDocument` (layout/layoutDocument.ts)
// has already resolved where everything falls; this loop only puts it on paper.
//
// `pageNumber`/`pageCount` arrive ready because the layout finished before the
// first stroke: that is what makes {pageNumber}/{pageCount} come out right on
// page 1 without needing a second traversal just to count.
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
  // Page size is structural: there is no sensible default to guess, and pdf-lib
  // would return an opaque TypeError ("`width` must be of type `number`, but
  // was actually of type `NaN`") without saying which page. A NaN here comes
  // from a template built by code (`width: Number(input)`) — JSON does not
  // represent NaN.
  assertFinitePageSize(pageDef);
  const pageWidthPt = mmToPt(pageDef.page.width);
  const pageHeightPt = mmToPt(pageDef.page.height);

  // One background image per DESIGN page, embedded once and reused on all of
  // its physical pages (the cache is keyed by data URI, so two design pages
  // with the same background share it too).
  let background: PDFImage | null = null;
  if (pageDef.backgroundImage) {
    // `null` = the page background, which has no field name.
    assertImageWithinSizeLimit(pageDef.backgroundImage, null);
    const cached = backgroundCache.get(pageDef.backgroundImage);
    if (cached) {
      background = cached;
    } else {
      try {
        background = await doc.embedPng(pageDef.backgroundImage);
      } catch {
        // pdf-lib/pako throws a raw STRING here ("The input is not a PNG
        // file!"), not an Error — so the caller's `catch (e) { e.message }`
        // gave `undefined`. The same handling drawImageField already gave to
        // the image field.
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

  // Repeating bands (header/footer/margin) — resolved HERE, and not in the
  // layout, because {pageNumber}/{pageCount} only exist once the layout has
  // finished. No body field depends on those tokens, so the body already
  // arrives with its value ready.
  for (const schema of repeatingSchemas) {
    // Repeating bands honor visibleWhen too. Resolved here, and not in the
    // layout, because the condition may use {pageNumber}/{pageCount} — e.g.
    // hiding a notice on the last page with `pageNumber != pageCount`.
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
    // Only the Y comes from the flow; the X stays exactly where it was drawn in
    // the editor — that is what preserves a grid of fields side by side
    // instead of cascading one below the other.
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

// Generates the final PDF: it resolves the bindings against the real JSON
// (buildInputs, which already existed and has no dependency on a PDF engine)
// and draws each schema in the right format. It runs 100% in the browser
// (pdf-lib is plain JS).
//
// Pagination: a body field automatically joins the header/footer (repeating
// on every page) when its Y position falls inside the headerHeight/
// footerHeight band — with no "zone" field in the schema, it is only the
// position. EVERY body item (table, repeated section, text, image) is
// processed in ONE sequence, ordered by Y: when one ends, the next continues
// right below it (the same page or a new one, whichever fits) — as if it were
// one continuous block. A table and a section may consume several slices or
// repetitions until they run out; text/image only takes up its own authored
// height. That already covers a title/caption BETWEEN two tables, text
// before/after a section and so on — the relative position between items is
// always preserved (the same gap authored in the editor), even if something
// earlier grew (a master-detail section) or changed page.
//
// Multi-page: `template.pages` (optional) allows drawing several DIFFERENT
// design pages in one PDF, with continuous numbering between them — the same
// PDFDocument/font embed, without generating/merging separate PDFs (see
// normalizePageDefs in layout/pageLayout.ts, renderPageDef above). A Template
// with no `pages` (every template today) becomes an array of 1, through
// exactly the same path.
export async function generatePdf(
  rawTemplate: Template,
  data: unknown,
  bindings: Binding[],
  options: GeneratePdfOptions = {}
): Promise<Uint8Array> {
  // A single point: every template that generates a PDF goes through here,
  // whether it comes from a database, a file or the in-memory <Designer>. A
  // template already at the current version passes through at no cost.
  const template = migrateTemplate(rawTemplate);

  // PAGE SIZE IS VALIDATED HERE, before the layout — and not only at render.
  //
  // The guard used to live inside `renderLayoutPage`, which runs AFTER
  // `layoutDocument`. And the layout reads the size directly (`bodyLayout.ts`
  // does `pageDef.page.height - footerHeight`), so a template whose `page`
  // does not exist threw `TypeError: Cannot read properties of undefined
  // (reading 'height')` inside the layout, before the guard had a chance.
  //
  // The side effect was worse than the ugly message: `describePdfError`
  // returns `null` for a TypeError, because it is not an error of ours. So the
  // consumer classified as `blame: "package"` — "not your fault, report it" —
  // a failure that belonged to THEIR template. Exactly the confusion the typed
  // error surface exists to put an end to.
  //
  // Validating ALL the pages at once, and not on demand, is also deliberate:
  // whoever loads a file wants to know that page 7 is malformed before waiting
  // for the first six to generate.
  // About `normalizePageDefs` and not `template.pages`: `pages` is OPTIONAL —
  // absent or empty, the template's flat fields become the implicit page (see
  // layout/pageLayout.ts). Validating the raw array would skip precisely the
  // single-page template, which is the most common case, and it is the same
  // set of pages the layout will walk three lines from here.
  for (const pageDef of normalizePageDefs(template)) assertFinitePageSize(pageDef);
  const doc = await PDFDocument.create();
  let font: PDFFont;
  if (options.fontBytes) {
    // @types/fontkit and pdf-lib's internal type for Fontkit diverge slightly
    // on the exact shape of create()'s return — a known type incompatibility
    // between the two packages, not an actual error (it works fine at
    // runtime).
    doc.registerFontkit(fontkit as unknown as Parameters<typeof doc.registerFontkit>[0]);
    const sfntBytes = await normalizeFontBytes(options.fontBytes);
    font = await doc.embedFont(sfntBytes);
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  // buildInputs/imageCache depend only on data+bindings (global to the whole
  // Template, not per page) — computed once, reused by every design page.
  // Nothing about them varies with the page being drawn.
  const inputs = buildInputs(data, bindings);
  const imageCache = new Map<string, PDFImage>();

  // A single traversal decides ALL the pagination, of every design page.
  // `pages.length` is the page count — not an estimate that has to agree with
  // the drawing afterwards.
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
