export type { Locale } from "./types";
export type { Dict } from "./locales/en";
export { I18nProvider } from "./context";
export { useT, useLocale } from "./hooks";
// The dictionary as a value, to use OUTSIDE a React component — e.g.
// `fieldWarning(schema, binding, dictFor("pt-BR"))` in a backend that
// validates a template before saving. Inside a component, `useT()` is still
// the way (it honors the <I18nProvider> around it).
export { dictFor } from "./dictionaries";
export { withInlineCode } from "./withInlineCode";
