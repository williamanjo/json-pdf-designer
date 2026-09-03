import type { ImageSchema } from "../../types";
import { useT } from "../../i18n";

export function ImageField({ schema, onUpdate }: { schema: ImageSchema; onUpdate?: (patch: Partial<ImageSchema>) => void }) {
  const t = useT();

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
    // File dialog consumes the mouseup, leaving react-rnd in drag state. Release it.
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }

  return schema.content ? (
    <img
      src={schema.content}
      alt={schema.name}
      onDoubleClick={(e) => {
        e.stopPropagation();
        pickFile();
      }}
      className="jpd-imagefield__img"
    />
  ) : (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        pickFile();
      }}
      className="jpd-image-placeholder"
    >
      {t.image.dropHint}
    </div>
  );
}
