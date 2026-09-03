import { useEffect, useState } from "react";
import { Designer, classifyZone, dictFor, makeSectionColumnPair } from "json-pdf-designer";
import type { Binding, Locale, Schema, SectionSchema, TableSchema, Template, TextSchema } from "json-pdf-designer";
import type { FieldNode } from "../lib/jsonExplorer";
import { sanitizeName } from "../lib/jsonExplorer";
import { uid } from "../lib/uid";
import FieldTree from "./FieldTree";
import { t } from "../i18n";
import { MEUS_PRIMITIVOS } from "../uiSlots";

type Props = {
  fields: FieldNode[];
  template: Template;
  bindings: Binding[];
  // Aceita a forma funcional do setState do React — evita perder um campo
  // se dois forem adicionados em sequência rápida (antes do primeiro
  // re-render), já que cada chamada calcula a posição a partir do estado
  // mais atual, não de uma closure velha.
  onChangeTemplate: React.Dispatch<React.SetStateAction<Template>>;
  onChangeBindings: React.Dispatch<React.SetStateAction<Binding[]>>;
  openFieldPickerRef?: React.MutableRefObject<(() => void) | null>;
  // Um valor, dois destinos: entra no `<Designer locale>` (o editor fala esse
  // idioma) e no `t(locale)` da casca (o modal do explorador de campos,
  // abaixo, fala o mesmo).
  locale: Locale;
};

function nextFreeY(schemas: Schema[]): number {
  if (schemas.length === 0) return 10;
  return Math.max(...schemas.map((s) => s.y + s.height)) + 5;
}

// Empilha só em cima de campos do CORPO — sem isso, um rodapé (ou
// cabeçalho/margem) já colocado fazia o próximo campo nascer logo abaixo
// dele (nextFreeY olhava todo mundo, inclusive faixa vermelha), caindo na
// própria faixa por acidente (zona é só posição, não intenção).
function bodyPosition(template: Template, schemas: Schema[]): { x: number; y: number } {
  const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0 } = template;
  const bands = { headerHeight, footerHeight, marginLeft, marginRight };
  const bodySchemas = schemas.filter((s) => classifyZone(s, template.page, bands) === "body");
  return { x: Math.max(10, marginLeft + 2), y: Math.max(nextFreeY(bodySchemas), headerHeight + 2) };
}

// O <Designer> PRESET, não as peças — é a identidade deste example no
// espectro (ver README.md daqui). Tudo que o explorador de campos precisa
// do editor cabe em duas props públicas do preset: `onCanvasDrop` (soltar
// campo na página) e `dataSources` (arrays conhecidos viram dropdown no
// editor de vínculo, em vez de path digitado à mão).
//
// O que NÃO cabe é ler a seleção do editor de fora — isso exige montar o
// <DesignerProvider> na mão, e é justamente o que o report-builder faz com
// a SelectedFieldBar dele. Aqui, preset por definição.
export default function DesignerPanel({
  fields,
  template,
  bindings,
  onChangeTemplate,
  onChangeBindings,
  openFieldPickerRef,
  locale,
}: Props) {
  const s = t(locale);
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  useEffect(() => {
    if (openFieldPickerRef) openFieldPickerRef.current = () => setShowFieldPicker(true);
  }, [openFieldPickerRef]);

  // Coluna individual de um DataSource (arrastada/clicada sozinha, não o
  // grupo inteiro) — só entra se já existir uma seção vinculada a esse
  // mesmo array (mesmo path); sem seção, não faz nada (nada de criar tabela
  // ou campo solto pra uma coluna avulsa). Posição/nome são calculados uma
  // vez só, fora dos dois callbacks funcionais, e reaproveitados nos dois —
  // mesmo padrão usado abaixo pro `schemaName`/`content` do campo escalar
  // (a única coisa que os dois setState precisam compartilhar é ESSE valor,
  // não o estado fresco em si; cada `prev` continua sendo lido de dentro do
  // próprio callback).
  function addColumnToMatchingSection(field: Extract<FieldNode, { kind: "arrayColumn" }>) {
    const sectionBinding = bindings.find(
      (b): b is Extract<Binding, { type: "section" }> => b.type === "section" && b.path === field.sourcePath
    );
    if (!sectionBinding) return;
    const section = template.schemas.find(
      (s): s is SectionSchema => s.type === "section" && s.name === sectionBinding.schemaName
    );
    if (!section) return;

    const members = template.schemas.filter((s) => s.sectionId === section.id);
    const y = members.length > 0 ? Math.max(...members.map((m) => m.y + m.height)) + 2 : section.y + 2;
    const x = section.x + 2;
    const { header, value, valueBinding } = makeSectionColumnPair(section.id, field.column, x, y);
    const bottom = y + Math.max(header.height, value.height);

    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas
        .map((s) => (s.id === section.id && s.type === "section" && bottom - s.y > s.height ? { ...s, height: bottom - s.y } : s))
        .concat([header, value]),
    }));
    onChangeBindings((prev) => [...prev, valueBinding]);
  }

  // Cria o schema (text/table) já vinculado ao path do JSON e joga no
  // canvas — usado tanto pelo drop do FieldTree (canvas) quanto pelo "+" do
  // seletor de campos (modal).
  function addFieldToCanvas(field: FieldNode) {
    if (field.kind === "arrayColumn") {
      addColumnToMatchingSection(field);
      return;
    }

    const schemaName = `${sanitizeName(field.path)}_${Math.random().toString(36).slice(2, 6)}`;

    if (field.kind === "arraySource" && field.columns && field.columns.length > 0) {
      const columns = field.columns;
      onChangeTemplate((prev) => {
        const pos = bodyPosition(prev, prev.schemas);
        const schema: TableSchema = {
          id: uid(),
          name: schemaName,
          type: "table",
          x: pos.x,
          y: pos.y,
          width: 180,
          height: 30,
          head: columns,
          content: [columns.map((c) => c.toUpperCase())],
        };
        return { ...prev, schemas: [...prev.schemas, schema] };
      });
      onChangeBindings((prev) => [...prev, { schemaName, type: "array", path: field.path, columns }]);
      return;
    }

    if (field.kind === "arraySource") {
      // sem colunas (array de valores simples) — não cria nada
      return;
    }

    const content = `{${field.path}}`;
    onChangeTemplate((prev) => {
      const pos = bodyPosition(prev, prev.schemas);
      const schema: TextSchema = {
        id: uid(),
        name: schemaName,
        type: "text",
        x: pos.x,
        y: pos.y,
        width: 90,
        height: 8,
        content,
        fontSize: 11,
        fontColor: "#000000",
        alignment: "left",
      };
      return { ...prev, schemas: [...prev.schemas, schema] };
    });
    onChangeBindings((prev) => [...prev, { schemaName, type: "template", template: content }]);
  }

  function handleCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    addFieldToCanvas(JSON.parse(raw) as FieldNode);
  }

  // Arrays já detectados no JSON de exemplo — vira dropdown "Data Source"
  // no vínculo de tabela (BindingEditor), em vez de path digitado livre.
  const dataSources = fields
    .filter((f): f is Extract<FieldNode, { kind: "arraySource" }> => f.kind === "arraySource")
    .map((f) => ({ path: f.path, label: f.path, columns: f.columns, columnTypes: f.columnTypes }));

  return (
    <>
      <Designer
        template={template}
        onChangeTemplate={onChangeTemplate}
        bindings={bindings}
        onChangeBindings={onChangeBindings}
        onCanvasDrop={handleCanvasDrop}
        dataSources={dataSources}
        locale={locale}
        // Troca DOIS dos 12 primitivos que o editor usa por dentro — ver
        // src/uiSlots.tsx. `components` é açúcar: ele monta um
        // <UiComponentsProvider> por volta do editor.
        //
        // A constante é de MÓDULO, não objeto inline: identidade instável
        // remonta o componente slotado e o campo perde o foco a cada tecla.
        components={MEUS_PRIMITIVOS}
      />

      {showFieldPicker && (
        <div className="app-overlay" onClick={() => setShowFieldPicker(false)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <div className="app-modal__head">
              <h3 className="app-modal__title">{s.fields.title}</h3>
              {/* REUSO em vez de dicionário próprio: "fechar o modal" é
                  conceito DO PACOTE — o `<Modal>` dele já tem esse nome
                  acessível traduzido em `modal.close`. Duplicar aqui criaria
                  duas traduções da mesma frase pra dessincronizar. `dictFor`
                  dá o dicionário como VALOR, que é o que serve fora de um
                  <I18nProvider> (o `useT()` só funciona dentro dele). */}
              <button
                type="button"
                className="app-icon-btn"
                onClick={() => setShowFieldPicker(false)}
                aria-label={dictFor(locale).modal.close}
              >
                ×
              </button>
            </div>
            <p className="app-hint">{s.fields.pickerHint}</p>
            <div className="app-modal__body">
              <FieldTree
                locale={locale}
                fields={fields}
                onAdd={(field) => {
                  addFieldToCanvas(field);
                  setShowFieldPicker(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
