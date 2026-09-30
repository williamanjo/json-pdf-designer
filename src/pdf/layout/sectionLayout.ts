import type { Binding, Schema, SectionSchema, TableSchema, TemplatePage } from "../../types";
import { getCaseInsensitive } from "../../expressions/dataAccess";
import { resolveNestedTableRows } from "../resolvers";
import { TABLE_ROW_HEIGHT_MM } from "../tableMetrics";

// Measuring a repeated section (data band / master-detail) — how many
// repetitions and how much each one takes. It lives in layout/ and not in
// render/renderSection.ts because it is pure math: none of these functions
// needs a PDFPage, and all of them are needed BEFORE drawing anything (it is
// the layout that decides where each repetition falls). render/renderSection.ts
// was left with the drawing only.

// A section's member fields — any schema in the template whose sectionId
// points at it (see PageCanvas.tsx: dragging onto it absorbs, dragging out
// clears).
export function sectionMembersOf(pageDef: TemplatePage, section: SectionSchema): Schema[] {
  return pageDef.schemas.filter((s) => s.sectionId === section.id);
}

// The growth (mm) of ONE member table beyond its own placeholder, for the
// current item — never negative (it does not shrink below what was drawn). It
// counts the totals row (footer) as +1 extra row, if there is one.
export function tableGrowth(tableMember: TableSchema, item: unknown, bindings: Binding[]): number {
  const rows = resolveNestedTableRows(tableMember, item, bindings);
  const footerRows = tableMember.footer && tableMember.footer.length > 0 ? 1 : 0;
  const actualHeight = (rows.length + 1 + footerRows) * TABLE_ROW_HEIGHT_MM; // +1 = the header row
  return Math.max(0, actualHeight - tableMember.height);
}

// The real height of this repetition of the section for the current item —
// the authored height (section.height) serves as a minimum; the sum of the
// growth of ALL member tables (master-detail) is how much more has to fit,
// since each one pushes down everything that comes after it (see
// drawSectionInstance) — with only 1 table it is just that table's growth.
export function sectionInstanceHeight(pageDef: TemplatePage, section: SectionSchema, item: unknown, bindings: Binding[]): number {
  let totalGrowth = 0;
  for (const member of sectionMembersOf(pageDef, section)) {
    if (member.type !== "table") continue;
    totalGrowth += tableGrowth(member, item, bindings);
  }
  return section.height + totalGrowth;
}

// The items of the array bound to a section — with no binding, it draws a
// single instance with the design content (a preview), like an unbound table.
export function resolveSectionItems(sectionSchema: SectionSchema, bindings: Binding[], data: unknown): unknown[] {
  const binding = bindings.find(
    (b): b is Extract<Binding, { type: "section" }> => b.schemaName === sectionSchema.name && b.type === "section"
  );
  if (!binding) return [undefined];
  const arr = getCaseInsensitive(data, binding.path);
  return Array.isArray(arr) && arr.length > 0 ? arr : [undefined];
}
