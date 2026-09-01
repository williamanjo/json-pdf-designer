import type { ReactNode } from "react";
import { I18nContext } from "./contextValue";
import { DICTIONARIES } from "./dictionaries";
import type { Locale } from "./types";

// Mapa em dictionaries.ts — valor puro, sem React (ver o motivo lá).

export function I18nProvider({ locale = "en", children }: { locale?: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: DICTIONARIES[locale] }}>{children}</I18nContext.Provider>;
}
