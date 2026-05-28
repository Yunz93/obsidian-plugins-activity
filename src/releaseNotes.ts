import type { Locale } from "./i18n/locale";

export interface ReleaseNoteEntry {
  version: string;
  en: string[];
  zh: string[];
}

export const RELEASE_NOTES: ReleaseNoteEntry[] = [
  {
    version: "0.2.2",
    en: [
      "Check community plugin updates from the overview (per-plugin and bulk).",
      "Drag the overview modal and resize table columns.",
      "Show a What's New dialog after plugin updates.",
      "Improve table layout: centered metrics, wrapped hints, and contained status badges.",
      "Stack row action buttons vertically for easier tapping.",
      "Settings opens correctly instead of staying behind the overview modal.",
      "Show What's New before the startup overview so release notes stay visible.",
      "Tone down untrackable-plugin hints and fix CSS lint compatibility issues.",
    ],
    zh: [
      "总览页支持插件更新检查（单插件 + 批量）。",
      "总览弹窗可拖拽，表格列宽可调整。",
      "插件更新后自动显示新功能说明。",
      "优化表格布局：数据居中、说明换行、状态徽章不溢出。",
      "行内操作按钮纵向排列，更易点击。",
      "修复设置页被弹窗遮挡的问题。",
      "启动时先显示新功能说明，避免被总览页遮挡。",
      "弱化不可统计说明样式，并修复 CSS lint 兼容问题。",
    ],
  },
  {
    version: "0.2.1",
    en: [
      "Center overview metric cells while keeping column headers left-aligned.",
      "Wrap long trackability hints in the plugin name column.",
      "Keep status badges inside the status column and size the column from badge text.",
    ],
    zh: [
      "总览表格数据居中显示，表头保持左对齐。",
      "插件名列中的不可统计说明支持换行完整显示。",
      "状态徽章不再溢出到相邻列，并按徽章文案计算列宽。",
    ],
  },
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
