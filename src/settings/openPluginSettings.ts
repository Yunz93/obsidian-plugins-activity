import type { AppSettingApi } from "../types/obsidian-internals";

export function openPluginSettings(
  setting: AppSettingApi,
  pluginId: string,
  beforeOpen?: () => void,
): void {
  beforeOpen?.();
  setting.open();
  window.requestAnimationFrame(() => {
    setting.openTabById(pluginId);
  });
}
