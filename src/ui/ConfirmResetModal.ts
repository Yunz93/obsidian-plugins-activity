import { App, Modal, Setting } from "obsidian";

export class ConfirmResetModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly onConfirm: () => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("确认")
          .setWarning()
          .onClick(async () => {
            await this.onConfirm();
            this.close();
          }),
      )
      .addButton((button) =>
        button.setButtonText("取消").onClick(() => {
          this.close();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
