import type { KpiElementKey, KpiSchema } from "../../types";
import { MaterialIcon } from "../ui/MaterialIcon";
import {
  DEFAULT_KPI_BORDER_RADIUS_PERCENT,
  DEFAULT_KPI_ICON_SIZE,
  DEFAULT_KPI_SUBTITLE_FONT_SIZE,
  DEFAULT_KPI_TITLE_FONT_SIZE,
  DEFAULT_KPI_VALUE_FONT_SIZE,
  defaultKpiElementPositions,
  formatKpiValue,
  kpiBorderRadius,
  kpiElementLocked,
  kpiElementOffset,
  kpiElementOffsetPatch,
} from "../../kpiFormat";
import { mmToPx, ptToMm, ptToPx } from "../../units";

type Props = {
  schema: KpiSchema;
  // Card já selecionado (seleção única) — só então um sub-elemento
  // DESTRAVADO pode ser arrastado (ver onMouseDown abaixo). Sem isso, um
  // clique simples ainda seleciona o sub-elemento (onSelectElement),
  // só não inicia arrasto.
  selected?: boolean;
  // Zoom atual do canvas (PageCanvas.tsx) — os deltas de mousemove chegam
  // em px de TELA, sem escala; dividir por `zoom` antes de converter pra
  // mm evita que o elemento "fuja" do cursor em qualquer zoom != 100%
  // (mesmo motivo do `scale={zoom}` que o <Rnd> do campo inteiro recebe).
  zoom?: number;
  selectedElement?: KpiElementKey | null;
  onSelectElement?: (el: KpiElementKey) => void;
  onUpdate?: (patch: Partial<KpiSchema>) => void;
};

// Um sub-elemento (ícone/título/valor/legenda) — posição absoluta (mm→px)
// em vez de flex, pra bater ponto a ponto com drawKpi.ts (que usa a MESMA
// posição padrão, ver kpiFormat.ts). onMouseDown sempre foca o elemento
// (onSelectElement); só inicia arrasto de verdade quando o card já tá
// selecionado E o elemento está destravado (cadeado na aba Campos) —
// nada de duplo clique/modo de edição, e sem <Rnd> aninhado: só
// stopPropagation (mesmo princípio de TextField.tsx/TableField.tsx) +
// um loop manual de mousemove/mouseup, igual o próprio
// examples/headless-designer faz pro handle de redimensionar.
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
      className="absolute truncate"
      style={{
        left: mmToPx(xMm),
        top: mmToPx(yMm),
        maxWidth: Math.max(maxWidthPx, 10),
        cursor: draggable ? "move" : "pointer",
        outline: focused ? "1px dashed currentColor" : undefined,
        outlineOffset: focused ? 2 : undefined,
      }}
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

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const start = kpiElementOffset(schema, el) ?? defaults[el];

    function onMouseMove(ev: MouseEvent) {
      const dxMm = (ev.clientX - startClientX) / zoom / (96 / 25.4);
      const dyMm = (ev.clientY - startClientY) / zoom / (96 / 25.4);
      const nextX = Math.min(Math.max(0, start.x + dxMm), schema.width);
      const nextY = Math.min(Math.max(0, start.y + dyMm), schema.height);
      onUpdate?.(kpiElementOffsetPatch(el, { x: nextX, y: nextY }));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const widthPx = mmToPx(schema.width);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
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
          <span className="font-medium uppercase tracking-wide opacity-90" style={{ fontSize: ptToPx(titleSizePt) }}>
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
          <span className="font-bold leading-tight" style={{ fontSize: ptToPx(valueSizePt) }}>
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
          <span className="opacity-80" style={{ fontSize: ptToPx(subtitleSizePt) }}>
            {schema.subtitle}
          </span>
        </ElementBox>
      )}
    </div>
  );
}
