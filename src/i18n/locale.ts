export type Locale = "en" | "zh";

export function resolveLocale(locale: string | undefined): Locale {
  const normalized = locale?.toLowerCase() ?? "en";
  return normalized.startsWith("zh") ? "zh" : "en";
}

export function getSortLocaleFromLocale(locale: Locale): string | undefined {
  return locale === "zh" ? "zh-CN" : undefined;
}
