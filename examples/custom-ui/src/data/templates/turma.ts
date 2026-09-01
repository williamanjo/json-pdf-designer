import type { Template, Binding } from "json-pdf-designer";
import turmaSample from "../samples/turmaSample.json";
import type { ExampleDefinition } from "./types";

// Exemplo: "Boletim de Turma" — seção repetindo por aluno SEM nenhuma
// tabela dentro, só um campo de texto membro (uma "linha" por aluno) —
// mostra que seção funciona igual de bem só com texto. Usa {Line} (número
// da repetição) e AVG/COUNT direto no fechamento.
const template: Template = {
  version: 1,
  page: { width: 210, height: 297 },
  schemas: [
    {
      id: "turma-titulo",
      name: "turma_titulo",
      type: "text",
      x: 10,
      y: 12,
      width: 190,
      height: 8,
      content: "Boletim de Turma — {turma.nome}",
      fontSize: 13,
      fontColor: "#111111",
      alignment: "center",
      backgroundColor: "#fef3c7",
      borderColor: "#d97706",
      borderWidth: 0.2,
    },
    {
      id: "turma-info",
      name: "turma_info",
      type: "text",
      x: 10,
      y: 22,
      width: 190,
      height: 6,
      content: "{turma.professor} — {turma.periodo}",
      fontSize: 9,
      fontColor: "#444444",
      alignment: "center",
    },
    {
      id: "turma-secao",
      name: "turma_secao",
      type: "section",
      x: 10,
      y: 34,
      width: 190,
      height: 8,
    },
    {
      id: "turma-aluno-linha",
      name: "turma_aluno_linha",
      type: "text",
      x: 10,
      y: 34,
      width: 190,
      height: 8,
      content: "{Line}. {nome} — Matrícula {matricula} — Nota: {nota} — Frequência: {frequencia}%",
      fontSize: 9,
      fontColor: "#1f2937",
      alignment: "left",
      sectionId: "turma-secao",
    },
    {
      id: "turma-fechamento",
      name: "turma_fechamento",
      type: "text",
      x: 10,
      y: 78,
      width: 190,
      height: 6,
      content: "Total de alunos: {COUNT(alunos)} — Média da turma: {AVG(alunos.nota)}",
      fontSize: 10,
      fontColor: "#111111",
      alignment: "left",
    },
  ],
};

const bindings: Binding[] = [{ schemaName: "turma_secao", type: "section", path: "alunos" }];

export const turmaExample: ExampleDefinition = {
  label: "Boletim de Turma (seção só com texto)",
  template,
  bindings,
  sample: turmaSample,
  sourceName: "turma",
};
