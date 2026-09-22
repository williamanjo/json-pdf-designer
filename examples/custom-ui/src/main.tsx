import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// NO CSS FROM THE PACKAGE is imported here — neither
// `json-pdf-designer/style.css` nor `json-pdf-designer/theme.css`. That is
// this example's point: the package's stylesheet is OPT-IN, and not importing
// it is a supported mode.
//
// What is left in the DOM without it are the `.jpd-*` classes and the `data-*`
// attributes every element of the <Designer> carries
// (`.jpd-btn[data-variant]`, `.jpd-field[data-selected]`,
// `.jpd-tab[data-active]`, ...). What styles them is this app's src/index.css,
// written by hand in plain CSS — canvas, property panel, tabs, modals and
// every control included.
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
