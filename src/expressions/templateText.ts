import { en, type Dict } from "../i18n/en";

// O texto de um campo é um TEMPLATE: texto literal com zero ou mais `{...}`
// no meio (`FAT-{fatura}`). Este módulo é o que o editor precisa saber sobre
// as CHAVES em si — coisa que o parser de expressão não vê, porque ele só
// recebe o conteúdo de dentro delas.
//
// Puro e testado por necessidade: o projeto não tem @testing-library/react
// (ver o topo de test/i18n/withInlineCode.test.tsx), então lógica de caret e
// de varredura tem de morar fora do componente pra existir teste.

export type TokenSpan = {
  // Índice do primeiro caractere DENTRO das chaves.
  start: number;
  // Índice do `}` que fecha (ou o fim do trecho, quando não há).
  end: number;
  inner: string;
};

// O `{...}` que contém o caret, ou null se o caret está no texto literal.
//
// Serve a duas coisas no editor: sugerir função só dentro das chaves (fora
// delas é texto solto, e uma lista de funções ali só estorva), e saber se o
// clique num campo da lista insere `total` ou `{total}`.
export function tokenAtCaret(template: string, caret: number): TokenSpan | null {
  // Última `{` antes do caret sem `}` no meio = o caret está dentro dela.
  let open = -1;
  for (let i = 0; i < caret; i++) {
    if (template[i] === "{") open = i;
    else if (template[i] === "}") open = -1;
  }
  if (open === -1) return null;

  // O token termina no `}` seguinte — ou numa `{` nova, quando o autor
  // esqueceu de fechar: aí o trecho vai só até ali, em vez de engolir o
  // token de baixo.
  let close = template.indexOf("}", caret);
  if (close === -1) close = template.length;
  const nextOpen = template.indexOf("{", caret);
  const end = nextOpen !== -1 && nextOpen < close ? nextOpen : close;
  return { start: open + 1, end, inner: template.slice(open + 1, end) };
}

// Chave desbalanceada, ou null se está tudo fechado.
//
// Existe porque nada mais acusa isso: o resolvedor de template casa
// `/\{([^{}]+)\}/g`, então uma `{` sem fechar simplesmente não casa e o
// trecho sai como TEXTO LITERAL no PDF — `{CURRENCY(total` impresso na cara.
// Não é erro de sintaxe de expressão (o parser nunca vê esse trecho) nem
// falha de geração; era só um campo saindo errado em silêncio.
export function braceError(template: string, t: Dict = en): string | null {
  let open = -1;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch === "{") {
      // `{a {b}` — a de fora nunca fecha, e o resolvedor casa só `{b}`.
      if (open !== -1) return t.expressionErrors.braceNested(i);
      open = i;
    } else if (ch === "}") {
      if (open === -1) return t.expressionErrors.braceUnexpected(i);
      open = -1;
    }
  }
  return open !== -1 ? t.expressionErrors.braceUnclosed(open) : null;
}
