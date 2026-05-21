export type TrackableInteractionSource =
  | "dom-event"
  | "editor-extension"
  | "editor-suggest"
  | "event-ref"
  | "markdown-code-block"
  | "markdown-post-processor"
  | "obsidian-protocol"
  | "ribbon";

const pluginInteractionSources = new Map<string, Set<TrackableInteractionSource>>();

export function markTrackableInteraction(
  pluginId: string,
  source: TrackableInteractionSource,
): void {
  const sources = pluginInteractionSources.get(pluginId) ?? new Set<TrackableInteractionSource>();
  sources.add(source);
  pluginInteractionSources.set(pluginId, sources);
}

export function hasTrackableInteraction(pluginId: string): boolean {
  return (pluginInteractionSources.get(pluginId)?.size ?? 0) > 0;
}

export function clearTrackableInteractions(): void {
  pluginInteractionSources.clear();
}
