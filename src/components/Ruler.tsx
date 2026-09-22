import { mmToPx } from "../page/units";

type Props = {
  lengthMm: number;
  orientation: "horizontal" | "vertical";
  thickness?: number;
};

const MAJOR_EVERY_MM = 10;
const MID_EVERY_MM = 5;

// A ruler in mm (ticks every 1mm, a number every 10mm) — purely a visual
// reference for the page's real size/margins, it is not interactive.
//
// Tick/number color comes from a CLASS (`stroke`/`fill` via --jpd-ruler-tick /
// --jpd-ruler-label), not from an SVG presentation attribute. Besides removing
// the hard-coded hex, that is what fixes dark mode: the ruler background had
// `dark:bg-gray-800` but `stroke="#94a3b8"`/`fill="#64748b"` had no dark
// counterpart, so in the dark theme it was a dark tick on a dark background. A
// presentation attribute loses to any author rule, so the class wins uncontested.
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
