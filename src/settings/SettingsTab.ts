import { App, PluginSettingTab, Setting } from "obsidian";
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

    containerEl.createEl("h2", { text: "Obsidian Plugins Activity 设置" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "所有统计数据仅保存在本地 vault 中，不会上传到任何服务器。",
    });

    new Setting(containerEl)
      .setName("启用使用统计")
      .setDesc("关闭后不再记录新的命令与视图使用数据。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.trackingEnabled)
          .onChange(async (value) => {
            this.plugin.settings.trackingEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("数据保留天数")
      .setDesc("超过该天数的日聚合数据会被自动清理。")
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
      .setName("显示已禁用插件")
      .setDesc("关闭后，总览页只显示当前启用的第三方插件。")
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
      .setName("启动时打开总览页")
      .setDesc("Obsidian 启动完成后自动打开插件使用总览。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.openOnStartup = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("清空全部统计数据")
      .setDesc("删除所有插件的命令与视图使用记录，此操作不可撤销。")
      .addButton((button) =>
        button
          .setButtonText("清空")
          .setWarning()
          .onClick(() => {
            new ConfirmResetModal(
              this.app,
              "清空全部统计数据",
              "确定要删除所有插件的使用统计吗？",
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
