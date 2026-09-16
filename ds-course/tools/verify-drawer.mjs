#!/usr/bin/env node
/** verify-drawer.mjs —— 确认右侧导航抽屉的新增功能都已落到代码里 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const js = fs.readFileSync(path.join(ROOT, "assets/js/course.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "assets/css/course.css"), "utf8");

const checks = [
  ["右侧边缘把手 .toc-tab 已创建", /className = "toc-tab"/.test(js)],
  ["把手可点击打开抽屉", /tab\.addEventListener\("click"/.test(js)],
  ["把手支持键盘 Enter/空格", /tab\.addEventListener\("keydown"/.test(js)],
  ["✕ 收起按钮已创建", /class="toc-close"/.test(js)],
  ["✕ 点击可收起抽屉", /closeBtn\.addEventListener\("click"/.test(js)],
  ["「钉住」按钮使用中文文案", /pinned \? "已钉住" : "钉住"/.test(js)],
  ["Esc 可收起抽屉", /e\.key === "Escape"/.test(js)],
  ["感应范围扩大到 48px", /SENSE_EDGE = 48/.test(js)],
  ["顶栏 ☰ 打开感应时会先抽出一次", /sense = true; applySense\(\);[\s\S]{0,80}open\(\)/.test(js)],
  ["把手样式 .toc-tab 已定义", /\.toc-tab \{/.test(css)],
  ["把手文字内容已定义", /content: "本页导航"/.test(css)],
  ["✕ 按钮样式 .toc-close 已定义", /\.toc-close \{/.test(css)],
  ["抽屉开合动画仍由 toc-hover / toc-open 驱动", /body\.toc-hover \.toc-drawer/.test(css) && /body\.toc-open\s+\.toc-drawer/.test(css)],
];

let ok = 0;
for (const [name, pass] of checks) { console.log((pass ? "✓ " : "✗ ") + name); if (pass) ok++; }
console.log(`\n通过 ${ok}/${checks.length}`);
process.exit(ok === checks.length ? 0 : 1);
