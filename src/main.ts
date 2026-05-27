import { Plugin } from "obsidian";
import { t } from "./i18n";
import { DEFAULT_SETTINGS, type PluginActivitySettings } from "./settings/settings";
import { openPluginSettings } from "./settings/openPluginSettings";
import { PluginActivitySettingTab } from "./settings/SettingsTab";
import { UsageStore } from "./tracking/usageStore";
import { UsageTracker } from "./tracking/usageTracker";
import { installGlobalTrackingHooks } from "./tracking/pluginApiHooks";
import { PluginUpdateService } from "./updates/pluginUpdateService";
import type { PluginSnapshot } from "./types/usage";

import { OverviewModal } from "./ui/OverviewModal";
import { WhatsNewModal } from "./ui/WhatsNewModal";

installGlobalTrackingHooks();

export default class PluginsActivityPlugin extends Plugin {
  settings!: PluginActivitySettings;
  usageStore!: UsageStore;
  usageTracker!: UsageTracker;
  updateService!: PluginUpdateService;
  private overviewModal: OverviewModal | null = null;

  async onload(): Promise<void> {
    this.initStore();

    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded?.settings);
    this.usageStore.load(loaded ?? null);

    this.usageTracker = new UsageTracker(this);
    this.usageTracker.installEarlyHooks();
    this.updateService = new PluginUpdateService({
      plugins: this.app.plugins,
      onStatusChanged: () => {
        this.scheduleOverviewRefresh();
      },
    });

    this.addCommand({
      id: "open-overview",
      name: t("openOverview"),
      callback: () => {
        this.openOverview();
      },
    });

    this.addCommand({
      id: "show-whats-new",
      name: t("whatsNewCommand"),
      callback: () => {
        this.openWhatsNew();
      },
    });

    this.addRibbonIcon("bar-chart-2", t("openOverview"), () => {
      this.openOverview();
    });

    this.addSettingTab(new PluginActivitySettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.closeLegacyOverviewLeaves();
      this.usageTracker.start();
      this.usageStore.pruneOldDaily(this.settings.retentionDays);
      void this.maybeShowWhatsNew();

      if (this.settings.openOnStartup) {
        this.openOverview();
      }
    });
  }

  onunload(): void {
    this.usageTracker?.stop();
    if (this.overviewRefreshTimer !== null) {
      window.clearTimeout(this.overviewRefreshTimer);
      this.overviewRefreshTimer = null;
    }
    void this.usageStore?.flush().catch((error) => {
      console.error("Extensions-Activity failed to save usage data while unloading.", error);
    });
    this.overviewModal?.close();
    this.overviewModal = null;
  }

  private initStore(): void {
    this.usageStore = new UsageStore(
      async () => {
        await this.saveData({
          settings: this.settings,
          stats: this.usageStore.serialize().stats,
        });
      },
      () => this.settings,
      () => {
        this.scheduleOverviewRefresh();
      },
    );
  }

  private overviewRefreshTimer: number | null = null;

  private scheduleOverviewRefresh(): void {
    if (this.overviewRefreshTimer !== null) {
      return;
    }

    this.overviewRefreshTimer = window.setTimeout(() => {
      this.overviewRefreshTimer = null;
      this.refreshOverviewViews();
    }, 250);
  }

  async saveSettings(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      stats: this.usageStore.serialize().stats,
    });
  }

  refreshOverviewViews(): void {
    void this.overviewModal?.refresh();
  }

  onOverviewClosed(modal: OverviewModal): void {
    if (this.overviewModal === modal) {
      this.overviewModal = null;
    }
  }

  openOverview(): void {
    if (this.overviewModal) {
      this.overviewModal.open();
      return;
    }

    this.overviewModal = new OverviewModal(this);
    this.overviewModal.open();
  }

  openWhatsNew(version = this.manifest.version, markAsSeen = false): void {
    new WhatsNewModal(this.app, this, version, markAsSeen).open();
  }

  async markWhatsNewSeen(version: string): Promise<void> {
    this.settings.lastSeenVersion = version;
    await this.saveSettings();
  }

  private async maybeShowWhatsNew(): Promise<void> {
    const currentVersion = this.manifest.version;
    const lastSeen = this.settings.lastSeenVersion;

    if (!lastSeen) {
      await this.markWhatsNewSeen(currentVersion);
      return;
    }

    if (lastSeen !== currentVersion) {
      this.openWhatsNew(currentVersion, true);
    }
  }

  openSettings(): void {
    openPluginSettings(this.app.setting, this.manifest.id, () => {
      this.overviewModal?.close();
    });
  }

  async checkPluginUpdates(): Promise<void> {
    await this.updateService.checkNow(() => this.getPluginSnapshotsForUpdateCheck());
  }

  async updatePlugin(pluginId: string): Promise<void> {
    await this.updateService.updatePlugin(pluginId);
  }

  private async getPluginSnapshotsForUpdateCheck(): Promise<PluginSnapshot[]> {
    const inventory = await this.usageTracker.refreshInventory();
    return inventory.snapshots;
  }

  private closeLegacyOverviewLeaves(): void {
    for (const viewType of [
      "obsidian-plugins-activity-overview",
      "plugins-activity-overview",
    ]) {
      for (const leaf of this.app.workspace.getLeavesOfType(viewType)) {
        leaf.detach();
      }
    }
  }
}
