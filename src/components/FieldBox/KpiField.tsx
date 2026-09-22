import type { KpiElementKey, KpiSchema } from "../../types";
import { MaterialIcon } from "../ui/MaterialIcon";
import { DEFAULT_KPI_BORDER_RADIUS_PERCENT, DEFAULT_KPI_ICON_SIZE, DEFAULT_KPI_SUBTITLE_FONT_SIZE, DEFAULT_KPI_TITLE_FONT_SIZE, DEFAULT_KPI_VALUE_FONT_SIZE, defaultKpiElementPositions, kpiBorderRadius, kpiElementLocked, kpiElementOffset, kpiElementOffsetPatch } from "../../fields/kpi/card";
import { formatKpiValue } from "../../fields/kpi/format";
import { mmToPx, ptToMm, ptToPx, pxToMm } from "../../page/units";
import { startDragGesture } from "../../canvas/dragGesture";

type Props = {
  schema: KpiSchema;
  // Card already selected (single selection) — only then can an UNLOCKED
  // sub-element be dragged (see onMouseDown below). Without this, a plain
  // click still selects the sub-element (onSelectElement), it simply does
  // not start a drag.
  selected?: boolean;
  // Current canvas zoom (PageCanvas.tsx) — mousemove deltas arrive in
  // SCREEN px, unscaled; dividing by `zoom` before converting to mm keeps
  // the element from "running away" from the cursor at any zoom != 100%
  // (same reason as the `scale={zoom}` the whole field's <Rnd> receives).
  zoom?: number;
  selectedElement?: KpiElementKey | null;
  onSelectElement?: (el: KpiElementKey) => void;
  onUpdate?: (patch: Partial<KpiSchema>) => void;
};

// One sub-element (icon/title/value/subtitle) — absolutely positioned (mm→px)
// instead of flex, so it matches render/renderKpi.ts point for point (which uses
// the SAME default position, see kpi/card.ts). onMouseDown always focuses the
// element (onSelectElement); it only starts a real drag once the card is
// already selected AND the element is unlocked (the padlock on the Fields
// tab) — no double click, no editing mode, and no nested <Rnd>: only
// stopPropagation (same principle as TextField.tsx/TableField.tsx) plus
// a manual mousemove/mouseup loop, exactly as examples/headless-designer
// itself does for its resize handle.
function ElementBox({
  el,
  xMm,
  yMm,
  maxWidthPx,
  focused,
  draggable,
  onMouseDown,
  children,
}: {
  el: KpiElementKey;
  xMm: number;
  yMm: number;
  maxWidthPx: number;
  focused: boolean;
  draggable: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-kpi-element={el}
      onMouseDown={onMouseDown}
      className="jpd-kpi__box"
      data-draggable={draggable || undefined}
      data-focused={focused || undefined}
      // Only the POSITION stays inline (mm→px, it has to match
      // render/renderKpi.ts point for point); cursor and focus outline are two
      // fixed states and became data-*. The `cursor` here can live in CSS
      // (unlike the <Rnd> in PageCanvas): react-rnd's inline `cursor: move`
      // is on the ANCESTOR element, and an inherited value loses to a rule
      // that matches the element itself.
      style={{ left: mmToPx(xMm), top: mmToPx(yMm), maxWidth: Math.max(maxWidthPx, 10) }}
    >
      {children}
    </div>
  );
}

export function KpiField({ schema, selected = false, zoom = 1, selectedElement = null, onSelectElement, onUpdate }: Props) {
  const titleSizePt = schema.titleFontSize ?? DEFAULT_KPI_TITLE_FONT_SIZE;
  const valueSizePt = schema.valueFontSize ?? DEFAULT_KPI_VALUE_FONT_SIZE;
  const subtitleSizePt = schema.subtitleFontSize ?? DEFAULT_KPI_SUBTITLE_FONT_SIZE;
  const iconSizePt = schema.iconSize ?? DEFAULT_KPI_ICON_SIZE;

  const sizesMm: Record<KpiElementKey, number> = {
    icon: ptToMm(iconSizePt),
    title: ptToMm(titleSizePt),
    value: ptToMm(valueSizePt),
    subtitle: ptToMm(subtitleSizePt),
  };
  const defaults = defaultKpiElementPositions(schema, sizesMm);
  const radiusPx = mmToPx(
    kpiBorderRadius(schema.borderRadius ?? DEFAULT_KPI_BORDER_RADIUS_PERCENT, schema.width, schema.height)
  );

  function startDrag(el: KpiElementKey, e: React.MouseEvent) {
    e.stopPropagation();
    onSelectElement?.(el);
    if (!selected || !onUpdate || kpiElementLocked(schema, el)) return;

    const start = kpiElementOffset(schema, el) ?? defaults[el];

    startDragGesture(e, (dx, dy) => {
      const dxMm = pxToMm(dx / zoom);
      const dyMm = pxToMm(dy / zoom);
      const nextX = Math.min(Math.max(0, start.x + dxMm), schema.width);
      const nextY = Math.min(Math.max(0, start.y + dyMm), schema.height);
      onUpdate?.(kpiElementOffsetPatch(el, { x: nextX, y: nextY }));
    });
  }

  const widthPx = mmToPx(schema.width);

  return (
    <div
      className="jpd-kpi"
      style={{ backgroundColor: schema.backgroundColor, color: schema.textColor, borderRadius: radiusPx }}
    >
      {schema.title !== undefined && (
        <ElementBox
          el="title"
          xMm={kpiElementOffset(schema, "title")?.x ?? defaults.title.x}
          yMm={kpiElementOffset(schema, "title")?.y ?? defaults.title.y}
          maxWidthPx={widthPx - mmToPx(kpiElementOffset(schema, "title")?.x ?? defaults.title.x) - ptToPx(4)}
          focused={selectedElement === "title"}
          draggable={selected && !kpiElementLocked(schema, "title")}
          onMouseDown={(e) => startDrag("title", e)}
        >
          <span className="jpd-kpi__part" data-part="title" style={{ fontSize: ptToPx(titleSizePt) }}>
            {schema.title}
          </span>
        </ElementBox>
      )}

      {schema.icon !== "none" && (
        <ElementBox
          el="icon"
          xMm={kpiElementOffset(schema, "icon")?.x ?? defaults.icon.x}
          yMm={kpiElementOffset(schema, "icon")?.y ?? defaults.icon.y}
          maxWidthPx={ptToPx(iconSizePt) + 4}
          focused={selectedElement === "icon"}
          draggable={selected && !kpiElementLocked(schema, "icon")}
          onMouseDown={(e) => startDrag("icon", e)}
        >
          <MaterialIcon icon={schema.icon} size={ptToPx(iconSizePt)} />
        </ElementBox>
      )}

      {schema.value !== undefined && (
        <ElementBox
          el="value"
          xMm={kpiElementOffset(schema, "value")?.x ?? defaults.value.x}
          yMm={kpiElementOffset(schema, "value")?.y ?? defaults.value.y}
          maxWidthPx={widthPx - mmToPx(kpiElementOffset(schema, "value")?.x ?? defaults.value.x) - ptToPx(4)}
          focused={selectedElement === "value"}
          draggable={selected && !kpiElementLocked(schema, "value")}
          onMouseDown={(e) => startDrag("value", e)}
        >
          <span className="jpd-kpi__part" data-part="value" style={{ fontSize: ptToPx(valueSizePt) }}>
            {formatKpiValue(schema.value, schema.numberFormat)}
          </span>
        </ElementBox>
      )}

      {schema.subtitle !== undefined && (
        <ElementBox
          el="subtitle"
          xMm={kpiElementOffset(schema, "subtitle")?.x ?? defaults.subtitle.x}
          yMm={kpiElementOffset(schema, "subtitle")?.y ?? defaults.subtitle.y}
          maxWidthPx={widthPx - mmToPx(kpiElementOffset(schema, "subtitle")?.x ?? defaults.subtitle.x) - ptToPx(4)}
          focused={selectedElement === "subtitle"}
          draggable={selected && !kpiElementLocked(schema, "subtitle")}
          onMouseDown={(e) => startDrag("subtitle", e)}
        >
          <span className="jpd-kpi__part" data-part="subtitle" style={{ fontSize: ptToPx(subtitleSizePt) }}>
            {schema.subtitle}
          </span>
        </ElementBox>
      )}
    </div>
  );
}
