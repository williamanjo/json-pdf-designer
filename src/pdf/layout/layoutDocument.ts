import type { Binding, Schema, SectionSchema, TableSchema, Template, TemplatePage } from "../../types";
import { computeTableSlice, needsNewPageForItem } from "../pagination";
import { resolveFooterRow, resolveTextValue, resolveTopLevelTableRows } from "../resolvers";
import { boundsOf, deriveBodyLayout, gapAfter } from "./bodyLayout";
import { normalizePageDefs } from "./pageLayout";
import type { BodyItem } from "./layoutTypes";
import { resolveSectionItems, sectionInstanceHeight } from "./sectionLayout";
import { evaluateConditionLenient } from "../../expressions/resolve";
import { PageLimitError, PaginationStalledError } from "../../errors";

// One thing to draw, already positioned on a physical page and with its value
// resolved. The renderer consumes this and makes no pagination decision and
// resolves no data.
export type Placement =
  // A body field (text/image/chart/kpi). `yMm` is the flow CURSOR's Y, not the
  // authored Y — each one's X stays where it was drawn in the editor, which is
  // what preserves the side-by-side layout of a "row".
  | { kind: "field"; schema: Schema; yMm: number; value: string | undefined }
  // One table slice: the rows that fitted on this page.
  | { kind: "tableSlice"; schema: TableSchema; yMm: number; rows: string[][]; includeHead: boolean; footer?: string[]; isLastSlice: boolean }
  // One repetition of a section. It keeps the `item` and the `index` instead of
  // expanding the members into Placements: `drawSectionInstance` already knows
  // how to shift the members as each member table grows (master-detail), and
  // reimplementing that here would change behavior needlessly. The page
  // DECISION, which is what mattered to unify, is all here.
  | { kind: "sectionRepeat"; schema: SectionSchema; yMm: number; item: unknown; index: number };

export type LayoutPage = {
  // Which design page this physical page belongs to (size, background, bands).
  pageDef: TemplatePage;
  // Header/footer/margin — they repeat on every physical page of this design page.
  // They are deliberately left without a resolved value: {pageNumber}/{pageCount}
  // only exist once the layout has finished, so the render resolves them (see
  // drawRepeating in generate.ts), with pages.length already known.
  repeatingSchemas: Schema[];
  placements: Placement[];
};

export type LayoutDocument = { pages: LayoutPage[] };

// A document's physical page ceiling. It exists to protect whoever generates:
// a template from an untrusted source, or data much larger than someone
// expected, must not become a million-page PDF that blows the memory.
//
// It replaced two ITERATION counters (1000 table slices, 20000 section
// repetitions) that had two problems:
//
//  1. They truncated SILENTLY. 60 thousand table rows came out as 40,998 in a
//     PDF that looked complete; 20 thousand section repetitions came out as
//     18,667. In a report, omitting a row without warning is the worst
//     possible outcome.
//  2. They protected against an infinite loop that cannot happen: the table's
//     always breaks on `capacity <= 0`, and the section's can always place the
//     item on the next page (on a freshly opened page the cursor is the
//     headerHeight, so `needsNewPageForItem` is false). Counting iterations
//     was measuring the wrong thing.
//
// The genuinely scarce resource is a page — it costs memory and time, whether
// it comes from a table, a section or several design pages. So the ceiling is
// in pages, and going past it is an ERROR, not a cut.
export const DEFAULT_MAX_PAGES = 5000;

// The class lives in src/errors.ts (with all the others, see the comment
// there) and is RE-EXPORTED from here: `PageLimitError` was already imported
// from this module by code and by tests, and changing the path would gain nothing.
export { PageLimitError } from "../../errors";

export type LayoutOptions = {
  // The physical page ceiling. Default DEFAULT_MAX_PAGES.
  maxPages?: number;
};

// The name of what is being paginated, for the error message. A "row" may
// have several fields; the first one is enough to locate it.
function nameOf(item: BodyItem): string {
  return item.kind === "row" ? (item.schemas[0]?.name ?? "(linha)") : item.schema.name;
}

// A pagination loop that does not advance is an arithmetic bug, not large
// data. Before, that would become spinning until an iteration counter blew up
// and the result came out silently truncated.
function assertProgress(madeProgress: boolean, field: string): void {
  if (madeProgress) return;
  throw new PaginationStalledError(field);
}

// `schema.visibleWhen` — an expression evaluated against the real data;
// without the prop, always visible. An invalid expression also counts as
// visible: a typo must not silently erase a field from the report (the editor
// warns, see fieldWarnings.ts).
function isVisible(schema: { visibleWhen?: string }, data: unknown): boolean {
  const condition = schema.visibleWhen?.trim();
  if (!condition) return true;
  return evaluateConditionLenient(condition, data, true);
}

// Where everything falls, physical page by physical page, for a Template +
// data + bindings — WITHOUT drawing anything and without touching pdf-lib.
//
// Before this, pagination existed in TWO traversals: the drawing loop in
// generate.ts decided and drew at the same time, and countBodyPages walked
// everything again only to learn the total (because {pageCount} needs the
// number before the first page is drawn). The two shared only the atomic
// decisions of pagination.ts; the cursor advance, the table slicing and the
// section repetition were written twice, and any divergence between the two
// copies would mean "the dry run said 7 pages, but the drawing made 8" — a
// class of bug nobody can reproduce on demand.
//
// Now there is a single traversal: the page count is `pages.length`, which
// cannot diverge from the drawing because it IS the drawing.
export function layoutDocument(
  template: Template,
  data: unknown,
  bindings: Binding[],
  inputs: Record<string, string>,
  options: LayoutOptions = {}
): LayoutDocument {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const pages: LayoutPage[] = [];

  for (const pageDef of normalizePageDefs(template)) {
    const { headerHeight, bodyBottomMm, repeatingSchemas, bodyItems } = deriveBodyLayout(pageDef);

    let current: LayoutPage = { pageDef, repeatingSchemas, placements: [] };
    pages.push(current);

    // `field` only serves the error message: it says WHAT was being paginated
    // when the ceiling was hit, which is the information whoever investigates
    // needs.
    const newPage = (field: string) => {
      if (pages.length >= maxPages) throw new PageLimitError(maxPages, field);
      current = { pageDef, repeatingSchemas, placements: [] };
      pages.push(current);
    };

    if (bodyItems.length === 0) continue;

    let cursorTopMm = boundsOf(bodyItems[0]).y;
    let prev: { y: number; height: number } | undefined;

    for (const item of bodyItems) {
      // Which of this item's fields actually make it onto the paper. A "row"
      // may have a hidden part; a table/section is all or nothing.
      const visibleSchemas = item.kind === "row" ? item.schemas.filter((schema) => isVisible(schema, data)) : [];
      const renders = item.kind === "row" ? visibleSchemas.length > 0 : isVisible(item.schema, data);

      const bounds = boundsOf(item);
      if (prev) cursorTopMm += gapAfter(prev, bounds);
      // `prev` receives the AUTHORED bounds even when the item does not render:
      // that is what preserves the spacing drawn in the editor around what was
      // hidden. So hiding an item reclaims its HEIGHT and nothing more — the
      // gaps on both sides still hold, and what comes after moves up by
      // exactly the hidden height. The `continue` before adding the height is
      // what makes that happen.
      prev = bounds;
      if (!renders) continue;

      // Not even the start of this item fits where the previous one stopped —
      // it starts on a new page.
      if (cursorTopMm >= bodyBottomMm) {
        newPage(nameOf(item));
        cursorTopMm = headerHeight;
      }

      if (item.kind === "row") {
        // A row does not paginate on its own — if not even its own height fits
        // in what is left of the page (and it is not the top of it yet), it
        // throws the WHOLE row (everyone sharing that same line) to the next
        // one instead of cutting.
        if (needsNewPageForItem(item.height, bodyBottomMm - cursorTopMm, cursorTopMm, headerHeight)) {
          newPage(nameOf(item));
          cursorTopMm = headerHeight;
        }
        for (const schema of visibleSchemas) {
          const value =
            schema.type === "text"
              ? resolveTextValue(schema.content, bindings.find((b) => b.schemaName === schema.name), data)
              : inputs[schema.name];
          current.placements.push({ kind: "field", schema, yMm: cursorTopMm, value });
        }
        cursorTopMm += item.height;
        continue;
      }

      if (item.kind === "table") {
        const schema = item.schema;
        const repeatHeader = schema.repeatHeader !== false;
        const hasFooter = Boolean(schema.footer && schema.footer.length > 0);
        const footerRow = hasFooter ? resolveFooterRow(schema, data) : undefined;
        let remaining = resolveTopLevelTableRows(schema, bindings, data, inputs);
        let isFirstSlice = true;

        // With no iteration counter: the loop terminates by construction (either
        // it consumes every row, or `capacity <= 0` breaks it). The page
        // ceiling is what protects the resource, and `assertProgress` below
        // catches the impossible case instead of letting it spin.
        for (;;) {
          const includeHead = isFirstSlice || repeatHeader;
          const decision = computeTableSlice(remaining.length, bodyBottomMm - cursorTopMm, includeHead, hasFooter);
          const rows = remaining.slice(0, decision.rowsToTake);
          current.placements.push({
            kind: "tableSlice",
            schema,
            yMm: cursorTopMm,
            rows,
            includeHead,
            footer: decision.isLastSlice ? footerRow : undefined,
            isLastSlice: decision.isLastSlice,
          });
          remaining = remaining.slice(rows.length);
          isFirstSlice = false;

          // `decision.heightMm` is the height the drawing will take, by the same
          // computation. The previous code advanced the cursor from the Y that
          // drawTableSlice RETURNED — a dependency on the renderer that made
          // the layout need to draw in order to know where to continue.
          cursorTopMm += decision.heightMm;

          if (remaining.length === 0 || decision.capacity <= 0) break;
          // No row consumed in a slice with capacity > 0 would be a pagination
          // arithmetic bug, not large data — spinning in silence would hide
          // that.
          assertProgress(rows.length > 0, schema.name);
          newPage(schema.name);
          cursorTopMm = headerHeight;
        }
        continue;
      }

      const schema = item.schema;
      const sectionItems = resolveSectionItems(schema, bindings, data);
      let index = 0;
      // Two iterations per item, in the worst case: one that opens a page and
      // one that places. If an iteration does neither, the item fits nowhere —
      // a bug, not volume, and `assertProgress` flags it.
      let lastIndex = -1;
      let pagesAtLastIndex = -1;
      for (; index < sectionItems.length; ) {
        assertProgress(index !== lastIndex || pages.length !== pagesAtLastIndex, schema.name);
        lastIndex = index;
        pagesAtLastIndex = pages.length;

        const instanceHeight = sectionInstanceHeight(pageDef, schema, sectionItems[index], bindings);
        if (needsNewPageForItem(instanceHeight, bodyBottomMm - cursorTopMm, cursorTopMm, headerHeight)) {
          newPage(schema.name);
          cursorTopMm = headerHeight;
          continue;
        }
        current.placements.push({ kind: "sectionRepeat", schema, yMm: cursorTopMm, item: sectionItems[index], index });
        cursorTopMm += instanceHeight;
        index++;
      }
    }
  }

  return { pages };
}
