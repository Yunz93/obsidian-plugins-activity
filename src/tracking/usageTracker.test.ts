import { afterEach, describe, expect, it, vi } from "vitest";
import type PluginsActivityPlugin from "../main";
import type { PluginActivitySettings } from "../settings/settings";
import { recordPluginActivity, setActivityRecorder } from "./activityRecorder";
import { UsageTracker } from "./usageTracker";

vi.mock("obsidian", () => {
  class Component {}
  class Plugin extends Component {}
  return { Component, Plugin };
});

const baseSettings: PluginActivitySettings = {
  trackingEnabled: true,
  excludeRenderActivities: false,
  retentionDays: 90,
  showDisabledPlugins: true,
  openOnStartup: false,
};

function createTracker(settings: Partial<PluginActivitySettings> = {}) {
  const usageStore = {
    recordCommand: vi.fn(),
    recordInteraction: vi.fn(),
    recordViewOpen: vi.fn(),
  };
  const workspace = {
    on: vi.fn(() => ({})),
    offref: vi.fn(),
  };
  const vault = {
    on: vi.fn(() => ({})),
  };
  const plugin = {
    app: { workspace, vault },
    settings: { ...baseSettings, ...settings },
    usageStore,
    registerEvent: vi.fn(),
  } as unknown as PluginsActivityPlugin;
  const tracker = new UsageTracker(plugin);

  tracker.installEarlyHooks();

  return { tracker, usageStore };
}

describe("UsageTracker", () => {
  afterEach(() => {
    setActivityRecorder(null);
  });

  it("routes command activity to command counters", () => {
    const { tracker, usageStore } = createTracker();

    recordPluginActivity("quickadd", "command");

    expect(usageStore.recordCommand).toHaveBeenCalledWith("quickadd");
    expect(usageStore.recordInteraction).not.toHaveBeenCalled();
    tracker.stop();
  });

  it("excludes render activity when the setting is enabled", () => {
    const { tracker, usageStore } = createTracker({ excludeRenderActivities: true });

    recordPluginActivity("dataview", "render");
    recordPluginActivity("dataview", "interaction");

    expect(usageStore.recordCommand).not.toHaveBeenCalled();
    expect(usageStore.recordInteraction).toHaveBeenCalledTimes(1);
    expect(usageStore.recordInteraction).toHaveBeenCalledWith("dataview");
    tracker.stop();
  });
});
