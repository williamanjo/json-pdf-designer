import { en, type Dict } from "./locales/en";
import { ptBR } from "./locales/pt-BR";
import type { Locale } from "./types";

// Mapa locale -> dicionário. Em arquivo próprio (não em context.tsx) porque é
// um VALOR puro, sem React: assim o `/server` e um backend podem importar sem
// arrastar react pro grafo — a fronteira que test/entryBoundaries.test.ts
// guarda.
export const DICTIONARIES: Record<Locale, Dict> = { en, "pt-BR": ptBR };

// O dicionário de um locale, fora de qualquer componente.
//
// Existe porque `fieldWarning(schema, binding, t)` é API pública e precisa de um
// `Dict`, mas o único jeito de obter um era o hook `useT()` — inútil pra quem
// valida um template num backend, ou em qualquer código fora da árvore React.
// Dentro de um componente, prefira `useT()`: ele respeita o `<I18nProvider>`
// em volta, enquanto isto exige escolher o locale na mão.
export function dictFor(locale: Locale): Dict {
  return DICTIONARIES[locale] ?? en;
}
