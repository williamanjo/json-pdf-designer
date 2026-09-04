import { en, type Dict } from "../i18n/locales/en";
import { ExpressionError } from "./errors";
import { evaluate, evaluateToString, isTruthy } from "./engine/evaluate";
import { parse } from "./engine/parse";

// Camada tolerante em cima do parser estrito.
//
// O parser estoura em expressão mal-formada, e isso é bom: é o que permite o
// editor APONTAR o problema (ver fieldWarnings.ts) em vez de deixar um campo
// misteriosamente em branco. Mas estourar na hora de GERAR seria pior que o
// comportamento anterior: antes, um `{CONCAT(a,)}` esquecido num campo
// deixava aquele campo vazio; se o parse estourasse aqui, o mesmo erro
// derrubaria o PDF INTEIRO — nenhuma página sai. Trocar "um campo em branco"
// por "nenhum relatório" não é melhoria.
//
// Então: geração é tolerante (campo vazio), e o erro aparece no editor, antes
// de gerar. Quem quiser a versão estrita programaticamente usa `parse`
// direto, ou `expressionError` abaixo.

// Todo `{...}` de um template. `[^{}]+` = um token não contém chaves.
const TOKEN_RE = /\{([^{}]+)\}/g;

// Resolve um token, devolvendo "" quando ele é sintaticamente inválido.
export function resolveTokenLenient(token: string, data: unknown): string {
  try {
    return evaluateToString(parse(token), data);
  } catch (err) {
    // Só erro de TEMPLATE é engolido (sintaxe, profundidade). Qualquer outro
    // é bug do motor e tem de subir — engolir tudo esconderia regressão.
    if (err instanceof ExpressionError) return "";
    throw err;
  }
}

// Resolve um template inteiro (texto com zero ou mais `{...}`), token a token.
// Um token inválido vira "" sem afetar os outros — é o raio de alcance que o
// motor anterior tinha.
export function renderTemplateLenient(template: string, data: unknown): string {
  return template.replace(TOKEN_RE, (_, inner) => resolveTokenLenient(inner, data));
}

// Verdade/falsidade de uma expressão de condição (o `visibleWhen` de um
// campo). Condição inválida conta como VISÍVEL, não invisível: um erro de
// digitação não pode fazer um campo desaparecer do relatório em silêncio — o
// editor avisa, e o campo continua aparecendo até alguém consertar.
export function evaluateConditionLenient(condition: string, data: unknown, fallback = true): boolean {
  try {
    return isTruthy(evaluate(parse(condition), data));
  } catch (err) {
    if (err instanceof ExpressionError) return fallback;
    throw err;
  }
}

// A mensagem de erro de sintaxe de UMA expressão, ou null se está válida.
// Usada pelo aviso de campo no editor.
//
// `t` decide o idioma da mensagem; sem ele, inglês (a convenção de mensagem de
// biblioteca, e o que um backend loga). Quem está dentro do React passa o
// `useT()`; fora dele, `dictFor(locale)`.
export function expressionError(source: string, t: Dict = en): string | null {
  try {
    parse(source);
    return null;
  } catch (err) {
    if (err instanceof ExpressionError) return err.localize(t);
    throw err;
  }
}

// Os tokens `{...}` sintaticamente inválidos de um template, com a mensagem de
// cada um. Vazio = template válido.
export function templateExpressionErrors(template: string, t: Dict = en): { token: string; message: string }[] {
  const errors: { token: string; message: string }[] = [];
  for (const match of template.matchAll(TOKEN_RE)) {
    const message = expressionError(match[1], t);
    if (message) errors.push({ token: match[0], message });
  }
  return errors;
}
