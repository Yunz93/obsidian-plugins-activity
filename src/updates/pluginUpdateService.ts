import type { PluginSnapshot } from "../types/usage";
import type { PluginsInternalApi } from "../types/obsidian-internals";
import type { PluginUpdateStatus } from "./updateTypes";

export interface PluginUpdateServiceOptions {
  plugins: PluginsInternalApi;
  onStatusChanged: () => void;
  now?: () => number;
}

export class PluginUpdateService {
  private readonly statuses = new Map<string, PluginUpdateStatus>();
  private checkPromise: Promise<void> | null = null;
  private readonly now: () => number;

  constructor(private readonly options: PluginUpdateServiceOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  getStatus(pluginId: string): PluginUpdateStatus {
    return this.statuses.get(pluginId) ?? {
      kind: "unknown",
      checkedAt: null,
    };
  }

  async checkNow(getSnapshots: () => Promise<PluginSnapshot[]>): Promise<void> {
    if (!this.checkPromise) {
      this.checkPromise = this.runCheck(getSnapshots).finally(() => {
        this.checkPromise = null;
      });
    }

    await this.checkPromise;
  }

  private async runCheck(getSnapshots: () => Promise<PluginSnapshot[]>): Promise<void> {
    const snapshots = await getSnapshots();
    this.markChecking(snapshots);

    try {
      await this.options.plugins.checkForUpdates();
      const updates = this.options.plugins.updates ?? {};
      for (const snapshot of snapshots) {
        this.setStatus(snapshot.id, {
          kind: Object.prototype.hasOwnProperty.call(updates, snapshot.id) ? "available" : "current",
          checkedAt: this.now(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const snapshot of snapshots) {
        this.setStatus(snapshot.id, {
          kind: "failed",
          checkedAt: this.now(),
          error: message,
        });
      }
    }
  }

  async updatePlugin(pluginId: string): Promise<void> {
    const update = this.options.plugins.updates?.[pluginId];
    if (!update) {
      return;
    }

    this.setStatus(pluginId, {
      kind: "checking",
      checkedAt: this.now(),
    });
    await this.options.plugins.installPlugin(update.repo, update.version, update.manifest);
    this.setStatus(pluginId, {
      kind: "current",
      checkedAt: this.now(),
    });
  }

  private markChecking(snapshots: PluginSnapshot[]): void {
    const checkedAt = this.now();
    for (const snapshot of snapshots) {
      this.setStatus(snapshot.id, {
        kind: "checking",
        checkedAt,
      });
    }
  }

  private setStatus(pluginId: string, status: PluginUpdateStatus): void {
    this.statuses.set(pluginId, status);
    this.options.onStatusChanged();
  }
}
