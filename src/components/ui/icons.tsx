// Ícones inline (sem dependência externa) — stroke consistente 1.8, 16x16.
type IconProps = { className?: string };

const base = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconX({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

export function IconGrip({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLink({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" />
    </svg>
  );
}

export function IconMinus({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconArrowsHorizontal({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" />
    </svg>
  );
}

export function IconArrowsVertical({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v18M12 3l-4 4M12 3l4 4M12 21l-4-4M12 21l4-4" />
    </svg>
  );
}

export function IconUpload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3M7 9l5-5 5 5M12 4v12" />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v13m0 0 4-4m-4 4-4-4M4 20h16" />
    </svg>
  );
}

export function IconFolderUp({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 20V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

export function IconDots({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Material Symbols "lock"/"lock_open_right" — preenchido, viewBox próprio
// (não usa `base`, que é pensado pra ícones em traço/stroke).
export function IconLock({ className }: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 -960 960 960" fill="currentColor" className={className}>
      <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z" />
    </svg>
  );
}

export function IconBringToFront({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="10" height="10" rx="1" opacity="0.4" />
      <rect x="9" y="9" width="12" height="12" rx="1" />
    </svg>
  );
}

export function IconSendToBack({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="9" width="12" height="12" rx="1" opacity="0.4" />
      <rect x="3" y="3" width="10" height="10" rx="1" />
    </svg>
  );
}

export function IconLockOpen({ className }: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 -960 960 960" fill="currentColor" className={className}>
      <path d="M240-160h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM240-160v-400 400Zm0 80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h280v-80q0-83 58.5-141.5T720-920q83 0 141.5 58.5T920-720h-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80h120q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Z" />
    </svg>
  );
}

// Aviso — campo faltando alguma coisa (vínculo com o JSON, condição de
// filtro sem valor etc.) na lista de campos, ver FieldList.tsx.
export function IconAlertTriangle({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
