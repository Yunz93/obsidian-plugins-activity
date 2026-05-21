import { t } from "./index";
import type { SortColumn } from "../types/usage";

const COLUMN_KEYS: Record<SortColumn, Parameters<typeof t>[0]> = {
  name: "columnName",
  enabled: "columnEnabled",
  version: "columnVersion",
  commandCount: "columnCommandCount",
  interactionCount: "columnInteractionCount",
  viewOpenCount: "columnViewOpenCount",
  lastUsedAt: "columnLastUsedAt",
  last7DaysTotal: "columnLast7DaysTotal",
  anomalyDaysLast7: "columnAnomalyDaysLast7",
};

export function getColumnLabel(column: SortColumn): string {
  return t(COLUMN_KEYS[column]);
}
