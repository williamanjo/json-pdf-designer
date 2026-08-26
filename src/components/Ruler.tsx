import { mmToPx } from "../units";

type Props = {
  lengthMm: number;
  orientation: "horizontal" | "vertical";
  thickness?: number;
};

const MAJOR_EVERY_MM = 10;
const MID_EVERY_MM = 5;

// Régua em mm (marcas a cada 1mm, número a cada 10mm) — só pra referência
// visual de tamanho/margem real da página, não é interativa.
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
          x1={pos}
          y1={thickness - tickLen}
          x2={pos}
          y2={thickness}
          stroke="#94a3b8"
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
      if (isMajor) {
        ticks.push(
          <text key={`t${mm}`} x={pos + 2} y={thickness - tickLen - 2} fontSize={8} fill="#64748b">
            {mm}
          </text>
        );
      }
    } else {
      ticks.push(
        <line
          key={mm}
          x1={thickness - tickLen}
          y1={pos}
          x2={thickness}
          y2={pos}
          stroke="#94a3b8"
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
      if (isMajor && mm > 0) {
        ticks.push(
          <text key={`t${mm}`} x={2} y={pos - 2} fontSize={8} fill="#64748b">
            {mm}
          </text>
        );
      }
    }
  }

  const width = orientation === "horizontal" ? pxLength : thickness;
  const height = orientation === "horizontal" ? thickness : pxLength;

  return (
    <svg
      width={width}
      height={height}
      className="select-none bg-slate-50 dark:bg-gray-800"
      style={{ display: "block", flexShrink: 0 }}
    >
      {ticks}
    </svg>
  );
}
