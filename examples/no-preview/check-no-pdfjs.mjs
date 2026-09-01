// Roda depois do `vite build` (ver o script "build" do package.json).
//
// Por que existe: só NÃO declarar o pdfjs-dist aqui não garante nada. O
// `json-pdf-designer` entra como dependência "file:../.." (symlink), e o
// Vite resolve import bare pelo caminho REAL do arquivo — então um import
// de pdf.js que vazasse pro entry principal ainda acharia o pacote no
// node_modules do repo pai (onde ele existe como devDependency) e o build
// passaria numa boa, com ~1MB de pdf.js embutido sem ninguém pedir.
//
// Esta checagem fecha esse buraco olhando o BUNDLE em si: se qualquer
// símbolo público do pdf.js aparecer no JS gerado, a fronteira quebrou.
// O guarda complementar, sobre o código-fonte, é
// test/entryBoundaries.test.ts na raiz do repo.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ASSETS = "dist/assets";

// Símbolos que só existem dentro do pdfjs-dist — nenhum código deste app
// (nem do entry principal do pacote) os menciona, então qualquer
// ocorrência significa que o pdf.js foi empacotado.
const MARKERS = ["GlobalWorkerOptions", "PDFDocumentLoadingTask", "pdf.worker.min.mjs"];

const files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error(`FALHOU: nenhum .js em ${ASSETS}/ — o build não gerou nada pra checar.`);
  process.exit(1);
}

let leaked = false;
for (const file of files) {
  const source = readFileSync(join(ASSETS, file), "utf8");
  for (const marker of MARKERS) {
    if (source.includes(marker)) {
      console.error(`FALHOU: "${marker}" apareceu em ${ASSETS}/${file} — pdf.js vazou pro entry principal.`);
      leaked = true;
    }
  }
}

if (leaked) process.exit(1);
console.log(`OK: ${files.length} bundle(s) sem nenhum vestígio de pdf.js.`);
