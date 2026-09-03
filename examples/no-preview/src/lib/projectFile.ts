import type { Binding, Template } from "json-pdf-designer";
import { migrateTemplate } from "json-pdf-designer";

// Exporta template + vínculos como um JSON pra baixar — "projeto" no
// sentido de "dá pra recarregar depois" (ver parseProjectFile).
export function downloadProjectFile(template: Template, bindings: Binding[]) {
  const payload = { template, bindings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Nome do arquivo BAIXADO: é dado que sai do app, não rótulo de interface —
  // fica igual nos dois idiomas, como "relatorio.pdf" (App.tsx).
  a.download = "projeto-relatorio.json";
  a.click();
  URL.revokeObjectURL(url);
}

// Lê e valida um arquivo de projeto exportado por downloadProjectFile —
// mesma validação de forma do loadAutosave (ver hooks/useAutosave.ts):
// sem isso, um JSON editado à mão (ou de uma versão antiga incompatível)
// passava direto pro estado tipado e quebrava o Designer mais na frente,
// sem erro claro na hora do import.
// As quatro recusas são NOSSAS (o pacote não tem conceito de "arquivo de
// projeto"), e cada uma carrega uma CHAVE, nunca a frase.
//
// Guardar a frase aqui foi um bug de verdade: ela era montada no momento da
// rejeição, ficava congelada no idioma daquele instante, e trocar o seletor
// com o banner aberto não retraduzia nada. A chave viaja; o texto sai do
// dicionário no render.
export type ProjectFileProblem = "missingTemplate" | "bindingsNotAList" | "malformed" | "unreadable";

export class ProjectFileError extends Error {
  // Campo declarado e atribuído à mão, e não `constructor(readonly problem)`:
  // o tsconfig destes examples liga `erasableSyntaxOnly`, que proíbe
  // parameter property (ela EMITE código, então não é sintaxe apagável). O
  // pacote usa a forma curta porque não liga essa flag.
  readonly problem: ProjectFileProblem;

  constructor(problem: ProjectFileProblem) {
    // `message` em inglês, como todo `throw` do pacote: é diagnóstico de log,
    // não texto de tela. Quem mostra pro usuário é o describeGenerationError,
    // que lê `problem` e pega a frase traduzida.
    super(`Invalid project file: ${problem}`);
    this.name = "ProjectFileError";
    this.problem = problem;
  }
}

export function parseProjectFile(file: File): Promise<{ template: Template; bindings: Binding[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string);
        if (!payload?.template || typeof payload.template !== "object" || !Array.isArray(payload.template.schemas)) {
          reject(new ProjectFileError("missingTemplate"));
          return;
        }
        if (payload.bindings !== undefined && !Array.isArray(payload.bindings)) {
          reject(new ProjectFileError("bindingsNotAList"));
          return;
        }
        // Template vindo de FORA (arquivo salvo por outra versão do app)
        // passa pela migração antes de virar estado — é o ponto em que um
        // formato antigo é normalizado. generatePdf também migra por dentro,
        // mas aqui garante que o EDITOR já trabalhe no formato corrente.
        resolve({ template: migrateTemplate(payload.template), bindings: payload.bindings ?? [] });
      } catch {
        reject(new ProjectFileError("malformed"));
      }
    };
    reader.onerror = () => reject(new ProjectFileError("unreadable"));
    reader.readAsText(file);
  });
}
