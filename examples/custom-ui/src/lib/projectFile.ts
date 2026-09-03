import type { Template, Binding } from "json-pdf-designer";
import { migrateTemplate } from "json-pdf-designer";

// Exporta template + vínculos como um JSON pra baixar — "projeto" no
// sentido de "dá pra recarregar depois" (ver parseProjectFile).
export function downloadProjectFile(template: Template, bindings: Binding[]) {
  const payload = { template, bindings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Nome do arquivo NÃO segue o idioma da UI: é o nome do DOCUMENTO que a
  // pessoa vai guardar em disco e reabrir. Trocar o seletor pra inglês não
  // pode fazer o mesmo projeto ser salvo com outro nome.
  a.download = "projeto-relatorio.json";
  a.click();
  URL.revokeObjectURL(url);
}

// A RECUSA DE ARQUIVO DE PROJETO É ERRO **NOSSO**.
//
// O formato `{ template, bindings }` é invenção deste example — o pacote não
// sabe que ele existe, então `describePdfError` devolve `null` pra estas
// falhas (de propósito: ele não inventa título pro que não é dele). Por isso
// elas viram CLASSE aqui, com um `problem` discriminante, e o
// `lib/generationError.ts` as trata no ramo próprio dele.
//
// Duas decisões copiadas do pacote de propósito, porque as duas são boas:
//
//   - o discriminante é um CÓDIGO, não a frase. Antes desta rodada o `reject`
//     levava `new Error(d.projetoJsonMalformado)`, ou seja: frase JÁ traduzida
//     indo pro estado do App. Um banner aberto ficava congelado no idioma de
//     quando a falha aconteceu, e trocar o seletor deixava o resíduo na tela;
//   - o `message` é INGLÊS, e é diagnóstico de desenvolvedor — é ele que sai
//     no `detail` do banner e é o que se cola num relato de bug. O texto de
//     usuário final sai do dicionário, no render.
export type ProjectFileProblem = "missingTemplate" | "badBindings" | "malformed" | "unreadable";

const PROBLEM_DETAIL: Record<ProjectFileProblem, string> = {
  missingTemplate: 'missing "template" with a "schemas" array',
  badBindings: '"bindings" must be an array',
  malformed: "the file is not valid JSON",
  unreadable: "the browser could not read the file",
};

export class ProjectFileError extends Error {
  // Campo declarado e atribuído no corpo, e não `constructor(readonly ...)`:
  // `erasableSyntaxOnly` (tsconfig.app.json) recusa parameter property.
  readonly problem: ProjectFileProblem;

  constructor(problem: ProjectFileProblem) {
    super(`Invalid project file: ${PROBLEM_DETAIL[problem]}.`);
    this.name = "ProjectFileError";
    this.problem = problem;
  }
}

// Lê e valida um arquivo de projeto exportado por downloadProjectFile —
// mesma validação de forma do loadAutosave (ver hooks/useAutosave.ts):
// sem isso, um JSON editado à mão (ou de uma versão antiga incompatível)
// passava direto pro estado tipado e quebrava o Designer mais na frente,
// sem erro claro na hora do import.
//
// Sem `locale`: nada aqui produz frase de tela. O que sai é `ProjectFileError`
// (nosso, com código) ou o erro de migração do PACOTE, cru — e quem escolhe a
// frase é o render (App.tsx -> lib/generationError.ts).
export function parseProjectFile(file: File): Promise<{ template: Template; bindings: Binding[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(reader.result as string);
      } catch {
        reject(new ProjectFileError("malformed"));
        return;
      }

      const candidate = payload as { template?: { schemas?: unknown }; bindings?: unknown };
      if (!candidate?.template || typeof candidate.template !== "object" || !Array.isArray(candidate.template.schemas)) {
        reject(new ProjectFileError("missingTemplate"));
        return;
      }
      if (candidate.bindings !== undefined && !Array.isArray(candidate.bindings)) {
        reject(new ProjectFileError("badBindings"));
        return;
      }

      // Template vindo de FORA (arquivo salvo por outra versão do app)
      // passa pela migração antes de virar estado — é o ponto em que um
      // formato antigo é normalizado. generatePdf também migra por dentro,
      // mas aqui garante que o EDITOR já trabalhe no formato corrente.
      //
      // FORA do try do JSON.parse de propósito: `migrateTemplate` lança as
      // classes do PACOTE (TemplateVersionTooNewError, ...), que têm título e
      // ação localizados por `describePdfError`. Engolir isso num
      // `ProjectFileError("malformed")` diria "JSON inválido" pra um arquivo
      // que na verdade só foi salvo por um build mais novo.
      try {
        resolve({ template: migrateTemplate(candidate.template as Template), bindings: (candidate.bindings as Binding[]) ?? [] });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new ProjectFileError("unreadable"));
    reader.readAsText(file);
  });
}
