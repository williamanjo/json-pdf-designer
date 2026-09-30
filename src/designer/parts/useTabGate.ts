import { useDesignerUi } from "../context/hooks";
import type { TabKey } from "../useTabBar";

// The per-tab gate is OPT-IN. It is the subtlest decision of the
// decomposition, and the one that decides whether the parts are really
// placeable.
//
// If `DesignerPropertyPanel` and `DesignerPageSettings` gated on `sidebarTab`
// by default, putting the two side by side in your own layout would erase one
// of them — because only one tab can be active. They would be parts that LOOK
// decomposed but only work inside a sidebar with tabs, defeating the feature.
//
// So: with no `whenTab`, the part always renders. With `whenTab`, it appears
// only on the listed tab(s) — and that is how `DesignerSidebar` and the
// `<Designer>` reproduce today's behavior.
export type TabGate = TabKey | readonly TabKey[] | undefined;

// ALWAYS call it at the top of the part, and do the `return null` right
// after — no other hook may come before the return, so the real body lives in
// a separate component (`*Body`). That is why each part file has two
// components instead of one.
export function useTabGate(whenTab: TabGate): boolean {
  const { sidebarTab } = useDesignerUi();
  if (whenTab === undefined) return true;
  return typeof whenTab === "string" ? sidebarTab === whenTab : whenTab.includes(sidebarTab);
}
