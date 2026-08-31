// Roda contra o pacote PUBLICADO (instalado via .tgz, não via symlink/
// file: no repo) — ver README.md nesta pasta. Testa só o entry "/server"
// (sem React) de propósito: é o diferencial mais importante do pacote
// ("gera PDF no backend sem precisar de React") e o mais fácil de isolar.
import { generatePdf } from "json-pdf-designer/server";

const template = {
  page: { width: 210, height: 297 },
  schemas: [
    {
      id: "txt1",
      name: "titulo",
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 15,
      content: "Olá, {nome}!",
      fontSize: 14,
      fontColor: "#000000",
      alignment: "left",
    },
  ],
};

const bytes = await generatePdf(template, { nome: "Mundo" }, []);

if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
  console.error("FALHOU: generatePdf não retornou bytes válidos.");
  process.exit(1);
}

// Assinatura de arquivo PDF real ("%PDF-") — confirma que saiu um PDF de
// verdade, não um objeto qualquer que só parece bytes.
const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
if (header !== "%PDF-") {
  console.error(`FALHOU: cabeçalho do arquivo não é um PDF válido (veio "${header}").`);
  process.exit(1);
}

console.log(`OK: generatePdf via "json-pdf-designer/server" produziu um PDF válido (${bytes.length} bytes).`);
