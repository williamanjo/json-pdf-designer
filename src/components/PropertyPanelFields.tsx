import type { Schema } from "../types";
import { Input } from "./ui";

type Props<S extends Schema> = {
  schema: S;
  onChangeSchema: (patch: Partial<S>) => void;
};

// X/Y/largura/altura — comum a qualquer tipo de campo. Tabela tem aba
// "Estilo" própria e mostra esses campos lá dentro, junto do resto da
// aparência, em vez de deixá-los soltos acima das abas (ver PropertyPanel).
export function PositionFields<S extends Schema>({ schema, onChangeSchema }: Props<S>) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        label="X (mm)"
        type="number"
        value={schema.x}
        onChange={(e) => onChangeSchema({ x: Number(e.target.value) } as Partial<S>)}
      />
      <Input
        label="Y (mm)"
        type="number"
        value={schema.y}
        onChange={(e) => onChangeSchema({ y: Number(e.target.value) } as Partial<S>)}
      />
      <Input
        label="Largura (mm)"
        type="number"
        value={schema.width}
        onChange={(e) => onChangeSchema({ width: Number(e.target.value) } as Partial<S>)}
      />
      <Input
        label="Altura (mm)"
        type="number"
        value={schema.height}
        onChange={(e) => onChangeSchema({ height: Number(e.target.value) } as Partial<S>)}
      />
    </div>
  );
}
