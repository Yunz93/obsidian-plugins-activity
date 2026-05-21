import { describe, expect, it } from "vitest";
import {
  countAnomalyDays,
  normalizeUsageStats,
  resolvePluginFromCommandId,
  sumDailyUsage,
  viewTypeMatchesPlugin,
} from "./usage";

describe("usage helpers", () => {
  it("normalizes legacy stats without interaction fields", () => {
    const legacyStats = {
      commandCount: 2,
      viewOpenCount: 1,
      daily: {
        "2026-05-21": {
          commands: 2,
          views: 1,
        },
      },
    } as unknown as Parameters<typeof normalizeUsageStats>[0];
    const stats = normalizeUsageStats(legacyStats);

    expect(stats.interactionCount).toBe(0);
    expect(stats.daily["2026-05-21"].interactions).toBe(0);
  });

  it("includes interactions in recent activity totals", () => {
    const total = sumDailyUsage(
      {
        "2026-05-21": {
          commands: 1,
          views: 2,
          interactions: 3,
        },
      },
      1,
      new Date("2026-05-21T12:00:00"),
    );

    expect(total).toBe(6);
  });

  it("counts recent activity spikes as anomaly days", () => {
    const anomalyDays = countAnomalyDays(
      {
        "2026-05-14": { commands: 2, views: 1, interactions: 0 },
        "2026-05-15": { commands: 1, views: 1, interactions: 1 },
        "2026-05-16": { commands: 2, views: 0, interactions: 1 },
        "2026-05-17": { commands: 1, views: 2, interactions: 0 },
        "2026-05-18": { commands: 1, views: 1, interactions: 0 },
        "2026-05-19": { commands: 2, views: 1, interactions: 0 },
        "2026-05-20": { commands: 1, views: 0, interactions: 1 },
        "2026-05-21": { commands: 9, views: 5, interactions: 4 },
      },
      7,
      new Date("2026-05-21T12:00:00"),
    );

    expect(anomalyDays).toBe(1);
  });

  it("does not count low-volume activity as anomalous", () => {
    const anomalyDays = countAnomalyDays(
      {
        "2026-05-21": { commands: 4, views: 2, interactions: 1 },
      },
      7,
      new Date("2026-05-21T12:00:00"),
    );

    expect(anomalyDays).toBe(0);
  });

  it("resolves only known third-party command prefixes", () => {
    const knownPluginIds = new Set(["quickadd"]);

    expect(resolvePluginFromCommandId("quickadd:run-choice", knownPluginIds)).toBe("quickadd");
    expect(resolvePluginFromCommandId("app:open-settings", knownPluginIds)).toBeNull();
    expect(resolvePluginFromCommandId("unknown:command", knownPluginIds)).toBeNull();
  });

  it("matches view types with meaningful plugin-id segments", () => {
    expect(viewTypeMatchesPlugin("kanban-board", "obsidian-kanban")).toBe(true);
    expect(viewTypeMatchesPlugin("calendar", "calendar")).toBe(true);
    expect(viewTypeMatchesPlugin("graph", "obsidian-kanban")).toBe(false);
  });
});
