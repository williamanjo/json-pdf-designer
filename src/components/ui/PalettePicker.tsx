import { forwardRef, useState, type HTMLAttributes } from "react";
import { cx } from "./cx";
import { Labeled, type LabeledParts } from "./Labeled";
import { PaletteSwatches } from "./PaletteSwatches";

// Uma opção dentro do dropdown: nome estável (é o que `onSelect` recebe e o
// que decide o destaque de "selecionado") + as cores já resolvidas pra essa
// opção (o caller resolve — este componente não sabe nada de paletas de
// gráfico/tabela) + um rótulo opcional pra mostrar ao lado das bolinhas
// (variant "list", ver abaixo; variant "grid" ignora `label`, só mostra as
// bolinhas, igual o seletor de tabela já fazia).
export type PaletteGroupItem = {
  name: string;
  colors: string[];
  label?: string;
};

// Um grupo de opções com um cabeçalho opcional. `label` vazio ("") não
// desenha cabeçalho nenhum — é o que o caller do gráfico usa pra ter uma
// lista "plana" (um grupo só, sem título) reaproveitando a mesma estrutura
// dos 3 grupos Claro/Médio/Escuro da tabela.
export type PaletteGroup = {
  label: string;
  items: PaletteGroupItem[];
};

export type PalettePickerProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  /** Rótulo acima do botão (ex.: "Paleta de cores"). Omitido = sem rótulo. */
  label?: string;
  /** Nome da paleta atualmente selecionada — usado só pra destacar a opção certa na lista. */
  currentName: string;
  /** Cores já resolvidas da paleta atual, mostradas nas bolinhas do botão. Array vazio mostra `emptyPlaceholder` no lugar. */
  currentColors: string[];
  /** Texto mostrado no botão ao lado das bolinhas. Padrão: `currentName`. */
  currentLabel?: string;
  onSelect: (name: string) => void;
  groups: PaletteGroup[];
  /** Mostrado no lugar das bolinhas quando `currentColors` está vazio. Padrão: "—" (caso da tabela sem preset/customizado). */
  emptyPlaceholder?: string;
  /**
   * "list" (padrão, caso do gráfico): opções empilhadas, uma coluna, cada
   * uma com bolinhas + `item.label`. Grupos não desenham cabeçalho (só
   * fazem sentido com um único grupo de `label` vazio).
   * "grid" (caso da tabela): opções por grupo, cada grupo com cabeçalho
   * (quando `group.label` não é vazio) e uma grade 2 colunas de opções só
   * com bolinhas (sem `item.label`).
   */
  variant?: "list" | "grid";
  /** Tamanho das bolinhas. "md" (gráfico) | "sm" (tabela). */
  swatchSize?: "sm" | "md";
  parts?: LabeledParts;
};

// Dropdown de paleta nomeada, reaproveitável: botão mostra a paleta atual
// (bolinhas + texto), clique abre/fecha uma lista de opções (bolinhas de
// cada uma), escolher uma aplica e fecha de novo. Generaliza os dois
// seletores quase idênticos que PropertyPanelChart.tsx e
// PropertyPanelTable.tsx tinham cada um o seu.
//
// BREAKING em 3.0.0, duas coisas:
//
// - `swatchSize`/`swatchGap`/`swatchShrink` (três strings de classe Tailwind)
//   colapsaram num `swatchSize` de dois valores. As duas chamadas reais
//   sempre passavam o mesmo trio junto, e sempre casado com o `variant`.
// - `staticArrow` morreu. Ele existia só pra preservar o que o comentário
//   dele mesmo chamava de "detalhe não intencional da versão original": a
//   seta do seletor da TABELA não alternava ▾/▴ e não tinha cor de dark
//   mode. Com token, existe uma cor de seta; a seta alterna nos dois casos.
export const PalettePicker = forwardRef<HTMLDivElement, PalettePickerProps>(function PalettePicker(
  { label, currentName, currentColors, currentLabel, onSelect, groups, emptyPlaceholder = "—", variant = "list", swatchSize, className, parts, ...rest },
  ref
) {
  const [open, setOpen] = useState(false);
  const isGrid = variant === "grid";
  const size = swatchSize ?? (isGrid ? "sm" : "md");

  function choose(name: string) {
    onSelect(name);
    setOpen(false);
  }

  return (
    <Labeled label={label} parts={parts}>
      <div ref={ref} {...rest} className={cx("jpd-palette", className)}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="jpd-palette__trigger">
          <span className="jpd-palette__current">
            {currentColors.length > 0 ? (
              <PaletteSwatches colors={currentColors} size={size} />
            ) : (
              <span className="jpd-palette__empty">{emptyPlaceholder}</span>
            )}
            <span>{currentLabel ?? currentName}</span>
          </span>
          <span className="jpd-palette__arrow">{open ? "▴" : "▾"}</span>
        </button>
        {open && (
          <div data-variant={variant} className="jpd-palette__menu">
            {isGrid
              ? groups.map((group) => (
                  <div key={group.label} className="jpd-palette__group">
                    {group.label && <span className="jpd-palette__grouplabel">{group.label}</span>}
                    <div className="jpd-palette__options">
                      {group.items.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => choose(item.name)}
                          data-selected={item.name === currentName || undefined}
                          className="jpd-palette__option"
                        >
                          <PaletteSwatches colors={item.colors} size={size} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              : groups
                  .flatMap((group) => group.items)
                  .map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => choose(item.name)}
                      data-selected={item.name === currentName || undefined}
                      className="jpd-palette__option"
                    >
                      <PaletteSwatches colors={item.colors} size={size} />
                      <span className="jpd-palette__optionlabel">{item.label ?? item.name}</span>
                    </button>
                  ))}
          </div>
        )}
      </div>
    </Labeled>
  );
});
