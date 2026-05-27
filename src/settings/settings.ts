export interface PluginActivitySettings {
  trackingEnabled: boolean;
  excludeRenderActivities: boolean;
  retentionDays: number;
  showDisabledPlugins: boolean;
  openOnStartup: boolean;
  lastSeenVersion?: string;
}

export const DEFAULT_SETTINGS: PluginActivitySettings = {
  trackingEnabled: true,
  excludeRenderActivities: false,
  retentionDays: 90,
  showDisabledPlugins: true,
  openOnStartup: false,
};
