import { createContext } from "react";
import { en } from "./en";
import type { Locale } from "./types";

// Default = inglês — quem usa um componente exportado direto (PdfPreview,
// FieldList...) SEM <Designer>/<I18nProvider> por cima ainda vê texto
// certo, só que sempre em inglês (não dá pra adivinhar preferência sem
// alguém decidir explicitamente). Em arquivo próprio — fast-refresh do
// Vite reclama de misturar Context/hook com componente no mesmo arquivo
// (ver context.tsx/hooks.ts).
export const I18nContext = createContext<{ locale: Locale; t: typeof en }>({ locale: "en", t: en });
