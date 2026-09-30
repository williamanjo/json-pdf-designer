import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// No Tailwind plugin here on purpose — and, unlike the other examples, with
// NO CSS import from the package at all (see main.tsx). This is the example
// that proves the `json-pdf-designer/theme.css` stylesheet is OPT-IN: the
// <Designer> only leaves the `.jpd-*` classes and the `data-*` attributes in
// the DOM, and what paints everything is this app's src/index.css, in plain CSS.
export default defineConfig({
  // Relative (not "/repo-name/") — it works on any GitHub Pages subpath (the
  // site is mounted at playground/custom-ui/) without having to hardcode the
  // repo's name here. It is only safe because this app uses no client-side
  // router (a single-view SPA).
  base: './',
  plugins: [react()],
  // A fixed port — without it Vite falls back to the default 5173, which
  // collides with the "report-builder" example's dev server if the two run
  // together.
  server: {
    port: 5174,
  },
  // json-pdf-designer is a "file:" dependency linked (a symlink) to the
  // parent package — without this Vite may resolve "react" from ITS
  // node_modules instead of this app's, loading two copies of React (the
  // "Invalid hook call" error).
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
