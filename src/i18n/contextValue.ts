import { createContext } from "react";
import { en } from "./locales/en";
import type { Locale } from "./types";

// The default is English — whoever uses an exported component directly
// (PdfPreview, FieldList...) WITHOUT a <Designer>/<I18nProvider> above still
// sees the right text, only always in English (a preference cannot be
// guessed without someone deciding explicitly). In a file of its own — Vite's
// fast refresh complains about mixing a Context/hook with a component in the
// same file (see context.tsx/hooks.ts).
export const I18nContext = createContext<{ locale: Locale; t: typeof en }>({ locale: "en", t: en });
