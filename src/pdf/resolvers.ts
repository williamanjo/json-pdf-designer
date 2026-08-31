// Resolve o conteúdo de um schema (texto/tabela) contra o dado real —
// puro, sem nenhuma dependência de pdf-lib. Usado tanto pelo fluxo
// principal (generate.ts) quanto pelo desenho de seção (render/renderSection.ts).
import type { Binding, TableSchema } from "../types";
import { filteredArrayAt, renderTemplate } from "../bindings/bindings";

export function resolveTableRows(schema: TableSchema, value: string | undefined): string[][] {
  if (!value) return schema.content;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // valor não é JSON de linhas (ex: schema sem vínculo) — mantém o preview
  }
  return schema.content;
}

// Uma linha (uma tabela vinculada a array, um item) — célula a célula. Se
// a célula de design (content[0][i]) tiver um {token} de verdade, ele
// manda: troca o token, troca o valor puxado, ponto — não depende de
// bater nome/posição com nenhuma lista de colunas à parte (essa é a fonte
// do bug de dessincronia: encurtar o cabeçalho por fora não muda o que
// essa célula referencia). Célula SEM chave nenhuma (ex: "PNR0000",
// preview genérico de tabela recém-criada) não conta como template — cai
// direto pro vínculo, senão um exemplo estático value viraria "o mesmo
// texto fixo em toda linha" pra sempre, ignorando o dado real. Vazio
// também cai pro vínculo (`binding.columns[i]`, path cru ou
// {label,formula}); sem nada disso, tenta o rótulo do cabeçalho como path
// direto no item.
export function resolveRowFromItem(tableSchema: TableSchema, item: unknown, binding: Extract<Binding, { type: "array" }> | undefined): string[] {
  return tableSchema.head.map((headLabel, i) => {
    const cellTemplate = tableSchema.content[0]?.[i];
    if (cellTemplate && cellTemplate.includes("{")) return renderTemplate(cellTemplate, item);
    const col = binding?.columns[i];
    if (col !== undefined) {
      if (typeof col !== "string") return renderTemplate(col.formula.trim(), item);
      const v = item && typeof item === "object" ? (item as Record<string, unknown>)[col] : undefined;
      return v === undefined || v === null ? "" : String(v);
    }
    const v = item && typeof item === "object" ? (item as Record<string, unknown>)[headLabel] : undefined;
    return v === undefined || v === null ? "" : String(v);
  });
}

export function resolveArrayRows(tableSchema: TableSchema, arr: unknown[], binding: Extract<Binding, { type: "array" }> | undefined): string[][] {
  return arr.map((item) => resolveRowFromItem(tableSchema, item, binding));
}

// Linhas de uma tabela do CORPO (não membro de seção) vinculada a um
// array — mesma resolução célula-a-célula (token de design manda,
// binding.columns é só o fallback). Sem vínculo "array" (ex: chave/
// valor, ou sem vínculo nenhum), cai no caminho de sempre (inputs
// pré-computado pelo buildInputs, ou o preview de design).
export function resolveTopLevelTableRows(tableSchema: TableSchema, bindings: Binding[], data: unknown, inputs: Record<string, string>): string[][] {
  const binding = bindings.find(
    (b): b is Extract<Binding, { type: "array" }> => b.schemaName === tableSchema.name && b.type === "array"
  );
  if (binding) {
    const filtered = filteredArrayAt(data, binding.path, binding.filters);
    if (filtered) return resolveArrayRows(tableSchema, filtered, binding);
  }
  return resolveTableRows(tableSchema, inputs[tableSchema.name]);
}

// Linhas de uma tabela MEMBRO de seção — dois casos:
// 1) Vinculada (type "array", path relativo ao ITEM) — mestre-detalhe de
//    verdade (ex. Pedido -> ItensPedido): uma linha por item do array
//    aninhado. Célula a célula, o TOKEN de design manda (ver
//    resolveRowFromItem) — binding.columns só é usado onde a célula
//    tiver ficado vazia.
// 2) Sem vínculo — UMA linha só, contra o ITEM atual (mesma resolução
//    célula a célula, sem lista de colunas nenhuma). Só cai no preview
//    de design puro se nem isso resolver nada (item vazio/sem campos).
export function resolveNestedTableRows(tableMember: TableSchema, item: unknown, bindings: Binding[]): string[][] {
  const binding = bindings.find(
    (b): b is Extract<Binding, { type: "array" }> => b.schemaName === tableMember.name && b.type === "array"
  );
  if (binding) {
    const filtered = filteredArrayAt(item, binding.path, binding.filters);
    if (filtered) return resolveArrayRows(tableMember, filtered, binding);
  } else if (item && typeof item === "object") {
    const row = resolveRowFromItem(tableMember, item, undefined);
    if (row.some((cell) => cell !== "")) return [row];
  }
  return tableMember.content;
}

// Linha de totais de uma tabela — cada célula é um template de verdade
// (texto fixo e/ou {token}/{SUM(...)}), resolvida contra o dado
// informado por quem chama (documento inteiro pra tabela solta, ITEM
// atual pra tabela membro de seção — mesma distinção de sempre).
export function resolveFooterRow(tableSchema: TableSchema, resolveData: unknown): string[] | undefined {
  if (!tableSchema.footer || tableSchema.footer.length === 0) return undefined;
  return tableSchema.footer.map((cell) => renderTemplate(cell, resolveData));
}

// Texto sem vínculo "template"/"scalar" usa o próprio conteúdo como
// template (resolve {token}/{SUM(...)} etc contra o dado informado) —
// mesma regra em QUALQUER lugar que desenha texto: corpo antes/depois de
// bloco, cabeçalho/rodapé/margem repetido, membro de seção.
export function resolveTextValue(content: string, binding: Binding | undefined, resolveData: unknown): string {
  if (binding?.type === "template") return renderTemplate(binding.template, resolveData);
  if (binding?.type === "scalar") return renderTemplate(`{${binding.path}}`, resolveData);
  return renderTemplate(content, resolveData);
}
