import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { IconX } from "./icons";
import { useUiComponents } from "./useUiComponents";

// Botão genérico "limpar campo pro default" — generaliza o padrão repetido
// em ResetPositionButton (PropertyPanelKpi.tsx), os dois botões inline de
// backgroundColor/borderColor (PropertyPanelText.tsx) e clearColumnStyle/
// clearFormula (PropertyPanelTable.tsx). A visibilidade condicional
// ("só aparece quando o campo tem valor não-default") continua sendo
// decisão de quem CHAMA este componente — ele só sabe renderizar o botão.
//
// Duas variantes, cobrindo as 4 chamadas existentes:
// - "icon" (default): botão ghost quadrado com IconX + tooltip via `title`.
// - "text": botão de texto pequeno, sem ícone, hover vermelho.
export type ClearFieldButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  onClick: () => void;
  // Variante "icon": texto do tooltip (atributo title). Variante "text":
  // conteúdo visível do botão.
  label: string;
  variant?: "icon" | "text";
};

export const ClearFieldButton = forwardRef<HTMLButtonElement, ClearFieldButtonProps>(function ClearFieldButton(
  { onClick, label, variant = "icon", className, ...rest },
  ref
) {
  // COMPOSTO, não primitivo slotável: lê o registry pra compor o `Button` do
  // CONSUMIDOR quando houver um. É por isso que trocar `Button` também
  // restiliza os botões de "limpar campo" espalhados pelos painéis, sem que
  // o consumidor precise saber que eles existem.
  const { Button } = useUiComponents();
  if (variant === "text") {
    return (
      <button ref={ref} type="button" onClick={onClick} {...rest} className={cx("jpd-linkbtn", className)}>
        {label}
      </button>
    );
  }

  // A variante de ícone COMPÕE o Button do kit em vez de repetir as classes
  // dele — é por isso que o `cx` precisa ser idempotente: o `className` do
  // consumidor passa por aqui e de novo lá dentro.
  return (
    <Button ref={ref} variant="ghost" size="icon" onClick={onClick} title={label} className={className} {...rest}>
      <IconX />
    </Button>
  );
});
