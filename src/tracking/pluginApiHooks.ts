import { around } from "monkey-around";
import {
  Component,
  Plugin,
  type EditorSuggest,
  type EventRef,
  type Vault,
  type Workspace,
} from "obsidian";
import { recordPluginActivity } from "./activityRecorder";
import {
  assignEventRefOwner,
  getEventRefLabel,
  getEventRefOwner,
  labelEventRef,
  shouldTrackLabeledEvent,
} from "./eventRefRegistry";
import {
  clearTrackableInteractions,
  markTrackableInteraction,
} from "./trackableSources";

const SELF_PLUGIN_ID = "plugins-activity";

const INTERACTIVE_DOM_EVENTS = new Set<string>([
  "click",
  "dblclick",
  "contextmenu",
  "keydown",
  "keyup",
  "keypress",
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "input",
  "change",
  "paste",
  "drop",
  "submit",
  "wheel",
]);

let hooksInstalled = false;
let uninstallHooks: (() => void) | undefined;

function isInteractiveDomEvent(eventName: string): boolean {
  return INTERACTIVE_DOM_EVENTS.has(eventName);
}

function shouldRecordDomEvent(event: Event): boolean {
  if ("isTrusted" in event && event.isTrusted === false) {
    return false;
  }

  return true;
}

type RunnableEditorExtension = {
  run: (...args: unknown[]) => unknown;
  __pluginsActivityWrapped?: boolean;
};

export function wrapEditorExtensionValue(pluginId: string, value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => wrapEditorExtensionValue(pluginId, item));
  }

  if (typeof value === "object") {
    return wrapRunnableEditorExtension(pluginId, value);
  }

  return value;
}

function wrapRunnableEditorExtension(pluginId: string, value: object): object {
  const spec = value as Partial<RunnableEditorExtension>;
  if (typeof spec.run !== "function" || spec.__pluginsActivityWrapped) {
    return value;
  }
  if (!Object.isExtensible(value)) {
    return value;
  }

  const runDescriptor = Object.getOwnPropertyDescriptor(value, "run");
  if (runDescriptor && runDescriptor.configurable === false && runDescriptor.writable !== true) {
    return value;
  }

  const original = spec.run;
  try {
    Object.defineProperty(value, "run", {
      configurable: true,
      writable: true,
      value(this: unknown, ...args: unknown[]) {
        recordPluginActivity(pluginId);
        return original.apply(this, args);
      },
    });
    Object.defineProperty(value, "__pluginsActivityWrapped", {
      configurable: true,
      value: true,
    });
  } catch {
    return value;
  }

  return value;
}

function wrapEditorSuggest(pluginId: string, suggest: EditorSuggest<unknown>): void {
  const target = suggest as EditorSuggest<unknown> & { __pluginsActivityWrapped?: boolean };
  if (target.__pluginsActivityWrapped) {
    return;
  }

  target.__pluginsActivityWrapped = true;
  const original = target.selectSuggestion.bind(target);
  target.selectSuggestion = (value, evt) => {
    recordPluginActivity(pluginId);
    return original(value, evt);
  };
}

function patchEventSource(
  target: { on: (...args: unknown[]) => unknown },
  prefix: string,
): () => void {
  return around(target, {
    on(original) {
      return function (this: unknown, name: unknown, callback: unknown, ...rest: unknown[]) {
        if (typeof name !== "string" || typeof callback !== "function") {
          return original.call(this, name, callback, ...rest);
        }

        const label = `${prefix}:${name}`;
        let eventRef: object | undefined;
        const wrapped = function (this: unknown, ...args: unknown[]) {
          if (eventRef && shouldTrackLabeledEvent(label)) {
            const pluginId = getEventRefOwner(eventRef);
            if (pluginId) {
              recordPluginActivity(pluginId);
            }
          }
          return callback.apply(this, args);
        };

        const ref = original.call(this, name, wrapped, ...rest);
        if (ref && typeof ref === "object") {
          eventRef = ref;
          labelEventRef(ref, label);
        }
        return ref;
      };
    },
  });
}

export function installGlobalTrackingHooks(): void {
  if (hooksInstalled) {
    return;
  }

  hooksInstalled = true;
  const uninstallers: Array<() => void> = [];

  uninstallers.push(
    around(Component.prototype, {
      registerDomEvent(original) {
        return function (
          this: Component,
          element: HTMLElement | Document | Window,
          type: string,
          callback: (ev: Event) => unknown,
          options?: boolean | AddEventListenerOptions,
        ) {
          if (!isInteractiveDomEvent(type)) {
            return original.call(this, element, type, callback, options);
          }

          const pluginId = this instanceof Plugin ? this.manifest?.id : undefined;
          if (!pluginId || pluginId === SELF_PLUGIN_ID) {
            return original.call(this, element, type, callback, options);
          }

          markTrackableInteraction(pluginId, "dom-event");
          const wrapped = (event: Event) => {
            if (shouldRecordDomEvent(event)) {
              recordPluginActivity(pluginId);
            }
            return callback.call(element as HTMLElement, event);
          };

          return original.call(this, element, type, wrapped, options);
        };
      },
      registerEvent(original) {
        return function (this: Component, eventRef: EventRef) {
          const pluginId = this instanceof Plugin ? this.manifest?.id : undefined;
          if (pluginId && pluginId !== SELF_PLUGIN_ID && eventRef && typeof eventRef === "object") {
            assignEventRefOwner(eventRef, pluginId);
            const label = getEventRefLabel(eventRef);
            if (label && shouldTrackLabeledEvent(label)) {
              markTrackableInteraction(pluginId, "event-ref");
            }
          }
          return original.call(this, eventRef);
        };
      },
    }),
  );

  uninstallers.push(
    around(Plugin.prototype, {
      addRibbonIcon(original) {
        return function (icon, title, callback) {
          const pluginId = this.manifest?.id;
          if (!pluginId || pluginId === SELF_PLUGIN_ID) {
            return original.call(this, icon, title, callback);
          }

          markTrackableInteraction(pluginId, "ribbon");
          const wrapped = (evt: MouseEvent) => {
            recordPluginActivity(pluginId);
            return callback(evt);
          };

          return original.call(this, icon, title, wrapped);
        };
      },
      registerObsidianProtocolHandler(original) {
        return function (action, handler) {
          const pluginId = this.manifest?.id;
          if (!pluginId || pluginId === SELF_PLUGIN_ID) {
            return original.call(this, action, handler);
          }

          markTrackableInteraction(pluginId, "obsidian-protocol");
          const wrapped = (params: Parameters<typeof handler>[0]) => {
            recordPluginActivity(pluginId);
            return handler(params);
          };

          return original.call(this, action, wrapped);
        };
      },
      registerMarkdownPostProcessor(original) {
        return function (postProcessor, sortOrder) {
          const pluginId = this.manifest?.id;
          if (!pluginId || pluginId === SELF_PLUGIN_ID) {
            return original.call(this, postProcessor, sortOrder);
          }

          markTrackableInteraction(pluginId, "markdown-post-processor");
          const wrapped: typeof postProcessor = (element, context) => {
            recordPluginActivity(pluginId, "render");
            return postProcessor(element, context);
          };

          return original.call(this, wrapped, sortOrder);
        };
      },
      registerMarkdownCodeBlockProcessor(original) {
        return function (language, handler, sortOrder) {
          const pluginId = this.manifest?.id;
          if (!pluginId || pluginId === SELF_PLUGIN_ID) {
            return original.call(this, language, handler, sortOrder);
          }

          markTrackableInteraction(pluginId, "markdown-code-block");
          const wrapped: typeof handler = (source, element, context) => {
            recordPluginActivity(pluginId, "render");
            return handler(source, element, context);
          };

          return original.call(this, language, wrapped, sortOrder);
        };
      },
      registerEditorSuggest(original) {
        return function (suggest: EditorSuggest<unknown>) {
          const pluginId = this.manifest?.id;
          if (pluginId && pluginId !== SELF_PLUGIN_ID) {
            markTrackableInteraction(pluginId, "editor-suggest");
            wrapEditorSuggest(pluginId, suggest);
          }
          return original.call(this, suggest);
        };
      },
      registerEditorExtension(original) {
        return function (extension: unknown) {
          const pluginId = this.manifest?.id;
          if (pluginId && pluginId !== SELF_PLUGIN_ID) {
            markTrackableInteraction(pluginId, "editor-extension");
            return original.call(this, wrapEditorExtensionValue(pluginId, extension));
          }
          return original.call(this, extension);
        };
      },
    }),
  );

  uninstallHooks = () => {
    for (const uninstall of uninstallers) {
      uninstall();
    }
    clearTrackableInteractions();
    uninstallHooks = undefined;
    hooksInstalled = false;
  };
}

export function attachEventSourceTracking(app: {
  workspace: Workspace;
  vault: Vault;
}): () => void {
  const uninstallWorkspace = patchEventSource(app.workspace, "workspace");
  const uninstallVault = patchEventSource(app.vault, "vault");
  return () => {
    uninstallWorkspace();
    uninstallVault();
  };
}

export function uninstallGlobalTrackingHooks(): void {
  uninstallHooks?.();
}
