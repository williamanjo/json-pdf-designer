// @ts-check

// AGRUPADO EM CATEGORIAS, e não numa lista plana.
//
// Eram 23 entradas de mesmo nível: uma coluna que não cabia na tela e não
// dava pista de onde uma coisa estava. Agora são 1 doc + 6 categorias, todas
// `collapsed: true`, então a coluna abre curta e o Docusaurus expande sozinho
// só a categoria que contém a página atual.
//
// A ordem das categorias segue o caminho de quem chega: instalar → montar um
// relatório → mexer no editor → consultar → integrar → atualizar de versão.
//
// Os rótulos são traduzidos em
// website/i18n/pt-BR/docusaurus-plugin-content-docs/current.json — categoria
// nova sem entrada lá aparece em inglês no site pt-BR, sem erro nenhum.
// `test/docsFreshness.test.ts` falha se isso acontecer.

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    "intro",
    {
      type: "category",
      label: "Getting started",
      collapsed: true,
      items: ["installation", "core-concepts", "server-only-usage"],
    },
    {
      type: "category",
      label: "Building a report",
      collapsed: true,
      items: [
        "data-binding",
        "conditional-visibility",
        "tables",
        "repeated-sections",
        "charts",
        "kpi-cards",
      ],
    },
    {
      type: "category",
      label: "The editor",
      collapsed: true,
      items: [
        "composing-the-designer",
        "ready-made-ui",
        "customizing-components",
        "theming",
        "ui-language",
      ],
    },
    {
      type: "category",
      label: "Reference",
      collapsed: true,
      items: ["public-api", "failure-modes", "package-structure", "architecture"],
    },
    {
      type: "category",
      label: "Integrating",
      collapsed: true,
      items: ["backend-integration", "examples"],
    },
    {
      type: "category",
      label: "Releases",
      collapsed: true,
      items: ["migration-3", "changelog"],
    },
  ],
};

export default sidebars;
