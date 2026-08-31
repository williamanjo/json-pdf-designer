import type { Binding, Template } from "../../../src/types";

// Seção repetida cuja ALTURA AUTORADA sozinha (antes de qualquer
// crescimento por tabela mestre-detalhe) já é maior que o corpo disponível
// de uma página A4 inteira — testa que `generatePdf` não trava/entra em
// loop infinito de página vazia quando um único item nem cabe fisicamente
// numa página (o guard de segurança existe em generate.ts, isto testa o
// pipeline inteiro, não só a função isolada).
export function sectionLargerThanPageTemplate(): { template: Template; data: unknown; bindings: Binding[] } {
  const sectionId = "sec1";
  const template: Template = {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: sectionId,
        name: "secao_gigante",
        type: "section",
        x: 10,
        y: 10,
        width: 190,
        // Maior que a folha inteira (297mm) — nem cabe numa página vazia.
        height: 400,
      },
      {
        id: "txt1",
        name: "titulo_item",
        type: "text",
        x: 10,
        y: 10,
        width: 150,
        height: 10,
        content: "Item da seção",
        fontSize: 10,
        fontColor: "#000000",
        alignment: "left",
        sectionId,
      },
    ],
  };
  const bindings: Binding[] = [{ schemaName: "secao_gigante", type: "section", path: "itens" }];
  const data = { itens: [{}, {}] }; // 2 repetições — cada uma maior que 1 página inteira.
  return { template, data, bindings };
}
