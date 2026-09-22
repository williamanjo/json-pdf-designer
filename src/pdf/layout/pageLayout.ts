import type { Template, TemplatePage } from "../../types";

// Normalizes a Template into the array of pages generatePdf draws: if
// `template.pages` exists and is not empty, it is the source of truth
// (several pages, each with its own design); otherwise the usual flat fields
// (page/headerHeight/.../schemas) become the single implicit page — the same
// code path for both cases, with no "single vs multi" branch.
export function normalizePageDefs(template: Template): TemplatePage[] {
  if (template.pages && template.pages.length > 0) return template.pages;
  return [
    {
      id: "single",
      page: template.page,
      headerHeight: template.headerHeight,
      footerHeight: template.footerHeight,
      marginLeft: template.marginLeft,
      marginRight: template.marginRight,
      backgroundImage: template.backgroundImage,
      schemas: template.schemas,
    },
  ];
}
