export type PluginUpdateKind =
  | "unknown"
  | "checking"
  | "available"
  | "current"
  | "failed";

export interface PluginUpdateStatus {
  kind: PluginUpdateKind;
  checkedAt: number | null;
  error?: string;
}
