import { describe, expect, it } from "vitest";
import { messages } from "./messages";
import { getSortLocaleFromLocale, resolveLocale } from "./locale";

describe("i18n locale", () => {
  it("resolves English and Chinese locales", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("en-gb")).toBe("en");
    expect(resolveLocale("zh-cn")).toBe("zh");
    expect(resolveLocale("zh-TW")).toBe("zh");
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("maps sort locales", () => {
    expect(getSortLocaleFromLocale("zh")).toBe("zh-CN");
    expect(getSortLocaleFromLocale("en")).toBeUndefined();
  });

  it("defines matching English and Chinese message keys", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.zh).sort());
    expect(messages.en.usageCount).toContain("{count}");
    expect(messages.zh.usageCount).toContain("{count}");
  });
});
