import type { SVGAttributes } from "react";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../../materialIcons";
import { cx } from "./cx";

// Mesmo ícone (Material Symbols) desenhado tanto no seletor do painel
// (PropertyPanelKpi.tsx) quanto no preview do canvas (FieldBox/KpiField.tsx)
// — ícone desconhecido/"none" simplesmente não mostra nada. viewBox usa o
// grid 960 padrão do Material Symbols (ver MATERIAL_ICON_GRID).
//
// `jpd-micon` e não `jpd-icon` só pra separar os dois papéis; as duas classes
// declaram apenas `display: block` (o que o Preflight dava), e NENHUMA
// declara tamanho — o tamanho daqui vem da prop `size`. Cuidado ao mexer: em
// SVG2 `width`/`height` no `<svg>` são geometry properties, então uma classe
// com `width` VENCE o atributo (medido no navegador: atributo 14 mais classe
// de 10px renderiza 10px). Declarar tamanho na classe quebraria o `size` em
// silêncio.
// `SVGAttributes` como os 20 ícones de icons.tsx, e pelo mesmo motivo: este
// componente é público desde a 3.0.0, e a regra do kit vale pra ele também —
// `className` faz merge, `style` e o resto dos atributos passam. Não é
// `SVGProps`, que estende `ClassAttributes` e aceitaria um `ref` que aqui não
// vai a lugar nenhum.
export type MaterialIconProps = SVGAttributes<SVGSVGElement> & {
  // Nome do glifo (chave de MATERIAL_ICON_PATHS). Desconhecido ou "none"
  // renderiza `null` em vez de um quadrado vazio.
  icon: string;
  // Lado do quadrado, em px. Vai nos ATRIBUTOS `width`/`height` — ver o
  // aviso acima sobre geometry properties antes de mover isto pra CSS.
  //
  // `width`/`height` são escritos DEPOIS do `...rest` de propósito: `size` é
  // a API documentada, então um `width` solto vindo pelo rest não pode
  // vencê-la em silêncio.
  size: number;
};

export function MaterialIcon({ icon, size, className, ...rest }: MaterialIconProps) {
  const path = MATERIAL_ICON_PATHS[icon as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return null;
  return (
    <svg
      {...rest}
      width={size}
      height={size}
      viewBox={`0 -${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID}`}
      fill="currentColor"
      className={cx("jpd-micon", className)}
    >
      <path d={path} />
    </svg>
  );
}
