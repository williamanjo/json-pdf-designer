// @ts-check

// GROUPED INTO CATEGORIES, and not in a flat list.
//
// There were 23 entries at the same level: a column that did not fit on the
// screen and gave no clue where anything was. Now there are 1 doc + 6
// categories, all `collapsed: true`, so the column opens short and Docusaurus
// expands only the category containing the current page by itself.
//
// The categories' order follows the path of whoever arrives: install → build a
// report → work in the editor → look something up → integrate → upgrade.
//
// The labels are translated in
// website/i18n/pt-BR/docusaurus-plugin-content-docs/current.json — a new
// category with no entry there appears in English on the pt-BR site, with no
// error at all. `test/docsFreshness.test.ts` fails if that happens.

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
        "accessibility",
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
