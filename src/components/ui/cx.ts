import type { CSSProperties } from "react";

// Class and style joining, in one place. Before this the package had THREE
// ways to concatenate a class — `[...].join(" ")` (Button/Select/Textarea), a
// template literal (Card) and `[...].filter(Boolean).join(" ")`
// (ClearFieldButton) — and none of them deduplicated or handled the case where
// "nothing was left".
export type ClassValue = string | false | null | undefined;

// `cx("jpd-btn", props.className)`.
//
// ORDER: our own class first, the consumer's last. That is only legibility and
// diff stability — the order of the tokens INSIDE the `class` attribute never
// decided the cascade, not even with Tailwind. `.jpd-btn` and the consumer's
// class have the same specificity (0-1-0), so what wins is the order in the
// STYLESHEET, not here. Whoever needs to beat theme.css loads their CSS after
// it, or uses `style` (see mergeStyle below).
//
// DEDUPE: by exact token, first occurrence wins. It is not there to resolve a
// utility conflict (that problem leaves along with Tailwind) — it is because
// composition really does pass the same token twice: ClearFieldButton forwards
// `className` to the Button, which already added its own base; and a slot
// adapter wrapping our own component
// (`(p) => <Button {...p} className={cx("mine", p.className)} />`) passes
// through here twice. Deduplicating makes `cx` idempotent, which is what
// allows stable markup assertions in the tests.
//
// RETURNS `undefined` (and not `""`) when nothing is left: React OMITS the
// attribute for `undefined`, so the markup is not left with a stray `class=""`.
// It is the opposite of what Card did (`${...} ${className}` always emitted a
// trailing space, even with no className).
export function cx(...parts: ClassValue[]): string | undefined {
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of part.split(/\s+/)) {
      if (token) seen.add(token);
    }
  }
  if (seen.size === 0) return undefined;
  return [...seen].join(" ");
}

// `style={mergeStyle(ourStyle, props.style)}`.
//
// ONE rule, everywhere: the consumer's `style` wins. It is the last-resort
// escape hatch — what is left when class and token were not enough — so it
// cannot be overridden by the component.
//
// Two consequences accepted on purpose: TabPanel's `gridTemplateRows` IS the
// collapse mechanism, and each swatch's `backgroundColor` in PaletteSwatches
// IS the palette. Overriding either of them breaks the component's function —
// and that is acceptable in a last-resort escape hatch.
export function mergeStyle(own: CSSProperties | undefined, incoming: CSSProperties | undefined): CSSProperties | undefined {
  if (!own) return incoming;
  if (!incoming) return own;
  return { ...own, ...incoming };
}

// The style of ONE internal part of a component.
//
// The rule for the package's entire styling API is:
//
//   `className`/`style`/`...rest` go to the element that NAMES the component.
//   Every other element it renders is addressed through `parts`, by role.
//
// So `<Input className>` still lands on the `<input>` (same as 2.x, no
// migration), and the `<label>` wrapping the control becomes
// `parts={{ root: ... }}`. In `<Modal>` the named element is the PANEL; the
// dimmed background is `parts={{ overlay: ... }}`.
//
// The alternative, "className always on the root", was rejected: it would
// silently relocate every existing `<Input className="w-24">` from the control
// to the wrapper whenever `label` was present — breakage with no error.
//
// Each component declares a CLOSED set of 2 to 6 keys, so the consumer
// discovers them by autocomplete on the component itself and TypeScript
// rejects a typo. That is what replaces the global map of 50-80 keys that was
// rejected: same coverage, local surface.
//
// `parts` accepts only className/style — no handler, no ref, on purpose. That
// limit is what stops `parts` from growing back into a global map: whoever
// needs a handler/ref on the wrapper omits `label` and composes their own,
// which ALREADY works today (Input/Select/Textarea return the bare control
// when they receive no `label`).
export type PartStyle = string | { className?: string; style?: CSSProperties };

export function readPart(part: PartStyle | undefined): { className?: string; style?: CSSProperties } {
  if (!part) return {};
  return typeof part === "string" ? { className: part } : part;
}
