import { mmToPx } from "../page/units";

type Props = {
  lengthMm: number;
  orientation: "horizontal" | "vertical";
  thickness?: number;
};

const MAJOR_EVERY_MM = 10;
const MID_EVERY_MM = 5;

// Régua em mm (marcas a cada 1mm, número a cada 10mm) — só pra referência
// visual de tamanho/margem real da página, não é interativa.
//
// Cor de marca/número vem de CLASSE (`stroke`/`fill` via --jpd-ruler-tick /
// --jpd-ruler-label), não de atributo de apresentação SVG. Além de tirar o
// hex fixo, é o que conserta o dark: o fundo da régua tinha `dark:bg-gray-800`
// mas `stroke="#94a3b8"`/`fill="#64748b"` não tinham contraparte dark, então
// no escuro ficava marca escura sobre fundo escuro. Atributo de apresentação
// perde de qualquer regra de autor, então a classe assume sem briga.
export function Ruler({ lengthMm, orientation, thickness = 16 }: Props) {
  const pxLength = mmToPx(lengthMm);
  const ticks: React.ReactElement[] = [];

  for (let mm = 0; mm <= Math.floor(lengthMm); mm++) {
    const pos = mmToPx(mm);
    const isMajor = mm % MAJOR_EVERY_MM === 0;
    const isMid = mm % MID_EVERY_MM === 0;
    const tickLen = isMajor ? thickness * 0.65 : isMid ? thickness * 0.45 : thickness * 0.25;

    if (orientation === "horizontal") {
      ticks.push(
        <line
          key={mm}
          className="jpd-ruler__tick"
          data-major={isMajor || undefined}
          x1={pos}
          y1={thickness - tickLen}
          x2={pos}
          y2={thickness}
        />
      );
      if (isMajor) {
        ticks.push(
          <text key={`t${mm}`} className="jpd-ruler__label" x={pos + 2} y={thickness - tickLen - 2} fontSize={8}>
            {mm}
          </text>
        );
      }
    } else {
      ticks.push(
        <line
          key={mm}
          className="jpd-ruler__tick"
          data-major={isMajor || undefined}
          x1={thickness - tickLen}
          y1={pos}
          x2={thickness}
          y2={pos}
        />
      );
      if (isMajor && mm > 0) {
        ticks.push(
          <text key={`t${mm}`} className="jpd-ruler__label" x={2} y={pos - 2} fontSize={8}>
            {mm}
          </text>
        );
      }
    }
  }

  const width = orientation === "horizontal" ? pxLength : thickness;
  const height = orientation === "horizontal" ? thickness : pxLength;

  return (
    <svg width={width} height={height} className="jpd-ruler">
      {ticks}
    </svg>
  );
}
