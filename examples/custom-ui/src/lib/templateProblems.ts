import { dictFor, expressionErrors, fieldWarning } from "json-pdf-designer";
import type { Binding, Locale, Schema, Template, TemplatePage } from "json-pdf-designer";
import { pageLabel } from "../i18n";

// Tudo que está torto no template ANTES de gerar.
//
// Existe porque a geração é tolerante de propósito: expressão inválida resolve
// pra vazio em vez de derrubar o PDF. Ótimo pra não perder um relatório de 200
// páginas por uma vírgula — mas sem isto o problema fica invisível (o campo
// aparece em branco e ninguém sabe por quê). Este é o outro lado do acordo.
//
// Tudo aqui vem de export público do pacote: `expressionErrors` (cada expressão
// que um campo carrega, incluindo o `visibleWhen` e as fórmulas de coluna) e
// `fieldWarning` (a mesma mensagem que o ícone de alerta da lista de campos do
// <Designer> mostra).

export type TemplateProblem = {
  pageIndex: number;
  pageName: string;
  schemaId: string;
  schemaName: string;
  // "expressao" = vai renderizar vazio agora. "config" = configuração pela
  // metade (falta vínculo, filtro sem valor).
  kind: "expressao" | "suspeita" | "config";
  // Onde no schema: "content", "visibleWhen", "footer[1]", "columns[2].formula".
  where?: string;
  message: string;
};

// `page.name` é DADO (nome que a pessoa deu à página) e sai como está. O
// fallback é rótulo de UI, e vem do `pageLabel` compartilhado (src/i18n.ts),
// que tira a palavra "página" do dicionário do PACOTE — a mesma que as abas
// da casca (PageTabs) e a aba "Página" do painel de propriedades usam.
function pageDisplayName(page: TemplatePage, index: number, locale: Locale): string {
  return page.name?.trim() || pageLabel(locale, index + 1);
}

function problemsOfSchema(
  schema: Schema,
  bindings: Binding[],
  page: TemplatePage,
  pageIndex: number,
  locale: Locale
): TemplateProblem[] {
  const binding = bindings.find((b) => b.schemaName === schema.name);
  const base = {
    pageIndex,
    pageName: pageDisplayName(page, pageIndex, locale),
    schemaId: schema.id,
    schemaName: schema.name,
  };

  // Erro de sintaxe vem primeiro: já está produzindo saída errada (campo
  // vazio), enquanto "falta vínculo" é configuração incompleta.
  // `severity` separa os dois: "error" não compila e o campo sai vazio com
  // certeza; "warning" compila mas é quase certamente engano — um operador com
  // espaço de um lado só (`{fatura /}`) virou nome de chave. O aviso existe
  // porque esse caso não é erro de sintaxe nenhum e passava calado.
  // `dictFor(locale)` também aqui: a mensagem do parser sai do dicionário, e
  // sem ele viria em inglês no meio da UI em português.
  const syntax = expressionErrors(schema, binding, dictFor(locale)).map((e) => ({
    ...base,
    kind: (e.severity === "error" ? "expressao" : "suspeita") as "expressao" | "suspeita",
    where: e.field,
    message: e.message,
  }));
  if (syntax.length > 0) return syntax;

  // `fieldWarning` também cobre erro de expressão (é a primeira coisa que ele
  // checa), então só chega aqui quando não havia nenhum — o que sobra é
  // configuração.
  // `dictFor` dá o dicionário como VALOR — `useT()` só existe dentro de um
  // componente, e isto roda fora da árvore React.
  const warning = fieldWarning(schema, binding, dictFor(locale));
  return warning ? [{ ...base, kind: "config" as const, message: warning }] : [];
}

export function templateProblems(template: Template, bindings: Binding[], locale: Locale): TemplateProblem[] {
  const pages = template.pages && template.pages.length > 0 ? template.pages : [];
  return pages.flatMap((page, pageIndex) =>
    page.schemas.flatMap((schema) => problemsOfSchema(schema, bindings, page, pageIndex, locale))
  );
}
