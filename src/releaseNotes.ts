import type { Locale } from "./i18n/locale";

export interface ReleaseNoteEntry {
  version: string;
  en: string[];
  zh: string[];
}

export const RELEASE_NOTES: ReleaseNoteEntry[] = [
  {
    version: "0.2.0",
    en: [
      "Check community plugin updates from the overview (per-plugin update action and bulk check).",
      "Drag the overview modal; resize table columns by dragging headers.",
      "Show a What's New dialog after plugin updates, including the plugin name in the title.",
      "Auto-size table columns so headers fit in both English and Chinese.",
      "Stack row action buttons vertically for easier tapping.",
      "Settings opens correctly instead of staying hidden behind the overview modal.",
      "Safer editor extension wrapping during plugin uninstall.",
    ],
    zh: [
      "总览页支持插件更新检查（单插件更新 + 批量检查）。",
      "总览弹窗可拖拽；表格列宽可调整。",
      "插件更新后自动显示新功能说明，标题包含插件名称。",
      "表格列宽按中英文列名自动计算。",
      "行内操作按钮改为纵向排列，更易点击。",
      "修复设置页被弹窗遮挡的问题。",
      "增强卸载流程中的 editor extension 包装稳定性。",
    ],
  },
];

export function getReleaseNotes(version: string, locale: Locale): string[] {
  const entry = RELEASE_NOTES.find((note) => note.version === version);
  if (!entry) {
    return [];
  }

  return entry[locale];
}
