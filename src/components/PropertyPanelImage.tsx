import type { ImageSchema } from "../types";
import { useT } from "../i18n";
import { useUiComponents } from "./ui/useUiComponents";

type Props = {
  schema: ImageSchema;
  onChangeSchema: (patch: Partial<ImageSchema>) => void;
};

export function PropertyPanelImage({ schema, onChangeSchema }: Props) {
  const t = useT();
  const { Textarea } = useUiComponents();
  return (
    <Textarea
      label={t.image.label}
      mono
      placeholder="data:image/png;base64,..."
      value={schema.content}
      onChange={(e) => onChangeSchema({ content: e.target.value })}
    />
  );
}
