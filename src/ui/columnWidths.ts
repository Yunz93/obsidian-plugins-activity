import type { Locale } from "../i18n/locale";
import { messages, type MessageKey } from "../i18n/messages";
import type { SortColumn } from "../types/usage";

export type TableColumn = SortColumn | "actions";

export const TABLE_COLUMNS: TableColumn[] = [
  "name",
  "enabled",
  "version",
  "commandCount",
  "interactionCount",
  "viewOpenCount",
  "lastUsedAt",
  "last7DaysTotal",
  "actions",
];

const COLUMN_KEYS: Record<SortColumn, MessageKey> = {
  name: "columnName",
  enabled: "columnEnabled",
  version: "columnVersion",
  commandCount: "columnCommandCount",
  interactionCount: "columnInteractionCount",
  viewOpenCount: "columnViewOpenCount",
  lastUsedAt: "columnLastUsedAt",
  last7DaysTotal: "columnLast7DaysTotal",
};

const ACTION_BUTTON_KEYS: MessageKey[] = [
  "update",
  "upToDate",
  "checkingUpdates",
  "updateUnknown",
  "updateCheckFailed",
  "disable",
  "enable",
  "uninstall",
];

const STATUS_VALUE_KEYS: MessageKey[] = ["enabled", "disabled"];

const STATUS_BADGE_PADDING_OVERHEAD = 4;

const HEADER_SORT_OVERHEAD = 2;
const NAME_CONTENT_BONUS = 12;
const BUTTON_PADDING_OVERHEAD = 4;

function estimateTextWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += char.charCodeAt(0) > 0x2e7f ? 2 : 1;
  }
  return width;
}

function getLocalizedText(key: MessageKey, locale: Locale): string {
  return messages[locale][key] ?? messages.en[key];
}

function getHeaderLabelWeight(column: TableColumn): number {
  if (column === "actions") {
    return (
      Math.max(
        estimateTextWidth(getLocalizedText("actions", "en")),
        estimateTextWidth(getLocalizedText("actions", "zh")),
      ) + HEADER_SORT_OVERHEAD
    );
  }

  const key = COLUMN_KEYS[column];
  return (
    Math.max(
      estimateTextWidth(getLocalizedText(key, "en")),
      estimateTextWidth(getLocalizedText(key, "zh")),
    ) + HEADER_SORT_OVERHEAD
  );
}

function getActionsColumnWeight(headerWeight: number): number {
  let maxButtonWidth = 0;
  for (const key of ACTION_BUTTON_KEYS) {
    maxButtonWidth = Math.max(
      maxButtonWidth,
      estimateTextWidth(getLocalizedText(key, "en")),
      estimateTextWidth(getLocalizedText(key, "zh")),
    );
  }

  return Math.max(headerWeight, maxButtonWidth + BUTTON_PADDING_OVERHEAD);
}

function getStatusColumnWeight(headerWeight: number): number {
  let maxValueWidth = 0;
  for (const key of STATUS_VALUE_KEYS) {
    maxValueWidth = Math.max(
      maxValueWidth,
      estimateTextWidth(getLocalizedText(key, "en")),
      estimateTextWidth(getLocalizedText(key, "zh")),
    );
  }

  return Math.max(headerWeight, maxValueWidth + STATUS_BADGE_PADDING_OVERHEAD);
}

function normalizeWeights(weights: Record<TableColumn, number>): Record<TableColumn, number> {
  const total = TABLE_COLUMNS.reduce((sum, column) => sum + weights[column], 0);
  const widths = {} as Record<TableColumn, number>;
  let allocated = 0;

  for (let index = 0; index < TABLE_COLUMNS.length; index += 1) {
    const column = TABLE_COLUMNS[index];
    if (index === TABLE_COLUMNS.length - 1) {
      widths[column] = Math.round((100 - allocated) * 10) / 10;
      break;
    }

    const width = Math.round(((weights[column] / total) * 100) * 10) / 10;
    widths[column] = width;
    allocated += width;
  }

  return widths;
}

function buildDefaultWeights(): Record<TableColumn, number> {
  const weights = {} as Record<TableColumn, number>;

  for (const column of TABLE_COLUMNS) {
    weights[column] = getHeaderLabelWeight(column);
  }

  weights.name += NAME_CONTENT_BONUS;
  weights.enabled = getStatusColumnWeight(weights.enabled);
  weights.actions = getActionsColumnWeight(weights.actions);

  return weights;
}

export function getDefaultColumnWidths(): Record<TableColumn, number> {
  return normalizeWeights(buildDefaultWeights());
}

export function getMinColumnWidths(): Record<TableColumn, number> {
  const headerWeights = {} as Record<TableColumn, number>;

  for (const column of TABLE_COLUMNS) {
    const headerWeight = getHeaderLabelWeight(column);
    headerWeights[column] =
      column === "actions"
        ? getActionsColumnWeight(headerWeight)
        : column === "enabled"
          ? getStatusColumnWeight(headerWeight)
          : headerWeight;
  }

  headerWeights.name = Math.max(headerWeights.name, 8);

  const minTotal = 52;
  const total = TABLE_COLUMNS.reduce((sum, column) => sum + headerWeights[column], 0);
  const widths = {} as Record<TableColumn, number>;
  let allocated = 0;

  for (let index = 0; index < TABLE_COLUMNS.length; index += 1) {
    const column = TABLE_COLUMNS[index];
    if (index === TABLE_COLUMNS.length - 1) {
      widths[column] = Math.round((minTotal - allocated) * 10) / 10;
      break;
    }

    const width = Math.round(((headerWeights[column] / total) * minTotal) * 10) / 10;
    widths[column] = width;
    allocated += width;
  }

  return widths;
}
