import { useT } from "../i18n";
import { Button } from "./ui";
import { IconPlus } from "./ui/icons";

type Props = {
  onAddText: () => void;
  onAddTable: () => void;
  onAddImage: () => void;
  onAddSection: () => void;
  onAddChart: () => void;
  onAddKpi: () => void;
};

export function Toolbar({ onAddText, onAddTable, onAddImage, onAddSection, onAddChart, onAddKpi }: Props) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onAddText}>
        <IconPlus /> {t.toolbar.text}
      </Button>
      <Button onClick={onAddTable}>
        <IconPlus /> {t.toolbar.table}
      </Button>
      <Button onClick={onAddImage}>
        <IconPlus /> {t.toolbar.image}
      </Button>
      <Button variant="outline" onClick={onAddSection}>
        <IconPlus /> {t.toolbar.section}
      </Button>
      <Button onClick={onAddChart}>
        <IconPlus /> {t.toolbar.chart}
      </Button>
      <Button onClick={onAddKpi}>
        <IconPlus /> {t.toolbar.kpi}
      </Button>
    </div>
  );
}
