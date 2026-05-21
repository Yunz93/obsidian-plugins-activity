const SELF_PLUGIN_ID = "extensions-activity";
const DEDUP_WINDOW_MS = 100;

export type ActivityKind = "command" | "interaction";

let recordActivity: ((pluginId: string, kind: ActivityKind) => void) | null = null;
const recentActivity = new Map<string, number>();

export function setActivityRecorder(
  recorder: ((pluginId: string, kind: ActivityKind) => void) | null,
): void {
  recordActivity = recorder;
  if (!recorder) {
    recentActivity.clear();
  }
}

export function recordPluginActivity(
  pluginId: string,
  kind: ActivityKind = "interaction",
): void {
  if (!pluginId || pluginId === SELF_PLUGIN_ID || !recordActivity) {
    return;
  }

  const now = Date.now();
  const dedupeKey = `${pluginId}:${kind}`;
  const lastAt = recentActivity.get(dedupeKey);
  if (lastAt !== undefined && now - lastAt < DEDUP_WINDOW_MS) {
    return;
  }

  recentActivity.set(dedupeKey, now);
  recordActivity(pluginId, kind);
}
