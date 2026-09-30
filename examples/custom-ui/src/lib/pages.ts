import type { Template, TemplatePage } from "json-pdf-designer";
import { uid } from "./uid";

// Every Template this example handles passes through here before becoming
// state — it guarantees `pages` is always present and non-empty, even for an
// "old" Template (an autosave/project saved before the page tabs existed, or a
// ready-made example that never used `pages`). generatePdf/Designer already
// tolerate an absent `pages` on their own, but the tab UI needs an array to
// iterate.
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
