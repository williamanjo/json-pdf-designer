// Barrel das peças posicionáveis. A superfície PÚBLICA disto entra na
// Fase 7 (src/index.ts); por enquanto quem importa daqui é o Designer.tsx.
export { DesignerBindingEditor, type DesignerBindingEditorProps } from "./DesignerBindingEditor";
export { DesignerCanvas, type DesignerCanvasProps } from "./DesignerCanvas";
export { DesignerFieldList, type DesignerFieldListProps } from "./DesignerFieldList";
export { DesignerFilterPanel, type DesignerFilterPanelProps } from "./DesignerFilterPanel";
export { DesignerInspector, type DesignerInspectorProps } from "./DesignerInspector";
export { DesignerPageSettings, type DesignerPageSettingsProps } from "./DesignerPageSettings";
export { DesignerPropertyPanel, type DesignerPropertyPanelProps } from "./DesignerPropertyPanel";
export { DesignerSidebar, type DesignerSidebarProps } from "./DesignerSidebar";
export { DesignerTabBar, type DesignerTabBarProps } from "./DesignerTabBar";
export { DesignerToolbar, type DesignerToolbarProps } from "./DesignerToolbar";
export type { TabGate } from "./useTabGate";
