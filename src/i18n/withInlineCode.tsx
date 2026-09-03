import { Fragment, type ReactNode } from "react";

// Textos de ajuda do dicionário marcam trecho de código com `backtick` (ex:
// "use `{campo}` direto") — troca por <code> de verdade na hora de
// renderizar, sem precisar quebrar cada frase em pedaços de JSX no
// dicionário (que ficaria ilegível e frágil de traduzir).
//
// A classe `jpd-code` não é decoração: até 2.1.1 este <code> saía SEM classe
// e herdava a monoespaçada do Preflight do Tailwind (`code,kbd,samp,pre {
// font-family: <mono> }`), que vinha embutido no dist/style.css. Sem o
// Preflight, <code> nu volta pra fonte do navegador em alguns temas e o
// trecho marcado deixa de parecer código.
export function withInlineCode(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="jpd-code">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
