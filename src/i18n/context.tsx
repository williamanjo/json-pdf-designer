import type { ReactNode } from "react";
import { en } from "./en";
import { ptBR } from "./pt-BR";
import { I18nContext } from "./contextValue";
import type { Locale } from "./types";

const DICTIONARIES = { en, "pt-BR": ptBR };

export function I18nProvider({ locale = "en", children }: { locale?: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: DICTIONARIES[locale] }}>{children}</I18nContext.Provider>;
}
