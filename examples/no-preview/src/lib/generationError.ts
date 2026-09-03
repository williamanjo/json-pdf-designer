import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfErrorBlame, PdfProblemCode } from "json-pdf-designer";
import { t } from "../i18n";
import { FontAssetError } from "./font";
import { ProjectFileError } from "./projectFile";

// Tradução de uma falha de `generatePdf` (ou de carregar um projeto) numa
// mensagem que diz o que FAZER.
//
// QUEM CLASSIFICA É O PACOTE. `describePdfError(err, dictFor(locale))` recebe o
// erro cru e devolve `{ code, blame, title, action?, field?, detail }` já
// localizado — ou `null` quando o erro não é dele. Não há `instanceof` por
// classe aqui, e muito menos regex em `err.message`: `error.message` do pacote
// é inglês fixo (diagnóstico de log), e casá-lo com frase em português foi
// exatamente como a versão anterior deste arquivo passou a jogar TODA falha
// classificada no ramo "erro inesperado" em silêncio.
//
// Num backend é a mesma chamada, e `problem.blame` é o que escolhe entre 413,
// 400 e 500.
//
// O import vem do entry principal (`json-pdf-designer`), não de
// `json-pdf-designer/server`: os dois exportam `describePdfError`, mas este
// app já importa `generatePdf`/`downloadPdf`/`<Designer>` do principal, e
// puxar o mesmo localizador por dois specifiers duplicaria o módulo no bundle.
// Nenhum dos dois entries toca pdf.js — é o que `check-no-pdfjs.mjs` confere
// depois do build.

// O `code` do pacote (18 códigos + "expression") mais os NOSSOS, pra quem
// consome poder tratar um caso à parte sem casar texto. Os três de baixo o
// pacote não conhece: fonte deste example, arquivo de projeto deste example, e
// o "não sei o que é isso" honesto.
export type GenerationProblemCode = PdfProblemCode | "fontAsset" | "projectFile" | "unknown";

export type GenerationProblem = {
  code: GenerationProblemCode;
  // De quem é a culpa: muda o tom da UI (ver GenerationErrorBanner) e, num
  // servidor, o status HTTP. Vem do PACOTE quando o erro é dele — antes este
  // arquivo derivava à mão, com os rótulos em português como chave.
  blame: PdfErrorBlame;
  // O que aconteceu, no idioma pedido.
  title: string;
  // O que a pessoa faz agora. Ausente quando não há ação útil (bug do pacote:
  // a ação é reportar, e o título já diz).
  action?: string;
  // Campo do template envolvido, quando o erro sabe qual.
  field?: string;
  // `err.message` cru — inglês, de propósito. Detalhe técnico, não a frase
  // principal.
  detail: string;
};

// `locale` escolhe o idioma. Nada aqui é guardado em estado: App.tsx guarda o
// erro CRU e chama isto no render, então trocar o idioma com o banner aberto
// retraduz o banner na hora (inclusive o texto que vem do pacote).
export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  const s = t(locale);

  // 1. O que é do pacote, o pacote classifica E localiza. `dictFor(locale)` é
  //    o dicionário dele como VALOR — o mesmo que o `<Designer locale>` usa,
  //    então a mensagem nunca manda procurar uma aba com outro nome.
  const doPacote = describePdfError(err, dictFor(locale));
  if (doPacote) return doPacote;

  // 2. Daqui pra baixo é NOSSO, e o pacote devolveu `null` porque não sabe
  //    nada disso.

  // A fonte é deste example (src/assets/inter-regular.ttf, ver lib/font.ts) —
  // só este app sabe onde ela mora e o que fazer quando ela não carrega.
  if (err instanceof FontAssetError) {
    return {
      code: "fontAsset",
      blame: "config",
      title: s.genError.fontTitle,
      action: s.genError.fontAction,
      detail: err.message,
    };
  }

  // Arquivo de projeto inválido. O `problem` é a CHAVE do caso (não a frase),
  // então a mensagem é escrita aqui, no render, e acompanha o idioma.
  if (err instanceof ProjectFileError) {
    return {
      code: "projectFile",
      // O arquivo de projeto É template + vínculos: a culpa é do conteúdo do
      // arquivo, não do pacote. Sem isso ele cairia no tom neutro de "bug
      // nosso", que é o oposto do que aconteceu.
      blame: "template",
      title: s.project[err.problem],
      action: s.project.action,
      detail: err.message,
    };
  }

  // 3. Genérico HONESTO: um erro que não é do pacote nem nosso (TypeError de
  //    dentro do pdf-lib, falha de rede, o que for). Este é o único caso em
  //    que "erro inesperado" é verdade — e ele mostra o detalhe cru, porque é
  //    tudo o que se sabe.
  return {
    code: "unknown",
    blame: "package",
    title: s.genError.genericTitle,
    action: s.genError.genericAction,
    detail: err instanceof Error ? err.message : String(err),
  };
}
