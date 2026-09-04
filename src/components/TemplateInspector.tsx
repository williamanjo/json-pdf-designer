import type { Binding, Schema, Template } from "../types";
import { classifyZone, isRedZone, type Zone } from "../page/zones";
import { describeBindingShort } from "../bindings/bindings";
import { useT } from "../i18n";

type Props = {
  template: Template;
  bindings: Binding[];
  selectedIds: string[];
  onSelect: (id: string, additive?: boolean) => void;
};

// Ordem de exibição das zonas — cabeçalho/margens primeiro (fixo em toda
// página), corpo no meio, rodapé por último. Mesma classificação de
// src/page/zones.ts usada pelo canvas/generate.ts, sem reimplementar nada aqui.
const ZONE_ORDER: Zone[] = ["header", "marginLeft", "marginRight", "body", "footer"];

// Árvore somente-leitura da página atual, agrupada por zona (Header/Body/
// Footer/margens) — cada linha mostra tipo, posição, seção-pai (se
// membro) e um resumo do vínculo. Clicar reaproveita a seleção já
// existente (useSelection em Designer.tsx) — não seleciona nada por conta
// própria. Posição no array `schemas` vira o z-index mostrado (mesma
// ordem que enviar-pra-trás/trazer-pra-frente já usa em PageCanvas.tsx).
export function TemplateInspector({ template, bindings, selectedIds, onSelect }: Props) {
  const t = useT();
  const bands = {
    headerHeight: template.headerHeight,
    footerHeight: template.footerHeight,
    marginLeft: template.marginLeft,
    marginRight: template.marginRight,
  };
  const zoneLabel: Record<Zone, string> = {
    header: t.templateInspector.zoneHeader,
    footer: t.templateInspector.zoneFooter,
    body: t.templateInspector.zoneBody,
    marginLeft: t.templateInspector.zoneMarginLeft,
    marginRight: t.templateInspector.zoneMarginRight,
  };
  const typeLabel: Record<Schema["type"], string> = {
    text: t.fieldTypeLabels.text,
    table: t.fieldTypeLabels.table,
    image: t.fieldTypeLabels.image,
    section: t.fieldTypeLabels.section,
    chart: t.fieldTypeLabels.chart,
    kpi: t.fieldTypeLabels.kpi,
  };

  if (template.schemas.length === 0) {
    return <p className="jpd-hint jpd-hint--md">{t.templateInspector.empty}</p>;
  }

  const grouped = new Map<Zone, { schema: Schema; zIndex: number }[]>();
  template.schemas.forEach((schema, zIndex) => {
    const zone = classifyZone(schema, template.page, bands);
    const list = grouped.get(zone) ?? [];
    list.push({ schema, zIndex });
    grouped.set(zone, list);
  });

  return (
    <div className="jpd-inspector">
      {ZONE_ORDER.filter((zone) => grouped.has(zone)).map((zone) => (
        <div key={zone}>
          <h4 className="jpd-eyebrow" data-zone={isRedZone(zone) ? "red" : "normal"}>
            {zoneLabel[zone]}
          </h4>
          <ul className="jpd-list jpd-stack jpd-stack--tight">
            {grouped.get(zone)!.map(({ schema, zIndex }) => {
              const binding = bindings.find((b) => b.schemaName === schema.name);
              const isSelected = selectedIds.includes(schema.id);
              const parentSection = schema.sectionId
                ? template.schemas.find((s) => s.id === schema.sectionId)
                : undefined;
              return (
                <li key={schema.id}>
                  <button
                    type="button"
                    onClick={(e) => onSelect(schema.id, e.ctrlKey || e.metaKey)}
                    className="jpd-fieldrow"
                    data-selected={isSelected || undefined}
                  >
                    <span className="jpd-fieldrow__name">
                      <span className="jpd-rowname">{schema.name}</span>
                      <span className="jpd-muted">{typeLabel[schema.type]}</span>
                      {parentSection && (
                        <span className="jpd-muted">
                          · {t.templateInspector.columnSection}: {parentSection.name}
                        </span>
                      )}
                      {binding && (
                        <span className="jpd-muted">
                          · {describeBindingShort(binding, t)}
                        </span>
                      )}
                    </span>
                    <span className="jpd-fieldrow__pos">
                      x{Math.round(schema.x)} y{Math.round(schema.y)}
                    </span>
                    <span
                      className="jpd-fieldrow__z"
                      title={t.templateInspector.columnZIndex}
                    >
                      z{zIndex}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
