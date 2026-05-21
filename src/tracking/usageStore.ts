import type { PluginActivitySettings } from "../settings/settings";
import {
  createEmptyStats,
  formatDateKey,
  normalizeUsageStats,
  sumDailyUsage,
  type PluginSnapshot,
  type PluginUsageRow,
  type PluginUsageStats,
} from "../types/usage";

export interface PersistedPluginActivityData {
  stats: Record<string, PluginUsageStats>;
}

export class UsageStore {
  private stats: Record<string, PluginUsageStats> = {};
  private dirty = false;
  private pendingWrites = 0;
  private flushTimer: number | null = null;
  private flushPromise: Promise<void> | null = null;
  private writeVersion = 0;

  constructor(
    private readonly persist: () => Promise<void>,
    private readonly getSettings: () => PluginActivitySettings,
    private readonly onStatsChanged?: () => void,
  ) {}

  load(data: PersistedPluginActivityData | null): void {
    this.stats = {};
    for (const [pluginId, stats] of Object.entries(data?.stats ?? {})) {
      this.stats[pluginId] = normalizeUsageStats(stats);
    }
  }

  serialize(): PersistedPluginActivityData {
    return { stats: this.stats };
  }

  getStats(pluginId: string): PluginUsageStats {
    return this.stats[pluginId] ?? createEmptyStats();
  }

  recordCommand(pluginId: string, at: Date = new Date()): void {
    if (!this.getSettings().trackingEnabled) {
      return;
    }

    this.touch(pluginId, at, "commands");
  }

  recordViewOpen(pluginId: string, at: Date = new Date()): void {
    if (!this.getSettings().trackingEnabled) {
      return;
    }

    this.touch(pluginId, at, "views");
  }

  resetPlugin(pluginId: string): void {
    delete this.stats[pluginId];
    this.markDirty(true);
  }

  resetAll(): void {
    this.stats = {};
    this.markDirty(true);
  }

  pruneOldDaily(retentionDays: number): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffKey = formatDateKey(cutoff);
    let changed = false;

    for (const pluginId of Object.keys(this.stats)) {
      const stats = this.stats[pluginId];
      for (const dayKey of Object.keys(stats.daily)) {
        if (dayKey < cutoffKey) {
          delete stats.daily[dayKey];
          changed = true;
        }
      }
    }

    if (changed) {
      this.markDirty(true);
    }
  }

  getMergedRows(
    snapshots: PluginSnapshot[],
    showDisabledPlugins: boolean,
  ): PluginUsageRow[] {
    return snapshots
      .filter((snapshot) => showDisabledPlugins || snapshot.enabled)
      .map((snapshot) => {
        const stats = this.getStats(snapshot.id);
        return {
          ...snapshot,
          commandCount: stats.commandCount,
          viewOpenCount: stats.viewOpenCount,
          interactionCount: stats.interactionCount,
          lastUsedAt: stats.lastUsedAt,
          last7DaysTotal: sumDailyUsage(stats.daily, 7),
          trackingSupported: true,
        };
      });
  }

  async flush(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (!this.flushPromise) {
      this.flushPromise = this.flushDirtyLoop().finally(() => {
        this.flushPromise = null;
      });
    }

    await this.flushPromise;
  }

  recordInteraction(pluginId: string, at: Date = new Date()): void {
    if (!this.getSettings().trackingEnabled) {
      return;
    }

    this.touch(pluginId, at, "interactions");
  }

  private async flushDirtyLoop(): Promise<void> {
    while (this.dirty) {
      const persistedVersion = this.writeVersion;

      try {
        await this.persist();
      } catch (error) {
        this.dirty = true;
        throw error;
      }

      if (this.writeVersion === persistedVersion) {
        this.dirty = false;
        this.pendingWrites = 0;
      }
    }
  }

  private touch(pluginId: string, at: Date, field: "commands" | "views" | "interactions"): void {
    const stats = normalizeUsageStats(this.stats[pluginId] ?? createEmptyStats());
    const dayKey = formatDateKey(at);
    const daily = stats.daily[dayKey] ?? { commands: 0, views: 0, interactions: 0 };

    if (field === "commands") {
      stats.commandCount += 1;
      daily.commands += 1;
    } else if (field === "views") {
      stats.viewOpenCount += 1;
      daily.views += 1;
    } else {
      stats.interactionCount += 1;
      daily.interactions += 1;
    }

    stats.daily[dayKey] = daily;
    stats.lastUsedAt = at.getTime();
    this.stats[pluginId] = stats;
    this.markDirty(false);
    this.onStatsChanged?.();
  }

  private markDirty(immediate: boolean): void {
    this.dirty = true;
    this.pendingWrites += 1;
    this.writeVersion += 1;

    if (immediate || this.pendingWrites >= 10) {
      this.flushSoon();
      return;
    }

    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = window.setTimeout(() => {
      this.flushSoon();
    }, 30_000);
  }

  private flushSoon(): void {
    void this.flush().catch((error) => {
      console.error("Obsidian Plugins Activity failed to save usage data.", error);
    });
  }
}
