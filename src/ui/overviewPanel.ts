import { Notice, type App } from "obsidian";
import type PluginsActivityPlugin from "../main";
import { ConfirmResetModal } from "./ConfirmResetModal";
import {
  formatRelativeTime,
  sumDailyUsage,
  type PluginUsageRow,
  type SortColumn,
  type SortDirection,
} from "../types/usage";
import { isTrackingSupported, getTrackingUnsupportedReason } from "../tracking/trackability";

const SELF_PLUGIN_ID = "obsidian-plugins-activity";

const SORTABLE_COLUMNS: SortColumn[] = [
  "name",
  "enabled",
  "version",
  "commandCount",
  "interactionCount",
  "viewOpenCount",
  "lastUsedAt",
  "last7DaysTotal",
];

const COLUMN_LABELS: Record<SortColumn, string> = {
  name: "插件",
  enabled: "状态",
  version: "版本",
  commandCount: "命令次数",
  interactionCount: "交互次数",
  viewOpenCount: "视图次数",
  lastUsedAt: "最近使用",
  last7DaysTotal: "7 日合计",
};

type RegisterDomEvent = <K extends keyof HTMLElementEventMap>(
  el: HTMLElement,
  type: K,
  callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
  options?: boolean | AddEventListenerOptions,
) => void;

export class OverviewPanel {
  private searchQuery = "";
  private sortColumn: SortColumn = "lastUsedAt";
  private sortDirection: SortDirection = "desc";
  private rows: PluginUsageRow[] = [];

  constructor(
    private readonly app: App,
    private readonly plugin: PluginsActivityPlugin,
    private readonly registerDomEvent: RegisterDomEvent,
  ) {}

  async refresh(root: HTMLElement): Promise<void> {
    await this.plugin.usageTracker.refreshInventory();
    this.render(root);
  }

  render(root: HTMLElement): void {
    root.empty();
    root.addClass("obsidian-plugins-activity-overview");

    this.rows = this.plugin.usageStore
      .getMergedRows(
        this.plugin.usageTracker.getInventory().snapshots,
        this.plugin.settings.showDisabledPlugins,
      )
      .map((row) => ({
        ...row,
        trackingSupported: isTrackingSupported(
          this.app,
          row.id,
          this.plugin.usageTracker.getInventory(),
        ),
      }));

    this.renderToolbar(root);
    this.renderSummary(root);
    this.renderTable(root);
  }

  private renderToolbar(root: HTMLElement): void {
    const toolbar = root.createDiv({ cls: "obsidian-plugins-activity-toolbar" });
    const heading = toolbar.createDiv({ cls: "obsidian-plugins-activity-heading" });
    heading.createEl("h2", { text: "第三方插件活动" });
    heading.createDiv({ cls: "obsidian-plugins-activity-heading-meta", text: "本地统计" });

    const actions = toolbar.createDiv({ cls: "obsidian-plugins-activity-toolbar-actions" });

    const search = actions.createEl("input", {
      cls: "obsidian-plugins-activity-search",
      type: "search",
      placeholder: "搜索插件名、ID、作者…",
    });
    search.value = this.searchQuery;
    this.registerDomEvent(search, "input", () => {
      this.searchQuery = search.value.trim().toLowerCase();
      this.renderTable(root);
    });

    const refreshButton = actions.createEl("button", { text: "刷新", cls: "mod-cta" });
    this.registerDomEvent(refreshButton, "click", () => {
      void this.refresh(root);
    });

    const resetButton = actions.createEl("button", { text: "重置" });
    this.registerDomEvent(resetButton, "click", () => {
      new ConfirmResetModal(
        this.app,
        "清空全部统计数据",
        "确定要删除所有插件的使用统计吗？",
        async () => {
          this.plugin.usageStore.resetAll();
          await this.plugin.usageStore.flush();
          await this.refresh(root);
        },
      ).open();
    });

    const settingsButton = actions.createEl("button", { text: "设置" });
    this.registerDomEvent(settingsButton, "click", () => {
      this.app.setting.open();
      this.app.setting.openTabById(this.plugin.manifest.id);
    });
  }

  private renderSummary(root: HTMLElement): void {
    const summary = root.createDiv({ cls: "obsidian-plugins-activity-summary" });
    const snapshots = this.plugin.usageTracker.getInventory().snapshots;
    let todayTotal = 0;
    const todayActive = snapshots.filter((snapshot) => {
      const stats = this.plugin.usageStore.getStats(snapshot.id);
      const total = sumDailyUsage(stats.daily, 1);
      todayTotal += total;
      return total > 0;
    }).length;

    const topPlugins = [...this.rows]
      .sort((left, right) => right.last7DaysTotal - left.last7DaysTotal)
      .filter((row) => row.last7DaysTotal > 0)
      .slice(0, 5);

    this.createSummaryCard(summary, "已安装插件", String(snapshots.length));
    this.createSummaryCard(summary, "今日活跃", String(todayActive));
    this.createSummaryCard(summary, "今日活动", String(todayTotal));
    this.createTopCard(summary, topPlugins);
  }

  private createSummaryCard(
    parent: HTMLElement,
    label: string,
    value: string,
  ): void {
    const card = parent.createDiv({ cls: "obsidian-plugins-activity-summary-card obsidian-plugins-activity-summary-stat" });
    card.createDiv({ cls: "label", text: label });
    const body = card.createDiv({ cls: "obsidian-plugins-activity-summary-body" });
    body.createDiv({ cls: "value", text: value });
  }

  private createTopCard(parent: HTMLElement, topPlugins: PluginUsageRow[]): void {
    const card = parent.createDiv({
      cls: "obsidian-plugins-activity-summary-card obsidian-plugins-activity-summary-top",
    });
    card.createDiv({ cls: "label", text: "近 7 日最常用" });
    const body = card.createDiv({ cls: "obsidian-plugins-activity-summary-body" });

    if (topPlugins.length === 0) {
      body.createDiv({ cls: "sub", text: "暂无使用记录" });
      return;
    }

    const list = body.createEl("ol", { cls: "obsidian-plugins-activity-top-list" });
    const maxTotal = Math.max(...topPlugins.map((row) => row.last7DaysTotal), 1);
    for (const row of topPlugins) {
      const item = list.createEl("li");
      item.style.setProperty(
        "--obsidian-plugins-activity-ratio",
        `${Math.max(8, Math.round((row.last7DaysTotal / maxTotal) * 100))}%`,
      );
      item.createSpan({ cls: "obsidian-plugins-activity-top-name", text: row.name });
      item.createSpan({ cls: "obsidian-plugins-activity-top-count", text: `${row.last7DaysTotal} 次` });
    }
  }

  private renderTable(root: HTMLElement): void {
    const existing = root.querySelector(".obsidian-plugins-activity-table-wrap");
    existing?.remove();

    const wrap = root.createDiv({ cls: "obsidian-plugins-activity-table-wrap" });
    const filteredRows = this.getFilteredRows();

    if (filteredRows.length === 0) {
      wrap.createDiv({
        cls: "obsidian-plugins-activity-empty",
        text: this.searchQuery ? "没有匹配的插件。" : "当前没有可显示的第三方插件。",
      });
      return;
    }

    const table = wrap.createEl("table", { cls: "obsidian-plugins-activity-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");

    for (const column of SORTABLE_COLUMNS) {
      const th = headerRow.createEl("th");
      if (this.isNumericColumn(column)) {
        th.addClass("obsidian-plugins-activity-table-number");
      }
      th.setText(COLUMN_LABELS[column]);
      const indicator = th.createSpan({ cls: "sort-indicator" });
      if (column === this.sortColumn) {
        indicator.addClass("is-active");
        indicator.setText(this.sortDirection === "asc" ? "↑" : "↓");
      } else {
        indicator.setText("↕");
      }

      this.registerDomEvent(th, "click", () => {
        if (this.sortColumn === column) {
          this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        } else {
          this.sortColumn = column;
          this.sortDirection = column === "name" || column === "version" ? "asc" : "desc";
        }
        this.renderTable(root);
      });
    }

    headerRow.createEl("th", { text: "操作" });

    const tbody = table.createEl("tbody");
    for (const row of this.sortRows(filteredRows)) {
      this.renderRow(tbody, row, root);
    }
  }

  private getFilteredRows(): PluginUsageRow[] {
    if (!this.searchQuery) {
      return this.rows;
    }

    return this.rows.filter((row) => {
      const haystack = `${row.name} ${row.id} ${row.author} ${row.description}`.toLowerCase();
      return haystack.includes(this.searchQuery);
    });
  }

  private sortRows(rows: PluginUsageRow[]): PluginUsageRow[] {
    const direction = this.sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      switch (this.sortColumn) {
        case "name":
          return direction * left.name.localeCompare(right.name, "zh-CN");
        case "enabled":
          return direction * (Number(left.enabled) - Number(right.enabled));
        case "version":
          return direction * left.version.localeCompare(right.version, undefined, { numeric: true });
        case "commandCount":
          return direction * (left.commandCount - right.commandCount);
        case "interactionCount":
          return direction * (left.interactionCount - right.interactionCount);
        case "viewOpenCount":
          return direction * (left.viewOpenCount - right.viewOpenCount);
        case "last7DaysTotal":
          return direction * (left.last7DaysTotal - right.last7DaysTotal);
        case "lastUsedAt": {
          const leftValue = left.lastUsedAt ?? 0;
          const rightValue = right.lastUsedAt ?? 0;
          return direction * (leftValue - rightValue);
        }
        default:
          return 0;
      }
    });
  }

  private isNumericColumn(column: SortColumn): boolean {
    return (
      column === "commandCount" ||
      column === "interactionCount" ||
      column === "viewOpenCount" ||
      column === "last7DaysTotal"
    );
  }

  private createNumberCell(row: HTMLTableRowElement, value: number): void {
    row.createEl("td", {
      cls: "obsidian-plugins-activity-table-number",
      text: String(value),
    });
  }

  private renderRow(tbody: HTMLElement, row: PluginUsageRow, root: HTMLElement): void {
    const tr = tbody.createEl("tr");
    if (!row.trackingSupported) {
      tr.addClass("is-untracked");
    }

    const nameCell = tr.createEl("td");
    nameCell.createDiv({ cls: "obsidian-plugins-activity-name", text: row.name });
    nameCell.createDiv({ cls: "obsidian-plugins-activity-id", text: row.id });
    if (!row.trackingSupported) {
      nameCell.createDiv({
        cls: "obsidian-plugins-activity-trackability-hint",
        text: getTrackingUnsupportedReason(row.id),
      });
    }

    const statusCell = tr.createEl("td");
    statusCell.createSpan({
      cls: row.enabled ? "obsidian-plugins-activity-status is-enabled" : "obsidian-plugins-activity-status is-disabled",
      text: row.enabled ? "已启用" : "已禁用",
    });

    tr.createEl("td", { text: row.version });
    this.createNumberCell(tr, row.commandCount);
    this.createNumberCell(tr, row.interactionCount);
    this.createNumberCell(tr, row.viewOpenCount);
    tr.createEl("td", { text: formatRelativeTime(row.lastUsedAt) });
    this.createNumberCell(tr, row.last7DaysTotal);

    const actionsCell = tr.createEl("td");
    const actions = actionsCell.createDiv({ cls: "obsidian-plugins-activity-row-actions" });
    const isSelf = row.id === SELF_PLUGIN_ID;

    if (!isSelf) {
      const toggleButton = actions.createEl("button", {
        text: row.enabled ? "禁用" : "启用",
      });
      this.registerDomEvent(toggleButton, "click", () => {
        void this.togglePluginEnabled(row, root);
      });

      const uninstallButton = actions.createEl("button", { text: "卸载" });
      uninstallButton.addClass("obsidian-plugins-activity-uninstall");
      this.registerDomEvent(uninstallButton, "click", () => {
        new ConfirmResetModal(
          this.app,
          "卸载插件",
          `确定要卸载「${row.name}」吗？这会删除插件文件并移除其使用统计。`,
          async () => {
            await this.uninstallPlugin(row, root);
          },
        ).open();
      });
    }
  }

  private async togglePluginEnabled(row: PluginUsageRow, root: HTMLElement): Promise<void> {
    try {
      if (row.enabled) {
        await this.app.plugins.disablePluginAndSave(row.id);
        new Notice(`已禁用：${row.name}`);
      } else {
        await this.app.plugins.enablePluginAndSave(row.id);
        new Notice(`已启用：${row.name}`);
      }
      await this.refresh(root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`操作失败：${message}`);
    }
  }

  private async uninstallPlugin(row: PluginUsageRow, root: HTMLElement): Promise<void> {
    try {
      this.plugin.usageStore.resetPlugin(row.id);
      await this.plugin.usageStore.flush();
      await this.app.plugins.uninstallPlugin(row.id);
      new Notice(`已卸载：${row.name}`);
      await this.refresh(root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`卸载失败：${message}`);
    }
  }
}
