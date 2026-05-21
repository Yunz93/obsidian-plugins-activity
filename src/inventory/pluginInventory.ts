import type { App } from "obsidian";
import { viewTypeMatchesPlugin, type InventoryMaps, type PluginSnapshot } from "../types/usage";

const SELF_PLUGIN_ID = "obsidian-plugins-activity";

async function listInstalledCommunityPluginIds(app: App): Promise<Set<string>> {
  const pluginDir = `${app.vault.configDir}/plugins`;

  try {
    const listing = await app.vault.adapter.list(pluginDir);
    const ids = new Set<string>();

    for (const folderPath of listing.folders) {
      const pluginId = folderPath.split("/").pop();
      if (pluginId && !pluginId.startsWith(".")) {
        ids.add(pluginId);
      }
    }

    return ids;
  } catch {
    return new Set(Object.keys(app.plugins.manifests));
  }
}

function collectViewTypesForPlugin(app: App, pluginId: string): string[] {
  const plugin = app.plugins.plugins[pluginId];
  if (!plugin) {
    return [];
  }

  const viewTypes: string[] = [];
  const pluginAny = plugin as Plugin & {
    _views?: Map<string, unknown>;
    views?: Map<string, unknown>;
  };

  const viewsMap = pluginAny._views ?? pluginAny.views;
  if (viewsMap instanceof Map) {
    for (const viewType of viewsMap.keys()) {
      if (typeof viewType === "string") {
        viewTypes.push(viewType);
      }
    }
  }

  return viewTypes;
}

function collectViewTypesFromRegistry(app: App, snapshots: PluginSnapshot[]): Map<string, string> {
  const viewTypeToPluginId = new Map<string, string>();
  const viewByType = app.viewRegistry?.viewByType;
  if (!viewByType) {
    return viewTypeToPluginId;
  }

  for (const viewType of Object.keys(viewByType)) {
    for (const snapshot of snapshots) {
      if (viewTypeMatchesPlugin(viewType, snapshot.id)) {
        viewTypeToPluginId.set(viewType, snapshot.id);
        break;
      }
    }
  }

  return viewTypeToPluginId;
}

function getEnabledPluginIds(app: App): Set<string> {
  if (app.plugins.enabledPlugins instanceof Set) {
    return app.plugins.enabledPlugins;
  }

  return new Set(Object.keys(app.plugins.plugins));
}

export async function buildPluginInventory(app: App): Promise<InventoryMaps> {
  const manifests = app.plugins.manifests;
  const enabledPlugins = getEnabledPluginIds(app);
  const installedCommunityIds = await listInstalledCommunityPluginIds(app);
  const snapshots: PluginSnapshot[] = [];
  const commandPrefixToPluginId = new Map<string, string>();
  const viewTypeToPluginId = new Map<string, string>();

  for (const pluginId of Object.keys(manifests)) {
    if (pluginId === SELF_PLUGIN_ID) {
      continue;
    }

    if (!installedCommunityIds.has(pluginId)) {
      continue;
    }

    const manifest = manifests[pluginId];
    const snapshot: PluginSnapshot = {
      id: pluginId,
      name: manifest.name,
      version: manifest.version,
      author: manifest.author,
      description: manifest.description,
      enabled: enabledPlugins.has(pluginId),
      isThirdParty: true,
    };

    snapshots.push(snapshot);
    commandPrefixToPluginId.set(pluginId, pluginId);

    for (const viewType of collectViewTypesForPlugin(app, pluginId)) {
      viewTypeToPluginId.set(viewType, pluginId);
    }
  }

  for (const [viewType, pluginId] of collectViewTypesFromRegistry(app, snapshots)) {
    viewTypeToPluginId.set(viewType, pluginId);
  }

  snapshots.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  return {
    commandPrefixToPluginId,
    viewTypeToPluginId,
    snapshots,
  };
}

export function getKnownThirdPartyPluginIds(inventory: InventoryMaps): Set<string> {
  return new Set(inventory.snapshots.map((snapshot) => snapshot.id));
}
