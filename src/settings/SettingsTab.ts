import { App, PluginSettingTab, Setting } from "obsidian";
import { t } from "../i18n";
import type PluginsActivityPlugin from "../main";
import { ConfirmResetModal } from "../ui/ConfirmResetModal";

export class PluginActivitySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: PluginsActivityPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: t("settingsTitle") });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: t("privacyNote"),
    });

    new Setting(containerEl)
      .setName(t("trackingEnabledName"))
      .setDesc(t("trackingEnabledDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.trackingEnabled)
          .onChange(async (value) => {
            this.plugin.settings.trackingEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("retentionDaysName"))
      .setDesc(t("retentionDaysDesc"))
      .addText((text) =>
        text
          .setPlaceholder("90")
          .setValue(String(this.plugin.settings.retentionDays))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed >= 7) {
              this.plugin.settings.retentionDays = parsed;
              await this.plugin.saveSettings();
              this.plugin.usageStore.pruneOldDaily(parsed);
              await this.plugin.usageStore.flush();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("showDisabledPluginsName"))
      .setDesc(t("showDisabledPluginsDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showDisabledPlugins)
          .onChange(async (value) => {
            this.plugin.settings.showDisabledPlugins = value;
            await this.plugin.saveSettings();
            this.plugin.refreshOverviewViews();
          }),
      );

    new Setting(containerEl)
      .setName(t("openOnStartupName"))
      .setDesc(t("openOnStartupDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.openOnStartup = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("resetAllName"))
      .setDesc(t("resetAllDesc"))
      .addButton((button) =>
        button
          .setButtonText(t("resetAllButton"))
          .setWarning()
          .onClick(() => {
            new ConfirmResetModal(
              this.app,
              t("resetAllTitle"),
              t("resetAllMessage"),
              async () => {
                this.plugin.usageStore.resetAll();
                await this.plugin.usageStore.flush();
                this.plugin.refreshOverviewViews();
              },
            ).open();
          }),
      );
  }
}
