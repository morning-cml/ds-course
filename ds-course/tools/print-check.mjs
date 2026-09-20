#!/usr/bin/env node
/**
 * print-check.mjs —— 校验「打印出来的讲义还看得清」
 *
 * 为什么需要它（2026-09 新增）：
 *   浏览器打印时**默认不画背景色**（Chrome/Edge/Firefox 的打印对话框里「背景图形」默认关闭），
 *   而本站的代码块恰恰是靠「深底 + 浅色字」反白显示的。底色一丢，剩下的就是
 *   「浅色字印在白纸上」——正文对比度只有 1.3:1，整段代码等于糊成一片。
 *   这不是理论问题：老师按下页面右上角的 ⎙「打印 / 导出 PDF」就会看到。
 *
 *   历史事故：course.css 的 @media print 只把页面布局调了一下，颜色一个没动，
 *   于是 15 讲所有代码块打印出来都看不清；首页大标题（渐变底白字）和
 *   卡片编号（蓝底白字）更是整块消失。
 *
 * 做法（三条，全部只看 assets/css/course.css，不依赖浏览器）：
 *   1. 屏幕上定义过的每个 .tk-* 记号色，@media print 里必须重新定义
 *      —— 否则新加一个记号类就会悄悄沿用「为深底挑的浅色」。
 *   2. @media print 里所有**当文字用**的颜色（color: 与颜色类令牌）都要满足
 *      WCAG AA 正文标准：与纯白纸的对比度 ≥ 4.5:1。
 *   3. 必须先隐藏掉那些「靠背景反白的界面零件」（工具栏、抽屉、打印按钮等），
 *      否则它们会以「白字白底」的形式印在纸上。清单写在下面 MUST_HIDE 里。
 *
 * 用法：node tools/print-check.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSS = path.join(ROOT, "assets/css/course.css");

/* ============================ 1. 取出 @media print 块 ============================ */
/** 从 `@media print {` 起按花括号配对找到整块内容（CSS 里没有字符串内的花括号，够用） */
function printBlock(css) {
  const at = css.indexOf("@media print");
  if (at < 0) return null;
  const open = css.indexOf("{", at);
  let depth = 0;                              // 括号深度；回到 0 就是块尾
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return { start: at, end: i + 1, body: css.slice(open + 1, i) };
  }
  return null;
}

const css = fs.readFileSync(CSS, "utf8");
const blk = printBlock(css);
if (!blk) {
  console.log("✗ assets/css/course.css 里找不到 @media print 块");
  process.exit(1);
}
/* outside —— 打印块之外的全部样式（即屏幕样式）；inside —— 打印块自己 */
const inside = blk.body;
const outside = css.slice(0, blk.start) + css.slice(blk.end);

/* ============================ 2. 颜色工具 ============================ */
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

/* ============================ 3. 检查一：记号色都要有打印版 ============================ */
/** 抓出所有 `.tk-xxx { ... }` 规则，返回 类名 → 颜色 */
function tkRules(text) {
  const out = new Map();
  for (const m of text.matchAll(/\.tk-([a-z0-9-]+)\s*\{([^}]*)\}/g)) {
    const c = m[2].match(/color\s*:\s*(#[0-9a-fA-F]{3,6})/);
    if (c) out.set("tk-" + m[1], c[1]);
  }
  return out;
}
const screenTk = tkRules(outside);            // 屏幕上的记号色（为深底挑的）
const printTk = tkRules(inside);              // 打印时的记号色

console.log("打印配色检查（course.css）\n");
console.log("① 记号色 .tk-* 是否有打印版");
let bad = 0;                                  // 失败条数；>0 时以 1 退出
if (!screenTk.size) { console.log("   ✗ 没有在打印块外找到任何 .tk-* 规则，CSS 结构变了？"); bad++; }
for (const [cls, color] of screenTk) {
  if (printTk.has(cls)) {
    const r = contrast(rgb(printTk.get(cls)), WHITE);
    console.log(`   ✓ ${cls.padEnd(9)} 屏幕 ${color} → 打印 ${printTk.get(cls)}  白纸对比度 ${r.toFixed(2)}:1`);
  } else {
    console.log(`   ✗ ${cls.padEnd(9)} 屏幕 ${color} → 打印块里没有重定义（会继续用这个浅色印在白纸上）`);
    bad++;
  }
}

/* ============================ 4. 检查二：打印块里的文字色都要够深 ============================ */
/* 只取「当文字用」的颜色：
     · color: #xxx 声明
     · 颜色类令牌 --xxx: #xxx —— 但排除那些本来就是浅底/描边的（*-soft / --panel* / --bg* / --border*），
       它们是填充色和边框色，不需要跟白纸拉开对比度。 */
const SURFACE = /(^--panel|^--bg|^--border|^--shadow|^--code-bg)|(-soft$)/;
const used = [];                              // [说明, 颜色, 出处]
for (const m of inside.matchAll(/(?:^|[;{\s])color\s*:\s*(#[0-9a-fA-F]{3,6})/g)) {
  used.push(["color 声明", m[1], "color: " + m[1]]);
}
for (const m of inside.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) {
  /* --text-soft 虽然是 -soft 结尾，但它是**文字**色（图注、次要说明），必须一起查 */
  const isText = m[1].startsWith("--text");
  if (isText || !SURFACE.test(m[1])) used.push(["令牌 " + m[1], m[2], m[1] + ": " + m[2]]);
}

console.log("\n② 打印块里当文字用的颜色是否都 ≥4.5:1（WCAG AA）");
if (!used.length) { console.log("   ✗ 打印块里没有任何文字色，CSS 结构变了？"); bad++; }
const seen = new Set();                       // 同一个颜色只报一次
let lightest = 99;                            // 记录最浅的一档，方便一眼看出余量
for (const [, color, label] of used) {
  if (seen.has(color + label)) continue;
  seen.add(color + label);
  const r = contrast(rgb(color), WHITE);
  lightest = Math.min(lightest, r);
  if (r >= AA) console.log(`   ✓ ${label.padEnd(22)} ${r.toFixed(2)}:1`);
  else { console.log(`   ✗ ${label.padEnd(22)} ${r.toFixed(2)}:1  ← 太浅，印在白纸上会看不清`); bad++; }
}
if (used.length) console.log(`   （最浅的一档 ${lightest.toFixed(2)}:1，门槛 ${AA}:1）`);

/* ============================ 5. 检查三：靠背景反白的界面零件必须隐藏 ============================ */
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
/* 打印块里被 display:none 掉的类名集合 */
const hidden = new Set();
for (const m of inside.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  if (!/display\s*:\s*none/.test(m[2])) continue;
  for (const c of m[1].matchAll(/\.([a-z][a-z0-9-]*)/g)) hidden.add(c[1]);
}

console.log("\n③ 靠背景反白的界面零件是否都在打印时隐藏");
for (const [cls, why] of MUST_HIDE) {
  if (hidden.has(cls)) console.log(`   ✓ .${cls.padEnd(13)} 已隐藏  （${why}）`);
  else { console.log(`   ✗ .${cls.padEnd(13)} 没隐藏  （${why}）`); bad++; }
}

/* ============================ 6. 汇总 ============================ */
console.log("\n" + "═".repeat(66));
if (bad) {
  console.log(`✗ 打印配色有 ${bad} 处问题：打印不等于屏幕，凡是靠背景反白的东西，`);
  console.log("  一旦底色不印出来就会变成「浅色字 + 白纸」。修法见 assets/css/course.css 第 13 节。");
} else {
  console.log(`✓ 打印配色通过：${screenTk.size} 个记号色都有打印版，打印块内文字色最浅 ${lightest.toFixed(2)}:1，界面零件已隐藏`);
}
process.exit(bad ? 1 : 0);
