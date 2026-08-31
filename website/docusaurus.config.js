// @ts-check
import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "json-pdf-designer",
  tagline: "Visual PDF report editor for React — drag/resize canvas + JSON data binding",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  // Site de PROJETO (não usuario.github.io raiz) — baseUrl precisa do
  // nome do repo.
  url: "https://williamanjo.github.io",
  baseUrl: "/json-pdf-designer/",

  organizationName: "williamanjo",
  projectName: "json-pdf-designer",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en", "pt-BR"],
    localeConfigs: {
      en: { label: "English" },
      "pt-BR": { label: "Português (Brasil)" },
    },
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          routeBasePath: "docs",
          editUrl: "https://github.com/williamanjo/json-pdf-designer/edit/master/website/",
          // Data real do último commit de cada página (via git) — precisa
          // estar ligado pro `lastmod: "date"` do sitemap (abaixo) ter de
          // onde tirar a data; também aparece como "Last updated on..." no
          // rodapé de cada página de doc.
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
        // changefreq/priority não trazem benefício real pro Google hoje
        // (a própria Docusaurus já marca as duas opções como "TODO: remover
        // em v4") — null tira os dois do sitemap gerado. lastmod: "date"
        // usa a data REAL do último commit de cada rota (via git, mesmo
        // mecanismo do "Last updated" no rodapé da doc) — não inventa data.
        sitemap: {
          changefreq: null,
          priority: null,
          lastmod: "date",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/docusaurus-social-card.jpg",
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: "json-pdf-designer",
        items: [
          {
            type: "docSidebar",
            sidebarId: "docsSidebar",
            position: "left",
            label: "Docs",
          },
          {
            // Rota de verdade do Docusaurus (src/pages/playground/) —
            // "to" normal, com locale/baseUrl resolvidos automaticamente
            // (igual qualquer outra página do site). Só os 3 exemplos
            // linkados de dentro dela (bundles estáticos à parte) que
            // abrem em aba nova — ver src/pages/playground/index.js.
            to: "/playground",
            label: "Playground",
            position: "left",
          },
          {
            type: "localeDropdown",
            position: "right",
          },
          {
            href: "https://github.com/williamanjo/json-pdf-designer",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              { label: "Getting Started", to: "/docs/intro" },
              { label: "Public API", to: "/docs/public-api" },
            ],
          },
          {
            title: "Playground",
            // "html" cru pelo mesmo motivo do navbar acima. Esses 3 apontam
            // direto pra um exemplo específico (não a landing page) — aba
            // nova de propósito, cada exemplo é um app pesado à parte.
            items: [
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/report-builder/" target="_blank" rel="noopener noreferrer">report-builder</a>',
              },
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/custom-ui/" target="_blank" rel="noopener noreferrer">custom-ui</a>',
              },
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/headless-designer/" target="_blank" rel="noopener noreferrer">headless-designer</a>',
              },
            ],
          },
          {
            title: "More",
            items: [
              { label: "GitHub", href: "https://github.com/williamanjo/json-pdf-designer" },
              { label: "npm", href: "https://www.npmjs.com/package/json-pdf-designer" },
              { label: "Issues", href: "https://github.com/williamanjo/json-pdf-designer/issues" },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} William Anjo. MIT licensed.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
