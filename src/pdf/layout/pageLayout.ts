import type { Template, TemplatePage } from "../../types";

// Normaliza um Template pro array de páginas que generatePdf desenha: se
// `template.pages` existe e não é vazio, é a fonte da verdade (várias
// páginas, cada uma com seu próprio design); senão, os campos flat de
// sempre (page/headerHeight/.../schemas) viram a única página implícita —
// mesmo caminho de código pros dois casos, sem branch "single vs multi".
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
