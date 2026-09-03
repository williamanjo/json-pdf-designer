import { useContext } from "react";
import { UiComponentsContext, type UiComponents } from "./registry";

// Os primitivos a usar AQUI, agora — os nossos por default, ou os do
// consumidor se houver um <UiComponentsProvider> acima.
//
// Uso no chrome do editor: destrutura no topo do componente e o JSX abaixo
// fica igual ao que era com import concreto.
//
//   const { Button, Input } = useUiComponents();
//
// INVARIANTE: primitivo SLOTÁVEL não chama isto. Ver o comentário em
// UiComponentsProvider.tsx — é o que evita recursão infinita no adapter mais
// óbvio que existe (embrulhar o nosso próprio Button). Guardado por varredura
// de fonte em test/uiSlots.test.tsx.
export function useUiComponents(): UiComponents {
  return useContext(UiComponentsContext);
}
