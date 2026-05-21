#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = ["main.js", "manifest.json", "styles.css"];

const destinations = [
  join(
    homedir(),
    "Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/plugins-activity",
  ),
  join(
    homedir(),
    "Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/.obsidian/plugins/plugins-activity",
  ),
];

for (const file of artifacts) {
  const source = join(root, file);
  if (!existsSync(source)) {
    console.error(`缺少构建产物：${source}，请先运行 npm run build`);
    process.exit(1);
  }
}

for (const dest of destinations) {
  mkdirSync(dest, { recursive: true });
  for (const file of artifacts) {
    cpSync(join(root, file), join(dest, file));
  }
  console.log(`已同步 → ${dest}`);
}
