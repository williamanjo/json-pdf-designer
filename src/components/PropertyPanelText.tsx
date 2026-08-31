import type { TextSchema } from "../types";
import { useT } from "../i18n";
import { allowDrop, readDroppedField } from "./dragField";
import { BulkLocked, ClearFieldButton, ColorInput, Input, Select, Textarea } from "./ui";

type Props = {
  schema: TextSchema;
  activeTab: "dados" | "estilo";
  bulkEdit?: boolean;
  onChangeSchema: (patch: Partial<TextSchema>) => void;
};

export function PropertyPanelText({ schema, activeTab, bulkEdit, onChangeSchema }: Props) {
  const t = useT();
  const textarea = (
    <Textarea
      label={t.text.designText}
      value={schema.content}
      onChange={(e) => onChangeSchema({ content: e.target.value })}
      onDragOver={allowDrop}
      onDrop={(e) => {
        const f = readDroppedField(e);
        if (!f) return;
        e.preventDefault();
        const token = `{${f.path}}`;
        onChangeSchema({ content: schema.content ? `${schema.content} ${token}` : token });
      }}
    />
  );
  return (
    <>
      {activeTab === "dados" &&
        (bulkEdit ? <BulkLocked hint={t.fieldsPanel.bulkDataLockedNoShared}>{textarea}</BulkLocked> : textarea)}
      {activeTab === "estilo" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label={t.text.fontSize}
              type="number"
              value={schema.fontSize}
              onChange={(e) => onChangeSchema({ fontSize: Number(e.target.value) })}
            />
            <ColorInput label={t.text.color} value={schema.fontColor} onChange={(e) => onChangeSchema({ fontColor: e.target.value })} />
          </div>
          <Select
            label={t.text.alignment}
            value={schema.alignment}
            onChange={(e) => onChangeSchema({ alignment: e.target.value as TextSchema["alignment"] })}
          >
            <option value="left">{t.text.alignLeft}</option>
            <option value="center">{t.text.alignCenter}</option>
            <option value="right">{t.text.alignRight}</option>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-end gap-1">
              <ColorInput
                label={t.text.background}
                value={schema.backgroundColor ?? "#ffffff"}
                onChange={(e) => onChangeSchema({ backgroundColor: e.target.value })}
              />
              {schema.backgroundColor && (
                <ClearFieldButton onClick={() => onChangeSchema({ backgroundColor: undefined })} label={t.text.removeBackground} />
              )}
            </div>
            <div className="flex items-end gap-1">
              <ColorInput
                label={t.text.border}
                value={schema.borderColor ?? "#94a3b8"}
                onChange={(e) => onChangeSchema({ borderColor: e.target.value, borderWidth: schema.borderWidth ?? 0.5 })}
              />
              {schema.borderColor && (
                <ClearFieldButton onClick={() => onChangeSchema({ borderColor: undefined })} label={t.text.removeBorder} />
              )}
            </div>
          </div>
          {schema.borderColor && (
            <Input
              label={t.text.borderWidth}
              type="number"
              step={0.1}
              min={0.1}
              value={schema.borderWidth ?? 0.5}
              onChange={(e) => onChangeSchema({ borderWidth: Number(e.target.value) })}
            />
          )}
        </>
      )}
    </>
  );
}
