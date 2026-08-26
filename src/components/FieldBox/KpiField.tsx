import type { KpiSchema } from "../../types";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../../materialIcons";

// Mesmo ícone (Material Symbols) desenhado no PDF final (ver pdf/drawKpi.ts)
// — ícone desconhecido/"none" simplesmente não mostra nada.
function KpiIconGlyph({ icon }: { icon: string }) {
  const path = MATERIAL_ICON_PATHS[icon as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return null;
  return (
    <svg width="18" height="18" viewBox={`0 -${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID}`} fill="currentColor">
      <path d={path} />
    </svg>
  );
}

export function KpiField({ schema }: { schema: KpiSchema }) {
  return (
    <div
      className="flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-lg p-2.5"
      style={{ backgroundColor: schema.backgroundColor, color: schema.textColor }}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-[10px] font-medium uppercase tracking-wide opacity-90">{schema.title}</span>
        <KpiIconGlyph icon={schema.icon} />
      </div>
      <div className="truncate text-2xl font-bold leading-tight">{schema.value}</div>
      <div className="truncate text-[10px] opacity-80">{schema.subtitle}</div>
    </div>
  );
}
