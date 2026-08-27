import { Fragment, type ReactNode } from "react";

// Textos de ajuda do dicionário marcam trecho de código com `backtick` (ex:
// "use `{campo}` direto") — troca por <code> de verdade na hora de
// renderizar, sem precisar quebrar cada frase em pedaços de JSX no
// dicionário (que ficaria ilegível e frágil de traduzir).
export function withInlineCode(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
