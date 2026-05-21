import { Modal } from "obsidian";
import type PluginsActivityPlugin from "../main";
import { OverviewPanel } from "./overviewPanel";

export class OverviewModal extends Modal {
  private panel: OverviewPanel;

  constructor(
    private readonly plugin: PluginsActivityPlugin,
  ) {
    super(plugin.app);
    this.panel = new OverviewPanel(
      this.app,
      this.plugin,
      (element, event, callback, options) =>
        this.plugin.registerDomEvent(element, event, callback, options),
    );
  }

  onOpen(): void {
    this.modalEl.addClass("mod-plugins-activity-modal");
    this.contentEl.addClass("plugins-activity-overview");
    void this.panel.refresh(this.contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
    this.plugin.onOverviewClosed(this);
  }

  async refresh(): Promise<void> {
    if (!this.contentEl) {
      return;
    }

    await this.panel.refresh(this.contentEl);
  }
}
