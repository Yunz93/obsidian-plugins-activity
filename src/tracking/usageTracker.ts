import { around } from "monkey-around";
import { Plugin, type EventRef, type WorkspaceLeaf } from "obsidian";
import type {
  CommandRegistryEntry,
  CommandsInternalApi,
} from "../types/obsidian-internals";
import type PluginsActivityPlugin from "../main";
import {
  buildPluginInventory,
  getKnownThirdPartyPluginIds,
} from "../inventory/pluginInventory";
import { resolvePluginFromCommandId, resolvePluginFromViewType, type InventoryMaps } from "../types/usage";
import { recordPluginActivity, setActivityRecorder } from "./activityRecorder";
import { installDelegatedInteractionTracking } from "./delegatedInteractions";
import {
  attachEventSourceTracking,
  uninstallGlobalTrackingHooks,
} from "./pluginApiHooks";

const SELF_PLUGIN_ID = "plugins-activity";

export class UsageTracker {
  private inventory: InventoryMaps | null = null;
  private knownPluginIds = new Set<string>();
  private uninstallCommandPatch?: () => void;
  private uninstallAddCommandPatch?: () => void;
  private uninstallRegisterViewPatch?: () => void;
  private uninstallEventSourcePatch?: () => void;
  private leafChangeRef: EventRef | null = null;
  private lastTrackedLeaf: WorkspaceLeaf | null = null;

  constructor(private readonly plugin: PluginsActivityPlugin) {}

  installEarlyHooks(): void {
    setActivityRecorder((pluginId, kind) => {
      if (!this.plugin.settings.trackingEnabled) {
        return;
      }

      if (kind === "command") {
        this.plugin.usageStore.recordCommand(pluginId);
        return;
      }

      this.plugin.usageStore.recordInteraction(pluginId);
    });
    this.uninstallEventSourcePatch = attachEventSourceTracking(this.plugin.app);
  }

  start(): void {
    void this.refreshInventory().then(() => {
      this.wrapExistingCommands();
      this.installAddCommandHook();
      this.installRegisterViewHook();
      this.installCommandPatch();
      this.installLeafTracking();
      installDelegatedInteractionTracking(this.plugin);
    });
  }

  stop(): void {
    this.uninstallCommandPatch?.();
    this.uninstallCommandPatch = undefined;
    this.uninstallAddCommandPatch?.();
    this.uninstallAddCommandPatch = undefined;
    this.uninstallRegisterViewPatch?.();
    this.uninstallRegisterViewPatch = undefined;
    this.uninstallEventSourcePatch?.();
    this.uninstallEventSourcePatch = undefined;
    uninstallGlobalTrackingHooks();
    setActivityRecorder(null);

    if (this.leafChangeRef) {
      this.plugin.app.workspace.offref(this.leafChangeRef);
      this.leafChangeRef = null;
    }
  }

  refreshInventory(): Promise<InventoryMaps> {
    return buildPluginInventory(this.plugin.app).then((inventory) => {
      this.inventory = inventory;
      this.knownPluginIds.clear();
      for (const pluginId of getKnownThirdPartyPluginIds(inventory)) {
        this.knownPluginIds.add(pluginId);
      }
      return inventory;
    });
  }

  getInventory(): InventoryMaps {
    if (this.inventory) {
      return this.inventory;
    }

    return {
      commandPrefixToPluginId: new Map(),
      viewTypeToPluginId: new Map(),
      snapshots: [],
    };
  }

  private recordCommandUsage(pluginId: string): void {
    recordPluginActivity(pluginId, "command");
  }

  private wrapExistingCommands(): void {
    const commandsApi = this.plugin.app.commands as CommandsInternalApi;
    for (const registry of [commandsApi.commands, commandsApi.editorCommands]) {
      if (!registry) {
        continue;
      }

      for (const command of Object.values(registry)) {
        const pluginId = resolvePluginFromCommandId(command.id, this.knownPluginIds);
        if (pluginId) {
          this.wrapCommandEntry(pluginId, command);
        }
      }
    }
  }

  private installRegisterViewHook(): void {
    const tracker = this;
    this.uninstallRegisterViewPatch = around(Plugin.prototype, {
      registerView(original) {
        return function (type: string, viewCreator: unknown) {
          const pluginId = this.manifest?.id;
          if (pluginId && pluginId !== SELF_PLUGIN_ID) {
            tracker.recordViewTypeMapping(pluginId, type);
          }
          return original.call(this, type, viewCreator);
        };
      },
    });
  }

  private recordViewTypeMapping(pluginId: string, viewType: string): void {
    if (!this.inventory) {
      return;
    }

    this.inventory.viewTypeToPluginId.set(viewType, pluginId);
  }

  private installAddCommandHook(): void {
    const tracker = this;
    this.uninstallAddCommandPatch = around(Plugin.prototype, {
      addCommand(original) {
        return function (command) {
          const pluginId = this.manifest?.id;
          const wrapped =
            pluginId && pluginId !== SELF_PLUGIN_ID
              ? tracker.wrapCommandForPlugin(pluginId, command)
              : command;
          return original.call(this, wrapped);
        };
      },
    });
  }

  private installCommandPatch(): void {
    const tracker = this;
    const patchTarget: Record<string, (original: (...args: never[]) => unknown) => (...args: never[]) => unknown> = {
      executeCommand(original) {
        return function (this: unknown, command: CommandRegistryEntry | string, ev?: Event | null) {
          const commandId =
            typeof command === "string" ? command : command?.id;
          if (commandId) {
            const pluginId = resolvePluginFromCommandId(commandId, tracker.knownPluginIds);
            if (pluginId) {
              tracker.recordCommandUsage(pluginId);
            }
          }
          return original.call(this, command, ev ?? null);
        };
      },
    };

    const commandsApi = this.plugin.app.commands as CommandsInternalApi;
    if (typeof commandsApi.executeCommandById === "function") {
      patchTarget.executeCommandById = function (original) {
        return function (this: unknown, commandId: string) {
          const pluginId = resolvePluginFromCommandId(commandId, tracker.knownPluginIds);
          if (pluginId) {
            tracker.recordCommandUsage(pluginId);
          }
          return original.call(this, commandId);
        };
      };
    }

    this.uninstallCommandPatch = around(this.plugin.app.commands, patchTarget);
  }

  private installLeafTracking(): void {
    this.leafChangeRef = this.plugin.app.workspace.on("active-leaf-change", (leaf) => {
      this.handleActiveLeafChange(leaf);
    });
    this.plugin.registerEvent(this.leafChangeRef);
  }

  private handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    if (!leaf) {
      return;
    }

    const viewType = leaf.view?.getViewType();
    if (!viewType || leaf === this.lastTrackedLeaf) {
      return;
    }

    this.lastTrackedLeaf = leaf;
    const pluginId = resolvePluginFromViewType(viewType, this.getInventory());
    if (!pluginId || pluginId === SELF_PLUGIN_ID) {
      return;
    }

    this.plugin.usageStore.recordViewOpen(pluginId);
  }

  private wrapCommandForPlugin(
    pluginId: string,
    command: CommandRegistryEntry,
  ): CommandRegistryEntry {
    return this.wrapCommandEntry(pluginId, { ...command });
  }

  private wrapCommandEntry(
    pluginId: string,
    command: CommandRegistryEntry,
  ): CommandRegistryEntry {
    if (command.__pluginsActivityWrapped) {
      return command;
    }

    command.__pluginsActivityWrapped = true;
    const tracker = this;
    const record = () => tracker.recordCommandUsage(pluginId);

    if (command.callback) {
      const original = command.callback;
      command.callback = function (...args: unknown[]) {
        record();
        return original.apply(this, args);
      };
    }

    if (command.editorCallback) {
      const original = command.editorCallback;
      command.editorCallback = function (...args: unknown[]) {
        record();
        return original.apply(this, args);
      };
    }

    if (command.checkCallback) {
      const original = command.checkCallback;
      command.checkCallback = function (checking: boolean, ...args: unknown[]) {
        if (!checking) {
          record();
        }
        return original.apply(this, [checking, ...args]);
      };
    }

    if (command.editorCheckCallback) {
      const original = command.editorCheckCallback;
      command.editorCheckCallback = function (checking: boolean, ...args: unknown[]) {
        if (!checking) {
          record();
        }
        return original.apply(this, [checking, ...args]);
      };
    }

    return command;
  }
}
