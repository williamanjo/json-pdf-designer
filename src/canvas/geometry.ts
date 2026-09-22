import type { Schema } from "../types";
import { pxToMm } from "../page/units";

// Height (mm) of the "jpd-section__handle" bar at the top of the section
// (FieldBox/SectionField.tsx, h-4 = 16px) — used so the marquee only picks
// up the section when it crosses that band, not the whole body.
const SECTION_HEADER_HEIGHT_MM = pxToMm(16);

// A field whose center falls inside a section rectangle becomes a member
// of it (sectionId) — outside any section clears the group binding.
export function findSectionAt(schemas: Schema[], x: number, y: number, width: number, height: number, excludeId: string) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return schemas.find(
    (s) => s.id !== excludeId && s.type === "section" && cx >= s.x && cx <= s.x + s.width && cy >= s.y && cy <= s.y + s.height
  );
}

// Marquee hit-test: which schemas cross the rectangle (mm) drawn on the
// canvas background. A section only enters the selection if the box
// crosses its HEADER band (the same height as the "jpd-section__handle"
// bar) — crossing the body alone (where the member fields are drawn)
// never selects the section, only the fields that happen to sit under
// the box.
export function schemasInRect(schemas: Schema[], rectMm: { x1: number; y1: number; x2: number; y2: number }) {
  return schemas.filter((s) => {
    const testHeight = s.type === "section" ? Math.min(s.height, SECTION_HEADER_HEIGHT_MM) : s.height;
    return s.x < rectMm.x2 && s.x + s.width > rectMm.x1 && s.y < rectMm.y2 && s.y + testHeight > rectMm.y1;
  });
}
