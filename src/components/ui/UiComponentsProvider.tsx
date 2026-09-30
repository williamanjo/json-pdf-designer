import { useContext, useMemo, useRef, type ReactNode } from "react";
import { UiComponentsContext, type UiComponents, type UiComponentsOverride } from "./registry";

// Swaps the primitives the editor uses internally.
//
//   <UiComponentsProvider components={{ Button: MyButton }}>
//     <Designer ... />
//   </UiComponentsProvider>
//
// A PARTIAL replacement is the normal case: whatever is not passed stays
// ours. And composition is key by key with the provider above, so the app's
// vocabulary can be defined at the root and only `Modal` overridden in a corner.
//
// WHY A CONTEXT OF ITS OWN, separate from the Designer's state: a slot value
// is a COMPONENT TYPE. If the map lived in the state context, every state
// change would rebuild the value, the identities would change, and React would
// unmount and remount every slotted primitive — the consumer would lose focus
// mid-typing. With its own context and a `useMemo` on the `components` prop,
// that is structurally impossible.
//
// ANTI-RECURSION INVARIANT: no slottable primitive (Button, Input, Modal,
// ...) calls `useUiComponents`. Otherwise the most obvious adapter there is —
// wrapping OUR component to adjust something —
//
//   { Button: (p) => <Button {...p} className={cx("mine", p.className)} /> }
//
// would recurse forever. Only the chrome and the composed components read the
// registry. Guarded by a source scan in test/uiSlots.test.tsx.
export type UiComponentsProviderProps = {
  // Only the keys you want to swap. The others come from the PARENT provider
  // (or from ours, if there is no parent) — `undefined` on a key means
  // INHERIT, not back-to-the-default.
  //
  // Hoist it to a module constant: an unstable identity remounts the slotted
  // component and the field loses focus on every keystroke.
  components?: UiComponentsOverride;
  children: ReactNode;
};

export function UiComponentsProvider({ components, children }: UiComponentsProviderProps) {
  // It merges over the PARENT provider, not over our defaults. That is what
  // allows defining the app's vocabulary at the root and overriding a single
  // key in a corner — merging over the default would reset everything this
  // provider does not mention, which is the opposite of "partial replacement".
  // (The context has `defaultUiComponents` as its default value, so with no
  // parent at all the `parent` is already our set.)
  const parent = useContext(UiComponentsContext);

  const value = useMemo<UiComponents>(() => {
    if (!components) return parent;
    // `undefined` is PRUNED: `{ Modal: cond ? X : undefined }` means
    // "inherit", not "back to the default". Going back to ours is written
    // explicitly with `defaultUiComponents.Modal`.
    const override = Object.fromEntries(Object.entries(components).filter(([, v]) => v !== undefined));
    return { ...parent, ...override } as UiComponents;
  }, [components, parent]);

  useUnstableIdentityWarning(components);

  return <UiComponentsContext.Provider value={value}>{children}</UiComponentsContext.Provider>;
}

// A development-only warning: an unstable identity is the sharpest edge of
// this API and it is INVISIBLE to the type system.
//
// Passing an inline object/function (`components={{ Button: (p) => ... }}`)
// creates a new component on every render; React sees a different type,
// unmounts and remounts — and the symptom is "I lose input focus on every
// keystroke", which nobody connects to the registry. One console line trades a
// baffling bug for an instruction.
function useUnstableIdentityWarning(components: UiComponentsOverride | undefined) {
  const first = useRef<UiComponentsOverride | undefined>(undefined);
  const warned = useRef(false);

  if (process.env.NODE_ENV !== "production") {
    if (first.current === undefined) {
      first.current = components;
    } else if (!warned.current && components) {
      const changed = Object.keys(components).filter(
        (k) => (components as Record<string, unknown>)[k] !== (first.current as Record<string, unknown> | undefined)?.[k]
      );
      if (changed.length > 0) {
        warned.current = true;
        console.warn(
          `[json-pdf-designer] A identidade destes slots mudou depois do primeiro render: ${changed.join(", ")}. ` +
            "O React trata componente com identidade nova como tipo novo, então ele desmonta e remonta — o sintoma " +
            "costuma ser perder o foco do campo a cada tecla. Suba o mapa pra uma constante de módulo, ou memoize com useMemo."
        );
      }
    }
  }
}
