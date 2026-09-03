import { readPart, cx, type PartStyle } from "../../components/ui/cx";
import { useUiComponents } from "../../components/ui/useUiComponents";
import { useT } from "../../i18n";
import { useDesignerBulkEdit, useDesignerSelectedSchema, useDesignerSelection } from "../context/hooks";

// Cabeçalho do campo selecionado: o nome num `<Badge>`, mais o aviso de
// seleção múltipla ("N selecionados" ou "editando N em bloco").
//
// NÃO é peça posicionável, de propósito — é o pedaço compartilhado entre
// `DesignerPropertyPanel` e `DesignerFilterPanel`, que no `Designer.tsx`
// eram um só `<div className="jpd-sidebar__panel">` com este topo em comum.
// Duplicá-lo nas duas peças faria as duas divergirem; exportá-lo como peça
// daria ao consumidor um "cabeçalho" que só tem sentido grudado num painel.
//
// Fica num arquivo próprio (e não dentro de um dos dois) pra nenhuma peça
// importar a outra — invariante guardado por partBoundaries.test.ts.
export function SelectedFieldHeader({ banner: bannerPart }: { banner?: PartStyle }) {
  const t = useT();
  const { Badge, CardHeader } = useUiComponents();
  const { selectedIds } = useDesignerSelection();
  const { selected } = useDesignerSelectedSchema();
  const { bulkEditActive } = useDesignerBulkEdit();
  if (!selected) return null;
  const banner = readPart(bannerPart);
  return (
    <>
      {/* Enviar/trazer e remover já vivem na linha selecionada da lista de
          campos (aba "Campos") — sem duplicar aqui. */}
      <CardHeader>
        <Badge>{selected.name}</Badge>
      </CardHeader>
      {selectedIds.length > 1 && (
        <p className={cx("jpd-sidebar__banner", banner.className)} style={banner.style}>
          {bulkEditActive
            ? t.fieldsPanel.bulkEditBanner(selectedIds.length)
            : t.fieldsPanel.multiSelected(selectedIds.length, selected.name)}
        </p>
      )}
    </>
  );
}
