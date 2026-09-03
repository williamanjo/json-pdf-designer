import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfErrorBlame, PdfProblemCode } from "json-pdf-designer";
import type { Ui } from "../i18n";
import { t } from "../i18n";
import { ProjectFileError, type ProjectFileProblem } from "./projectFile";

// Tradução de um erro de `generatePdf` numa mensagem que diz o que FAZER.
//
// QUEM CLASSIFICA É O PACOTE. `describePdfError(err, dictFor(locale))` recebe
// o erro cru e devolve `{ code, blame, title, action?, field?, detail }` já
// LOCALIZADO — ou `null` quando o erro não é dele. Este arquivo não olha
// `err.message`: nem por `instanceof` classe por classe (que dava um `if` por
// erro, e silêncio quando o pacote ganhava um novo), nem — muito menos — por
// regex na frase. A mensagem lançada é inglês de DESENVOLVEDOR (log, stack,
// Sentry), e casar texto nela é exatamente o bug que este arquivo tinha: as
// regexes eram em português, o pacote passou a lançar em inglês, e TODA falha
// classificada caiu no ramo genérico sem nada avisar.
//
// O que sobrou aqui, então, é só o que o pacote NÃO pode saber:
//
//   1. `ProjectFileError` — arquivo de projeto deste example (lib/projectFile.ts).
//      O pacote não tem conceito de "arquivo de projeto"; `describePdfError`
//      devolve `null` pra ele. É NOSSO erro, com texto nosso.
//   2. Um ramo por TOM/ESTRUTURA: ver `invalidPageSize` abaixo.
//   3. O genérico honesto pro que não é de ninguém (falha de `fetch` da fonte,
//      TypeError de dentro do pdf-lib).
//
// E continua sendo chamado no RENDER do App, não no `catch`: o estado guarda o
// erro CRU e a frase é montada a cada render — trocar de idioma com o banner
// aberto retraduz o banner.

export type GenerationProblem = {
  // O discriminante. `PdfProblemCode` são os 18 codes do pacote + "expression";
  // os dois de fora são nossos. Serve pra ramo próprio na UI, telemetria ou
  // status HTTP num backend — sem casar texto.
  code: PdfProblemCode | "projectFile" | "desconhecido";
  // Culpa de quem: muda o tom da UI e, num servidor, o status HTTP. Vinha de
  // um enum NOSSO em português; agora é o `blame` do pacote
  // ("data" | "template" | "config" | "package"), porque derivar isso à mão
  // era mais uma cópia pra dessincronizar.
  blame: PdfErrorBlame;
  // Título curto — o que aconteceu, no idioma pedido.
  title: string;
  // O que a pessoa faz agora. OPCIONAL porque o pacote omite quando não há
  // ação útil (bug dele: a "ação" é reportar, e o título já diz).
  action?: string;
  // Campo do template envolvido, quando o erro sabe qual.
  field?: string;
  // Mensagem original, pra quem quiser o detalhe cru. Do pacote ela vem em
  // INGLÊS de propósito (é diagnóstico de desenvolvedor, não UI) e mostrar
  // traduzido seria mentir sobre o que está no log. Quando a falha é NOSSA
  // (ProjectFileError), o detalhe sai do dicionário.
  detail: string;
};

function projectFileDetail(ui: Ui, problem: ProjectFileProblem): string {
  switch (problem) {
    case "semTemplate":
      return ui.projetoSemTemplate;
    case "bindingsNaoLista":
      return ui.projetoBindingsNaoLista;
    case "jsonMalformado":
      return ui.projetoJsonMalformado;
    case "naoLeu":
      return ui.projetoNaoLeu;
  }
}

export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  const ui = t(locale);

  // Recusa de arquivo de projeto (lib/projectFile.ts). Vem primeiro porque é
  // NOSSO erro, com código próprio — e é o único caso em que até o `detail`
  // sai do dicionário, já que a frase é nossa e não do pacote.
  if (err instanceof ProjectFileError) {
    return {
      code: "projectFile",
      blame: "data",
      title: ui.projetoTitulo,
      action: ui.projetoAcao,
      detail: projectFileDetail(ui, err.problem),
    };
  }

  // Erro do pacote: ele classifica E localiza. Zero `instanceof` por classe,
  // zero regex. `dictFor(locale)` é o MESMO dicionário que o `<I18nProvider>`
  // entrega ao editor (App.tsx passa o mesmo `locale`), então o banner nunca
  // fala num idioma e o editor no outro.
  const problem = describePdfError(err, dictFor(locale));
  if (problem) {
    // O ÚNICO ramo próprio, e não é questão de gosto: o `action` que o pacote
    // dá pra `invalidPageSize` manda "definir largura e altura na ABA
    // 'Página'" — e o assunto deste example é justamente montar o editor SEM
    // barra de abas. Aqui a peça `<DesignerPageSettings>` é um cartão na
    // coluna da direita, então a frase do pacote mandaria procurar uma coisa
    // que não existe na tela. Título, `code`, `blame` e `field` continuam
    // vindo dele; só esta orientação de navegação é nossa.
    if (problem.code === "invalidPageSize") {
      return { ...problem, action: ui.erroTamanhoAcao };
    }
    return problem;
  }

  // Não é nosso nem do pacote: `fetch` da fonte que falhou, TypeError de
  // dentro do pdf-lib, erro de rede. Genérico honesto — inventar título pra
  // uma falha que não conhecemos é pior que admitir que não sabemos.
  return {
    code: "desconhecido",
    blame: "package",
    title: ui.erroGenericoTitulo,
    action: ui.erroGenericoAcao,
    detail: err instanceof Error ? err.message : String(err),
  };
}
