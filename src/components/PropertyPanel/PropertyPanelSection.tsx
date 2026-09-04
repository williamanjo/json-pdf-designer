import type { Binding, DataSourceOption, SectionSchema } from "../../types";
import { SECTION_COLUMN_MIME } from "../../schemaFactory";
import { useT } from "../../i18n";

type Props = {
  schema: SectionSchema;
  binding: Binding | undefined;
  dataSources?: DataSourceOption[];
};

export function PropertyPanelSection({ schema, binding, dataSources }: Props) {
  const t = useT();
  const sectionColumns =
    binding?.type === "section" ? (dataSources?.find((d) => d.path === binding.path)?.columns ?? []) : [];

  return (
    <div className="jpd-stack jpd-stack--snug">
      <p className="jpd-meta jpd-meta--md">{t.section.dragHint}</p>
      {sectionColumns.length > 0 && (
        <div className="jpd-stack jpd-stack--tight jpd-callout" data-tone="purple">
          <p className="jpd-callout__title">
            {t.section.fieldsFromSource(binding && binding.type === "section" ? binding.path : "")}
          </p>
          <div className="jpd-callout__chips">
            {sectionColumns.map((col) => (
              <span
                key={col}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(SECTION_COLUMN_MIME, JSON.stringify({ sectionId: schema.id, column: col }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="jpd-chip jpd-chip--source"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
