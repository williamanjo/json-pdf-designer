import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfErrorBlame, PdfProblem } from "json-pdf-designer";
import { t, type ShellDict } from "../i18n";
import { ProjectFileError, type ProjectFileProblem } from "./projectFile";

// Tradução de uma falha em algo que diz o que FAZER — e a divisão de trabalho
// entre o pacote e este app.
//
// O PACOTE classifica e localiza o que é DELE. `describePdfError(err, dict)`
// devolve `{ code, blame, title, action?, field?, detail }` já no idioma
// pedido, ou `null` quando o erro não é dele. `code` é string literal (18
// códigos + "expression"), `blame` é "data" | "template" | "config" |
// "package" — e é o `blame` que decide o tom do banner, do mesmo jeito que
// num backend ele decidiria entre 413/400 e 500.
//
// ESTE APP só faz três coisas em cima disso:
//   1. trata os erros que são DELE (ProjectFileError — o pacote não sabe que
//      o formato `{ template, bindings }` existe);
//   2. substitui a AÇÃO de um código onde ele sabe mais que o pacote (a de
//      `expression` aponta pro painel desta casca, que o pacote não conhece);
//   3. preenche a ação quando o pacote não tem uma (os códigos de `blame:
//      "package"` não têm — a ação é reportar, e o link do repo é escolha de
//      quem monta o app).
//
// O QUE SAIU DAQUI, e por que isso era um bug: até esta rodada a
// classificação era `instanceof` em três classes MAIS seis regexes casando a
// frase do erro em português (`/tamanho inválido/`, `/Paginação travada/`...).
// O pacote passou a lançar `message` em inglês, com classe e `code`
// estruturado — então nenhuma daquelas regexes casava mais, e TODA falha
// classificada caía no ramo "erro inesperado", em silêncio. Casar texto de
// mensagem sempre foi frágil; `code` é o contrato que substitui isso.
//
// A função é chamada no RENDER (App.tsx), não no `catch`: o estado guarda o
// erro CRU e a frase é montada a cada render, então trocar de idioma com o
// banner aberto retraduz o banner.

export type GenerationProblem = {
  // Título curto — o que aconteceu.
  title: string;
  // O que a pessoa faz agora. Opcional porque pode não haver ação útil: nos
  // dois códigos de bug do pacote a "ação" é reportar, e o título já diz.
  action?: string;
  // Culpa de quem: muda o tom da UI e, num servidor, o status HTTP. É o
  // `blame` DO PACOTE, não uma derivação nossa — antes este campo era uma
  // união em português ("dado" | "template" | ...) que a gente atribuía à mão
  // em cada ramo, o que é uma segunda fonte de verdade pra divergir da dele.
  blame: PdfErrorBlame;
  // Campo do template envolvido, quando o erro sabe qual.
  field?: string;
  // Mensagem original, pra quem quiser o detalhe cru. NÃO traduzida: é
  // diagnóstico de desenvolvedor (inglês, por convenção de biblioteca) e é o
  // que se cola num relato de bug.
  detail: string;
};

// As quatro recusas de arquivo de projeto (lib/projectFile.ts). O `switch` no
// código — e não na frase — é o que garante que uma recusa nova apareça aqui:
// sem `case`, o TypeScript recusa o retorno.
function projectFileTitle(d: ShellDict, problem: ProjectFileProblem): string {
  switch (problem) {
    case "missingTemplate":
      return d.projectMissingTemplate;
    case "badBindings":
      return d.projectBadBindings;
    case "malformed":
      return d.projectMalformed;
    case "unreadable":
      return d.projectUnreadable;
  }
}

// A AÇÃO — o único lugar onde este example ainda escreve texto pra erro do
// pacote, e só em dois casos, os dois por falta de API e não por gosto.
//
// O `default` é deliberado: código novo no pacote entra com o título E a ação
// dele, já localizados, sem passar por aqui. Trocar isso por um `switch`
// exaustivo obrigaria este arquivo a ter uma frase própria por código — que é
// exatamente a duplicação que a rodada anterior criou e esta desfaz.
function actionFor(problem: PdfProblem, d: ShellDict): string | undefined {
  switch (problem.code) {
    // O pacote diz "corrija a expressão no template — <erro de sintaxe>".
    // Está certo, mas ele não sabe que esta casca tem um painel que já lista
    // cada expressão quebrada e em que página está; mandar a pessoa pra lá é
    // mais útil que mandar procurar. O nome do painel sai do MESMO dicionário
    // que desenha o cabeçalho dele, então nunca aponta pra um painel com
    // outro nome.
    case "expression":
      return d.expressionAction(d.problemsTitle);
    default:
      // `action` ausente = bug do pacote (paginationStalled,
      // templateMigrationMissing): não há o que a pessoa conserte, e o pacote
      // de propósito não chuta um link de repositório. Quem monta o app sabe
      // onde reportar, então a frase é nossa.
      return problem.action ?? (problem.blame === "package" ? d.reportBugAction : undefined);
  }
}

export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  const d = t(locale);

  // Erro NOSSO, primeiro: `describePdfError` devolveria `null` pra ele e a
  // recusa de um arquivo de projeto viraria "erro inesperado" — que é errado
  // duas vezes, porque nem é inesperado nem é do pacote.
  if (err instanceof ProjectFileError) {
    return {
      title: projectFileTitle(d, err.problem),
      action: d.projectAction,
      // A pessoa entregou um arquivo que não serve: o que muda pra dar certo
      // é o arquivo, não o template que está aberto no editor.
      blame: "data",
      detail: err.message,
    };
  }

  // Tudo o que é do pacote: uma chamada, título e ação já no idioma da casca.
  // `dictFor` é o `useT()` que funciona como VALOR — isto roda fora da árvore
  // React (e também é chamado do render, sem provider por perto).
  const problem = describePdfError(err, dictFor(locale));

  if (problem) {
    return {
      title: problem.title,
      action: actionFor(problem, d),
      blame: problem.blame,
      field: problem.field,
      detail: problem.detail,
    };
  }

  // `null` = não é erro do pacote nem nosso. Um `fetch` que falhou ao buscar
  // a fonte (lib/font.ts), uma quota de storage, um TypeError de dentro de
  // uma dependência. Genérico HONESTO: não inventamos título pra falha que
  // não conhecemos, e o detalhe cru fica um clique de distância.
  return {
    title: d.genericTitle,
    action: d.genericAction,
    blame: "package",
    detail: err instanceof Error ? err.message : String(err),
  };
}
