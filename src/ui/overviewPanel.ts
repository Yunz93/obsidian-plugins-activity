import { Notice, type App } from "obsidian";
import { getColumnLabel } from "../i18n/columns";
import { formatRelativeTime, getLocale, getSortLocale, t } from "../i18n";
import type PluginsActivityPlugin from "../main";
import { isTrackingSupported, getTrackingUnsupportedReason } from "../tracking/trackability";
import { ConfirmResetModal } from "./ConfirmResetModal";
import { getUpdateButtonState } from "../updates/updateButton";
import {
  sumDailyUsage,
  type PluginUsageRow,
  type SortColumn,
  type SortDirection,
} from "../types/usage";

const SELF_PLUGIN_ID = "plugins-activity";

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

type TableColumn = SortColumn | "actions";

const TABLE_COLUMNS: TableColumn[] = [...SORTABLE_COLUMNS, "actions"];

const DEFAULT_COLUMN_WIDTHS: Record<TableColumn, number> = {
  name: 25,
  enabled: 9,
  version: 8,
  commandCount: 8,
  interactionCount: 8,
  viewOpenCount: 8,
  lastUsedAt: 11,
  last7DaysTotal: 8,
  actions: 15,
};

const MIN_COLUMN_WIDTHS: Record<TableColumn, number> = {
  name: 12,
  enabled: 7,
  version: 6,
  commandCount: 6,
  interactionCount: 6,
  viewOpenCount: 6,
  lastUsedAt: 8,
  last7DaysTotal: 6,
  actions: 13,
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
  private columnWidths: Record<TableColumn, number> = { ...DEFAULT_COLUMN_WIDTHS };
  private isResizingColumn = false;

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
    root.toggleClass("is-locale-en", getLocale() === "en");
    root.toggleClass("is-locale-zh", getLocale() === "zh");
    this.applyColumnWidths(root);

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
    heading.createEl("h2", { text: t("overviewTitle") });
    heading.createDiv({ cls: "obsidian-plugins-activity-heading-meta", text: t("overviewMeta") });

    const actions = toolbar.createDiv({ cls: "obsidian-plugins-activity-toolbar-actions" });

    const searchRow = actions.createDiv({ cls: "obsidian-plugins-activity-toolbar-search-row" });
    const search = searchRow.createEl("input", {
      cls: "obsidian-plugins-activity-search",
      type: "search",
      placeholder: t("searchPlaceholder"),
    });
    search.value = this.searchQuery;
    this.registerDomEvent(search, "input", () => {
      this.searchQuery = search.value.trim().toLowerCase();
      this.renderTable(root);
    });

    const refreshButton = searchRow.createEl("button", { text: t("refresh"), cls: "mod-cta" });
    this.registerDomEvent(refreshButton, "click", () => {
      void this.refresh(root);
    });

    const buttonRow = actions.createDiv({ cls: "obsidian-plugins-activity-toolbar-button-row" });
    const resetButton = buttonRow.createEl("button", { text: t("reset") });
    this.registerDomEvent(resetButton, "click", () => {
      new ConfirmResetModal(
        this.app,
        t("resetAllTitle"),
        t("resetAllMessage"),
        async () => {
          this.plugin.usageStore.resetAll();
          await this.plugin.usageStore.flush();
          await this.refresh(root);
        },
      ).open();
    });

    const checkUpdatesButton = buttonRow.createEl("button", { text: t("checkUpdates") });
    this.registerDomEvent(checkUpdatesButton, "click", async () => {
      checkUpdatesButton.disabled = true;
      checkUpdatesButton.setText(t("checkingUpdates"));
      try {
        await this.plugin.checkPluginUpdates();
        new Notice(t("updateCheckComplete"));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(t("updateCheckFailedWithMessage", { message }));
      } finally {
        await this.refresh(root);
      }
    });

    const settingsButton = buttonRow.createEl("button", { text: t("settings") });
    this.registerDomEvent(settingsButton, "click", () => {
      this.plugin.openSettings();
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

    this.createSummaryCard(summary, t("installedPlugins"), String(snapshots.length));
    this.createSummaryCard(summary, t("activeToday"), String(todayActive));
    this.createSummaryCard(summary, t("activityToday"), String(todayTotal));
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
    card.createDiv({ cls: "label", text: t("topLast7Days") });
    const body = card.createDiv({ cls: "obsidian-plugins-activity-summary-body" });

    if (topPlugins.length === 0) {
      body.createDiv({ cls: "sub", text: t("noUsageRecords") });
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
      item.createSpan({
        cls: "obsidian-plugins-activity-top-count",
        text: t("usageCount", { count: row.last7DaysTotal }),
      });
    }
  }

  private renderTable(root: HTMLElement): void {
    const existing = root.querySelector(".obsidian-plugins-activity-table-wrap");
    existing?.remove();

    const wrap = root.createDiv({ cls: "obsidian-plugins-activity-table-wrap" });
    const filteredRows = this.getFilteredRows();
    this.renderMobileSort(wrap, root);

    if (filteredRows.length === 0) {
      wrap.createDiv({
        cls: "obsidian-plugins-activity-empty",
        text: this.searchQuery ? t("noMatchingPlugins") : t("noPluginsToShow"),
      });
      return;
    }

    const table = wrap.createEl("table", { cls: "obsidian-plugins-activity-table" });
    const colgroup = table.createEl("colgroup");
    for (const column of TABLE_COLUMNS) {
      colgroup.createEl("col", {
        attr: {
          style: `width: var(--obsidian-plugins-activity-col-${column});`,
        },
      });
    }

    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");

    for (const column of SORTABLE_COLUMNS) {
      const th = headerRow.createEl("th");
      th.dataset.col = column;
      if (this.isNumericColumn(column)) {
        th.addClass("obsidian-plugins-activity-table-number");
      }
      th.setText(getColumnLabel(column));
      const indicator = th.createSpan({ cls: "sort-indicator" });
      if (column === this.sortColumn) {
        indicator.addClass("is-active");
        indicator.setText(this.sortDirection === "asc" ? "↑" : "↓");
      } else {
        indicator.setText("↕");
      }

      this.renderColumnResizeHandle(th, column, root);

      this.registerDomEvent(th, "click", (event) => {
        const target = event.target;
        if (
          this.isResizingColumn ||
          (target instanceof HTMLElement &&
            target.closest(".obsidian-plugins-activity-column-resizer"))
        ) {
          return;
        }

        if (this.sortColumn === column) {
          this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        } else {
          this.sortColumn = column;
          this.sortDirection = column === "name" || column === "version" ? "asc" : "desc";
        }
        this.renderTable(root);
      });
    }

    const actionsHeader = headerRow.createEl("th", { text: t("actions") });
    actionsHeader.dataset.col = "actions";

    const tbody = table.createEl("tbody");
    for (const row of this.sortRows(filteredRows)) {
      this.renderRow(tbody, row, root);
    }
  }

  private renderMobileSort(parent: HTMLElement, root: HTMLElement): void {
    const bar = parent.createDiv({ cls: "obsidian-plugins-activity-mobile-sort" });
    bar.createSpan({ cls: "obsidian-plugins-activity-mobile-sort-label", text: t("sortBy") });

    const select = bar.createEl("select", { cls: "obsidian-plugins-activity-mobile-sort-select" });
    for (const column of SORTABLE_COLUMNS) {
      const option = select.createEl("option", {
        value: column,
        text: getColumnLabel(column),
      });
      if (column === this.sortColumn) {
        option.selected = true;
      }
    }

    this.registerDomEvent(select, "change", () => {
      this.sortColumn = select.value as SortColumn;
      this.renderTable(root);
    });

    const directionButton = bar.createEl("button", {
      cls: "obsidian-plugins-activity-mobile-sort-direction",
      text: this.sortDirection === "asc" ? "↑" : "↓",
    });
    this.registerDomEvent(directionButton, "click", () => {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
      this.renderTable(root);
    });
  }

  private applyColumnWidths(root: HTMLElement): void {
    for (const column of TABLE_COLUMNS) {
      root.style.setProperty(
        `--obsidian-plugins-activity-col-${column}`,
        `${this.columnWidths[column]}%`,
      );
    }
  }

  private renderColumnResizeHandle(
    header: HTMLTableCellElement,
    column: TableColumn,
    root: HTMLElement,
  ): void {
    const nextColumn = this.getNextColumn(column);
    if (!nextColumn) {
      return;
    }

    const handle = header.createSpan({
      cls: "obsidian-plugins-activity-column-resizer",
      attr: {
        "aria-hidden": "true",
      },
    });

    this.registerDomEvent(handle, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const table = header.closest("table");
      if (!(table instanceof HTMLTableElement)) {
        return;
      }

      const tableWidth = table.getBoundingClientRect().width;
      if (tableWidth <= 0) {
        return;
      }

      const startX = event.clientX;
      const startWidth = this.columnWidths[column];
      const startNextWidth = this.columnWidths[nextColumn];
      const combinedWidth = startWidth + startNextWidth;
      const minWidth = MIN_COLUMN_WIDTHS[column];
      const nextMinWidth = MIN_COLUMN_WIDTHS[nextColumn];

      this.isResizingColumn = true;
      table.addClass("is-resizing-columns");

      const onPointerMove = (moveEvent: PointerEvent) => {
        const delta = ((moveEvent.clientX - startX) / tableWidth) * 100;
        const nextWidth = this.clampWidth(
          startWidth + delta,
          minWidth,
          combinedWidth - nextMinWidth,
        );

        this.columnWidths[column] = nextWidth;
        this.columnWidths[nextColumn] = combinedWidth - nextWidth;
        this.applyColumnWidths(root);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        table.removeClass("is-resizing-columns");
        window.setTimeout(() => {
          this.isResizingColumn = false;
        }, 0);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    });
  }

  private getNextColumn(column: TableColumn): TableColumn | null {
    const index = TABLE_COLUMNS.indexOf(column);
    return index >= 0 ? TABLE_COLUMNS[index + 1] ?? null : null;
  }

  private clampWidth(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
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
    const sortLocale = getSortLocale();
    return [...rows].sort((left, right) => {
      switch (this.sortColumn) {
        case "name":
          return direction * left.name.localeCompare(right.name, sortLocale);
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

  private createNumberCell(
    row: HTMLTableRowElement,
    column: SortColumn,
    value: number,
  ): void {
    const cell = row.createEl("td", {
      cls: "obsidian-plugins-activity-table-number",
      text: String(value),
    });
    cell.dataset.col = column;
    cell.dataset.label = getColumnLabel(column);
  }

  private renderRow(tbody: HTMLElement, row: PluginUsageRow, root: HTMLElement): void {
    const tr = tbody.createEl("tr");
    if (!row.trackingSupported) {
      tr.addClass("is-untracked");
    }

    const nameCell = tr.createEl("td");
    nameCell.dataset.col = "name";
    nameCell.createDiv({ cls: "obsidian-plugins-activity-name", text: row.name });
    nameCell.createDiv({ cls: "obsidian-plugins-activity-id", text: row.id });
    if (!row.trackingSupported) {
      nameCell.createDiv({
        cls: "obsidian-plugins-activity-trackability-hint",
        text: getTrackingUnsupportedReason(row.id),
      });
    }

    const statusCell = tr.createEl("td");
    statusCell.dataset.col = "enabled";
    statusCell.dataset.label = getColumnLabel("enabled");
    statusCell.createSpan({
      cls: row.enabled ? "obsidian-plugins-activity-status is-enabled" : "obsidian-plugins-activity-status is-disabled",
      text: row.enabled ? t("enabled") : t("disabled"),
    });

    const versionCell = tr.createEl("td", { text: row.version });
    versionCell.dataset.col = "version";
    versionCell.dataset.label = getColumnLabel("version");
    this.createNumberCell(tr, "commandCount", row.commandCount);
    this.createNumberCell(tr, "interactionCount", row.interactionCount);
    this.createNumberCell(tr, "viewOpenCount", row.viewOpenCount);
    const lastUsedCell = tr.createEl("td", { text: formatRelativeTime(row.lastUsedAt) });
    lastUsedCell.dataset.col = "lastUsedAt";
    lastUsedCell.dataset.label = getColumnLabel("lastUsedAt");
    this.createNumberCell(tr, "last7DaysTotal", row.last7DaysTotal);

    const actionsCell = tr.createEl("td");
    actionsCell.dataset.col = "actions";
    const actions = actionsCell.createDiv({ cls: "obsidian-plugins-activity-row-actions" });
    const isSelf = row.id === SELF_PLUGIN_ID;

    if (!isSelf) {
      this.renderUpdateButton(actions, row, root);

      const toggleButton = actions.createEl("button", {
        text: row.enabled ? t("disable") : t("enable"),
      });
      this.registerDomEvent(toggleButton, "click", () => {
        void this.togglePluginEnabled(row, root);
      });

      const uninstallButton = actions.createEl("button", { text: t("uninstall") });
      uninstallButton.addClass("obsidian-plugins-activity-uninstall");
      this.registerDomEvent(uninstallButton, "click", () => {
        new ConfirmResetModal(
          this.app,
          t("uninstallTitle"),
          t("uninstallMessage", { name: row.name }),
          async () => {
            await this.uninstallPlugin(row, root);
          },
        ).open();
      });
    }
  }

  private renderUpdateButton(actions: HTMLElement, row: PluginUsageRow, root: HTMLElement): void {
    const status = this.plugin.updateService.getStatus(row.id);
    const buttonState = getUpdateButtonState(status);
    const updateButton = actions.createEl("button", {
      text: t(buttonState.labelKey),
    });
    updateButton.disabled = buttonState.disabled;
    updateButton.title = t(buttonState.titleKey);
    if (status.kind === "available") {
      updateButton.addClass("mod-cta");
    }
    this.registerDomEvent(updateButton, "click", async () => {
      if (buttonState.disabled) {
        return;
      }

      updateButton.disabled = true;
      updateButton.setText(t("checkingUpdates"));
      try {
        await this.plugin.updatePlugin(row.id);
        new Notice(t("pluginUpdated", { name: row.name }));
        await this.refresh(root);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(t("updatePluginFailed", { message }));
      }
    });
  }

  private async togglePluginEnabled(row: PluginUsageRow, root: HTMLElement): Promise<void> {
    try {
      if (row.enabled) {
        await this.app.plugins.disablePluginAndSave(row.id);
        new Notice(t("pluginDisabled", { name: row.name }));
      } else {
        await this.app.plugins.enablePluginAndSave(row.id);
        new Notice(t("pluginEnabled", { name: row.name }));
      }
      await this.refresh(root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(t("actionFailed", { message }));
    }
  }

  private async uninstallPlugin(row: PluginUsageRow, root: HTMLElement): Promise<void> {
    try {
      await this.app.plugins.uninstallPlugin(row.id);
      this.plugin.usageStore.resetPlugin(row.id);
      await this.plugin.usageStore.flush();
      new Notice(t("pluginUninstalled", { name: row.name }));
      await this.refresh(root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(t("uninstallFailed", { message }));
    }
  }
}
