import { describe, expect, it, vi } from "vitest";
import type { PluginUpdateInfo, PluginsInternalApi } from "../types/obsidian-internals";
import type { PluginSnapshot } from "../types/usage";
import { PluginUpdateService } from "./pluginUpdateService";

const snapshots: PluginSnapshot[] = [
  {
    id: "quickadd",
    name: "QuickAdd",
    version: "1.0.0",
    author: "Author",
    description: "",
    enabled: true,
    isThirdParty: true,
  },
  {
    id: "dataview",
    name: "Dataview",
    version: "1.0.0",
    author: "Author",
    description: "",
    enabled: true,
    isThirdParty: true,
  },
];

function createPlugins(updates: Record<string, PluginUpdateInfo> = {}): PluginsInternalApi {
  return {
    manifests: {},
    enabledPlugins: new Set(),
    plugins: {},
    updates,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    installPlugin: vi.fn().mockResolvedValue(undefined),
    enablePluginAndSave: vi.fn(),
    disablePluginAndSave: vi.fn(),
    uninstallPlugin: vi.fn(),
  };
}

describe("PluginUpdateService", () => {
  it("summarizes Obsidian's current update state", async () => {
    const plugins = createPlugins({ quickadd: { repo: "chhoumann/quickadd", version: "1.1.0" } });
    const service = new PluginUpdateService({
      plugins,
      onStatusChanged: vi.fn(),
      now: () => 1_000,
    });

    await service.checkNow(async () => snapshots);

    expect(plugins.checkForUpdates).toHaveBeenCalledOnce();
    expect(service.getStatus("quickadd")).toMatchObject({ kind: "available" });
    expect(service.getStatus("dataview")).toMatchObject({ kind: "current" });
  });

  it("updates a plugin through Obsidian's installer", async () => {
    const plugins = createPlugins({
      quickadd: {
        repo: "chhoumann/quickadd",
        version: "1.1.0",
        manifest: {
          id: "quickadd",
          name: "QuickAdd",
          author: "Author",
          version: "1.1.0",
          minAppVersion: "1.5.0",
          description: "",
        },
      },
    });
    const service = new PluginUpdateService({
      plugins,
      onStatusChanged: vi.fn(),
      now: () => 1_000,
    });

    await service.updatePlugin("quickadd");

    expect(plugins.installPlugin).toHaveBeenCalledWith(
      "chhoumann/quickadd",
      "1.1.0",
      {
        id: "quickadd",
        name: "QuickAdd",
        author: "Author",
        version: "1.1.0",
        minAppVersion: "1.5.0",
        description: "",
      },
    );
    expect(service.getStatus("quickadd")).toMatchObject({ kind: "current" });
  });

  it("marks plugins failed when Obsidian's check fails", async () => {
    const plugins = createPlugins();
    vi.mocked(plugins.checkForUpdates).mockRejectedValue(new Error("offline"));
    const service = new PluginUpdateService({
      plugins,
      onStatusChanged: vi.fn(),
      now: () => 1_000,
    });

    await service.checkNow(async () => snapshots);

    expect(service.getStatus("quickadd")).toMatchObject({
      kind: "failed",
      error: "offline",
    });
  });
});
