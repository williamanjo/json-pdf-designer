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

// A placeable part: page size/orientation, header/footer heights, margins,
// background image and the isolated mode.
//
// The root is `.jpd-stack`, the SAME one `Designer.tsx` had.
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
      {/* This <label> was the ui/Button `outline` transcribed by hand,
          string by string. It now consumes the SAME classes as the kit: a
          `<label>` is not a `<button>`, but `.jpd-btn` + `data-size`/
          `data-variant` do not depend on the element (the reset's
          `appearance: button` is inert outside a widget). It stays a `<label>`
          because the file input has to sit inside for the click to open the picker. */}
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
