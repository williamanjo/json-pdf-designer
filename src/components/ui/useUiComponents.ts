import { useContext } from "react";
import { UiComponentsContext, type UiComponents } from "./registry";

// The primitives to use HERE, now — ours by default, or the consumer's if
// there is a <UiComponentsProvider> above.
//
// Usage in the editor chrome: destructure at the top of the component and the
// JSX below reads exactly as it did with a concrete import.
//
//   const { Button, Input } = useUiComponents();
//
// INVARIANT: a SLOTTABLE primitive does not call this. See the comment in
// UiComponentsProvider.tsx — it is what avoids infinite recursion in the most
// obvious adapter there is (wrapping our own Button). Guarded by a source scan
// in test/uiSlots.test.tsx.
export function useUiComponents(): UiComponents {
  return useContext(UiComponentsContext);
}
