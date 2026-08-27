import type { Binding, DataSourceOption, SectionSchema } from "../types";
import { SECTION_COLUMN_MIME } from "../schemaFactory";
import { useT } from "../i18n";

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
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-slate-500 dark:text-gray-400">{t.section.dragHint}</p>
      {sectionColumns.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-purple-300 bg-purple-50/40 p-2 dark:border-purple-700 dark:bg-purple-900/20">
          <p className="text-[10px] font-medium text-purple-700 dark:text-purple-300">
            {t.section.fieldsFromSource(binding && binding.type === "section" ? binding.path : "")}
          </p>
          <div className="flex flex-wrap gap-1">
            {sectionColumns.map((col) => (
              <span
                key={col}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(SECTION_COLUMN_MIME, JSON.stringify({ sectionId: schema.id, column: col }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="cursor-grab rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:border-purple-400 hover:bg-purple-50 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-purple-500 dark:hover:bg-purple-900/40"
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
