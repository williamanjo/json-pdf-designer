// A SUPERFÍCIE DE ERRO, testada no pacote INSTALADO.
//
// Companheiro do generate-check.mjs, e existe pelo mesmo motivo: `npm test`
// roda contra `src/`, e há coisa que só quebra no que é publicado de verdade
// — `exports` errado, arquivo fora do `files`, um import que arrasta React
// pro entry `/server`.
//
// Este arquivo cobre o que o generate-check não cobre: a 3.0.0 trocou
// mensagem de erro por CLASSE com `code`, e prometeu que um backend
// classifica e localiza a falha sem React. Isso é contrato público, e nada
// verificava contra o tarball.
//
// Roda em Node puro, sem React instalado. Se algum dia `src/errors.ts` passar
// a importar algo do lado React, o `import` abaixo quebra aqui — que é o
// lugar certo pra descobrir.
import {
  generatePdf,
  describePdfError,
  dictFor,
  isPdfError,
  InvalidPageSizeError,
  PdfGenerationError,
  PDF_ERROR_CODES,
} from "json-pdf-designer/server";

const falhas = [];
const ok = (cond, msg) => (cond ? console.log("ok  " + msg) : falhas.push(msg));

ok(PDF_ERROR_CODES.length === 18, `PDF_ERROR_CODES tem 18 códigos (tem ${PDF_ERROR_CODES.length})`);

// --- a classe chega, com os dados estruturados ------------------------------
let err;
try {
  await generatePdf({ page: { width: 0, height: -3 }, schemas: [] }, {}, []);
} catch (e) {
  err = e;
}
ok(err !== undefined, "generatePdf lançou");
ok(err instanceof InvalidPageSizeError, `é InvalidPageSizeError (é ${err?.constructor?.name})`);
ok(err instanceof PdfGenerationError, "herda da base abstrata");
ok(isPdfError(err), "isPdfError reconhece");
ok(err?.code === "invalidPageSize", `code = invalidPageSize (é ${err?.code})`);
ok(err?.blame === "template", `blame = template (é ${err?.blame})`);
ok(typeof err?.pageId === "string", "o campo estruturado pageId chegou");

// `message` é diagnóstico de desenvolvedor, em inglês. Inglês NÃO é o mesmo
// que ASCII (a frase usa travessão), então o critério é ausência de
// acentuação portuguesa — que é o que a 2.1.1 emitia.
ok(!/[áàâãéêíóôõúüç]/i.test(err?.message ?? ""), "message sem acentuação pt");
ok(/expected two finite numbers/.test(err?.message ?? ""), "message traz a frase em inglês");

// --- `page` AUSENTE --------------------------------------------------------
// Antes desta release isto estourava `TypeError: Cannot read properties of
// undefined (reading 'height')` dentro do LAYOUT, porque o guard de tamanho
// morava no render, que roda depois. O efeito era pior que a mensagem: um
// TypeError não é erro nosso, `describePdfError` devolve `null`, e o
// consumidor classificava como `blame: "package"` — bug do pacote — uma
// falha que era do template dele.
let semPage;
try {
  await generatePdf({ schemas: [] }, {}, []);
} catch (e) {
  semPage = e;
}
ok(semPage instanceof InvalidPageSizeError, `page ausente → InvalidPageSizeError (deu ${semPage?.constructor?.name})`);
ok(describePdfError(semPage, dictFor("en")) !== null, "page ausente não cai no ramo `null`");
ok(describePdfError(semPage, dictFor("en"))?.blame === "template", "e o blame é template, não package");

// --- localização: mesmo erro, dois idiomas ---------------------------------
const en = describePdfError(err, dictFor("en"));
const pt = describePdfError(err, dictFor("pt-BR"));
ok(en !== null && pt !== null, "describePdfError devolveu problema nos dois idiomas");
ok(en?.title !== pt?.title, "o title difere entre idiomas");
ok(en?.code === pt?.code && en?.blame === pt?.blame, "code e blame são estáveis entre idiomas");
ok(en?.detail === pt?.detail, "detail é a mensagem crua, igual nos dois");

// Erro que não é nosso: `null` de propósito, em vez de título inventado.
ok(describePdfError(new TypeError("de outro lugar"), dictFor("en")) === null, "erro alheio devolve null");

// --- blame → status HTTP ---------------------------------------------------
// A razão de `blame` existir: um backend não deve tomar esta decisão duas
// vezes, uma no pacote e outra na mão.
const status = { data: 400, template: 422, config: 500, package: 500 };
ok(status[pt?.blame] === 422, `blame ${pt?.blame} mapeia pra 422`);

if (falhas.length > 0) {
  console.error("\nFALHOU:\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("\nOK: a superfície de erro funciona no pacote instalado, sem React.");
