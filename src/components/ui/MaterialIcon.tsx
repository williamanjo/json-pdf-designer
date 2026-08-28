import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../../materialIcons";

// Mesmo ícone (Material Symbols) desenhado tanto no seletor do painel
// (PropertyPanelKpi.tsx) quanto no preview do canvas (FieldBox/KpiField.tsx)
// — ícone desconhecido/"none" simplesmente não mostra nada. viewBox usa o
// grid 960 padrão do Material Symbols (ver MATERIAL_ICON_GRID).
export function MaterialIcon({ icon, size }: { icon: string; size: number }) {
  const path = MATERIAL_ICON_PATHS[icon as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox={`0 -${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID}`} fill="currentColor">
      <path d={path} />
    </svg>
  );
}
