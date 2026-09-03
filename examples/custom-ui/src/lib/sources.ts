import type { JsonSource } from "../components/DataSourcePanel";

// Por que CÓDIGO e não frase: o erro de uma fonte fica guardado em estado
// (App.tsx::errorsById) até o próximo resync/gerar. Se guardássemos a frase
// já traduzida, trocar o idioma deixaria a mensagem antiga na tela, em
// português, embaixo de uma interface em inglês. Guardando o código, quem
// traduz é o render (DataSourcePanel) e a troca é instantânea.
export type SourceErrorCode = "invalidJson" | "notAnObject";

// Junta N fontes JSON num objeto só, nível superior — em caso de chave
// repetida, a fonte mais pra baixo na lista vence. Erro de uma fonte
// (JSON inválido, ou não é objeto) não impede as outras de entrar na
// mescla; só fica de fora e aparece marcada.
export function mergeSources(sources: JsonSource[]): {
  data: Record<string, unknown>;
  errorsById: Record<string, SourceErrorCode>;
} {
  const data: Record<string, unknown> = {};
  const errorsById: Record<string, SourceErrorCode> = {};
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      errorsById[source.id] = "invalidJson";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "notAnObject";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
