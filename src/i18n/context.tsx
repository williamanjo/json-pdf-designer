import type { ReactNode } from "react";
import { I18nContext } from "./contextValue";
import { DICTIONARIES } from "./dictionaries";
import type { Locale } from "./types";

// The map is in dictionaries.ts — a pure value, no React (see the reason there).

export function I18nProvider({ locale = "en", children }: { locale?: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: DICTIONARIES[locale] }}>{children}</I18nContext.Provider>;
}
