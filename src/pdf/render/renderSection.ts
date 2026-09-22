// A repeated section (data band/master-detail) — the generator's most complex
// piece, isolated in a file of its own: how many repetitions, how much each
// one grows (a master-detail member table pushes the rest of the section
// down), and the drawing of ONE repetition. generate.ts only calls this —
// resolveSectionItems/sectionInstanceHeight to learn how many repetitions and
// how much space each one takes before drawing (pagination),
// drawSectionInstance to actually draw.
import type { PDFFont, PDFPage } from "pdf-lib";
import type { Binding, Schema, SectionSchema, TemplatePage } from "../../types";
import { mmToPt } from "../../page/units";
import { drawTableSlice } from "./renderTable";
// The section's measurement lives in layout/sectionLayout.ts (pure math, it
// has to run before drawing); only the drawing was left here. Re-exported
// because some code imports it through this path.
export { resolveSectionItems, sectionInstanceHeight, sectionMembersOf } from "../layout/sectionLayout";
import { sectionMembersOf, tableGrowth } from "../layout/sectionLayout";
import { resolveFooterRow, resolveNestedTableRows, resolveTextValue } from "../resolvers";

// What drawSectionInstance needs to borrow from generatePdf — only what is
// needed to draw a member that is NOT a table (drawField already knows how to
// draw text/image/chart/kpi with doc/imageCache/inputs inside its own
// closure).
export type SectionDrawContext = {
  template: TemplatePage;
  bindings: Binding[];
  font: PDFFont;
  pageHeightPt: number;
  drawField: (page: PDFPage, schema: Schema, value: string | undefined) => Promise<void>;
};

// One repetition of a section: it processes the members in order of Y (top to
// bottom) accumulating an offset — each table that grows beyond its own
// placeholder pushes down EVERYTHING that comes after it (another table, text,
// an image), not only what is below the LAST table. With a single table that
// is equivalent to the previous behavior; with two or more, the second (and
// whatever comes after) now shifts correctly instead of staying at the drawn
// position and overlapping the first. Each member keeps its absolute X (the
// same column in every repetition). The binding resolves against the CURRENT
// item (not the whole document); {Line} gives the repetition's number
// (1, 2, 3...).
export async function drawSectionInstance(
  ctx: SectionDrawContext,
  page: PDFPage,
  sectionSchema: SectionSchema,
  item: unknown,
  lineNumber: number,
  topMm: number
): Promise<void> {
  const { template, bindings, font, pageHeightPt, drawField } = ctx;
  const base = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const augmented = { ...base, Line: lineNumber, index: lineNumber };
  const members = sectionMembersOf(template, sectionSchema).slice().sort((a, b) => a.y - b.y);

  let shiftSoFar = 0;
  for (const member of members) {
    const offsetY = member.y - sectionSchema.y + shiftSoFar;

    if (member.type === "table") {
      const rows = resolveNestedTableRows(member, item, bindings);
      const xPt = mmToPt(member.x);
      const widthPt = mmToPt(member.width);
      const topYPt = pageHeightPt - mmToPt(topMm + offsetY);
      drawTableSlice(page, font, member, rows, xPt, topYPt, widthPt, true, resolveFooterRow(member, augmented));
      shiftSoFar += tableGrowth(member, item, bindings);
      continue;
    }

    const absoluteMember = { ...member, y: topMm + offsetY } as Schema;
    if (member.type !== "text") {
      await drawField(page, absoluteMember, undefined);
      continue;
    }
    const binding = bindings.find((b) => b.schemaName === member.name);
    const text = resolveTextValue(member.content, binding, augmented);
    await drawField(page, absoluteMember, text);
  }
}
