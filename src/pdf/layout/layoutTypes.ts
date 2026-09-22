import type { Schema, SectionSchema, TableSchema } from "../../types";

// One body item, in the order it appears on the page — a table and a section
// paginate for real (they may consume several slices/repetitions, including
// turning the page); a "row" (text/image/chart/kpi) does not paginate on its
// own, it only takes up its own height in the flow. A "row" may have more than
// one schema — every field (not a table/section) sharing the SAME authored y
// becomes a single line (see buildBodyItems in bodyLayout.ts), preserving each
// one's X: without that, two fields side by side (e.g. two KPI cards on the
// same line) would cascade one below the other, because the sequential flow
// rewrites each item's Y from the cursor — without that joining, each becomes
// its own "next item in the sequence" and loses its position relative to its
// neighbors on the same line.
export type BodyItem =
  | { kind: "table"; schema: TableSchema }
  | { kind: "section"; schema: SectionSchema }
  | { kind: "row"; schemas: Schema[]; y: number; height: number };

// The common shape of "where/how much space" a BodyItem takes in the flow —
// used by boundsOf (return) and gapAfter (parameters), in bodyLayout.ts.
export type FlowBounds = { y: number; height: number };
