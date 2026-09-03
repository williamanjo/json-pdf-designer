import { describePdfError, dictFor } from "json-pdf-designer/server";
import type { Locale, PdfErrorBlame, PdfProblem, PdfProblemCode } from "json-pdf-designer/server";
import { FontAssetError } from "./font";
import { ProjectFileError } from "./projectFile";
import { shellDict } from "../i18n";

// CLASSIFICAÇÃO de uma falha de geração — de que erro se trata, de quem é a
// culpa, e que texto a pessoa lê.
//
// A divisão é a que o pacote passou a oferecer na 3.0.0:
//
//   - Erro DELE: `describePdfError(err, dictFor(locale))` devolve
//     `{ code, blame, title, action?, field?, detail }` com título e ação JÁ
//     LOCALIZADOS. São 18 códigos + `expression`, e a função é exaustiva —
//     não existe mais "cai no genérico porque não reconheci".
//   - Erro NOSSO: `describePdfError` devolve `null` (arquivo de projeto
//     inválido, asset de fonte que não carregou). Aí, e só aí, o texto sai do
//     dicionário da casca (`src/i18n.ts`, `failures.*`).
//
// O QUE ESTAVA ERRADO ANTES: os erros que o pacote lançava como `Error` comum
// eram reconhecidos por REGEX na frase em português (`/tamanho inválido/`,
// `/Paginação travada/`). Na 3.0.0 `error.message` virou inglês, e cada falha
// virou classe com `code` — então toda regex dessas passou a não casar nunca,
// em silêncio, e QUALQUER falha caía em "erro inesperado". Zero regex sobrou
// aqui, e não deve voltar: casar texto de mensagem é acoplar a UI a uma frase
// que o pacote pode reescrever a qualquer momento sem quebrar tipo nenhum.
//
// `blame` também não é mais derivado à mão. Ele vem do pacote (`data` /
// `template` / `config` / `package`) — é a mesma informação que um backend usa
// pra escolher entre 413, 400 e 500, e ela não devia ter duas versões.

// Códigos que são NOSSOS — o que o pacote não sabe que existe. Ficam ao lado
// dos códigos dele na união abaixo em vez de num campo separado: pra quem
// renderiza, "que falha foi" é uma pergunta só.
export type ShellFailureCode = "projectFile" | "fontAsset" | "unknown";

// Mesma forma do `PdfProblem` do pacote, com o `code` alargado. Reusar a forma
// dele (inclusive `blame: PdfErrorBlame`) é o que deixa o banner tratar erro
// nosso e erro dele pelo mesmo caminho de render.
export type GenerationProblem = Omit<PdfProblem, "code"> & {
  code: PdfProblemCode | ShellFailureCode;
};

// Chamada NA RENDERIZAÇÃO, nunca no `catch`: o estado guarda o erro CRU, e o
// texto é resolvido aqui com o `locale` do momento. É isso que faz trocar o
// idioma com o banner aberto retraduzir o banner, sem regerar o PDF.
export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  // Título e ação já no idioma pedido — o dicionário do pacote é o mesmo
  // `dictFor(locale)` que este example já usa pros rótulos dele.
  const tt = shellDict(locale);
  const problem = describePdfError(err, dictFor(locale));

  if (problem) {
    // ÚNICO texto de falha do pacote que este example reescreve, e não é
    // questão de tom: a ação dele é "corrija a expressão — <mensagem>", e
    // aqui existe um painel ("Problemas do template") que já lista TODAS as
    // expressões quebradas com o lugar de cada uma. Mandar a pessoa pra lá é
    // melhor que repetir uma mensagem só. `code`, `blame` e `title`
    // continuam vindo do pacote.
    if (problem.code === "expression") {
      return { ...problem, action: tt.failures.expressionAction };
    }
    return problem;
  }

  // Daqui pra baixo: o erro NÃO é do pacote. Ele devolveu `null` de propósito
  // em vez de inventar um título pra uma falha que não conhece.
  const detail = err instanceof Error ? err.message : String(err);

  // Arquivo de projeto (o JSON que este example salva/carrega) — conceito
  // deste app, o pacote nunca ouviu falar. A classe carrega o `reason`
  // justamente pra esta classificação não precisar ler a mensagem.
  if (err instanceof ProjectFileError) {
    const copy = tt.failures.projectFile[err.reason];
    return {
      code: "projectFile",
      // Forma quebrada é problema do TEMPLATE que veio no arquivo; ler/parsear
      // é problema do arquivo que a pessoa escolheu.
      blame: err.reason === "shape" ? "template" : "data",
      title: copy.title,
      action: copy.action,
      detail,
    };
  }

  // A fonte deste example é um asset embutido (src/assets/inter-regular.ttf).
  // Falhar em buscá-la é problema de build/instalação — nada a ver com os
  // erros de fonte DO PACOTE, que são todos sobre .woff2 e `fontBytes`.
  if (err instanceof FontAssetError) {
    return {
      code: "fontAsset",
      blame: "config",
      title: tt.failures.fontAsset.title,
      action: tt.failures.fontAsset.action,
      detail,
    };
  }

  // Genérico honesto: um TypeError de dentro do pdf-lib, uma falha de rede, o
  // que for. Antes desta rodada TODA falha classificada chegava aqui.
  return {
    code: "unknown",
    blame: "package" satisfies PdfErrorBlame,
    title: tt.failures.unknown.title,
    action: tt.failures.unknown.action,
    detail,
  };
}
