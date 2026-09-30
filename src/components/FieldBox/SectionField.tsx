import type { SectionSchema } from "../../types";
import { useT } from "../../i18n";

// The section is dragged only by the bar at the top (class
// "jpd-section__handle", pinned in the Rnd's dragHandleClassName in
// PageCanvas.tsx) — without it, any click inside it (which can now have a
// member field drawn on top) risked moving the section instead of the field.
//
// BOTH CLASSES HERE ARE READ BY JAVASCRIPT, not only by CSS:
// "jpd-section__body" is tested with classList.contains() in the empty-area
// hit-test and "jpd-section__handle" goes into react-rnd's dragHandleClassName
// (which matches it in the DOM on its own). Renaming one without renaming its
// pair in PageCanvas.tsx breaks drag/selection WITH NO console error.
export function SectionField(_props: { schema: SectionSchema }) {
  const t = useT();
  return (
    <div className="jpd-section__body">
      <div className="jpd-section__handle">{t.section.dragHandleHint}</div>
    </div>
  );
}
