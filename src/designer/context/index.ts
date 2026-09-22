// The barrel of the editor's state. Its PUBLIC surface lands in Phase 7
// (src/index.ts); for now the only importer is the designer itself.
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
