import type { Dict, PageSize, Schema, TemplatePage } from "json-pdf-designer/server";
// Geometria mora em lib/ e não aqui: arquivo de componente que também
// exporta constante quebra o Fast Refresh (oxlint react(only-export-components)).
import { GRID_MM, MIN_HEIGHT_MM, MIN_WIDTH_MM, PX_PER_MM, snap } from "../lib/geometry";


// Arrasta/redimensiona um campo na mão, sem react-rnd nem qualquer peça do
// pacote — só mousedown/mousemove/mouseup do DOM, convertendo delta em px
// pra delta em mm (PX_PER_MM). É exatamente essa lógica (não o componente
// <Designer>) que este example existe pra provar que dá pra escrever do
// zero, por cima só do modelo de dados (Schema/Template) do pacote.
function CanvasField({
  field,
  selected,
  t,
  onSelect,
  onMove,
  onResize,
}: {
  field: Schema;
  selected: boolean;
  // Só o dicionário do PACOTE aqui: a miniatura de um campo sem conteúdo
  // legível (gráfico, seção, imagem) é o NOME DO TIPO, e tipo de campo é
  // conceito dele. Nenhum rótulo desta caixa é frase própria deste app.
  t: Dict;
  onSelect: () => void;
  onMove: (xMm: number, yMm: number) => void;
  onResize: (widthMm: number, heightMm: number) => void;
}) {
  function startDrag(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect();
    if (field.locked) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = field.x;
    const origY = field.y;
    function onMouseMove(ev: MouseEvent) {
      const dxMm = (ev.clientX - startX) / PX_PER_MM;
      const dyMm = (ev.clientY - startY) / PX_PER_MM;
      onMove(snap(Math.max(0, origX + dxMm)), snap(Math.max(0, origY + dyMm)));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function startResize(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    if (field.locked) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = field.width;
    const origH = field.height;
    function onMouseMove(ev: MouseEvent) {
      const dwMm = (ev.clientX - startX) / PX_PER_MM;
      const dhMm = (ev.clientY - startY) / PX_PER_MM;
      onResize(snap(Math.max(MIN_WIDTH_MM, origW + dwMm)), snap(Math.max(MIN_HEIGHT_MM, origH + dhMm)));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // Texto/tabela/KPI mostram o CONTEÚDO do campo (dado do documento, no
  // idioma em que foi escrito). Os outros três não têm conteúdo legível, então
  // mostram o nome do tipo — e esse vem do dicionário do pacote, incluindo
  // "Pizza"/"Barra" e o "(seção repetida)" de `t.binding`.
  const preview =
    field.type === "text"
      ? field.content
      : field.type === "table"
        ? field.head.join(" | ")
        : field.type === "kpi"
          ? `${field.title ?? ""}: ${field.value ?? ""}`
          : field.type === "chart"
            ? `${t.fieldTypeLabels.chart} (${field.chartType === "bar" ? t.chart.bar : t.chart.pie})`
            : field.type === "section"
              ? `${t.fieldTypeLabels.section} ${t.binding.repeatedSection}`
              : t.fieldTypeLabels.image;

  return (
    <div
      className={`canvas-field${selected ? " selected" : ""}${field.locked ? " locked" : ""}`}
      style={{
        left: field.x * PX_PER_MM,
        top: field.y * PX_PER_MM,
        width: field.width * PX_PER_MM,
        height: field.height * PX_PER_MM,
      }}
      onMouseDown={startDrag}
    >
      {/* O recorte do conteúdo mora neste wrapper, não no `.canvas-field`: as
          alças de canto do estado selecionado são desenhadas FORA da caixa
          (`.canvas-field.selected::after`, com `inset: -4px`) e um
          `overflow: hidden` no pai as cortaria. */}
      <div className="canvas-field-body">
        <span className="canvas-field-label">{field.name}</span>
        <div className="canvas-field-preview">{preview}</div>
      </div>
      {/* Condição de visibilidade é invisível no PDF quando o dado não bate —
          então o canvas marca que ela existe, senão o campo "desaparecido"
          fica sem explicação. */}
      {field.visibleWhen && <span className="canvas-field-flag">?</span>}
      <div className="resize-handle" onMouseDown={startResize} />
    </div>
  );
}

type Props = {
  page: TemplatePage;
  selectedId: string | null;
  // Repassado pra cada `<CanvasField>` — ver o comentário lá.
  t: Dict;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
  onResize: (id: string, widthMm: number, heightMm: number) => void;
  // Drop de um campo do explorador: recebe o payload cru do dataTransfer e a
  // posição em mm dentro da página — quem monta o schema é o App.
  onDropField: (rawJson: string, xMm: number, yMm: number) => void;
};

function bandStyle(size: PageSize, top: number, height: number) {
  return { top: top * PX_PER_MM, height: height * PX_PER_MM, width: size.width * PX_PER_MM };
}

// A página do canvas — só um retângulo branco do tamanho da folha, com os
// campos posicionados absolutamente por cima. Nada aqui vem do pacote: nem
// <DesignerCanvas>, nem react-rnd, nem CSS de tema.
export default function Canvas({ page, selectedId, t, onSelect, onMove, onResize, onDropField }: Props) {
  const size = page.page;
  const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0 } = page;

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    // Solta ONDE soltou: o canvas conhece a escala (PX_PER_MM), então dá pra
    // converter a posição do mouse em mm em vez de empilhar o campo novo no
    // primeiro Y livre (o que o <Designer> faz, porque lá o drop não sabe a
    // geometria da folha).
    const rect = e.currentTarget.getBoundingClientRect();
    const xMm = snap(Math.max(0, (e.clientX - rect.left) / PX_PER_MM));
    const yMm = snap(Math.max(0, (e.clientY - rect.top) / PX_PER_MM));
    onDropField(raw, xMm, yMm);
  }

  return (
    <div
      className="canvas-page"
      style={
        {
          width: size.width * PX_PER_MM,
          height: size.height * PX_PER_MM,
          // PAPEL MILIMETRADO — e o passo dele sai DA ESCALA DESTE CANVAS, não
          // de um número solto no CSS. O `index.css` desenha quatro
          // `repeating-linear-gradient` (1mm fraca, 5mm forte) e lê o passo
          // destas duas custom properties; publicá-las aqui é o que mantém a
          // grade DESENHADA e a grade de COMPORTAMENTO (o snap de `GRID_MM`)
          // no mesmo número: mexer em PX_PER_MM move as duas juntas.
          //
          // Só este example pode fazer isso: nos outros quatro o canvas é o
          // `<DesignerCanvas>` do pacote, e a folha é o que o tema disser.
          "--bp-grid-minor": `${PX_PER_MM}px`,
          "--bp-grid-major": `${GRID_MM * PX_PER_MM}px`,
          // O cast é por causa das custom properties: `CSSProperties` não
          // aceita chave arbitrária, e é o padrão recomendado pra isso.
        } as React.CSSProperties
      }
      onMouseDown={() => onSelect(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Faixas de cabeçalho/rodapé/margem da PÁGINA (mm) — um campo entra no
          cabeçalho do PDF só por cair dentro da faixa, não por marcação
          própria (ver zones.ts do pacote). Desenhar as faixas é o que faz
          isso deixar de ser mágica. */}
      {headerHeight > 0 && <div className="canvas-band" style={bandStyle(size, 0, headerHeight)} />}
      {footerHeight > 0 && (
        <div className="canvas-band" style={bandStyle(size, size.height - footerHeight, footerHeight)} />
      )}
      {marginLeft > 0 && (
        <div
          className="canvas-band canvas-band--side"
          style={{ top: 0, left: 0, width: marginLeft * PX_PER_MM, height: size.height * PX_PER_MM }}
        />
      )}
      {marginRight > 0 && (
        <div
          className="canvas-band canvas-band--side"
          style={{ top: 0, right: 0, width: marginRight * PX_PER_MM, height: size.height * PX_PER_MM }}
        />
      )}

      {page.schemas.map((f) => (
        <CanvasField
          key={f.id}
          field={f}
          selected={f.id === selectedId}
          t={t}
          onSelect={() => onSelect(f.id)}
          onMove={(x, y) => onMove(f.id, x, y)}
          onResize={(width, height) => onResize(f.id, width, height)}
        />
      ))}
    </div>
  );
}
