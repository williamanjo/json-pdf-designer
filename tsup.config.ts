import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Deps reais ficam de fora do bundle (o consumidor já resolve via
  // node_modules, por serem "dependencies" do package.json) — evita
  // duplicar pdf-lib/pdfjs-dist no dist e, principalmente, evita que o
  // tsup tente (e falhe) lidar com o worker separado do pdf.js.
  external: ["react", "react-dom", "pdf-lib", "fontkit", "pdfjs-dist", "react-rnd", "lodash.get", "wawoff2", "tiny-inflate"],
});
