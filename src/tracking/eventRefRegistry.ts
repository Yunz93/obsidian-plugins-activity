const eventRefLabels = new WeakMap<object, string>();
const eventRefOwners = new WeakMap<object, string>();

const TRACKED_WORKSPACE_EVENTS = new Set([
  "editor-paste",
  "editor-drop",
  "hover-link",
]);

const TRACKED_VAULT_EVENTS = new Set([
  "create",
]);

export function labelEventRef(ref: object, label: string): void {
  eventRefLabels.set(ref, label);
}

export function assignEventRefOwner(ref: object, pluginId: string): void {
  eventRefOwners.set(ref, pluginId);
}

export function getEventRefLabel(ref: unknown): string | undefined {
  if (!ref || typeof ref !== "object") {
    return undefined;
  }

  return eventRefLabels.get(ref);
}

export function getEventRefOwner(ref: unknown): string | undefined {
  if (!ref || typeof ref !== "object") {
    return undefined;
  }

  return eventRefOwners.get(ref);
}

export function shouldTrackLabeledEvent(label: string): boolean {
  const separator = label.indexOf(":");
  if (separator <= 0) {
    return false;
  }

  const source = label.slice(0, separator);
  const name = label.slice(separator + 1);

  if (source === "workspace") {
    return TRACKED_WORKSPACE_EVENTS.has(name);
  }

  if (source === "vault") {
    return TRACKED_VAULT_EVENTS.has(name);
  }

  return false;
}
