import { Checkbox, type CheckboxProps, type SelectProps, type UiComponentsOverride } from "json-pdf-designer";

// SWAPPING THE PRIMITIVES THE EDITOR USES INTERNALLY.
//
// This is the only example that demonstrates the slot registry. It exists
// because 3.0.0 opened the editor's 12 primitives (`Button`, `Input`,
// `ColorInput`, `Select`, `Textarea`, `Checkbox`, `Modal`, `Card`,
// `CardHeader`, `CardTitle`, `Badge`, `TabPanel`) to replacement — and it is
// the only part of that API no example exercised.
//
// Here we swap TWO on purpose, not the twelve: the point is to show the
// mechanics and the adapter's shape. Replacing all of them is the same
// gesture, repeated.
//
// +- WHY THIS EXAMPLE --------------------------------------------------+
// | It uses the `<Designer>` PRESET, and `<Designer components={...}>`  |
// | is the sugar that assembles the `<UiComponentsProvider>` — the path |
// | most consumers take. Whoever renders a standalone part assembles    |
// | the provider by hand.                                               |
// |                                                                     |
// | And why NOT in `custom-ui`, which would be the obvious guess: there |
// | the identity is styling the ~190 `.jpd-*` classes the editor emits. |
// | Swapping the primitives REMOVES from the DOM precisely the          |
// | `.jpd-btn`/`.jpd-input`/`.jpd-select` that CSS styles. The two are  |
// | mutually exclusive.                                                 |
// +---------------------------------------------------------------------+

// A MODULE CONSTANT, and this is load-bearing.
//
// An inline object (`components={{ Select: ... }}` written in the JSX) creates
// a NEW component on every render, and React unmounts/remounts whatever
// changed identity — the symptom is the field losing focus on every keystroke.
// Outside production the provider warns in the console, once.
//
// `satisfies` instead of `:` so TypeScript still infers each adapter's exact
// type (with `:` it would widen to the slot's type and lose the check that the
// props match).
export const MEUS_PRIMITIVOS = {
  // ---- Select ------------------------------------------------------------
  // A native `<select>` dressed as a terminal widget: `[ ]` brackets and a
  // green `▾` arrow drawn in CSS (`.slot-select`, see index.css), a green
  // uppercase label. It is so it can be SEEN on screen, with no DevTools, that
  // the primitive is ours and not the package's — a demonstration has to be
  // visible to exist.
  //
  // The props that are OURS (`label`, `parts`) leave through destructuring;
  // the rest (`value`, `onChange`, `children`, `aria-*`, ...) is passed along.
  // It is the canonical shape of the ~5-line adapter.
  //
  // `label` is the prop that BITES: the editor has ~16 controls whose
  // accessible name comes from it. A slot that discards it leaves a screen
  // reader with nothing to announce. Here it is honored in a real `<label>`.
  //
  // And it arrives ALREADY TRANSLATED: what assembles those ~16 controls is
  // the editor, which reads the `<Designer>`'s `locale` (see
  // DesignerPanel.tsx). This adapter does not touch the shell's dictionary
  // (src/i18n.ts) for that reason — the text is not its own, and translating
  // again here would be a second translation to fall out of sync. Nothing else
  // in this file is text: if one day a placeholder or an `aria-label` of OURS
  // is born here, it goes into the shell's dictionary — and then the map has
  // to become a function of `locale`, because a module constant cannot depend
  // on state (see the warning above).
  Select: ({ label, parts: _parts, children, ...rest }: SelectProps) => (
    <label className="slot-field" data-slot="select">
      {label && <span className="slot-field__label">{label}</span>}
      <span className="slot-select">
        <select {...rest}>{children}</select>
      </span>
    </label>
  ),

  // ---- Checkbox ----------------------------------------------------------
  // Here the adapter WRAPS our own `<Checkbox>` instead of reimplementing it
  // — it is the most natural use case there is ("I want the package's
  // behavior, with a shell of mine around it").
  //
  // This is only possible because of an invariant of the design: a slottable
  // primitive NEVER reads the registry. If the kit's `<Checkbox>` resolved
  // itself through `useUiComponents()`, this adapter would recurse forever.
  // There is a source test in the package guaranteeing that
  // (`test/uiSlots.test.tsx`, the "anti-recursion invariant" describe).
  Checkbox: (props: CheckboxProps) => (
    <span className="slot-check" data-slot="checkbox">
      <Checkbox {...props} />
    </span>
  ),

  // The other 10 slots do not appear here — and `undefined` on a key would
  // mean INHERIT (from the parent provider), not "back to ours". Simply
  // omitting is the way to say "that one stays the package's".
} satisfies UiComponentsOverride;
