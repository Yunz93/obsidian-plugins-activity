import type { App } from "obsidian";
import { t } from "../i18n";
import { DELEGATED_INTERACTION_RULES } from "./delegatedInteractions";
import { hasTrackableInteraction } from "./trackableSources";
import type { InventoryMaps } from "../types/usage";

const STATIC_UNSUPPORTED_PLUGIN_IDS = new Set([
  "cm-editor-syntax-highlight-obsidian",
]);

const DELEGATED_PLUGIN_IDS = new Set(
  DELEGATED_INTERACTION_RULES.map((rule) => rule.pluginId),
);

function pluginHasCommands(app: App, pluginId: string): boolean {
  const commandsApi = app.commands as { commands?: Record<string, unknown> };
  const prefix = `${pluginId}:`;
  return Object.keys(commandsApi.commands ?? {}).some((commandId) => commandId.startsWith(prefix));
}

function pluginHasRegisteredViews(inventory: InventoryMaps, pluginId: string): boolean {
  for (const mappedPluginId of inventory.viewTypeToPluginId.values()) {
    if (mappedPluginId === pluginId) {
      return true;
    }
  }

  return false;
}

export function isTrackingSupported(
  app: App,
  pluginId: string,
  inventory: InventoryMaps,
): boolean {
  if (STATIC_UNSUPPORTED_PLUGIN_IDS.has(pluginId)) {
    return false;
  }

  if (DELEGATED_PLUGIN_IDS.has(pluginId)) {
    return true;
  }

  if (hasTrackableInteraction(pluginId)) {
    return true;
  }

  if (pluginHasRegisteredViews(inventory, pluginId)) {
    return true;
  }

  if (pluginHasCommands(app, pluginId)) {
    return true;
  }

  return false;
}

export function getTrackingUnsupportedReason(pluginId: string): string {
  if (STATIC_UNSUPPORTED_PLUGIN_IDS.has(pluginId)) {
    return t("passiveUnsupported");
  }

  return t("noTrackableSurface");
}
