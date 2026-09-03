import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './styles.module.css';

// Conteúdo bilíngue à mão (en/pt-BR) — mesma ideia do resto do site, só
// que sem depender do sistema de tradução de conteúdo do Docusaurus
// (docusaurus-plugin-content-docs), porque esta é uma página comum
// (docusaurus-plugin-content-pages), não um doc. useDocusaurusContext()
// dá o locale ativo (o mesmo que o dropdown do navbar já controla).
const EXAMPLES = [
  {
    slug: 'report-builder',
    badge: { en: 'Ready-made UI', 'pt-BR': 'UI pronta' },
    description: {
      en: "The full designer — JSON data sources, a field explorer, 6 ready-made templates — using the package's ready-made UI components (Button/Card/Input/PdfPreviewModal).",
      'pt-BR':
        'O designer completo — fontes de dados JSON, um explorador de campos, 6 templates prontos — usando os componentes de UI prontos do pacote (Button/Card/Input/PdfPreviewModal).',
    },
  },
  {
    slug: 'composed-layout',
    badge: { en: 'Part by part', 'pt-BR': 'Peça por peça' },
    description: {
      en: 'The editor assembled part by part, without the <Designer> component — DesignerProvider mounted by hand, toolbar on top, and five stacked panels that inside <Designer> would be five tabs. Proves the tab gate is opt-in.',
      'pt-BR':
        'O editor montado peça por peça, sem o componente <Designer> — o DesignerProvider montado na mão, toolbar em cima, e cinco painéis empilhados que dentro do <Designer> seriam cinco abas. Prova que o gate por aba é opt-in.',
    },
  },
  {
    slug: 'custom-ui',
    badge: { en: 'Custom shell', 'pt-BR': 'Casca própria' },
    description: {
      en: 'The exact same features as report-builder, but the entire shell is hand-written plain CSS — zero package UI components. Proves <Designer> works with any design system.',
      'pt-BR':
        'As mesmas funcionalidades do report-builder, mas a casca inteira é CSS puro escrito à mão — zero componente de UI do pacote. Prova que o <Designer> funciona com qualquer design system.',
    },
  },
  {
    slug: 'no-preview',
    badge: { en: 'No pdf.js', 'pt-BR': 'Sem pdf.js' },
    description: {
      en: 'Generates the PDF and downloads it straight away — no preview screen and, the point of it, no pdfjs-dist installed. Proves the main entry works without the optional peer; pdf.js lives behind json-pdf-designer/preview.',
      'pt-BR':
        'Gera o PDF e baixa direto — sem tela de preview e, o ponto do example, sem o pdfjs-dist instalado. Prova que a entry principal funciona sem o peer opcional; o pdf.js mora atrás do json-pdf-designer/preview.',
    },
  },
  {
    slug: 'headless-designer',
    badge: { en: 'No <Designer>', 'pt-BR': 'Sem <Designer>' },
    description: {
      en: 'No <Designer> component at all — a hand-built canvas (its own drag/resize logic, no react-rnd) over generatePdf + types from json-pdf-designer/server, plus PdfPreview. Proves the data model and PDF engine work standalone.',
      'pt-BR':
        'Sem o componente <Designer> nenhum — um canvas montado à mão (própria lógica de arrastar/redimensionar, sem react-rnd) sobre generatePdf + tipos de json-pdf-designer/server, mais o PdfPreview. Prova que o modelo de dados e o motor de PDF funcionam sozinhos.',
    },
  },
];

const TEXT = {
  title: { en: 'Playground', 'pt-BR': 'Playground' },
  description: {
    en: 'Five live example apps built on json-pdf-designer.',
    'pt-BR': 'Cinco apps de exemplo ao vivo, construídos com o json-pdf-designer.',
  },
  lead: {
    en: "Five live example apps — same package, five different ways to build the editor around it. Each runs independently; changes here don't affect the others.",
    'pt-BR':
      'Cinco apps de exemplo ao vivo — mesmo pacote, cinco jeitos diferentes de montar o editor em volta dele. Cada um roda independente; mudanças aqui não afetam os outros.',
  },
  open: { en: 'Open →', 'pt-BR': 'Abrir →' },
};

export default function Playground() {
  const { i18n } = useDocusaurusContext();
  const locale = i18n.currentLocale === 'pt-BR' ? 'pt-BR' : 'en';

  return (
    <Layout title={TEXT.title[locale]} description={TEXT.description[locale]}>
      <main className={styles.main}>
        <h1>{TEXT.title[locale]}</h1>
        <p className={styles.lead}>{TEXT.lead[locale]}</p>
        <div className={styles.grid}>
          {EXAMPLES.map((ex) => (
            // <a> comum, não <Link> — cada exemplo é um bundle estático
            // separado (fora do grafo de rotas do Docusaurus, montado em
            // playground/<slug>/ no deploy), sem versão por idioma. Abre
            // em aba nova de propósito — é um app pesado à parte.
            <a
              key={ex.slug}
              className={styles.card}
              href={`/json-pdf-designer/playground/${ex.slug}/`}
              target="_blank"
              rel="noopener noreferrer">
              <span className={styles.badge}>{ex.badge[locale]}</span>
              <h2>{ex.slug}</h2>
              <p>{ex.description[locale]}</p>
              <span className={styles.openLink}>{TEXT.open[locale]}</span>
            </a>
          ))}
        </div>
      </main>
    </Layout>
  );
}
