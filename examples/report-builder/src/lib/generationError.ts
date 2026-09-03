import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfProblem } from "json-pdf-designer";
import { FontLoadError } from "./font";
import { t, type AppDict } from "../i18n";
import { ProjectFileError, type ProjectFileReason } from "./projectFile";

// Tradução de uma falha de `generatePdf` (ou de carregar um projeto) numa
// mensagem que diz o que FAZER.
//
// Quem classifica é o PACOTE: `describePdfError(err, dictFor(locale))` recebe
// o erro cru e devolve `{ code, blame, title, action?, field?, detail }` já
// localizado — ou `null` se o erro não é dele. Antes este arquivo casava
// REGEX na mensagem (`/tamanho inválido/`) pra descobrir o que tinha
// acontecido; a mensagem do pacote é inglês fixo e mudou de frase, as regexes
// pararam de casar, e TODA falha virou "erro inesperado" em silêncio. É o
// motivo pelo qual `code` existe: string literal, estável, com o TypeScript
// cobrando exaustividade. Zero regex aqui, de propósito.
//
// `blame` também vem do pacote — não é derivado aqui. É o que muda o tom da
// UI (ver components/GenerationErrorBanner.tsx) e, num backend, o status HTTP:
// `data`/`template` são 4xx, `config` é erro de instalação, `package` é 500.
//
// O que continua NOSSO: erro de arquivo de projeto (lib/projectFile.ts), JSON
// inválido de fonte de dados (lib/sources.ts) e o asset de fonte deste example
// (lib/font.ts). O pacote não sabe nada disso, devolve `null`, e caem no ramo
// de baixo com o dicionário da casca (`src/i18n.ts`).
//
// Duas camadas de idioma, como antes:
//   - `title`/`action` são a cópia que a pessoa lê e faz — localizadas (pelo
//     dicionário do PACOTE quando o erro é dele, pelo da CASCA quando é nosso);
//   - `detail` é a mensagem CRUA do erro, e não passa por dicionário nenhum —
//     é a camada técnica, e o pacote a lança sempre em inglês de propósito.

// Nossos códigos entram na mesma união dos do pacote: assim quem renderiza
// classifica tudo por `code`, sem ter que saber de onde o erro veio.
export type AppProblemCode = "appFontLoad" | "appProjectFile" | "appUnknown";

export type GenerationProblem = Omit<PdfProblem, "code"> & {
  code: PdfProblem["code"] | AppProblemCode;
};

// Tabela em vez de `switch`: `Record` sobre a união obriga as três razões a
// existirem, então uma razão nova em lib/projectFile.ts para de compilar aqui.
const PROJECT_COPY: Record<ProjectFileReason, { title: (tx: AppDict) => string; action: (tx: AppDict) => string }> = {
  shape: { title: (tx) => tx.projectShapeTitle, action: (tx) => tx.projectShapeAction },
  malformed: { title: (tx) => tx.projectMalformedTitle, action: (tx) => tx.projectMalformedAction },
  unreadable: { title: (tx) => tx.projectUnreadableTitle, action: (tx) => tx.projectUnreadableAction },
};

export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  // `dictFor(locale)` é o MESMO dicionário que alimenta o `<I18nProvider>` do
  // editor — um `locale` no estado, uma tradução. E como isto roda no render
  // (App.tsx guarda o erro cru), trocar o idioma com o banner aberto
  // retraduz o que está na tela.
  const problem = describePdfError(err, dictFor(locale));
  if (problem) return withAppCopy(problem, locale);

  const tx = t(locale);
  const detail = err instanceof Error ? err.message : String(err);

  // Asset de fonte deste example — nosso, então a frase é nossa.
  if (err instanceof FontLoadError) {
    return { code: "appFontLoad", blame: "config", title: tx.genFontTitle, action: tx.genFontAction, detail };
  }

  // Arquivo de projeto — conceito deste app, o pacote não sabe que existe. A
  // classe carrega `reason` justamente pra esta classificação não precisar ler
  // a mensagem.
  if (err instanceof ProjectFileError) {
    const copy = PROJECT_COPY[err.reason];
    return {
      code: "appProjectFile",
      // Forma quebrada é problema do TEMPLATE que veio no arquivo; ler ou
      // parsear é problema do arquivo que a pessoa escolheu. Nenhum dos dois
      // é `package`, que era onde os quatro caíam antes.
      blame: err.reason === "shape" ? "template" : "data",
      title: copy.title(tx),
      action: copy.action(tx),
      detail,
    };
  }

  // Sobra: algo de fora do pacote e de fora daqui (um TypeError do pdf-lib,
  // falha de rede). `blame: "package"` deixa o banner no tom cinza de "não é
  // culpa sua, reporte" — agora só pra quem merece esse tom.
  return { code: "appUnknown", blame: "package", title: tx.genUnknownTitle, action: tx.genUnknownAction, detail };
}

// Onde a cópia deste example sobrescreve a do pacote. Só ramo com MOTIVO —
// duplicar título/ação que o pacote já entrega localizado é criar duas frases
// pra mesma falha, prontas pra dessincronizar na próxima tradução.
function withAppCopy(problem: PdfProblem, locale: Locale): GenerationProblem {
  const tx = t(locale);

  // `switch` no `code` (não regex na frase): literal, e o TypeScript avisa se
  // um code deixar de existir.
  switch (problem.code) {
    // O pacote manda "corrija a expressão no template" — correto, mas ele não
    // sabe que ESTE app tem um painel que lista cada expressão quebrada e onde
    // ela está. O nome do painel sai do mesmo dicionário que o painel usa pro
    // título dele, então a mensagem nunca aponta pra um painel com outro nome.
    // O `title` continua vindo do pacote.
    case "expression":
      return { ...problem, action: tx.genExpressionAction(tx.problemsTitle) };
    default:
      return problem;
  }
}
