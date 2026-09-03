import type { Template, Binding } from "json-pdf-designer/server";

export type ExampleDefinition = { label: string; template: Template; bindings: Binding[]; sample: unknown; sourceName: string };
