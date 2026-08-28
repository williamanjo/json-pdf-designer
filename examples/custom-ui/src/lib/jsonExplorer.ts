// Varre um objeto JSON de exemplo (a resposta da sua query) e monta uma lista
// de "campos" que podem ser arrastados/clicados para o designer do
// relatório.
//
// Regras:
// - objeto  -> desce recursivamente em cada chave (path com ".")
// - array de objetos -> vira 1 "arraySource" (o DataSource inteiro — clicar/
//   arrastar cria uma tabela com TODAS as colunas) + 1 "arrayColumn" por
//   coluna (clicar/arrastar UMA coluna só adiciona ela numa seção já
//   vinculada a esse mesmo array, se houver uma; sem seção, não faz nada —
//   ver DesignerPanel.tsx::addFieldToCanvas)
// - array de valores simples -> vira só um "arraySource" sem colunas (sem
//   coluna nenhuma pra oferecer individualmente)
// - valor simples (string/number/boolean/null) -> campo "scalar"

export type ColumnType = "number" | "string" | "boolean" | "other";

export type FieldNode =
  | { path: string; label: string; kind: "scalar" }
  | { path: string; label: string; kind: "arraySource"; columns?: string[]; columnTypes?: Record<string, ColumnType> }
  // Coluna individual de um "arraySource" — sourcePath aponta pro array-pai
  // (pra achar a seção vinculada a ele, se houver).
  | { path: string; label: string; kind: "arrayColumn"; sourcePath: string; column: string }
  // Token sintético do motor de PDF (ver src/pdf/generate.ts pageData) — não
  // vem do JSON, só existe na hora de gerar. Só resolve de verdade em campo
  // de texto que caia no cabeçalho/rodapé/margem (docs/USAGE.md); no corpo
  // do documento resolve vazio, mesma regra de sempre.
  | { path: string; label: string; kind: "native" };

// Campos sintéticos sempre disponíveis, independente do JSON carregado —
// mostrados numa seção fixa própria na árvore ("Variáveis nativas", ver
// FieldTree.tsx).
export const NATIVE_FIELDS: FieldNode[] = [
  { path: "pageNumber", label: "Nº da página", kind: "native" },
  { path: "pageCount", label: "Total de páginas", kind: "native" },
];

function valueColumnType(v: unknown): ColumnType {
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "boolean";
  return "other";
}

export function extractFields(sample: unknown, basePath = ""): FieldNode[] {
  const fields: FieldNode[] = [];

  function walk(value: unknown, path: string) {
    if (Array.isArray(value)) {
      const first = value[0];
      if (first && typeof first === "object" && !Array.isArray(first)) {
        const firstObj = first as Record<string, unknown>;
        const columns = Object.keys(firstObj);
        const columnTypes: Record<string, ColumnType> = {};
        for (const col of columns) columnTypes[col] = valueColumnType(firstObj[col]);
        fields.push({ path, label: path, kind: "arraySource", columns, columnTypes });
        for (const col of columns) {
          fields.push({ path: `${path}.${col}`, label: col, kind: "arrayColumn", sourcePath: path, column: col });
        }
      } else {
        fields.push({ path, label: path, kind: "arraySource" });
      }
      return;
    }

    if (value && typeof value === "object") {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        const childPath = path ? `${path}.${key}` : key;
        walk((value as Record<string, unknown>)[key], childPath);
      }
      return;
    }

    if (path) {
      fields.push({ path, label: path, kind: "scalar" });
    }
  }

  walk(sample, basePath);
  return fields;
}

export function sanitizeName(path: string): string {
  return path.replace(/[^a-zA-Z0-9]/g, "_");
}

// Remonta a hierarquia (perdida no `path` pontuado do FieldNode achatado)
// só pra EXIBIÇÃO em árvore — o FieldNode original fica guardado sem
// alteração na folha, então o contrato de drag-and-drop/binding não muda em
// nada. Um grupo pode ter um `field` próprio (o "arraySource" que ele
// representa) — nesse caso a linha do grupo em si é clicável/arrastável
// (cria a tabela inteira), além de expandir/colapsar os filhos
// ("arrayColumn", uma coluna cada).
export type FieldTreeNode =
  | { type: "group"; key: string; label: string; field?: FieldNode; children: FieldTreeNode[] }
  | { type: "leaf"; field: FieldNode; label: string };

export function buildFieldTree(fields: FieldNode[]): FieldTreeNode[] {
  const roots: FieldTreeNode[] = [];

  function getOrCreateGroup(siblings: FieldTreeNode[], key: string, label: string): Extract<FieldTreeNode, { type: "group" }> {
    const existing = siblings.find((n): n is Extract<FieldTreeNode, { type: "group" }> => n.type === "group" && n.key === key);
    if (existing) return existing;
    const group: Extract<FieldTreeNode, { type: "group" }> = { type: "group", key, label, children: [] };
    siblings.push(group);
    return group;
  }

  // Acha/cria a cadeia de grupos pra um path pontuado (todo segmento vira
  // um nível), devolvendo o array de filhos do ÚLTIMO grupo — reaproveitado
  // tanto por scalar (grupo = pasta comum) quanto por arraySource/
  // arrayColumn (grupo = o próprio DataSource).
  function childrenFor(path: string): FieldTreeNode[] {
    const segments = path.split(".");
    let cursor = roots;
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix ? `${prefix}.${segment}` : segment;
      cursor = getOrCreateGroup(cursor, prefix, segment).children;
    }
    return cursor;
  }

  for (const field of fields) {
    if (field.kind === "scalar") {
      const segments = field.path.split(".");
      const parentPath = segments.slice(0, -1).join(".");
      const siblings = parentPath ? childrenFor(parentPath) : roots;
      siblings.push({ type: "leaf", field, label: segments[segments.length - 1] });
      continue;
    }

    if (field.kind === "arraySource") {
      const segments = field.path.split(".");
      const parentPath = segments.slice(0, -1).join(".");
      const siblings = parentPath ? childrenFor(parentPath) : roots;
      const group = getOrCreateGroup(siblings, field.path, segments[segments.length - 1]);
      group.field = field;
      continue;
    }

    // "native" nunca chega aqui — a árvore de dados só recebe o que vem de
    // extractFields; campos nativos são renderizados à parte (FieldTree.tsx).
    if (field.kind === "native") continue;

    // arrayColumn — sempre filho direto do grupo do arraySource-pai.
    const siblings = childrenFor(field.sourcePath);
    siblings.push({ type: "leaf", field, label: field.column });
  }

  return roots;
}
