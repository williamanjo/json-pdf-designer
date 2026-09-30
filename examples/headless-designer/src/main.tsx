import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// THE RESET ONLY, without the theme — and this is the only example that does so.
//
// `json-pdf-designer/reset.css` is the APPEARANCE-FREE subset of `theme.css`:
// it gives back what Tailwind's Preflight gave for free up to 2.x
// (`box-sizing`, `margin: 0` on headings/paragraphs/lists, `font: inherit` on
// controls, `svg { display: block }`, monospaced `code`) and nothing else.
// Zero color, zero spacing, zero borders.
//
// It serves because this app does not render the `<Designer>`: it assembles
// its own editor and from the package uses only `<PdfPreview>`, whose surface
// is FOUR names (`.jpd-error`, `.jpd-error--md`, `.jpd-preview__count` and the
// `--jpd-shadow-page-preview` token). Writing those four's appearance by hand
// is the ~5 rules at the end of index.css — cheap. For the WHOLE editor the
// cost would be another matter: see `examples/custom-ui`, which pays ~190 classes.
//
// Whoever wants the ready-made appearance imports `json-pdf-designer/theme.css`,
// which already includes this reset — one line, and nothing to write.
import "json-pdf-designer/reset.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
