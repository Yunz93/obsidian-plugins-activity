import { Modal } from "obsidian";
import type PluginsActivityPlugin from "../main";
import { OverviewPanel } from "./overviewPanel";

export class OverviewModal extends Modal {
  private panel: OverviewPanel;
  private removeDragListeners: (() => void) | null = null;

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
    this.modalEl.addClass("mod-obsidian-plugins-activity-modal");
    this.contentEl.addClass("obsidian-plugins-activity-overview");
    this.installDragMove();
    void this.panel.refresh(this.contentEl);
  }

  onClose(): void {
    this.removeDragListeners?.();
    this.removeDragListeners = null;
    this.contentEl.empty();
    this.plugin.onOverviewClosed(this);
  }

  async refresh(): Promise<void> {
    if (!this.contentEl) {
      return;
    }

    await this.panel.refresh(this.contentEl);
  }

  private installDragMove(): void {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (!target.closest(".obsidian-plugins-activity-toolbar")) {
        return;
      }

      if (target.closest("button, input, select, textarea, a")) {
        return;
      }

      const rect = this.modalEl.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      this.modalEl.style.position = "fixed";
      this.modalEl.style.left = `${rect.left}px`;
      this.modalEl.style.top = `${rect.top}px`;
      this.modalEl.style.width = `${rect.width}px`;
      this.modalEl.style.height = `${rect.height}px`;
      this.modalEl.style.margin = "0";
      this.modalEl.style.transform = "none";

      const onPointerMove = (moveEvent: PointerEvent) => {
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);
        const nextLeft = Math.min(Math.max(0, moveEvent.clientX - offsetX), maxLeft);
        const nextTop = Math.min(Math.max(0, moveEvent.clientY - offsetY), maxTop);

        this.modalEl.style.left = `${nextLeft}px`;
        this.modalEl.style.top = `${nextTop}px`;
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    this.modalEl.addEventListener("pointerdown", onPointerDown);
    this.removeDragListeners = () => {
      this.modalEl.removeEventListener("pointerdown", onPointerDown);
    };
  }
}
