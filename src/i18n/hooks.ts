import { useContext } from "react";
import { I18nContext } from "./contextValue";
import type { Locale } from "./types";

export function useT() {
  return useContext(I18nContext).t;
}

// Only for whoever needs the active language's CODE, not the dictionary —
// e.g. choosing between MATERIAL_ICON_LABELS_EN/PT_BR (materialIcons.ts),
// which does not live inside the dictionary because it is too large/optional
// to load every time.
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
