// @ts-check
import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "json-pdf-designer",
  tagline: "Design PDF reports in the browser. Generate them anywhere.",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  // A PROJECT site (not the user.github.io root) — baseUrl needs the repo's
  // name.
  url: "https://williamanjo.github.io",
  baseUrl: "/json-pdf-designer/",

  organizationName: "williamanjo",
  projectName: "json-pdf-designer",

  // `throw` on purpose: a sidebar entry pointing at a deleted doc ABORTS the
  // build instead of generating a broken page in silence. It is what caught
  // the removal of `tailwind-setup` in 3.0.0.
  onBrokenLinks: "throw",
  // Moved from `onBrokenMarkdownLinks` (deprecated, going away in v4) — the
  // value is the same, only the place changed. Without this, every build
  // prints two warnings.
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

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
          // The real date of each page's last commit (through git) — it has to
          // be on for the sitemap's `lastmod: "date"` (below) to have a date to
          // take; it also appears as "Last updated on..." in the footer of each
          // doc page.
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
        // changefreq/priority bring no real benefit for Google today
        // (Docusaurus itself already marks both options as "TODO: remove in
        // v4") — null removes both from the generated sitemap. lastmod: "date"
        // uses the REAL date of each route's last commit (through git, the same
        // mechanism as the docs' footer "Last updated") — it invents no date.
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
            // A real Docusaurus route (src/pages/playground/) — a normal
            // "to", with the locale/baseUrl resolved automatically (like any
            // other page of the site). Only the 5 examples linked from inside
            // it (separate static bundles) open in a new tab — see
            // src/pages/playground/index.js.
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
              { label: "Changelog", to: "/docs/changelog" },
            ],
          },
          {
            title: "Playground",
            // Raw "html" for the same reason as the navbar above. These 5 point
            // straight at a specific example (not the landing page) — a new
            // tab on purpose, each example is a heavy app of its own.
            items: [
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/report-builder/" target="_blank" rel="noopener noreferrer">report-builder</a>',
              },
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/composed-layout/" target="_blank" rel="noopener noreferrer">composed-layout</a>',
              },
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/custom-ui/" target="_blank" rel="noopener noreferrer">custom-ui</a>',
              },
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/headless-designer/" target="_blank" rel="noopener noreferrer">headless-designer</a>',
              },
              {
                html: '<a class="footer__link-item" href="/json-pdf-designer/playground/no-preview/" target="_blank" rel="noopener noreferrer">no-preview</a>',
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
