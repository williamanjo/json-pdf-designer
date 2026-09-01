// Entry "json-pdf-designer/preview" — a ÚNICA parte do pacote que depende
// de pdfjs-dist (peer opcional, ~35MB instalado). Mesmo padrão do
// server.ts: um subconjunto de exports com build separado, pra que quem
// importa só a entry principal nunca precise resolver o pdf.js.
//
// INVARIANTE: pdfjs-dist só pode ser importado por este arquivo e pelos
// módulos alcançáveis A PARTIR DELE. Nada alcançável de src/index.ts ou
// src/server.ts pode importar pdf.js — nem via re-export, nem via
// import() dinâmico (bundler ainda precisa resolver em tempo de build).
// Um teste em test/entryBoundaries.test.ts guarda isso.
export { PdfPreview } from "./components/PdfPreview";
export { default as PdfPreviewModal } from "./components/PdfPreviewModal";
export { configurePdfWorker } from "./pdf/pdfWorker";
