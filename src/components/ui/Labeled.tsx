import type { ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

// A label wrapper shared by Input/ColorInput/Select/Textarea — all four
// repeated the same <label><span>{label}</span>{control}</label>.
//
// NAME: `jpd-labeled`, and not `jpd-field`. The word "field" would describe
// both, but `jpd-field` is the CANVAS field box (PageCanvas's <Rnd>) —
// colliding the names would let one's CSS leak into the other.
//
// `parts` addresses everything that is not the element naming the component:
// `className` goes to the control, `parts.root` to the <label> and
// `parts.label` to the <span>. Only className/style, no handler and no ref —
// whoever needs those omits `label` and composes their own wrapper.
export type LabeledParts = { root?: PartStyle; label?: PartStyle };

export function Labeled({ label, parts, children }: { label?: string; parts?: LabeledParts; children: ReactNode }) {
  // With no label, it returns the BARE control — same behavior as 2.x, and it
  // is the way out for anyone who wants to build their own wrapper.
  if (!label) return <>{children}</>;

  const root = readPart(parts?.root);
  const text = readPart(parts?.label);
  return (
    <label className={cx("jpd-labeled", root.className)} style={root.style}>
      <span className={cx("jpd-labeled__text", text.className)} style={text.style}>
        {label}
      </span>
      {children}
    </label>
  );
}
