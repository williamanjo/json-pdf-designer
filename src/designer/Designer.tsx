import type { CSSProperties, DragEvent } from "react";
import type { Binding, DataSourceOption, Template } from "../types";
import { I18nProvider, type Locale } from "../i18n";
import { cx } from "../components/ui/cx";
import { UiComponentsProvider } from "../components/ui/UiComponentsProvider";
import type { UiComponentsOverride } from "../components/ui/registry";
import { DesignerProvider } from "./context/DesignerProvider";
import { DesignerCanvas } from "./parts/DesignerCanvas";
import { DesignerSidebar } from "./parts/DesignerSidebar";

export type DesignerProps = {
  template: Template;
  // It accepts React's setState directly (functional form included) — this
  // avoids overwriting a concurrent change because of a stale closure (e.g.
  // two fields added in quick succession, before the first render
  // happened).
  onChangeTemplate: React.Dispatch<React.SetStateAction<Template>>;
  bindings: Binding[];
  onChangeBindings: React.Dispatch<React.SetStateAction<Binding[]>>;
  // A passthrough to the canvas container — used by anyone who wants to drop
  // external fields (e.g. a JSON field explorer) straight onto the page.
  onCanvasDrop?: (e: DragEvent<HTMLDivElement>) => void;
  // Known arrays of the sample JSON — they become the "Data Source" dropdown
  // in the table binding (see BindingEditor). Without it, a freely typed path.
  dataSources?: DataSourceOption[];
  // Language of the designer's UI (buttons, tabs, warnings) — default "en".
  // It only affects what this component SAYS to whoever is building the
  // report; it does not change how the generated PDF formats dates/currency
  // (that is {DATE(...)}/{CURRENCY(...)} written in the template, see bindings.ts).
  locale?: Locale;
  // Grid step in mm (default 5). It aligns dragging, resizing, the birth of
  // a new field and pasting — all four, since 3.0.0 (up to 2.x only the
  // canvas drag honored a custom value).
  gridSizeMm?: number;
  // Clicking a field reopens a collapsed sidebar (default true). `false` for
  // a layout where the sidebar is not the answer to "I clicked a field".
  expandOnSelect?: boolean;
  // Swaps the primitives the editor uses INTERNALLY (Button, Input, Select,
  // Modal, ...) for yours. Sugar for mounting a <UiComponentsProvider> —
  // which is what counts when you render a standalone part, with no <Designer>.
  //
  // IMPORTANT: pass a module constant or something memoized. An inline
  // object creates a new component on every render, and React remounts
  // whatever changed identity — the symptom is losing field focus on every
  // keystroke. Outside production, the provider warns in the console.
  components?: UiComponentsOverride;
  // They go to the outer `<div class="jpd-designer">`. `className` MERGES
  // with ours (yours comes last); your `style` beats ours.
  className?: string;
  style?: CSSProperties;
};

// The editor canvas: a page in mm, each field dragging/resizing freely
// (react-rnd). A selection opens the property panel — which already includes
// the binding to the JSON, with no bridge at all (it is all plain React).
//
// This component is a PRESET, and since 3.0.0 that is all it is: three
// providers and two parts in a two-column layout. Whoever wants their own
// layout mounts the <DesignerProvider> by hand and places the parts (see
// ./parts/). The usual 7 props are still identical — `gridSizeMm`,
// `expandOnSelect`, `className` and `style` are optional additions.
//
// The providers sit OUT HERE because a component does not consume the
// context it declares itself.
export default function Designer({ locale = "en", components, className, style, ...props }: DesignerProps) {
  return (
    <I18nProvider locale={locale}>
      {/* The i18n and primitives providers are independent and the order
          between them does not matter — neither reads the other. They are
          separate because they have different cardinality and frequency of
          change: the primitives vocabulary is one per APP and almost never
          changes; the editor state is one per instance and changes on every
          keystroke. See the comment in UiComponentsProvider.tsx.
          The DesignerProvider comes INSIDE both because it reads `useT()`
          and the parts inside it read primitives. */}
      <UiComponentsProvider components={components}>
        <DesignerProvider {...props}>
          <div className={cx("jpd-designer", className)} style={style}>
            {/* `.jpd-designer__main` is only the `display: flex` that puts the
                two columns side by side, with the gap.

                The 320px width lives in `.jpd-sidebar` (`inline-size: 20rem`
                in theme.css), that is, IN THE PART and not in the preset. It
                is a DEFAULT, not an imposition: a sidebar with no width at
                all would collapse to its content size in a flex row, which is
                worse. Whoever builds their own layout overrides it through
                `className` — a consumer rule is outside `@layer` and beats
                ours (which is what examples/report-builder does). */}
            <div className="jpd-designer__main">
              <DesignerCanvas />
              {/* `whenTab` is passed to neither of the two: the canvas and the
                  sidebar always appear. The per-tab gate happens INSIDE the
                  sidebar, part by part. */}
              <DesignerSidebar />
            </div>
          </div>
        </DesignerProvider>
      </UiComponentsProvider>
    </I18nProvider>
  );
}
