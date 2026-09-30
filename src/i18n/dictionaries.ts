import { en, type Dict } from "./locales/en";
import { ptBR } from "./locales/pt-BR";
import type { Locale } from "./types";

// The locale -> dictionary map. In a file of its own (not in context.tsx)
// because it is a pure VALUE, with no React: that way `/server` and a backend
// can import it without dragging react into the graph — the boundary
// test/entryBoundaries.test.ts guards.
export const DICTIONARIES: Record<Locale, Dict> = { en, "pt-BR": ptBR };

// A locale's dictionary, outside any component.
//
// It exists because `fieldWarning(schema, binding, t)` is public API and needs
// a `Dict`, but the only way to get one was the `useT()` hook — useless for
// anyone validating a template in a backend, or in any code outside the React
// tree. Inside a component, prefer `useT()`: it honors the `<I18nProvider>`
// around it, while this one requires choosing the locale by hand.
export function dictFor(locale: Locale): Dict {
  return DICTIONARIES[locale] ?? en;
}
