export type { Locale } from "./types";
export type { Dict } from "./en";
export { I18nProvider } from "./context";
export { useT, useLocale } from "./hooks";
// O dicionário como valor, pra usar FORA de um componente React — ex:
// `fieldWarning(schema, binding, dictFor("pt-BR"))` num backend que valida
// template antes de salvar. Dentro de um componente, `useT()` continua sendo o
// caminho (respeita o <I18nProvider> em volta).
export { dictFor } from "./dictionaries";
export { withInlineCode } from "./withInlineCode";
