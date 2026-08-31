import { Button } from "./Button";
import { IconX } from "./icons";

// Botão genérico "limpar campo pro default" — generaliza o padrão repetido
// em ResetPositionButton (PropertyPanelKpi.tsx), os dois botões inline de
// backgroundColor/borderColor (PropertyPanelText.tsx) e clearColumnStyle/
// clearFormula (PropertyPanelTable.tsx). A visibilidade condicional
// ("só aparece quando o campo tem valor não-default") continua sendo
// decisão de quem CHAMA este componente — ele só sabe renderizar o botão.
//
// Duas variantes, cobrindo as 4 chamadas existentes:
// - "icon" (default): botão ghost quadrado com IconX + tooltip via `title`
//   — mesmo markup/classes do ResetPositionButton (o precedente mais
//   completo). Usado por PropertyPanelKpi e PropertyPanelText.
// - "text": botão de texto pequeno, sem ícone, hover vermelho — mesmas
//   classes dos botões clearColumnStyle/clearFormula de PropertyPanelTable.
type Props = {
  onClick: () => void;
  // Variante "icon": texto do tooltip (atributo title). Variante "text":
  // conteúdo visível do botão.
  label: string;
  variant?: "icon" | "text";
  className?: string;
};

export function ClearFieldButton({ onClick, label, variant = "icon", className }: Props) {
  if (variant === "text") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "self-start text-[10px] text-slate-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </button>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={onClick} title={label} className={className}>
      <IconX />
    </Button>
  );
}
