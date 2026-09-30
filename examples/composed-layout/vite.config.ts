import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This example exists to prove ONE thing: the <Designer> is not indivisible.
// It assembles the <DesignerProvider> by hand and places the parts in a layout
// the preset cannot produce — a toolbar on top, a list on the left, a panel on
// the right, and NO tab bar.
//
// The absence of the tab bar is the real test: without it, the parts that
// inside the <Designer> would live in different tabs (the list, the two halves
// of the property panel, the binding, the filter, the page, the inspector)
// have to render ALL at the same time — 9 instances in the DOM at once. It
// only works because the per-tab gate is opt-in (`whenTab`) — if it were the
// default, this layout would show one part and erase the other eight.
//
// The only tabs on screen are the PAGE ones (components/PageTabs.tsx), which
// are this app's state: they swap which page of the document the canvas shows,
// not which panel appears.
//
// No Tailwind plugin: the shell is plain CSS (src/index.css) and the editor
// comes from "json-pdf-designer/theme.css".
export default defineConfig({
  // Relative — it works on any GitHub Pages subpath
  // (playground/composed-layout/) without hardcoding the repo's name.
  base: "./",
  plugins: [react()],
  server: {
    // 5173/5174/5175/5176 already belong to the other four examples.
    port: 5177,
  },
  // json-pdf-designer is a "file:" dependency linked (a symlink) to the
  // parent package — without this Vite may resolve "react" from ITS
  // node_modules instead of this app's, loading two copies of React (the
  // "Invalid hook call" error).
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
