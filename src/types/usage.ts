export interface DailyUsage {
  commands: number;
  views: number;
  interactions: number;
}

export interface PluginUsageStats {
  commandCount: number;
  viewOpenCount: number;
  interactionCount: number;
  lastUsedAt: number | null;
  daily: Record<string, DailyUsage>;
}

export interface PluginSnapshot {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  isThirdParty: boolean;
}

export interface PluginUsageRow extends PluginSnapshot {
  commandCount: number;
  viewOpenCount: number;
  interactionCount: number;
  lastUsedAt: number | null;
  last7DaysTotal: number;
  trackingSupported: boolean;
}

export type SortColumn =
  | "name"
  | "enabled"
  | "version"
  | "commandCount"
  | "viewOpenCount"
  | "interactionCount"
  | "lastUsedAt"
  | "last7DaysTotal";

export type SortDirection = "asc" | "desc";

export interface InventoryMaps {
  commandPrefixToPluginId: Map<string, string>;
  viewTypeToPluginId: Map<string, string>;
  snapshots: PluginSnapshot[];
}

export function formatDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyStats(): PluginUsageStats {
  return {
    commandCount: 0,
    viewOpenCount: 0,
    interactionCount: 0,
    lastUsedAt: null,
    daily: {},
  };
}

export function normalizeDailyUsage(entry: Partial<DailyUsage> | undefined): DailyUsage {
  return {
    commands: entry?.commands ?? 0,
    views: entry?.views ?? 0,
    interactions: entry?.interactions ?? 0,
  };
}

export function normalizeUsageStats(
  stats: Partial<PluginUsageStats> | undefined,
): PluginUsageStats {
  const daily: Record<string, DailyUsage> = {};
  for (const [dayKey, entry] of Object.entries(stats?.daily ?? {})) {
    daily[dayKey] = normalizeDailyUsage(entry);
  }

  return {
    commandCount: stats?.commandCount ?? 0,
    viewOpenCount: stats?.viewOpenCount ?? 0,
    interactionCount: stats?.interactionCount ?? 0,
    lastUsedAt: stats?.lastUsedAt ?? null,
    daily,
  };
}

export function sumDailyUsage(
  daily: Record<string, DailyUsage>,
  days: number,
  referenceDate: Date = new Date(),
): number {
  let total = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(referenceDate);
    date.setDate(referenceDate.getDate() - offset);
    const key = formatDateKey(date);
    const entry = daily[key];
    if (entry) {
      total += entry.commands + entry.views + entry.interactions;
    }
  }
  return total;
}

export function resolvePluginFromCommandId(
  commandId: string,
  knownPluginIds: Set<string>,
): string | null {
  const colonIndex = commandId.indexOf(":");
  if (colonIndex <= 0) {
    return null;
  }

  const prefix = commandId.slice(0, colonIndex);
  if (prefix === "app" || prefix === "editor" || prefix === "workspace") {
    return null;
  }

  if (knownPluginIds.has(prefix)) {
    return prefix;
  }

  return null;
}

export function viewTypeMatchesPlugin(viewType: string, pluginId: string): boolean {
  if (viewType === pluginId || viewType.includes(pluginId)) {
    return true;
  }

  const segments = pluginId.split("-").filter((segment) => segment.length >= 4);
  return segments.some(
    (segment) =>
      viewType === segment ||
      viewType.startsWith(`${segment}-`) ||
      viewType.endsWith(`-${segment}`) ||
      viewType.includes(`-${segment}-`),
  );
}

export function resolvePluginFromViewType(
  viewType: string,
  inventory: InventoryMaps,
): string | null {
  const mapped = inventory.viewTypeToPluginId.get(viewType);
  if (mapped) {
    return mapped;
  }

  for (const snapshot of inventory.snapshots) {
    if (viewTypeMatchesPlugin(viewType, snapshot.id)) {
      return snapshot.id;
    }
  }

  return null;
}
