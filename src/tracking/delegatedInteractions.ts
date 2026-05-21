import type PluginsActivityPlugin from "../main";
import { recordPluginActivity } from "./activityRecorder";

export interface DelegatedInteractionRule {
  pluginId: string;
  selector: string;
  events: Array<"click" | "change" | "wheel" | "contextmenu">;
}

export const DELEGATED_INTERACTION_RULES: DelegatedInteractionRule[] = [
  {
    pluginId: "quick-explorer",
    selector: ".qe-file, .qe-folder, .qe-popup-menu .qe-file, .qe-popup-menu .qe-folder",
    events: ["click"],
  },
  {
    pluginId: "tag-wrangler",
    selector: ".tag-pane-tag, .markdown-preview-view a.tag[href^='#']",
    events: ["click", "contextmenu"],
  },
  {
    pluginId: "obsidian-tasks-plugin",
    selector: ".task-list-item-checkbox",
    events: ["click", "change"],
  },
  {
    pluginId: "mousewheel-image-zoom",
    selector: ".markdown-preview-view img, .workspace-leaf-content img",
    events: ["wheel"],
  },
];

function matchesDelegatedRule(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null;
  }

  for (const rule of DELEGATED_INTERACTION_RULES) {
    if (target.closest(rule.selector)) {
      return rule.pluginId;
    }
  }

  return null;
}

export function installDelegatedInteractionTracking(plugin: PluginsActivityPlugin): void {
  const handleEvent = (event: Event) => {
    if (!plugin.settings.trackingEnabled) {
      return;
    }

    if ("isTrusted" in event && event.isTrusted === false) {
      return;
    }

    const pluginId = matchesDelegatedRule(event.target);
    if (!pluginId || !plugin.app.plugins.plugins[pluginId]) {
      return;
    }

    recordPluginActivity(pluginId);
  };

  const trackedEvents = new Set<DelegatedInteractionRule["events"][number]>();
  for (const rule of DELEGATED_INTERACTION_RULES) {
    for (const eventName of rule.events) {
      trackedEvents.add(eventName);
    }
  }

  for (const eventName of trackedEvents) {
    plugin.registerDomEvent(document, eventName, handleEvent, { capture: true });
  }
}
