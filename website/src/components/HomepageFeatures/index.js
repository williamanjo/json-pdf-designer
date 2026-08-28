import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

// Texto bilíngue à mão (en/pt-BR) — mesmo motivo do playground
// (src/pages/playground/index.js): este componente não é conteúdo de doc
// (docusaurus-plugin-content-docs), então não ganha tradução automática
// via i18n/pt-BR/... — precisa ler o locale ativo e escolher o texto certo
// na mão.
const FeatureList = [
  {
    Emoji: '🖱️',
    title: { en: 'Drag, resize, bind', 'pt-BR': 'Arraste, redimensione, vincule' },
    description: {
      en: (
        <>
          Text, table, image, repeated section, chart, and KPI fields —
          all drag/resize freely on a grid, wired to real JSON via{' '}
          <code>{'{token}'}</code>/<code>{'{FUNCTION(...)}'}</code> templates.
        </>
      ),
      'pt-BR': (
        <>
          Campos de texto, tabela, imagem, seção repetida, gráfico e KPI
          — todos arrastam/redimensionam livre numa grade, vinculados ao
          JSON real via templates <code>{'{token}'}</code>/
          <code>{'{FUNÇÃO(...)}'}</code>.
        </>
      ),
    },
  },
  {
    Emoji: '📄',
    title: { en: 'Generate anywhere', 'pt-BR': 'Gere em qualquer lugar' },
    description: {
      en: (
        <>
          <code>generatePdf</code> is plain JS (<code>pdf-lib</code>) — the
          same function runs in the browser or in a Node backend. Use{' '}
          <code>json-pdf-designer/server</code> to skip React entirely.
        </>
      ),
      'pt-BR': (
        <>
          <code>generatePdf</code> é JS puro (<code>pdf-lib</code>) — a
          mesma função roda no navegador ou num backend Node. Use{' '}
          <code>json-pdf-designer/server</code> pra pular o React
          inteiramente.
        </>
      ),
    },
  },
  {
    Emoji: '🧩',
    title: { en: 'Use it your way', 'pt-BR': 'Use do seu jeito' },
    description: {
      en: (
        <>
          Ship it with the ready-made UI kit, wrap it in your own CSS, or
          skip <code>{'<Designer>'}</code> altogether and build your own
          editor over the data model. Three playground examples show all
          three.
        </>
      ),
      'pt-BR': (
        <>
          Distribua com o kit de UI pronto, embrulhe na sua própria CSS,
          ou pule o <code>{'<Designer>'}</code> de vez e monte o próprio
          editor por cima do modelo de dados. Três exemplos no playground
          mostram os três jeitos.
        </>
      ),
    },
  },
];

function Feature({Emoji, title, description, locale}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <span className={styles.featureEmoji} role="img" aria-hidden="true">
          {Emoji}
        </span>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title[locale]}</Heading>
        <p>{description[locale]}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  const {i18n} = useDocusaurusContext();
  const locale = i18n.currentLocale === 'pt-BR' ? 'pt-BR' : 'en';

  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
