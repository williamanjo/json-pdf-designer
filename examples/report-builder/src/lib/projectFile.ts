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
  // Nome do ARQUIVO baixado: não traduz. É o identificador do artefato que o
  // usuário vai reabrir depois — trocar de idioma não pode mudar como o
  // arquivo dele se chama.
  a.download = "projeto-relatorio.json";
  a.click();
  URL.revokeObjectURL(url);
}

// Lê e valida um arquivo de projeto exportado por downloadProjectFile —
// mesma validação de forma do loadAutosave (ver hooks/useAutosave.ts):
// sem isso, um JSON editado à mão (ou de uma versão antiga incompatível)
// passava direto pro estado tipado e quebrava o Designer mais na frente,
// sem erro claro na hora do import.
// POR QUE UMA CLASSE COM CÓDIGO, e não `new Error(t.frase)`.
//
// Esta função ANTES recebia o dicionário e rejeitava com a mensagem já
// traduzida. O argumento era que aquilo virava o `detail` do banner — a camada
// técnica —, e detail congelado no idioma do erro seria aceitável.
//
// O argumento não fechava, por um motivo medido: sem código, a CLASSIFICAÇÃO
// não tinha sinal nenhum. As quatro falhas de arquivo de projeto caíam no ramo
// final de `describeGenerationError` e saíam como `appUnknown` com
// `blame: "package"` — ou seja, o banner dizia "não é culpa sua, reporte" pra
// alguém que só escolheu um JSON torto. O único jeito de distinguir seria
// casar regex na frase, que muda com o idioma: exatamente o anti-padrão que
// esta rodada tirou do resto deste arquivo.
//
// Agora `reason` é o sinal, título e ação saem do dicionário no render, e a
// mensagem volta a ser inglês de diagnóstico — igual às do pacote, que é o
// texto que se cola num issue.
//
// As quatro validações colapsam em TRÊS razões porque as duas primeiras são a
// mesma falha pra quem lê: o arquivo abriu, o JSON era válido, e a forma
// dentro dele está errada.
//
// Campo `readonly` no corpo, e não parameter property: o tsconfig destes
// examples liga `erasableSyntaxOnly`.
export type ProjectFileReason = "shape" | "malformed" | "unreadable";

export class ProjectFileError extends Error {
  readonly reason: ProjectFileReason;

  constructor(reason: ProjectFileReason, detail: string) {
    super(`Invalid project file (${reason}): ${detail}`);
    this.name = "ProjectFileError";
    this.reason = reason;
  }
}

export function parseProjectFile(file: File): Promise<{ template: Template; bindings: Binding[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string);
        if (!payload?.template || typeof payload.template !== "object" || !Array.isArray(payload.template.schemas)) {
          reject(new ProjectFileError("shape", 'missing "template" with "schemas"'));
          return;
        }
        if (payload.bindings !== undefined && !Array.isArray(payload.bindings)) {
          reject(new ProjectFileError("shape", '"bindings" is not a list'));
          return;
        }
        // Template vindo de FORA (arquivo salvo por outra versão do app)
        // passa pela migração antes de virar estado — é o ponto em que um
        // formato antigo é normalizado. generatePdf também migra por dentro,
        // mas aqui garante que o EDITOR já trabalhe no formato corrente.
        resolve({ template: migrateTemplate(payload.template), bindings: payload.bindings ?? [] });
      } catch {
        reject(new ProjectFileError("malformed", "not valid JSON"));
      }
    };
    reader.onerror = () => reject(new ProjectFileError("unreadable", "FileReader failed"));
    reader.readAsText(file);
  });
}
