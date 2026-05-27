import { App, Modal, Setting } from "obsidian";
import { getLocale, t } from "../i18n";
import { getReleaseNotes } from "../releaseNotes";
import type PluginsActivityPlugin from "../main";

export class WhatsNewModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: PluginsActivityPlugin,
    private readonly version: string,
    private readonly markAsSeen: boolean,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obsidian-plugins-activity-whats-new");

    contentEl.createEl("h2", {
      text: t("whatsNewTitle", { name: this.plugin.manifest.name }),
    });
    contentEl.createEl("p", {
      cls: "obsidian-plugins-activity-whats-new-version",
      text: `v${this.version}`,
    });

    const highlights = getReleaseNotes(this.version, getLocale());
    if (highlights.length > 0) {
      const list = contentEl.createEl("ul", { cls: "obsidian-plugins-activity-whats-new-list" });
      for (const item of highlights) {
        list.createEl("li", { text: item });
      }
    }

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(t("whatsNewGotIt"))
          .setCta()
          .onClick(async () => {
            if (this.markAsSeen) {
              await this.plugin.markWhatsNewSeen(this.version);
            }
            this.close();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
