import { useContext } from "react";
import { I18nContext } from "./contextValue";
import type { Locale } from "./types";

export function useT() {
  return useContext(I18nContext).t;
}

// Só pra quem precisa do CÓDIGO do idioma ativo, não do dicionário — ex:
// escolher entre MATERIAL_ICON_LABELS_EN/PT_BR (materialIcons.ts), que não
// vive dentro do dicionário por ser grande/opcional demais pra carregar
// sempre.
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
