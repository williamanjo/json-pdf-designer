import { readPart, cx, type PartStyle } from "../../components/ui/cx";
import { useUiComponents } from "../../components/ui/useUiComponents";
import { useT } from "../../i18n";
import { useDesignerBulkEdit, useDesignerSelectedSchema, useDesignerSelection } from "../context/hooks";

// The selected field's header: the name in a `<Badge>`, plus the multiple
// selection warning ("N selected" or "bulk editing N").
//
// It is deliberately NOT a placeable part — it is the piece shared between
// `DesignerPropertyPanel` and `DesignerFilterPanel`, which in `Designer.tsx`
// were a single `<div className="jpd-sidebar__panel">` with this common top.
// Duplicating it in both parts would make the two diverge; exporting it as a
// part would give the consumer a "header" that only makes sense glued to a panel.
//
// It lives in a file of its own (and not inside one of the two) so that no
// part imports another — an invariant guarded by partBoundaries.test.ts.
export function SelectedFieldHeader({ banner: bannerPart }: { banner?: PartStyle }) {
  const t = useT();
  const { Badge, CardHeader } = useUiComponents();
  const { selectedIds } = useDesignerSelection();
  const { selected } = useDesignerSelectedSchema();
  const { bulkEditActive } = useDesignerBulkEdit();
  if (!selected) return null;
  const banner = readPart(bannerPart);
  return (
    <>
      {/* Send/bring and remove already live on the selected row of the field
          list (the "Fields" tab) — not duplicated here. */}
      <CardHeader>
        <Badge>{selected.name}</Badge>
      </CardHeader>
      {selectedIds.length > 1 && (
        <p className={cx("jpd-sidebar__banner", banner.className)} style={banner.style}>
          {bulkEditActive
            ? t.fieldsPanel.bulkEditBanner(selectedIds.length)
            : t.fieldsPanel.multiSelected(selectedIds.length, selected.name)}
        </p>
      )}
    </>
  );
}
