import type { Template, TemplatePage } from "json-pdf-designer";
import { uid } from "./uid";

// Todo Template manipulado pelo report-builder passa por aqui antes de
// virar estado — garante `pages` sempre presente e não-vazio, mesmo pra um
// Template "antigo" (autosave/projeto salvo antes das abas de página
// existirem, ou um exemplo pronto que nunca usou `pages`). generatePdf/
// Designer já toleram `pages` ausente sozinhos, mas a UI de abas do
// report-builder precisa de um array pra iterar.
export function ensurePages(template: Template): Template & { pages: TemplatePage[] } {
  if (template.pages && template.pages.length > 0) {
    return template as Template & { pages: TemplatePage[] };
  }
  const page: TemplatePage = {
    id: uid(),
    page: template.page,
    headerHeight: template.headerHeight,
    footerHeight: template.footerHeight,
    marginLeft: template.marginLeft,
    marginRight: template.marginRight,
    backgroundImage: template.backgroundImage,
    schemas: template.schemas,
  };
  return { ...template, pages: [page] };
}

export function blankPage(): TemplatePage {
  return { id: uid(), page: { width: 210, height: 297 }, schemas: [] };
}
