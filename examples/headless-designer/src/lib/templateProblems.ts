import { dictFor, expressionErrors } from "json-pdf-designer/server";
import type { Binding, Locale, Schema, Template, TemplatePage } from "json-pdf-designer/server";
import { shellDict } from "../i18n";

// Tudo que está torto no template ANTES de gerar.
//
// Existe porque a geração é tolerante de propósito: expressão inválida resolve
// pra vazio em vez de derrubar o PDF. Ótimo pra não perder um relatório de 200
// páginas por uma vírgula — mas sem isto o problema fica invisível (o campo
// aparece em branco e ninguém sabe por quê). Este é o outro lado do acordo.
//
// A varredura de expressão vem de export público do pacote: `expressionErrors`
// devolve cada expressão que um campo carrega (incluindo o `visibleWhen` e as
// fórmulas de coluna), e `dictFor(locale)` dá o dicionário como VALOR — o hook
// `useT()` só existe dentro de um componente, e isto roda fora da árvore React.
//
// ONDE ESTE ARQUIVO DIFERE DO report-builder: lá a parte de "configuração pela
// metade" sai de `fieldWarning(schema, binding, t)`. Essa função é exportada
// pelo entry `.` (o com React) e NÃO pelo `/server` — e este example importa só
// do `/server`, de propósito. Então as duas regras que ela aplica (vínculo
// faltando em section/chart, e filtro com condição sem valor) estão escritas
// aqui embaixo, reusando as MENSAGENS do dicionário do pacote pra não inventar
// texto próprio nem perder a tradução.

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

// `page.name` é DADO (o nome que o autor do template deu à página) e sai como
// veio; o fallback "Page N"/"Página N" é rótulo da casca, e é o MESMO do
// `PageTabs` — uma entrada só de dicionário serve os dois, senão a aba e o
// painel de problemas chamariam a mesma página de dois jeitos.
function pageLabel(page: TemplatePage, index: number, locale: Locale): string {
  return page.name?.trim() || shellDict(locale).pages.tab(index + 1);
}

// Vinculado a um array (chart/table/kpi) mas alguma condição de filtro tem
// coluna escolhida e valor em branco — filtro montado pela metade, que
// filtraria tudo fora sem o usuário perceber. (Cópia da regra de
// `filterIncomplete` do pacote, que só o entry React exporta.)
function filterIncomplete(binding: Binding | undefined): boolean {
  if (!binding || (binding.type !== "chart" && binding.type !== "array" && binding.type !== "kpi")) return false;
  return (binding.filters ?? []).some((group) => group.some((cond) => cond.column && !cond.value.trim()));
}

function problemsOfSchema(
  schema: Schema,
  bindings: Binding[],
  page: TemplatePage,
  pageIndex: number,
  locale: Locale
): TemplateProblem[] {
  const t = dictFor(locale);
  const binding = bindings.find((b) => b.schemaName === schema.name);
  const base = {
    pageIndex,
    pageName: pageLabel(page, pageIndex, locale),
    schemaId: schema.id,
    schemaName: schema.name,
  };

  // Erro de sintaxe vem primeiro: já está produzindo saída errada (campo
  // vazio), enquanto "falta vínculo" é configuração incompleta.
  // `severity` separa os dois: "error" não compila e o campo sai vazio com
  // certeza; "warning" compila mas é quase certamente engano — um operador com
  // espaço de um lado só (`{fatura /}`) virou nome de chave. O aviso existe
  // porque esse caso não é erro de sintaxe nenhum e passava calado.
  const syntax = expressionErrors(schema, binding, t).map((e) => ({
    ...base,
    kind: (e.severity === "error" ? "expressao" : "suspeita") as "expressao" | "suspeita",
    where: e.field,
    message: e.message,
  }));
  if (syntax.length > 0) return syntax;

  // Só chega aqui quando não havia erro de expressão nenhum — o que sobra é
  // configuração. Section/chart sem vínculo não desenham nada; texto/tabela sem
  // vínculo ficam de fora de propósito (conteúdo estático é uso legítimo).
  if ((schema.type === "section" || schema.type === "chart") && !binding) {
    return [{ ...base, kind: "config" as const, message: t.warnings.missingBinding }];
  }
  if (filterIncomplete(binding)) {
    return [{ ...base, kind: "config" as const, message: t.warnings.incompleteFilter }];
  }
  return [];
}

export function templateProblems(template: Template, bindings: Binding[], locale: Locale): TemplateProblem[] {
  const pages = template.pages && template.pages.length > 0 ? template.pages : [];
  return pages.flatMap((page, pageIndex) =>
    page.schemas.flatMap((schema) => problemsOfSchema(schema, bindings, page, pageIndex, locale))
  );
}
