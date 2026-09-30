import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// No Tailwind plugin here — and since 3.0.0 there is no Tailwind at all to
// plug in: the package no longer uses it. This example proves that an editor
// of your OWN can be assembled (without the <Designer> component and without
// any `Designer*` part) using only the package's low-level pieces
// (generatePdf/types from "json-pdf-designer/server" + <PdfPreview> from
// "json-pdf-designer/preview"). And it imports ONLY "json-pdf-designer/
// reset.css" (main.tsx), not the theme — so even `<PdfPreview>`'s appearance
// is written by hand, in src/index.css.
export default defineConfig({
  // Relative — it works on any GitHub Pages subpath
  // (playground/headless-designer/) without hardcoding the repo's name. Safe
  // here because this app uses no client-side router.
  base: "./",
  plugins: [react()],
  server: {
    port: 5175,
  },
  // json-pdf-designer is a "file:" dependency linked (a symlink) to the
  // parent package — without this Vite may resolve "react" from ITS
  // node_modules instead of this app's, loading two copies of React (the
  // "Invalid hook call" error).
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
