// Uma fileira de bolinhas com as cores dadas — usado tanto pelo seletor de
// paleta do gráfico (PropertyPanelChart) quanto pelo da tabela
// (PropertyPanelTable), que tinham cada um sua própria cópia quase idêntica
// deste componente. `size`/`gap`/`shrink` existem só pra reproduzir as
// pequenas diferenças visuais que já existiam entre as duas cópias (gráfico:
// bolinhas h-4 w-4, gap-1, com flex-shrink-0; tabela: h-3.5 w-3.5, gap-0.5,
// sem flex-shrink-0) — os valores padrão aqui são os do gráfico.
type PaletteSwatchesProps = {
  colors: readonly string[];
  /** Classes Tailwind de tamanho de cada bolinha. Padrão: "h-4 w-4" (gráfico). */
  size?: string;
  /** Classe Tailwind de espaçamento entre bolinhas. Padrão: "gap-1" (gráfico). */
  gap?: string;
  /** Se cada bolinha leva `flex-shrink-0`. Padrão: true (gráfico); a tabela usa false. */
  shrink?: boolean;
};

export function PaletteSwatches({ colors, size = "h-4 w-4", gap = "gap-1", shrink = true }: PaletteSwatchesProps) {
  return (
    <div className={`flex ${gap}`}>
      {colors.map((c, i) => (
        <span
          key={i}
          className={`${size} ${shrink ? "flex-shrink-0 " : ""}rounded-full border border-black/10`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
