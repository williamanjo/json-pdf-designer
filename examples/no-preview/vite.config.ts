import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This example exists to prove ONE thing: the package's main entry works
// without pdfjs-dist installed (see the README.md here). That is why the
// package.json has pdfjs-dist in NO field, and nothing here imports from
// "json-pdf-designer/preview" — if any pdf.js import comes back into the main
// entry, this app's `npm ci && npm run build` breaks in CI.
//
// No Tailwind plugin: the <Designer>'s CSS comes ready in
// "json-pdf-designer/theme.css" (imported in main.tsx), which is hand-written
// CSS — nothing to compile. This is the only example with no Tailwind pipeline
// at either end, which makes it the smoke test for the loss of Preflight.
export default defineConfig({
  // Relative — it works on any GitHub Pages subpath
  // (playground/no-preview/) without hardcoding the repo's name. Safe here
  // because this app uses no client-side router.
  base: "./",
  plugins: [react()],
  server: {
    // 5173/5174/5175 already belong to the other three examples.
    port: 5176,
  },
  // json-pdf-designer is a "file:" dependency linked (a symlink) to the
  // parent package — without this Vite may resolve "react" from ITS
  // node_modules instead of this app's, loading two copies of React (the
  // "Invalid hook call" error).
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
