#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const PLUGIN_DIR =
  process.argv[2] ??
  `${process.env.HOME}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/.obsidian/plugins`;

const SKIP = new Set(["extensions-activity"]);
const DELEGATED_PLUGIN_IDS = new Set([
  "quick-explorer",
  "tag-wrangler",
  "obsidian-tasks-plugin",
  "mousewheel-image-zoom",
]);

const PATTERNS = {
  addCommand: /addCommand\s*\(/g,
  registerView: /registerView\s*\(/g,
  registerEvent: /registerEvent\s*\(/g,
  registerDomEvent: /registerDomEvent\s*\(/g,
  registerEditorExtension: /registerEditorExtension\s*\(/g,
  registerMarkdownPostProcessor: /registerMarkdownPostProcessor\s*\(/g,
  registerMarkdownCodeBlockProcessor: /registerMarkdownCodeBlockProcessor\s*\(/g,
  registerHoverLinkSource: /registerHoverLinkSource\s*\(/g,
  registerInterval: /registerInterval\s*\(/g,
  addRibbonIcon: /addRibbonIcon\s*\(/g,
  registerExtensions: /registerExtensions\s*\(/g,
  registerEditorSuggest: /registerEditorSuggest\s*\(/g,
  registerCodeBlockPostProcessor: /registerCodeBlockPostProcessor\s*\(/g,
  registerWidget: /registerWidget\s*\(/g,
  registerPatch: /registerPatch\s*\(/g,
  registerObsidianProtocolHandler: /registerObsidianProtocolHandler\s*\(/g,
};

async function readPluginSource(pluginPath) {
  for (const file of ["main.js", "main.mjs", "main.cjs"]) {
    const candidate = path.join(pluginPath, file);
    try {
      const info = await stat(candidate);
      if (info.isFile()) {
        return readFile(candidate, "utf8");
      }
    } catch {
      // continue
    }
  }
  return "";
}

function countMatches(source, regex) {
  return source.match(regex)?.length ?? 0;
}

function classify(pluginId, manifest, counts) {
  const hasCommand = counts.addCommand > 0;
  const hasView = counts.registerView > 0;
  const hasTrackableInteraction =
    counts.registerDomEvent > 0 ||
    counts.registerEditorExtension > 0 ||
    counts.registerMarkdownPostProcessor > 0 ||
    counts.registerMarkdownCodeBlockProcessor > 0 ||
    counts.registerCodeBlockPostProcessor > 0 ||
    counts.registerEditorSuggest > 0 ||
    counts.registerObsidianProtocolHandler > 0 ||
    counts.addRibbonIcon > 0 ||
    DELEGATED_PLUGIN_IDS.has(pluginId);
  const hasPassiveHooks =
    counts.registerEvent > 0 ||
    counts.registerHoverLinkSource > 0 ||
    counts.registerInterval > 0 ||
    counts.registerExtensions > 0 ||
    counts.registerWidget > 0 ||
    counts.registerPatch > 0;

  let trackability;
  let reason;

  if (hasCommand && hasView && hasTrackableInteraction) {
    trackability = "good";
    reason = "命令 + 视图 + 常见交互均可统计";
  } else if ((hasCommand && hasView) || (hasCommand && hasTrackableInteraction) || (hasView && hasTrackableInteraction)) {
    trackability = "good";
    reason = "至少两类活动入口可统计";
  } else if (hasCommand && !hasView) {
    trackability = "partial";
    reason = "仅命令可统计；其他活动入口可能漏计";
  } else if (!hasCommand && hasView) {
    trackability = "partial";
    reason = "仅视图切换可统计；直接交互可能漏计";
  } else if (hasTrackableInteraction) {
    trackability = "partial";
    reason = "可统计常见交互/渲染入口，但没有命令或专属视图";
  } else if (hasPassiveHooks) {
    trackability = "poor";
    reason = "主要靠未覆盖的被动钩子/后台任务，当前方案基本统计不到活跃";
  } else {
    trackability = "unknown";
    reason = "未检测到常见 API，可能极难统计或源码被强混淆";
  }

  const blindSpots = [];
  if (counts.addRibbonIcon > 0 && !hasCommand) {
    blindSpots.push("ribbon 直调回调");
  }
  if (counts.registerEditorExtension > 0) {
    blindSpots.push("编辑器内联扩展");
  }
  if (counts.registerMarkdownPostProcessor > 0 || counts.registerMarkdownCodeBlockProcessor > 0) {
    blindSpots.push("预览渲染钩子");
  }
  if (counts.registerEvent > 0 || counts.registerDomEvent > 0) {
    blindSpots.push("事件监听型交互");
  }
  if (counts.registerEditorSuggest > 0) {
    blindSpots.push("输入补全/弹窗");
  }
  if (counts.registerInterval > 0) {
    blindSpots.push("定时后台任务");
  }
  if (counts.registerPatch > 0 || counts.registerExtensions > 0) {
    blindSpots.push("全局 patch/扩展");
  }
  if (counts.registerObsidianProtocolHandler > 0) {
    blindSpots.push("obsidian:// 协议入口");
  }

  return {
    pluginId,
    name: manifest.name ?? pluginId,
    trackability,
    reason,
    blindSpots,
    counts,
  };
}

async function main() {
  const entries = await readdir(PLUGIN_DIR, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith(".")) {
      continue;
    }

    const pluginPath = path.join(PLUGIN_DIR, entry.name);
    let manifest = { name: entry.name };
    try {
      manifest = JSON.parse(await readFile(path.join(pluginPath, "manifest.json"), "utf8"));
    } catch {
      // ignore
    }

    const source = await readPluginSource(pluginPath);
    const counts = Object.fromEntries(
      Object.entries(PATTERNS).map(([key, regex]) => [key, countMatches(source, regex)]),
    );

    results.push(classify(entry.name, manifest, counts));
  }

  results.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  const groups = {
    good: results.filter((r) => r.trackability === "good"),
    partial: results.filter((r) => r.trackability === "partial"),
    poor: results.filter((r) => r.trackability === "poor"),
    unknown: results.filter((r) => r.trackability === "unknown"),
  };

  console.log(`# 插件可统计性排查\n`);
  console.log(`目录: ${PLUGIN_DIR}`);
  console.log(`插件数: ${results.length}\n`);
  console.log(`当前方案统计:`);
  console.log(`- 命令执行 (app.commands.executeCommand / executeCommandById / 包装 callback)`);
  console.log(`- 工作区 leaf 切换到插件注册的 viewType`);
  console.log(`- 常见交互入口 (ribbon / DOM 事件 / 编辑器扩展 / 输入建议 / Markdown 渲染 / obsidian:// 协议 / 部分委托交互)\n`);

  for (const [label, key] of [
    ["统计较好", "good"],
    ["部分可统计", "partial"],
    ["基本统计不到", "poor"],
    ["待确认", "unknown"],
  ]) {
    const items = groups[key];
    console.log(`## ${label} (${items.length})\n`);
    for (const item of items) {
      console.log(`- **${item.name}** (\`${item.pluginId}\`)`);
      console.log(`  - ${item.reason}`);
      if (item.blindSpots.length > 0) {
        console.log(`  - 盲区: ${item.blindSpots.join("、")}`);
      }
      console.log(
        `  - API: cmd=${item.counts.addCommand}, view=${item.counts.registerView}, event=${item.counts.registerEvent}, editorExt=${item.counts.registerEditorExtension}, postProc=${item.counts.registerMarkdownPostProcessor + item.counts.registerMarkdownCodeBlockProcessor}, ribbon=${item.counts.addRibbonIcon}`,
      );
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
