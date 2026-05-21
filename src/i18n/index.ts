import { moment } from "obsidian";
import { getSortLocaleFromLocale, resolveLocale, type Locale } from "./locale";
import { messages, type MessageKey } from "./messages";

export type { Locale, MessageKey };
export { resolveLocale } from "./locale";

export function getLocale(): Locale {
  return resolveLocale(moment.locale());
}

export function getSortLocale(): string | undefined {
  return getSortLocaleFromLocale(getLocale());
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const locale = getLocale();
  let text: string = messages[locale][key] ?? messages.en[key];

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }

  return text;
}

export function formatRelativeTime(timestamp: number | null): string {
  if (timestamp === null) {
    return t("neverUsed");
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) {
    return t("justNow");
  }
  if (diffMinutes < 60) {
    return t("minutesAgo", { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t("hoursAgo", { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return t("daysAgo", { count: diffDays });
  }

  return new Date(timestamp).toLocaleDateString(getSortLocale());
}
