import type { Schema } from "../types";
import { Button } from "./ui";
import { IconLock, IconLockOpen, IconTrash } from "./ui/icons";

type Props = {
  schemas: Schema[];
  selectedIds: string[];
  onSelect: (id: string, additive?: boolean) => void;
  onRemove: (id: string) => void;
  onToggleLock: (id: string) => void;
};

const typeLabel: Record<Schema["type"], string> = {
  text: "Texto",
  table: "Tabela",
  image: "Imagem",
  section: "Seção",
  chart: "Gráfico",
  kpi: "Indicador",
};

// Lista de todo campo já colocado na página — clique seleciona (abre o
// Field Edit logo abaixo); cadeado trava/destrava mover/redimensionar no
// canvas (continua editável pelo painel); lixeira remove direto, sem
// precisar selecionar primeiro.
export function FieldList({ schemas, selectedIds, onSelect, onRemove, onToggleLock }: Props) {
  if (schemas.length === 0) {
    return <p className="text-xs text-slate-400 dark:text-gray-400">Nenhum campo ainda — use os botões "+" acima do canvas.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {schemas.map((schema) => (
        <li
          key={schema.id}
          className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors ${
            selectedIds.includes(schema.id)
              ? "border-sky-500 bg-sky-50 dark:border-blue-400 dark:bg-blue-400/10"
              : "border-slate-200 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-700"
          }`}
        >
          <button
            type="button"
            onClick={(e) => onSelect(schema.id, e.ctrlKey || e.metaKey)}
            className="min-w-0 flex-1 truncate text-left text-xs"
          >
            <span className="font-medium text-slate-700 dark:text-gray-200">{schema.name}</span>
            <span className="ml-1.5 text-slate-400 dark:text-gray-400">{typeLabel[schema.type]}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleLock(schema.id)}
            aria-label={schema.locked ? `Destravar ${schema.name}` : `Travar ${schema.name}`}
            title={schema.locked ? "Destravar (permitir mover/redimensionar)" : "Travar (impedir mover/redimensionar)"}
          >
            {schema.locked ? <IconLock /> : <IconLockOpen />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onRemove(schema.id)} aria-label={`Remover ${schema.name}`}>
            <IconTrash />
          </Button>
        </li>
      ))}
    </ul>
  );
}
