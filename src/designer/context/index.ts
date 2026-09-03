// Barrel do estado do editor. A superfície PÚBLICA disto entra na Fase 7
// (src/index.ts); por enquanto quem importa daqui é só o próprio designer.
export { DesignerProvider, type DesignerProviderProps } from "./DesignerProvider";
export {
  useDesignerActions,
  useDesignerBulkEdit,
  useDesignerConfig,
  useDesignerData,
  useDesignerFieldListSchemas,
  useDesignerFilterColumns,
  useDesignerSelectedSchema,
  useDesignerSelection,
  useDesignerTabWarnings,
  useDesignerUi,
} from "./hooks";
export type {
  DesignerActionsValue,
  DesignerConfigValue,
  DesignerDataValue,
  DesignerSelectionValue,
  DesignerUiValue,
} from "./contexts";
export { bandsOf, fieldListSchemasOf } from "./derived";
