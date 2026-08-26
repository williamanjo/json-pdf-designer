# Arquitetura

## Modelo de dados (`src/types/`)

```ts
export type PageSize = { width: number; height: number }; // em mm

export type BaseSchema = {
  id: string;       // uuid, estável (react-rnd/seleção usam isso)
  name: string;      // nome do campo — schemaName no sistema de vínculo
  x: number;          // mm, a partir do canto superior-esquerdo da página
  y: number;          // mm
  width: number;      // mm
  height: number;     // mm
};

export type TextSchema = BaseSchema & {
  type: "text";
  content: string;    // texto de design-time — pode ter {path} / {FUNÇÃO(...)}
  fontSize: number;
  fontColor: string;  // hex
  alignment: "left" | "center" | "right";
};

export type TableSchema = BaseSchema & {
  type: "table";
  head: string[];        // rótulos das colunas (preview de design-time)
  content: string[][];   // linhas de preview (design-time)
};

export type ImageSchema = BaseSchema & {
  type: "image";
  content: string; // data URI (base64)
};

export type Schema = TextSchema | TableSchema | ImageSchema;

export type Template = {
  page: PageSize;
  schemas: Schema[];
};

// Binding: igual ao já validado no report-builder (ver bindings.ts)
export type TableColumn = string | { label: string; formula: string };
export type Binding =
  | { schemaName: string; type: "scalar"; path: string }
  | { schemaName: string; type: "array"; path: string; columns: TableColumn[] }
  | { schemaName: string; type: "keyvalue"; paths: string[] }
  | { schemaName: string; type: "template"; template: string };
```

Unidade de medida: **mm** no modelo de dados (fácil de raciocinar — folha
A4 é 210×297mm), convertido pra **px** só na hora de renderizar no canvas
(via um fator de escala fixo, ex. 1mm = 3.78px a 96dpi) e pra **pt** na
hora de desenhar no PDF via pdf-lib (1mm = 2.83465pt).

## Canvas (`src/Designer.tsx`)

```
<div className="page" style={{ width: mmToPx(page.width), height: mmToPx(page.height) }}>
  {schemas.map((schema) => (
    <Rnd
      key={schema.id}
      size={{ width: mmToPx(schema.width), height: mmToPx(schema.height) }}
      position={{ x: mmToPx(schema.x), y: mmToPx(schema.y) }}
      onDragStop={(e, d) => updateSchema(schema.id, { x: pxToMm(d.x), y: pxToMm(d.y) })}
      onResizeStop={(e, dir, ref, delta, pos) => updateSchema(schema.id, {
        width: pxToMm(ref.offsetWidth),
        height: pxToMm(ref.offsetHeight),
        x: pxToMm(pos.x),
        y: pxToMm(pos.y),
      })}
      bounds="parent"
      onClick={() => setSelectedId(schema.id)}
    >
      <FieldRenderer schema={schema} selected={schema.id === selectedId} />
    </Rnd>
  ))}
</div>
```

`FieldRenderer` troca o que desenha por `schema.type` (texto: `<div>` com
o `content`; tabela: `<table>` de `head`+`content`; imagem: `<img>`).

Seleção (`selectedId`) dispara o painel de propriedades — **dentro da
mesma árvore React**, sem ponte de módulo. O botão de vínculo manual
(reusa o `ManualBindingPanel` já existente) fica logo ali, como qualquer
outro componente filho condicional.

Toolbar simples: botões "+ texto" / "+ tabela" / "+ imagem" (cria schema
com posição/tamanho default) e "Remover" pro campo selecionado — a
remoção já dispara a limpeza do binding correspondente (mesma lógica que
já existia: filtrar `bindings` por `schemaName` que ainda existe em
`schemas`).

## Geração do PDF (`src/pdf/generate.ts`)

```ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildInputs } from "./bindings";
import { mmToPt } from "./units";

export async function generatePdf(template: Template, data: unknown, bindings: Binding[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([mmToPt(template.page.width), mmToPt(template.page.height)]);
  const inputs = buildInputs(data, bindings); // já existe, sem mudança

  for (const schema of template.schemas) {
    const value = inputs[schema.name];
    const xPt = mmToPt(schema.x);
    // pdf-lib mede Y de baixo pra cima — inverte a partir do topo da página
    const yPt = mmToPt(template.page.height - schema.y - schema.height);

    if (schema.type === "text") {
      page.drawText(value ?? schema.content, { x: xPt, y: yPt, size: schema.fontSize, font, color: rgb(...) });
    } else if (schema.type === "table") {
      drawTable(page, font, schema, JSON.parse(value ?? "[]"), xPt, yPt);
    } else if (schema.type === "image") {
      const img = await doc.embedPng(schema.content); // ou embedJpg
      page.drawImage(img, { x: xPt, y: yPt, width: mmToPt(schema.width), height: mmToPt(schema.height) });
    }
  }

  return doc.save();
}
```

`drawTable` é a única peça 100% nova (motor antigo resolvia isso por
dentro do próprio plugin de tabela): itera linhas × colunas, desenha texto de cada célula +
`drawRectangle`/`drawLine` pras bordas. Fica em `src/pdf/drawTable.ts`,
separado pra não inchar `generate.ts`.

## Sistema de vínculo (`src/bindings/bindings.ts`)

Portado do `report-builder/src/lib/bindings.ts` quase sem mudança —
ver [SCOPE.md](SCOPE.md) pra lista exata do que muda (só os imports de
tipo). Toda a lógica de `resolveToken`/`renderTemplate`/`buildInputs` é
puro JS sobre strings/objetos, não tem nenhuma referência a lib de terceiros.
