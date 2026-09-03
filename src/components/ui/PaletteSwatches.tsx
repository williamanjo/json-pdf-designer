import { forwardRef, type HTMLAttributes } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type PaletteSwatchesProps = HTMLAttributes<HTMLDivElement> & {
  colors: readonly string[];
  /**
   * "md" (padrão, caso do gráfico) | "sm" (caso da tabela: bolinha e gap
   * menores, e sem `flex-shrink`, pra três bolinhas caberem numa célula de
   * grade de 2 colunas).
   */
  size?: "sm" | "md";
  parts?: { swatch?: PartStyle };
};

// Uma fileira de bolinhas com as cores dadas — usado tanto pelo seletor de
// paleta do gráfico quanto pelo da tabela.
//
// BREAKING em 3.0.0: as props `size`/`gap`/`shrink` recebiam CLASSE TAILWIND
// como valor (`size="h-4 w-4"`, `gap="gap-1"`) — três strings que existiam
// só pra reproduzir as pequenas diferenças entre as duas cópias originais, e
// que eram invisíveis a qualquer busca por `className`. Viraram um `size` de
// dois valores, que é o que as duas chamadas reais usavam.
export const PaletteSwatches = forwardRef<HTMLDivElement, PaletteSwatchesProps>(function PaletteSwatches(
  { colors, size = "md", className, parts, ...rest },
  ref
) {
  const swatch = readPart(parts?.swatch);
  return (
    <div ref={ref} {...rest} data-size={size} className={cx("jpd-swatches", className)}>
      {colors.map((c, i) => (
        // `backgroundColor` inline continua: É a paleta, não decoração — o
        // valor vem do dado, não do tema.
        <span key={i} className={cx("jpd-swatch", swatch.className)} style={{ ...swatch.style, backgroundColor: c }} />
      ))}
    </div>
  );
});
