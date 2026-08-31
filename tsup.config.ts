import { defineConfig } from "tsup";

export default defineConfig({
  // `server.ts` é o subconjunto sem React de `index.ts` (ver comentário lá)
  // — build separado pra quem importa "json-pdf-designer/server" nunca
  // puxar react/react-dom (nem como import solto no arquivo compilado).
  entry: ["src/index.ts", "src/server.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Deps reais ficam de fora do bundle (o consumidor já resolve via
  // node_modules, por serem "dependencies" do package.json) — evita
  // duplicar pdf-lib/pdfjs-dist no dist e, principalmente, evita que o
  // tsup tente (e falhe) lidar com o worker separado do pdf.js.
  external: ["react", "react-dom", "pdf-lib", "fontkit", "pdfjs-dist", "react-rnd", "wawoff2", "tiny-inflate"],
});
