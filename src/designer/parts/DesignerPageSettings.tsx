import type { CSSProperties } from "react";
import { cx } from "../../components/ui/cx";
import { IconUpload } from "../../components/ui/icons";
import { useUiComponents } from "../../components/ui/useUiComponents";
import { useT } from "../../i18n";
import { matchPreset, orientationOf, PAGE_SIZE_PRESETS } from "../../page/sizes";
import { useDesignerActions, useDesignerData, useDesignerUi } from "../context/hooks";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerPageSettingsProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
};

// Peça posicionável: tamanho/orientação da página, alturas de
// cabeçalho/rodapé, margens, imagem de fundo e o modo isolado.
//
// A raiz é `.jpd-stack`, a MESMA que o `Designer.tsx` tinha.
export function DesignerPageSettings({ whenTab, ...rest }: DesignerPageSettingsProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerPageSettingsBody {...rest} />;
}

function DesignerPageSettingsBody({ className, style }: Omit<DesignerPageSettingsProps, "whenTab">) {
  const t = useT();
  const { Button, Input, Select } = useUiComponents();
  const { template } = useDesignerData();
  const { isolateBands, backgroundUploadError } = useDesignerUi();
  const { updatePageBand, setPagePreset, setPageOrientation, setBackgroundImage, toggleIsolateBands, handleBackgroundUpload } =
    useDesignerActions();

  return (
    <div className={cx("jpd-stack", className)} data-part="page-settings" style={style}>
      <div className="jpd-grid2">
        <Select label={t.pageSettings.pageSize} value={matchPreset(template.page) ?? ""} onChange={(e) => setPagePreset(e.target.value)}>
          {!matchPreset(template.page) && <option value="">{t.pageSettings.customSize}</option>}
          {PAGE_SIZE_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {t.pageSizeLabels[p.name as keyof typeof t.pageSizeLabels] ?? p.label}
            </option>
          ))}
        </Select>
        <Select
          label={t.pageSettings.orientation}
          value={orientationOf(template.page)}
          onChange={(e) => setPageOrientation(e.target.value as "portrait" | "landscape")}
        >
          <option value="portrait">{t.pageSettings.portrait}</option>
          <option value="landscape">{t.pageSettings.landscape}</option>
        </Select>
      </div>
      <div className="jpd-grid2">
        <Input
          label={t.pageSettings.header}
          type="number"
          min={0}
          value={template.headerHeight ?? 0}
          onChange={(e) => updatePageBand({ headerHeight: Number(e.target.value) || 0 })}
        />
        <Input
          label={t.pageSettings.footer}
          type="number"
          min={0}
          value={template.footerHeight ?? 0}
          onChange={(e) => updatePageBand({ footerHeight: Number(e.target.value) || 0 })}
        />
        <Input
          label={t.pageSettings.marginLeft}
          type="number"
          min={0}
          value={template.marginLeft ?? 0}
          onChange={(e) => updatePageBand({ marginLeft: Number(e.target.value) || 0 })}
        />
        <Input
          label={t.pageSettings.marginRight}
          type="number"
          min={0}
          value={template.marginRight ?? 0}
          onChange={(e) => updatePageBand({ marginRight: Number(e.target.value) || 0 })}
        />
      </div>
      {/* Este <label> era o `outline` do ui/Button transcrito à mão, string
          por string. Agora consome as MESMAS classes do kit: `<label>` não é
          `<button>`, mas `.jpd-btn` + `data-size`/`data-variant` não dependem
          do elemento (o `appearance: button` do reset é inerte fora de
          widget). Continua um `<label>` porque o input de arquivo tem de
          ficar por dentro pra o clique abrir o seletor. */}
      <label className="jpd-btn" data-size="sm" data-variant="outline">
        <IconUpload /> {t.pageSettings.backgroundUpload}
        <input type="file" accept="image/png,image/jpeg" onChange={handleBackgroundUpload} hidden />
      </label>
      {template.backgroundImage && (
        <Button variant="ghost" onClick={() => setBackgroundImage(undefined)}>
          {t.pageSettings.removeBackground}
        </Button>
      )}
      {backgroundUploadError && <span className="jpd-error jpd-error--md">{backgroundUploadError}</span>}
      <Button variant={isolateBands ? "primary" : "outline"} onClick={toggleIsolateBands} title={t.pageSettings.isolateTitle}>
        {isolateBands ? t.pageSettings.isolateOn : t.pageSettings.isolateOff}
      </Button>
    </div>
  );
}
