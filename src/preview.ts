// The "json-pdf-designer/preview" entry — the ONLY part of the package that
// depends on pdfjs-dist (an optional peer, ~35MB installed). The same pattern
// as server.ts: a subset of exports with a separate build, so that whoever
// imports only the main entry never has to resolve pdf.js.
//
// INVARIANT: pdfjs-dist may only be imported by this file and by the modules
// reachable FROM IT. Nothing reachable from src/index.ts or src/server.ts may
// import pdf.js — neither through a re-export, nor through a dynamic import()
// (the bundler still has to resolve it at build time). A test in
// test/entryBoundaries.test.ts guards that.
export { PdfPreview } from "./components/PdfPreview";
export { default as PdfPreviewModal } from "./components/PdfPreviewModal";
export { configurePdfWorker } from "./pdf/pdfWorker";
