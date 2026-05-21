export interface PluginActivitySettings {
  trackingEnabled: boolean;
  retentionDays: number;
  showDisabledPlugins: boolean;
  openOnStartup: boolean;
}

export const DEFAULT_SETTINGS: PluginActivitySettings = {
  trackingEnabled: true,
  retentionDays: 90,
  showDisabledPlugins: true,
  openOnStartup: false,
};
