import type { PluginManifest } from "obsidian";

declare module "obsidian" {
  interface App {
    plugins: PluginsInternalApi;
    setting: AppSettingApi;
    internalPlugins: InternalPluginsApi;
  }
}

export interface AppSettingApi {
  openTabById(id: string): void;
  open(): void;
}

export interface InternalPluginsApi {
  getEnabledPluginById(id: string): InternalPluginInstance | null;
}

export interface InternalPluginInstance {
  id: string;
  modal?: {
    onChooseItem?: (command: CommandRegistryEntry, ev: Event) => boolean | void;
  };
}

export interface PluginsInternalApi {
  manifests: Record<string, PluginManifest>;
  enabledPlugins: Set<string>;
  plugins: Record<string, Plugin>;
  enablePluginAndSave(id: string): Promise<void>;
  disablePluginAndSave(id: string): Promise<void>;
  uninstallPlugin(id: string): Promise<void>;
}

export interface CommandRegistryEntry {
  id: string;
  name?: string;
  callback?: (...args: unknown[]) => unknown;
  editorCallback?: (...args: unknown[]) => unknown;
  checkCallback?: (checking: boolean, ...args: unknown[]) => boolean | void;
  editorCheckCallback?: (checking: boolean, ...args: unknown[]) => boolean | void;
  __pluginsActivityWrapped?: boolean;
}

export interface CommandsInternalApi {
  commands?: Record<string, CommandRegistryEntry>;
  editorCommands?: Record<string, CommandRegistryEntry>;
  executeCommand(command: CommandRegistryEntry | string, ev?: Event | null): boolean;
  executeCommandById?(commandId: string): boolean;
  listCommands?(): CommandRegistryEntry[];
}

declare module "obsidian" {
  interface App {
    commands: CommandsInternalApi;
  }
}

export interface ViewRegistryApi {
  viewByType?: Record<string, unknown>;
}

declare module "obsidian" {
  interface App {
    viewRegistry?: ViewRegistryApi;
  }
}
