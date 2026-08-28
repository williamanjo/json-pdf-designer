import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import Heading from '@theme/Heading';
import styles from './index.module.css';

// Texto bilíngue à mão (en/pt-BR) — a home não é conteúdo de doc, então
// não ganha tradução automática via i18n/pt-BR/...; `siteConfig.tagline`
// também é uma string fixa só (não varia por locale sozinha).
const TEXT = {
  tagline: {
    en: 'Visual PDF report editor for React — drag/resize canvas + JSON data binding',
    'pt-BR': 'Editor visual de relatórios em PDF pra React — canvas de arrastar/redimensionar + vínculo de dados JSON',
  },
  getStarted: { en: 'Get Started', 'pt-BR': 'Comece aqui' },
  playground: { en: 'Playground', 'pt-BR': 'Playground' },
};

function HomepageHeader({locale}) {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{TEXT.tagline[locale]}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/intro">
            {TEXT.getStarted[locale]}
          </Link>
          <Link className="button button--outline button--secondary button--lg" to="/playground">
            {TEXT.playground[locale]}
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig, i18n} = useDocusaurusContext();
  const locale = i18n.currentLocale === 'pt-BR' ? 'pt-BR' : 'en';
  return (
    <Layout title={siteConfig.title} description={TEXT.tagline[locale]}>
      <HomepageHeader locale={locale} />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
