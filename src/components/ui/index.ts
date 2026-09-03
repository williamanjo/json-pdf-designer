export { Button, type ButtonProps } from "./Button";
export { Input, ColorInput, type InputProps, type ColorInputProps } from "./Input";
export { Textarea, type TextareaProps } from "./Textarea";
export { Select, type SelectProps } from "./Select";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { Card, CardHeader, CardTitle, Badge, type CardProps, type CardTitleProps, type BadgeProps } from "./Card";
export { TabPanel, type TabPanelProps } from "./TabPanel";
export { Modal, type ModalProps } from "./Modal";
export { BulkLocked, type BulkLockedProps } from "./BulkLocked";
export { PalettePicker, type PalettePickerProps, type PaletteGroup, type PaletteGroupItem } from "./PalettePicker";
export { PaletteSwatches, type PaletteSwatchesProps } from "./PaletteSwatches";
export { ClearFieldButton, type ClearFieldButtonProps } from "./ClearFieldButton";
export { CollapsibleSection, type CollapsibleSectionProps } from "./CollapsibleSection";
// Tipos da API de estilo: `parts` de qualquer componente é montado com eles,
// e um adapter de slot (Fase 4) precisa nomeá-los sem re-derivar.
export type { PartStyle, ClassValue } from "./cx";
export type { LabeledParts } from "./Labeled";
export { MaterialIcon, type MaterialIconProps } from "./MaterialIcon";
// Props dos 20 ícones. `SVGAttributes`, e de propósito NÃO `SVGProps` — ver
// o comentário de icons.tsx.
export type { IconProps } from "./icons";
export {
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconTrash,
  IconGrip,
  IconLink,
  IconMinus,
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconDots,
  IconUpload,
  IconLock,
  IconLockOpen,
  IconBringToFront,
  IconSendToBack,
  IconRefresh,
  IconDownload,
  IconFolderUp,
  IconAlertTriangle,
} from "./icons";
