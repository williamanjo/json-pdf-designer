import { Button } from "./ui";
import { IconPlus } from "./ui/icons";

type Props = {
  onAddText: () => void;
  onAddTable?: () => void;
  onAddImage: () => void;
  onAddSection?: () => void;
  onAddChart?: () => void;
  onAddKpi?: () => void;
};

export function Toolbar({ onAddText, onAddTable, onAddImage, onAddSection, onAddChart, onAddKpi }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onAddText}>
        <IconPlus /> texto
      </Button>
      {onAddTable && (
        <Button onClick={onAddTable}>
          <IconPlus /> tabela
        </Button>
      )}
      <Button onClick={onAddImage}>
        <IconPlus /> imagem
      </Button>
      {onAddSection && (
        <Button variant="outline" onClick={onAddSection}>
          <IconPlus /> seção
        </Button>
      )}
      {onAddChart && (
        <Button onClick={onAddChart}>
          <IconPlus /> gráfico
        </Button>
      )}
      {onAddKpi && (
        <Button onClick={onAddKpi}>
          <IconPlus /> indicador
        </Button>
      )}
    </div>
  );
}
