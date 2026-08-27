import type { KpiSchema } from "../../types";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../../materialIcons";
import {
  DEFAULT_KPI_BORDER_RADIUS_PERCENT,
  DEFAULT_KPI_ICON_SIZE,
  DEFAULT_KPI_SUBTITLE_FONT_SIZE,
  DEFAULT_KPI_TITLE_FONT_SIZE,
  DEFAULT_KPI_VALUE_FONT_SIZE,
  formatKpiValue,
  kpiBorderRadius,
} from "../../kpiFormat";
import { mmToPx, ptToPx } from "../../units";

// Mesmo ícone (Material Symbols) desenhado no PDF final (ver pdf/drawKpi.ts)
// — ícone desconhecido/"none" simplesmente não mostra nada.
function KpiIconGlyph({ icon, sizePx }: { icon: string; sizePx: number }) {
  const path = MATERIAL_ICON_PATHS[icon as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return null;
  return (
    <svg width={sizePx} height={sizePx} viewBox={`0 -${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID}`} fill="currentColor">
      <path d={path} />
    </svg>
  );
}

export function KpiField({ schema }: { schema: KpiSchema }) {
  const titleSize = ptToPx(schema.titleFontSize ?? DEFAULT_KPI_TITLE_FONT_SIZE);
  const valueSize = ptToPx(schema.valueFontSize ?? DEFAULT_KPI_VALUE_FONT_SIZE);
  const subtitleSize = ptToPx(schema.subtitleFontSize ?? DEFAULT_KPI_SUBTITLE_FONT_SIZE);
  const iconSize = ptToPx(schema.iconSize ?? DEFAULT_KPI_ICON_SIZE);
  const displayValue = formatKpiValue(schema.value, schema.numberFormat);
  // width/height do próprio schema já são mm (BaseSchema) — mesma conta de
  // kpiBorderRadius do PDF (ver drawKpi.ts), só que em mm em vez de pt.
  const radiusPx = mmToPx(
    kpiBorderRadius(schema.borderRadius ?? DEFAULT_KPI_BORDER_RADIUS_PERCENT, schema.width, schema.height)
  );

  return (
    <div
      className="flex h-full w-full flex-col justify-center gap-1 overflow-hidden p-2.5"
      style={{ backgroundColor: schema.backgroundColor, color: schema.textColor, borderRadius: radiusPx }}
    >
      <div className="flex items-center justify-between">
        <span className="truncate font-medium uppercase tracking-wide opacity-90" style={{ fontSize: titleSize }}>
          {schema.title}
        </span>
        <KpiIconGlyph icon={schema.icon} sizePx={iconSize} />
      </div>
      <div className="truncate font-bold leading-tight" style={{ fontSize: valueSize }}>
        {displayValue}
      </div>
      <div className="truncate opacity-80" style={{ fontSize: subtitleSize }}>
        {schema.subtitle}
      </div>
    </div>
  );
}
