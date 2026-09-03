import { useContext, useMemo, useRef, type ReactNode } from "react";
import { UiComponentsContext, type UiComponents, type UiComponentsOverride } from "./registry";

// Troca os primitivos que o editor usa por dentro.
//
//   <UiComponentsProvider components={{ Button: MeuBotao }}>
//     <Designer ... />
//   </UiComponentsProvider>
//
// Substituição PARCIAL é o caso normal: o que não vier continua sendo o
// nosso. E a composição é chave-a-chave com o provider de cima, então dá pra
// definir o vocabulário do app na raiz e sobrescrever só o `Modal` num canto.
//
// POR QUE CONTEXTO PRÓPRIO, separado do estado do Designer: valor de slot é
// TIPO DE COMPONENTE. Se o mapa morasse no contexto de estado, cada mudança
// de estado reconstruiria o valor, as identidades trocariam, e o React
// desmontaria e remontaria cada primitivo slotado — o consumidor perderia o
// foco no meio da digitação. Com contexto próprio e `useMemo` na prop
// `components`, isso é estruturalmente impossível.
//
// INVARIANTE ANTI-RECURSÃO: nenhum primitivo slotável (Button, Input, Modal,
// ...) chama `useUiComponents`. Senão o adapter mais óbvio que existe —
// embrulhar o NOSSO componente pra ajustar algo —
//
//   { Button: (p) => <Button {...p} className={cx("meu", p.className)} /> }
//
// recursionaria pra sempre. Só o chrome e os compostos leem o registry.
// Guardado por varredura de fonte em test/uiSlots.test.tsx.
export type UiComponentsProviderProps = {
  // Só as chaves que você quer trocar. As outras vêm do provider PAI (ou dos
  // nossos, se não houver pai) — `undefined` numa chave significa HERDA, e
  // não volta-ao-default.
  //
  // Hoiste pra constante de módulo: identidade instável remonta o componente
  // slotado e o campo perde o foco a cada tecla.
  components?: UiComponentsOverride;
  children: ReactNode;
};

export function UiComponentsProvider({ components, children }: UiComponentsProviderProps) {
  // Mescla sobre o provider PAI, não sobre os nossos defaults. É o que
  // permite definir o vocabulário do app na raiz e sobrescrever só uma chave
  // num canto — mesclar sobre o default resetaria tudo que este provider não
  // menciona, o que é o oposto de "substituição parcial". (O contexto tem
  // `defaultUiComponents` como valor default, então sem pai nenhum o `parent`
  // já é o nosso conjunto.)
  const parent = useContext(UiComponentsContext);

  const value = useMemo<UiComponents>(() => {
    if (!components) return parent;
    // `undefined` é PODADO: `{ Modal: cond ? X : undefined }` significa
    // "herda", não "volta ao default". Voltar ao nosso se escreve
    // explicitamente com `defaultUiComponents.Modal`.
    const override = Object.fromEntries(Object.entries(components).filter(([, v]) => v !== undefined));
    return { ...parent, ...override } as UiComponents;
  }, [components, parent]);

  useUnstableIdentityWarning(components);

  return <UiComponentsContext.Provider value={value}>{children}</UiComponentsContext.Provider>;
}

// Aviso só em desenvolvimento: identidade instável é a aresta mais afiada
// desta API e é INVISÍVEL no sistema de tipos.
//
// Passar um objeto/função inline (`components={{ Button: (p) => ... }}`) cria
// um componente novo a cada render; o React vê tipo diferente, desmonta e
// remonta — e o sintoma é "perco o foco do input a cada tecla", que ninguém
// liga ao registry. Uma linha no console troca um bug desconcertante por
// instrução.
function useUnstableIdentityWarning(components: UiComponentsOverride | undefined) {
  const first = useRef<UiComponentsOverride | undefined>(undefined);
  const warned = useRef(false);

  if (process.env.NODE_ENV !== "production") {
    if (first.current === undefined) {
      first.current = components;
    } else if (!warned.current && components) {
      const changed = Object.keys(components).filter(
        (k) => (components as Record<string, unknown>)[k] !== (first.current as Record<string, unknown> | undefined)?.[k]
      );
      if (changed.length > 0) {
        warned.current = true;
        console.warn(
          `[json-pdf-designer] A identidade destes slots mudou depois do primeiro render: ${changed.join(", ")}. ` +
            "O React trata componente com identidade nova como tipo novo, então ele desmonta e remonta — o sintoma " +
            "costuma ser perder o foco do campo a cada tecla. Suba o mapa pra uma constante de módulo, ou memoize com useMemo."
        );
      }
    }
  }
}
