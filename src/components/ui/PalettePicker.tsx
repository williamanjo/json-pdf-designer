import { useState } from "react";
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

type PalettePickerProps = {
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
  swatchSize?: string;
  swatchGap?: string;
  swatchShrink?: boolean;
  /**
   * Quando true, a seta do botão fica sempre "▾" (não alterna com o estado
   * aberto/fechado) e sem a cor de dark mode — reproduz o comportamento que
   * o seletor de tabela já tinha (aparentemente um detalhe não intencional
   * da versão original, preservado aqui pra não mudar nada visualmente).
   * Padrão: false (seta alterna ▾/▴, caso do gráfico).
   */
  staticArrow?: boolean;
};

// Dropdown de paleta nomeada, reaproveitável: botão mostra a paleta atual
// (bolinhas + texto), clique abre/fecha uma lista de opções (bolinhas de
// cada uma), escolher uma aplica e fecha de novo. Generaliza os dois
// seletores quase idênticos que PropertyPanelChart.tsx e
// PropertyPanelTable.tsx tinham cada um o seu: `variant="list"` cobre o
// caso do gráfico (lista plana com nome ao lado de cada opção) e
// `variant="grid"` cobre o da tabela (grupos Claro/Médio/Escuro, grade 2
// colunas, só bolinhas). Estado `open` é interno — o caller não precisa
// gerenciar nada além de currentName/currentColors/onSelect/groups.
export function PalettePicker({
  label,
  currentName,
  currentColors,
  currentLabel,
  onSelect,
  groups,
  emptyPlaceholder = "—",
  variant = "list",
  swatchSize,
  swatchGap,
  swatchShrink,
  staticArrow = false,
}: PalettePickerProps) {
  const [open, setOpen] = useState(false);
  const isGrid = variant === "grid";

  function choose(name: string) {
    onSelect(name);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[11px] font-medium text-slate-600 dark:text-gray-300">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:border-sky-400 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400"
      >
        <span className="flex items-center gap-2">
          {currentColors.length > 0 ? (
            <PaletteSwatches colors={currentColors} size={swatchSize} gap={swatchGap} shrink={swatchShrink} />
          ) : (
            <span className="text-slate-400 dark:text-gray-500">{emptyPlaceholder}</span>
          )}
          <span>{currentLabel ?? currentName}</span>
        </span>
        <span className={staticArrow ? "text-slate-400" : "text-slate-400 dark:text-gray-500"}>
          {staticArrow ? "▾" : open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div
          className={
            isGrid
              ? "flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 p-1.5 dark:border-gray-600"
              : "flex flex-col gap-0.5 rounded-lg border border-slate-200 p-1 dark:border-gray-600"
          }
        >
          {isGrid
            ? groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  {group.label && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-gray-500">
                      {group.label}
                    </span>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => choose(item.name)}
                        className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-sky-50 dark:hover:bg-blue-400/10 ${
                          item.name === currentName ? "bg-sky-50 dark:bg-blue-400/10" : ""
                        }`}
                      >
                        <PaletteSwatches colors={item.colors} size={swatchSize} gap={swatchGap} shrink={swatchShrink} />
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
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-sky-50 dark:hover:bg-blue-400/10 ${
                      item.name === currentName ? "bg-sky-50 dark:bg-blue-400/10" : ""
                    }`}
                  >
                    <PaletteSwatches colors={item.colors} size={swatchSize} gap={swatchGap} shrink={swatchShrink} />
                    <span className="text-slate-700 dark:text-gray-200">{item.label ?? item.name}</span>
                  </button>
                ))}
        </div>
      )}
    </div>
  );
}
