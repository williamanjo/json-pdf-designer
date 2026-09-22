// It scans a sample JSON object (your query's response) and builds a list of
// "fields" that can be dragged/clicked into the report designer.
//
// Rules:
// - an object -> it descends recursively into each key (a "." path)
// - an array of objects -> becomes 1 "arraySource" (the whole DataSource —
//   clicking/dragging creates a table with ALL the columns) + 1 "arrayColumn"
//   per column (clicking/dragging ONE column only adds it to a section already
//   bound to that same array, if there is one; with no section, it does
//   nothing — see DesignerPanel.tsx::addFieldToCanvas)
// - an array of simple values -> becomes only an "arraySource" with no columns
//   (there is no column at all to offer individually)
// - a simple value (string/number/boolean/null) -> a "scalar" field

import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";

export type ColumnType = "number" | "string" | "boolean" | "other";

export type FieldNode =
  | { path: string; label: string; kind: "scalar" }
  | { path: string; label: string; kind: "arraySource"; columns?: string[]; columnTypes?: Record<string, ColumnType> }
  // An individual column of an "arraySource" — sourcePath points at the
  // parent array (to find the section bound to it, if there is one).
  | { path: string; label: string; kind: "arrayColumn"; sourcePath: string; column: string }
  // A synthetic token of the PDF engine (see src/pdf/generate.ts pageData) —
  // it does not come from the JSON, it only exists at generation time. It only
  // really resolves in a text field that falls in the header/footer/margin
  // (docs/USAGE.md); in the document's body it resolves empty, as always.
  | { path: string; label: string; kind: "native" };

// Synthetic fields always available, regardless of the loaded JSON — shown in
// a fixed section of their own in the tree ("Native variables", see
// FieldTree.tsx).
//
// A FUNCTION, not a constant, because the `label` is INTERFACE and follows the
// UI's language. The `path` is the other half and does not follow: it is
// written inside the template as `{pageNumber}`, it is what the PDF engine
// resolves at generation time, and a template must not change meaning because
// someone switched the language picker.
export function nativeFields(locale: Locale): FieldNode[] {
  const s = t(locale);
  return [
    { path: "pageNumber", label: s.fields.nativePageNumber, kind: "native" },
    { path: "pageCount", label: s.fields.nativePageCount, kind: "native" },
  ];
}

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
