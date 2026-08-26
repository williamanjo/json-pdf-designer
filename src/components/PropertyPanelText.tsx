import type { TextSchema } from "../types";
import { Button, ColorInput, Input, Select, Textarea } from "./ui";
import { IconX } from "./ui/icons";

type DroppedField = { path: string; kind: string };
function readDroppedField(e: React.DragEvent): DroppedField | null {
  const raw = e.dataTransfer.getData("application/json");
  if (!raw) return null;
  try { return JSON.parse(raw) as DroppedField; } catch { return null; }
}
const allowDrop = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes("application/json")) e.preventDefault();
};

type Props = {
  schema: TextSchema;
  onChangeSchema: (patch: Partial<TextSchema>) => void;
};

export function PropertyPanelText({ schema, onChangeSchema }: Props) {
  return (
    <>
      <Textarea
        label="Texto (design)"
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
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Tam. fonte"
          type="number"
          value={schema.fontSize}
          onChange={(e) => onChangeSchema({ fontSize: Number(e.target.value) })}
        />
        <ColorInput label="Cor" value={schema.fontColor} onChange={(e) => onChangeSchema({ fontColor: e.target.value })} />
      </div>
      <Select
        label="Alinhamento"
        value={schema.alignment}
        onChange={(e) => onChangeSchema({ alignment: e.target.value as TextSchema["alignment"] })}
      >
        <option value="left">Esquerda</option>
        <option value="center">Centro</option>
        <option value="right">Direita</option>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-end gap-1">
          <ColorInput
            label="Fundo"
            value={schema.backgroundColor ?? "#ffffff"}
            onChange={(e) => onChangeSchema({ backgroundColor: e.target.value })}
          />
          {schema.backgroundColor && (
            <Button variant="ghost" size="icon" onClick={() => onChangeSchema({ backgroundColor: undefined })} title="Remover fundo">
              <IconX />
            </Button>
          )}
        </div>
        <div className="flex items-end gap-1">
          <ColorInput
            label="Borda"
            value={schema.borderColor ?? "#94a3b8"}
            onChange={(e) => onChangeSchema({ borderColor: e.target.value, borderWidth: schema.borderWidth ?? 0.5 })}
          />
          {schema.borderColor && (
            <Button variant="ghost" size="icon" onClick={() => onChangeSchema({ borderColor: undefined })} title="Remover borda">
              <IconX />
            </Button>
          )}
        </div>
      </div>
      {schema.borderColor && (
        <Input
          label="Espessura da borda (mm)"
          type="number"
          step={0.1}
          min={0.1}
          value={schema.borderWidth ?? 0.5}
          onChange={(e) => onChangeSchema({ borderWidth: Number(e.target.value) })}
        />
      )}
    </>
  );
}
