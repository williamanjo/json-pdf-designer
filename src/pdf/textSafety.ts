import type { PDFFont } from "pdf-lib";

// Duas coisas separam "o dado tem um caractere estranho" de "não sai PDF
// nenhum". Este arquivo é as duas.
//
// O gatilho é o DADO, não o template: quem monta o relatório não controla o
// que vem no JSON. Antes disto, um `\n` no nome de um cliente — vindo de um
// textarea, de um endereço com quebra, de um import de CSV — derrubava o
// documento inteiro com `WinAnsi cannot encode "\n"`.

// Caracteres de CONTROLE (C0, DEL e C1). Não têm glifo em fonte NENHUMA, nem
// numa fonte Unicode completa passada em `fontBytes` — então trocar por espaço
// não é perda de conteúdo, é a única renderização possível.
//
// Um campo deste formato é de uma linha só por construção (não há quebra
// automática; o que não cabe é truncado, ver truncateToWidth), então `\n` e
// `\t` viram espaço em vez de tentar virar layout.
//
// Faixas cobertas: C0 (U+0000..U+001F — inclui tab, LF e CR), DEL
// (U+007F) e C1 (U+0080..U+009F). Escritas com escape de propósito: um
// literal com o caractere de verdade dentro é ilegível e fácil de estragar
// num diff.
// Intencional: casar caractere de controle É o objetivo, e já está escrito
// com escape Unicode (que é o que o lint sugere como alternativa).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

// Prepara um valor vindo do dado pra ser medido/desenhado. Chamado por TODO
// caminho que toca `drawText`/`widthOfTextAtSize` — texto, célula de tabela,
// KPI e rótulo de gráfico.
export function sanitizeText(text: string): string {
  if (!text) return text;
  return text.replace(CONTROL_CHARS, " ");
}

// O primeiro caractere de `text` que a fonte não sabe escrever, ou null.
//
// Descobre testando caractere por caractere em vez de ler a mensagem de erro
// do pdf-lib: casar mensagem de biblioteca de terceiro quebra em silêncio na
// próxima versão dela. Só roda no caminho de ERRO, então o custo não importa.
function firstUnencodableChar(text: string, font: PDFFont, size: number): string | null {
  // Itera por code point (não por unidade UTF-16), pra um emoji fora do BMP
  // ser reportado como UM caractere e não como dois surrogates.
  for (const char of text) {
    try {
      font.widthOfTextAtSize(char, size);
    } catch {
      return char;
    }
  }
  return null;
}

function codePointLabel(char: string): string {
  const cp = char.codePointAt(0) ?? 0;
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

// Erro de glifo ausente com contexto suficiente pra agir: qual campo, qual
// caractere, e o que fazer.
//
// A alternativa seria descartar o caractere e seguir. Não fazemos: um relatório
// é um documento que alguém assina, e sumir com um caractere do conteúdo em
// silêncio é pior que falhar. Caractere de CONTROLE é outra história (não tem
// glifo em fonte nenhuma) — esse o sanitizeText acima já resolve.
export class UnsupportedGlyphError extends Error {
  constructor(
    readonly field: string,
    readonly char: string,
    readonly text: string
  ) {
    super(
      `Campo "${field}": o caractere ${JSON.stringify(char)} (${codePointLabel(char)}) não existe na fonte usada. ` +
        `A fonte padrão (Helvetica/WinAnsi) cobre acentuação latina, mas não emoji/CJK/árabe — ` +
        `passe \`fontBytes\` com uma fonte que cubra esse caractere em generatePdf(..., { fontBytes }), ` +
        `ou remova o caractere do dado.`
    );
    this.name = "UnsupportedGlyphError";
  }
}

// Roda `draw` e, se o pdf-lib recusar por causa de um caractere, troca o erro
// cru ("WinAnsi cannot encode …", que não diz onde) por um que nomeia o campo.
//
// `texts` é uma FUNÇÃO de propósito: ela só é chamada no caminho de erro, então
// pode custar caro (resolver os rótulos de um gráfico, achatar as linhas de uma
// tabela) sem pesar na geração normal.
export function withGlyphContext<T>(
  field: string,
  texts: () => (string | undefined)[],
  font: PDFFont,
  size: number,
  draw: () => T
): T {
  try {
    return draw();
  } catch (err) {
    // `size` NaN faria a medição falhar pra TODO caractere, e o primeiro seria
    // acusado por engano — o problema aí é o tamanho, não o texto.
    const safeSize = finiteOr(size, 10);
    for (const text of texts()) {
      if (!text) continue;
      const char = firstUnencodableChar(text, font, safeSize);
      if (char !== null) throw new UnsupportedGlyphError(field, char, text);
    }
    // Nenhum dos textos conhecidos é o culpado — o erro é outro, e mascará-lo
    // como problema de glifo seria pior que repassar.
    throw err;
  }
}

// Número que o pdf-lib aceita. NaN/Infinity chegam de template montado por
// código (`width: Number(input)`) e viram um TypeError opaco lá dentro
// ("`size` must be of type `number`, but was actually of type `NaN`"), com
// zero pista de qual campo. Aqui cai no default, que é o comportamento certo
// pra uma medida: um tamanho de fonte perdido não pode custar o documento.
export function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
