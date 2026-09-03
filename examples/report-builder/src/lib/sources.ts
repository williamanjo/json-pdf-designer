import type { JsonSource } from "../components/DataSourcePanel";

// Junta N fontes JSON num objeto só, nível superior — em caso de chave
// repetida, a fonte mais pra baixo na lista vence. Erro de uma fonte
// (JSON inválido, ou não é objeto) não impede as outras de entrar na
// mescla; só fica de fora e aparece marcada.
//
// Devolve o MOTIVO do erro (um código), não a frase pronta: a frase é
// escolhida na hora de renderizar, em DataSourcePanel. Guardar texto já
// traduzido no estado era o bug — trocar o idioma não recalcula o estado, e a
// mensagem de erro ficava congelada no idioma em que foi gerada.
export type SourceProblem = "invalidJson" | "notObject";

export function mergeSources(sources: JsonSource[]): { data: Record<string, unknown>; errorsById: Record<string, SourceProblem> } {
  const data: Record<string, unknown> = {};
  const errorsById: Record<string, SourceProblem> = {};
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      errorsById[source.id] = "invalidJson";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "notObject";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
