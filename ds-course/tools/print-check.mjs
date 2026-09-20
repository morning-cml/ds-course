#!/usr/bin/env node
/**
 * print-check.mjs —— 校验「代码不管在屏幕还是纸上都看得清」
 *
 * 为什么需要它（2026-09 新增）：
 *   历史上这里连着栽过两次，症状都是「代码看不清」，原因却完全不同：
 *
 *   事故一（打印）：浏览器打印时**默认不画背景色**（Chrome/Edge/Firefox 的打印对话框里
 *     「背景图形」默认关闭）。当时代码块是「深底 + 浅色记号」，底色一丢，剩下的就是
 *     印在白纸上的浅色字，正文对比度只有 1.3:1 左右 —— 15 讲的代码全部糊成一片。
 *     首页大标题（渐变底白字）和卡片编号（蓝底白字）更是整块消失。
 *
 *   事故二（屏幕）：course.js 生成的代码块是 <pre><code>…</code></pre>，而 course.css 里
 *     给**行内代码**写了一条 `code { background: var(--bg-soft); … }`，它同样命中了这个
 *     <code>。行内元素按行盒绘制背景，于是每一行代码背后都多出一个浅色小方块，
 *     而记号色是按代码块底色挑的 —— 落在浅框上就又糊了。修法是加 `.code-block pre code` 重置。
 *
 * 现在代码块的颜色全部走设计令牌（--code-bg / --code-text / --tk-*），
 * 浅色主题一套、深色主题一套、打印再一套。本脚本守的就是这三套：
 *
 *   ① 每个 --tk-* 记号色令牌，@media print 里必须重新定义
 *      —— 否则深色主题打印时会直接沿用「为深底挑的浅色」。
 *   ② @media print 里所有当文字用的颜色，对纯白纸的对比度 ≥4.5:1（WCAG AA 正文标准）。
 *   ③ 浅色/深色两套主题里，记号色对**本主题的代码块底色**也要 ≥4.5:1。
 *   ④ 靠背景反白的界面零件（顶栏、抽屉、打印按钮…）必须在打印时隐藏。
 *
 * 用法：node tools/print-check.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSS = path.join(ROOT, "assets/css/course.css");

/* ============================ 工具 ============================ */
/** 按花括号配对取出 `sel` 对应的规则体（CSS 里没有字符串内的花括号，够用） */
function ruleBody(text, sel, from = 0) {
  const at = text.indexOf(sel, from);
  if (at < 0) return null;
  const open = text.indexOf("{", at);
  let depth = 0;                              // 括号深度；回到 0 就是块尾
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return { start: at, end: i + 1, body: text.slice(open + 1, i) };
  }
  return null;
}
/** 把 #rgb / #rrggbb 统一成 [r,g,b]；不是颜色就返回 null */
function rgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
/** WCAG 相对亮度 */
function lum([r, g, b]) {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** 两色对比度（1~21） */
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const WHITE = [255, 255, 255];
const AA = 4.5;                               // WCAG AA 正文标准
/** 从规则体里抓出所有 `--xxx: #rrggbb`，返回 Map(令牌名 → #rrggbb) */
function tokensOf(body) {
  const out = new Map();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) out.set(m[1], m[2]);
  return out;
}
const ratio = (a, b) => contrast(rgb(a), rgb(b)).toFixed(2) + ":1";
const ok = (r) => parseFloat(r) >= AA;

/* ============================ 取出三段 CSS ============================ */
/* 先去掉注释再解析：注释里会写到选择器名字（比如 `:root`、`html[data-theme="dark"]`），
   indexOf 会先撞上注释里的那一次，于是取错规则块 —— 这个坑在写第一版时就踩过一次。 */
const raw = fs.readFileSync(CSS, "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
const printRule = ruleBody(css, "@media print");
if (!printRule) { console.log("✗ assets/css/course.css 里找不到 @media print 块"); process.exit(1); }
const inside = printRule.body;                                     // 打印块
const outside = css.slice(0, printRule.start) + css.slice(printRule.end);   // 屏幕样式

const lightBody = ruleBody(outside, ":root");
const darkBody = ruleBody(outside, 'html[data-theme="dark"]');
const printTokens = tokensOf(inside);
const light = tokensOf(lightBody.body);
const dark = tokensOf(darkBody.body);

let bad = 0;                                  // 失败条数；>0 时以 1 退出
const line = (okFlag, text) => console.log(`   ${okFlag ? "✓" : "✗"} ${text}`);

/* ============================ ① 记号色令牌要有打印版 ============================ */
const tkNames = [...light.keys()].filter((k) => k.startsWith("--tk-")).sort();
console.log("代码配色检查（course.css）\n");
console.log("① 每个记号色令牌 --tk-* 在 @media print 里都有重新定义");
if (!tkNames.length) { console.log("   ✗ 通道 :root 里找不到 --tk-* 令牌，CSS 结构变了？"); bad++; }
for (const t of tkNames) {
  if (!printTokens.has(t)) { line(false, `${t.padEnd(10)} 打印块里没有重定义（深色主题打印会沿用深底配色）`); bad++; }
  else line(true, `${t.padEnd(10)} 浅色 ${light.get(t)} / 深色 ${dark.get(t)} → 打印 ${printTokens.get(t)}  ${ratio(printTokens.get(t), "#ffffff")}`);
}

/* ============================ ② 打印块里的文字色都要够深 ============================ */
/* 只取「当文字用」的颜色：color: #xxx 声明 + 颜色类令牌。
   命名约定：以 -bg / -line / -soft 结尾的，以及 --panel* / --bg* / --border* / --shadow*，
   都是**背景与描边**，不需要跟白纸拉开对比度；其余（含 --text-soft）都当文字查。 */
const SURFACE = /(^--panel|^--bg|^--border|^--shadow|^--code-scroll|(-bg|-line|-soft)$)/;
const used = [];                              // [出处, 颜色]
for (const m of inside.matchAll(/(?:^|[;{\s])color\s*:\s*(#[0-9a-fA-F]{3,6})/g)) used.push(["color: " + m[1], m[1]]);
for (const [name, val] of printTokens) {
  /* --text-soft 虽然是 -soft 结尾，但它是**文字**色（图注、次要说明），必须一起查 */
  if (name.startsWith("--text") || !SURFACE.test(name)) used.push([name, val]);
}
console.log("\n② 打印块里当文字用的颜色是否都 ≥4.5:1（对纯白纸）");
if (!used.length) { console.log("   ✗ 打印块里没有任何文字色，CSS 结构变了？"); bad++; }
let lightest = 99;                            // 记录最浅的一档，方便一眼看出余量
const seen = new Set();                       // 同一个「出处 + 颜色」只报一次
for (const [label, color] of used) {
  if (seen.has(label + color)) continue;
  seen.add(label + color);
  const r = ratio(color, "#ffffff");
  lightest = Math.min(lightest, parseFloat(r));
  if (ok(r)) line(true, `${label.padEnd(18)} ${color}  ${r}`);
  else { line(false, `${label.padEnd(18)} ${color}  ${r}  ← 太浅，印在白纸上会看不清`); bad++; }
}
if (used.length) console.log(`   （最浅的一档 ${lightest.toFixed(2)}:1，门槛 ${AA}:1）`);

/* ============================ ③ 两套屏幕主题各自的记号色 ============================ */
/* 对照关系：正文/记号色 比 代码块底色；顶部条与按钮上的字比它们自己的底色。 */
const PAIRS = [
  ["--code-text", "--code-bg", "正文"],
  ["--code-lang", "--code-head-bg", "顶部条语言名"],
  ["--code-file", "--code-head-bg", "顶部条文件名"],
  ["--code-btn-fg", "--code-btn-bg", "复制按钮文字"],
];
console.log("\n③ 两套屏幕主题下，文字对本主题底色的对比度是否都 ≥4.5:1");
for (const [themeName, t] of [["浅色主题", light], ["深色主题", dark]]) {
  const bg = t.get("--code-bg");
  console.log(`   【${themeName}】代码块底色 ${bg}`);
  for (const tk of tkNames) {
    const r = ratio(t.get(tk), bg);
    line(ok(r), `${tk.padEnd(10)} ${t.get(tk)}  ${r}`);
    if (!ok(r)) bad++;
  }
  for (const [fg, bgKey, what] of PAIRS) {
    const r = ratio(t.get(fg), t.get(bgKey));
    line(ok(r), `${what.padEnd(10)} ${t.get(fg)} 对 ${t.get(bgKey)}  ${r}`);
    if (!ok(r)) bad++;
  }
}

/* ============================ ④ 靠背景反白的界面零件必须隐藏 ============================ */
/* 这些零件在屏幕上是「实色底 + 白字」（或固定在屏幕边缘），打印时不画背景就会变成白纸上的白字。
   新增这类零件时，把类名加到这张表里、并在 @media print 里隐藏它。 */
const MUST_HIDE = [
  ["topbar", "顶栏：logo 是渐变底白字"],
  ["sidebar", "左侧目录：固定定位，会印在纸上"],
  ["pager", "上一讲/下一讲：屏幕导航，纸上无意义"],
  ["viz-controls", "动画播放控件：纸上用不了"],
  ["copy-btn", "复制按钮：实色底白字"],
  ["toc-drawer", "右侧抽屉：固定定位"],
  ["toc-tab", "右侧把手：实色底白字 + 固定定位"],
  ["toc-hint", "抽屉提示气泡：固定定位"],
];
/** 打印块里被 display:none 掉的类名集合 */
const hidden = new Set();
for (const m of inside.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  if (!/display\s*:\s*none/.test(m[2])) continue;
  for (const c of m[1].matchAll(/\.([a-z][a-z0-9-]*)/g)) hidden.add(c[1]);
}
console.log("\n④ 靠背景反白的界面零件是否都在打印时隐藏");
for (const [cls, why] of MUST_HIDE) {
  if (hidden.has(cls)) line(true, `.${cls.padEnd(13)} 已隐藏  （${why}）`);
  else { line(false, `.${cls.padEnd(13)} 没隐藏  （${why}）`); bad++; }
}

/* ============================ 汇总 ============================ */
console.log("\n" + "═".repeat(66));
if (bad) {
  console.log(`✗ 代码配色有 ${bad} 处问题：颜色令牌是分「浅色 / 深色 / 打印」三套的，`);
  console.log("  漏掉任何一套都会出现「浅色字配浅底色」。修法见 assets/css/course.css 第 1 节与第 13 节。");
} else {
  console.log(`✓ 代码配色通过：${tkNames.length} 个记号色令牌三套（浅色/深色/打印）齐全且都 ≥${AA}:1，打印块最浅 ${lightest.toFixed(2)}:1，界面零件已隐藏`);
}
process.exit(bad ? 1 : 0);
