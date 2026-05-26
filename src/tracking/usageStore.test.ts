import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginActivitySettings } from "../settings/settings";
import { UsageStore } from "./usageStore";

const settings: PluginActivitySettings = {
  trackingEnabled: true,
  excludeRenderActivities: false,
  retentionDays: 90,
  showDisabledPlugins: true,
  openOnStartup: false,
};

describe("UsageStore", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
  });

  it("keeps legacy data readable and records interactions separately", () => {
    const store = new UsageStore(vi.fn(), () => settings);
    const legacyData = {
      stats: {
        quickadd: {
          commandCount: 2,
          viewOpenCount: 1,
          lastUsedAt: null,
          daily: {
            "2026-05-21": {
              commands: 2,
              views: 1,
            },
          },
        },
      },
    } as unknown as Parameters<UsageStore["load"]>[0];
    store.load(legacyData);

    store.recordInteraction("quickadd", new Date("2026-05-21T10:00:00"));

    const stats = store.getStats("quickadd");
    expect(stats.commandCount).toBe(2);
    expect(stats.viewOpenCount).toBe(1);
    expect(stats.interactionCount).toBe(1);
    expect(stats.daily["2026-05-21"]).toEqual({
      commands: 2,
      views: 1,
      interactions: 1,
    });
  });

  it("retries a failed persist instead of dropping dirty state", async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error("disk unavailable"))
      .mockResolvedValueOnce(undefined);
    const store = new UsageStore(persist, () => settings);

    store.recordCommand("quickadd", new Date("2026-05-21T10:00:00"));

    await expect(store.flush()).rejects.toThrow("disk unavailable");
    await store.flush();

    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("runs another persist when data changes during an in-flight save", async () => {
    let resolveFirstPersist = (): void => {};
    const persist = vi.fn(() => {
      if (persist.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveFirstPersist = resolve;
        });
      }
      return Promise.resolve();
    });
    const store = new UsageStore(persist, () => settings);

    store.recordCommand("quickadd", new Date("2026-05-21T10:00:00"));
    const flushPromise = store.flush();
    store.recordInteraction("quickadd", new Date("2026-05-21T10:00:01"));

    resolveFirstPersist();
    await flushPromise;

    expect(persist).toHaveBeenCalledTimes(2);
  });
});
