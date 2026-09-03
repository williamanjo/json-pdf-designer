import { Checkbox, type CheckboxProps, type SelectProps, type UiComponentsOverride } from "json-pdf-designer";

// TROCANDO OS PRIMITIVOS QUE O EDITOR USA POR DENTRO.
//
// Este é o único example que demonstra o registry de slots. Ele existe porque
// a 3.0.0 abriu os 12 primitivos do editor (`Button`, `Input`, `ColorInput`,
// `Select`, `Textarea`, `Checkbox`, `Modal`, `Card`, `CardHeader`,
// `CardTitle`, `Badge`, `TabPanel`) pra substituição — e é a única parte
// dessa API que nenhum example exercitava.
//
// Aqui trocamos DOIS de propósito, não os doze: o ponto é mostrar a mecânica
// e a forma do adapter. Substituir todos é o mesmo gesto, repetido.
//
// ┌─ POR QUE ESTE EXAMPLE ─────────────────────────────────────────────────┐
// │ Ele usa o `<Designer>` PRESET, e `<Designer components={...}>` é o     │
// │ açúcar que monta o `<UiComponentsProvider>` — o caminho que a maioria  │
// │ dos consumidores toma. Quem renderiza peça avulsa monta o provider na  │
// │ mão.                                                                   │
// │                                                                        │
// │ E por que NÃO no `custom-ui`, que seria o palpite óbvio: lá a          │
// │ identidade é estilizar as ~190 classes `.jpd-*` que o editor emite.    │
// │ Trocar os primitivos REMOVE do DOM justamente as `.jpd-btn`/           │
// │ `.jpd-input`/`.jpd-select` que aquele CSS estiliza. As duas coisas são │
// │ mutuamente exclusivas.                                                 │
// └────────────────────────────────────────────────────────────────────────┘

// CONSTANTE DE MÓDULO, e isto é load-bearing.
//
// Objeto inline (`components={{ Select: ... }}` escrito no JSX) cria um
// componente NOVO a cada render, e o React desmonta/remonta o que trocou de
// identidade — o sintoma é o campo perder o foco a cada tecla digitada.
// Fora de produção o provider avisa no console, uma vez.
//
// `satisfies` em vez de `:` pra o TypeScript ainda inferir o tipo exato de
// cada adapter (com `:` ele alargaria pro tipo do slot e perderia a
// checagem de que as props batem).
export const MEUS_PRIMITIVOS = {
  // ---- Select ------------------------------------------------------------
  // Um `<select>` nativo vestido de widget de terminal: colchetes `[ ]` e
  // uma seta `▾` verde desenhados em CSS (`.slot-select`, ver index.css),
  // rótulo em caixa alta verde. É pra dar pra ver na tela, sem DevTools, que
  // o primitivo é nosso e não do pacote — a demonstração precisa ser visível
  // pra existir.
  //
  // As props que são NOSSAS (`label`, `parts`) saem por destructuring; o
  // resto (`value`, `onChange`, `children`, `aria-*`, ...) é passado
  // adiante. É a forma canônica do adapter de ~5 linhas.
  //
  // `label` é a prop que MORDE: o editor tem ~16 controles cujo nome
  // acessível vem daí. Um slot que a descarta deixa leitor de tela sem nada
  // pra anunciar. Aqui ela é honrada num `<label>` de verdade.
  //
  // E ela chega JÁ TRADUZIDA: quem monta esses ~16 controles é o editor, que
  // lê o `locale` do `<Designer>` (ver DesignerPanel.tsx). Este adapter não
  // toca no dicionário da casca (src/i18n.ts) por isso — o texto não é dele,
  // e traduzir de novo aqui seria uma segunda tradução pra dessincronizar.
  // Nada mais neste arquivo é texto: se algum dia um placeholder ou
  // `aria-label` NOSSO nascer aqui, ele entra no dicionário da casca — e aí
  // o mapa precisa virar função de `locale`, porque constante de módulo não
  // pode depender de estado (ver o aviso acima).
  Select: ({ label, parts: _parts, children, ...rest }: SelectProps) => (
    <label className="slot-field" data-slot="select">
      {label && <span className="slot-field__label">{label}</span>}
      <span className="slot-select">
        <select {...rest}>{children}</select>
      </span>
    </label>
  ),

  // ---- Checkbox ----------------------------------------------------------
  // Aqui o adapter EMBRULHA o nosso próprio `<Checkbox>` em vez de
  // reimplementá-lo — é o caso de uso mais natural que existe ("quero o
  // comportamento do pacote, com uma casca minha em volta").
  //
  // Isto só é possível por causa de uma invariante do desenho: primitivo
  // slotável NUNCA lê o registry. Se o `<Checkbox>` do kit resolvesse a si
  // mesmo pelo `useUiComponents()`, este adapter recursionaria pra sempre.
  // Há um teste de fonte no pacote que garante isso (`test/uiSlots.test.tsx`,
  // describe "invariante anti-recursão").
  Checkbox: (props: CheckboxProps) => (
    <span className="slot-check" data-slot="checkbox">
      <Checkbox {...props} />
    </span>
  ),

  // Os outros 10 slots não vêm aqui — e `undefined` numa chave significaria
  // HERDA (do provider pai), não "volta ao nosso". Simplesmente omitir é o
  // jeito de dizer "esse aí fica sendo o do pacote".
} satisfies UiComponentsOverride;
