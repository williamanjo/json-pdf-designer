import type { Template, Binding } from "json-pdf-designer";

export type ExampleDefinition = { label: string; template: Template; bindings: Binding[]; sample: unknown; sourceName: string };
