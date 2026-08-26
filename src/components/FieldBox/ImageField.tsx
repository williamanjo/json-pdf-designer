import type { Schema } from "../../types";

export function ImageField({ schema, onUpdate }: { schema: Schema; onUpdate?: (patch: Partial<Schema>) => void }) {
  if (schema.type !== "image") return null;

  function pickFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onUpdate?.({ content: reader.result as string });
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return schema.content ? (
    <img
      src={schema.content}
      alt={schema.name}
      onDoubleClick={(e) => {
        e.stopPropagation();
        pickFile();
      }}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  ) : (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        pickFile();
      }}
      className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-[11px] text-slate-400"
    >
      imagem (duplo clique pra escolher)
    </div>
  );
}
