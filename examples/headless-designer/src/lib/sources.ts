// Uma fonte de dados JSON. O tipo mora AQUI (e não no painel que o edita)
// porque quem depende dele é o motor de mescla abaixo, o autosave e o
// próprio App — o painel é só uma das telas que o mostram.
export type JsonSource = { id: string; name: string; raw: string };

// Junta N fontes JSON num objeto só, nível superior — em caso de chave
// repetida, a fonte mais pra baixo na lista vence. Erro de uma fonte
// (JSON inválido, ou não é objeto) não impede as outras de entrar na
// mescla; só fica de fora e aparece marcada.
// POR QUE UM CÓDIGO, e não a frase pronta.
//
// Estas duas mensagens eram STRING INGLESA cravada aqui, e iam pra estado
// (`errorsById` no App). O painel embrulhava num prefixo traduzido
// (`tt.sources.parseError`), então o resultado era meio traduzido: "Erro:
// Invalid JSON." — o rótulo em português e a razão em inglês, em toda sessão
// pt-BR. Trocar o idioma não mudava nada, porque a frase já estava em estado.
//
// Com o código, o estado guarda O QUE FALHOU e o painel resolve o texto na
// renderização, no idioma daquele render.
export type SourceErrorCode = "invalidJson" | "notAnObject";

export function mergeSources(sources: JsonSource[]): { data: Record<string, unknown>; errorsById: Record<string, SourceErrorCode> } {
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
