import { Fragment, type ReactNode } from "react";

// The dictionary's help texts mark a stretch of code with a `backtick` (e.g.
// "use `{field}` directly") — it is swapped for a real <code> at render time,
// without having to break each sentence into pieces of JSX in the dictionary
// (which would be unreadable and fragile to translate).
//
// The `jpd-code` class is not decoration: up to 2.1.1 this <code> came out
// WITH NO class and inherited the monospace from Tailwind's Preflight
// (`code,kbd,samp,pre { font-family: <mono> }`), which was embedded in
// dist/style.css. Without Preflight, a bare <code> falls back to the browser
// font in some themes and the marked stretch stops looking like code.
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
