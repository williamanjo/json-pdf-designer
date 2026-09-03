import type { CSSProperties, DragEvent } from "react";
import type { Binding, DataSourceOption, Template } from "../types";
import { I18nProvider, type Locale } from "../i18n";
import { cx } from "../components/ui/cx";
import { UiComponentsProvider } from "../components/ui/UiComponentsProvider";
import type { UiComponentsOverride } from "../components/ui/registry";
import { DesignerProvider } from "./context/DesignerProvider";
import { DesignerCanvas } from "./parts/DesignerCanvas";
import { DesignerSidebar } from "./parts/DesignerSidebar";

export type DesignerProps = {
  template: Template;
  // Aceita o setState do React direto (forma funcional inclusa) — evita
  // sobrescrever uma mudança concorrente por causa de closure velha (ex:
  // dois campos adicionados em sequência rápida, antes do primeiro render
  // acontecer).
  onChangeTemplate: React.Dispatch<React.SetStateAction<Template>>;
  bindings: Binding[];
  onChangeBindings: React.Dispatch<React.SetStateAction<Binding[]>>;
  // Passthrough pro container do canvas — usado por quem quer soltar campos
  // externos (ex: um explorador de campos de JSON) direto na página.
  onCanvasDrop?: (e: DragEvent<HTMLDivElement>) => void;
  // Arrays conhecidos do JSON de exemplo — vira dropdown "Data Source" no
  // vínculo de tabela (ver BindingEditor). Sem isso, path digitado livre.
  dataSources?: DataSourceOption[];
  // Idioma da UI do designer (botões, abas, avisos) — default "en". Só
  // afeta o que este componente FALA com quem monta o relatório; não
  // muda como o PDF gerado formata data/moeda (isso é {DATE(...)}/
  // {CURRENCY(...)} escrito no próprio template, ver bindings.ts).
  locale?: Locale;
  // Passo da grade em mm (default 5). Alinha arrasto, redimensionamento,
  // nascimento de campo novo e colagem — os quatro, desde a 3.0.0 (até a
  // 2.x só o arrasto do canvas honrava um valor customizado).
  gridSizeMm?: number;
  // Clicar num campo reabre a sidebar colapsada (default true). `false` pra
  // layout onde a sidebar não é a resposta a "cliquei num campo".
  expandOnSelect?: boolean;
  // Troca os primitivos que o editor usa POR DENTRO (Button, Input, Select,
  // Modal, ...) pelos seus. Açúcar pra montar um <UiComponentsProvider> —
  // que é o que vale quando você renderiza uma peça avulsa, sem <Designer>.
  //
  // IMPORTANTE: passe uma constante de módulo ou algo memoizado. Objeto
  // inline cria componente novo a cada render, e o React remonta o que
  // mudou de identidade — o sintoma é perder o foco do campo a cada tecla.
  // Fora de produção, o provider avisa no console se isso acontecer.
  components?: UiComponentsOverride;
  // Vão pro `<div class="jpd-designer">` de fora. `className` faz MERGE com
  // a nossa (a sua vem depois); `style` seu ganha do nosso.
  className?: string;
  style?: CSSProperties;
};

// Canvas do editor: página em mm, cada campo arrasta/redimensiona livre
// (react-rnd). Seleção abre o painel de propriedades — que já inclui o
// vínculo com o JSON, sem ponte nenhuma (tudo é React normal).
//
// Este componente é um PRESET, e desde a 3.0.0 é só isto: três providers e
// duas peças num layout de duas colunas. Quem quer o próprio layout monta o
// <DesignerProvider> na mão e posiciona as peças (ver ./parts/). As 7 props
// de sempre continuam idênticas — `gridSizeMm`, `expandOnSelect`,
// `className` e `style` são adições opcionais.
//
// Os providers ficam AQUI FORA porque um componente não consome o contexto
// que ele mesmo declara.
export default function Designer({ locale = "en", components, className, style, ...props }: DesignerProps) {
  return (
    <I18nProvider locale={locale}>
      {/* Os providers de i18n e de primitivos são independentes e a ordem
          entre eles não importa — nenhum lê o outro. Separados porque têm
          cardinalidade e frequência de mudança diferentes: o vocabulário de
          primitivos é um por APP e quase nunca muda; o estado do editor é um
          por instância e muda a cada tecla. Ver o comentário de
          UiComponentsProvider.tsx.
          O DesignerProvider vem por DENTRO dos dois porque ele lê `useT()`
          e as peças dentro dele leem primitivos. */}
      <UiComponentsProvider components={components}>
        <DesignerProvider {...props}>
          <div className={cx("jpd-designer", className)} style={style}>
            {/* O `.jpd-designer__main` é só o `display: flex` que põe as duas
                colunas lado a lado, com o gap.

                A largura de 320px mora em `.jpd-sidebar` (`inline-size: 20rem`
                em theme.css), ou seja NA PEÇA e não no preset. É um DEFAULT,
                não uma imposição: uma sidebar sem largura nenhuma colapsaria
                pro tamanho do conteúdo num flex row, o que é pior. Quem monta
                o próprio layout sobrescreve por `className` — regra do
                consumidor está fora de `@layer` e ganha da nossa (é o que o
                examples/report-builder faz, com `w-80 flex-shrink-0`). */}
            <div className="jpd-designer__main">
              <DesignerCanvas />
              {/* `whenTab` não é passado a nenhuma das duas: canvas e sidebar
                  aparecem sempre. O gate por aba acontece DENTRO da sidebar,
                  peça por peça. */}
              <DesignerSidebar />
            </div>
          </div>
        </DesignerProvider>
      </UiComponentsProvider>
    </I18nProvider>
  );
}
