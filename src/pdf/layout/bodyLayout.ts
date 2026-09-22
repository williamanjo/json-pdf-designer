import type { Schema, TemplatePage } from "../../types";
import { classifyZone } from "../../page/zones";
import type { BodyItem, FlowBounds } from "./layoutTypes";

export function boundsOf(item: BodyItem): FlowBounds {
  return item.kind === "row" ? { y: item.y, height: item.height } : { y: item.schema.y, height: item.schema.height };
}

// Groups the body's schemas into BodyItems, in the order they appear on the
// page (by Y) — a table/section becomes one item each; any other field
// (text/image/chart/kpi) sharing the SAME authored y as the previous item
// joins the same "row" instead of becoming a separate item (see the BodyItem
// comment in layoutTypes.ts for the reason).
export function buildBodyItems(bodySchemas: Schema[]): BodyItem[] {
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

// The space (mm) between the end of one block (a table or a section) and the
// start of the next — it honors what was drawn in the editor (the difference
// between where the next one was positioned and where the previous one
// "should" end, according to the authored height), never a fixed value. A
// negative value (blocks overlapping in the editor) becomes 0.
export function gapAfter(prev: FlowBounds, next: FlowBounds): number {
  return Math.max(next.y - (prev.y + prev.height), 0);
}

// Derives, from ONE page (TemplatePage), everything pagination/drawing need
// — the same arithmetic as always, only parameterized by pageDef instead of
// the whole Template (which allows running it once per page when there is
// more than one).
export function deriveBodyLayout(pageDef: TemplatePage) {
  const headerHeight = pageDef.headerHeight ?? 0;
  const footerHeight = pageDef.footerHeight ?? 0;
  const bodyBottomMm = pageDef.page.height - footerHeight;
  const bands = {
    headerHeight,
    footerHeight,
    marginLeft: pageDef.marginLeft ?? 0,
    marginRight: pageDef.marginRight ?? 0,
  };
  // A field with a sectionId never draws on its own — only through the
  // repetition of the section that owns it (see render/renderSection.ts).
  const ownedBySection = (s: Schema) => Boolean(s.sectionId);
  const repeatingSchemas = pageDef.schemas.filter((s) => !ownedBySection(s) && classifyZone(s, pageDef.page, bands) !== "body");
  const bodySchemas = pageDef.schemas.filter((s) => !ownedBySection(s) && classifyZone(s, pageDef.page, bands) === "body");
  const bodyItems = buildBodyItems(bodySchemas);
  return { headerHeight, bodyBottomMm, repeatingSchemas, bodyItems };
}
