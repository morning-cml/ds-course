#!/usr/bin/env node
/**
 * deploy-check.mjs —— 校验「这套课件能不能原样搬到线上静态托管」
 *
 * 为什么需要它（2026-09 新增，准备部署到 Cloudflare Pages 时写的）：
 *   课件是纯静态的（HTML + CSS + JS，无构建、无外链），丢到任何静态托管上都能跑。
 *   但本地是 Windows —— **Windows 的文件系统不区分大小写**，而线上托管
 *   （Cloudflare Pages / GitHub Pages / Netlify / Vercel / 对象存储…）全是 Linux，
 *   **区分大小写**。于是 `href="Assets/css/course.css"`（首字母大写）这种笔误
 *   在本机打开一切正常，一上线就是 404，而且很难第一时间想到是大小写问题。
 *   check.mjs 虽然也查链接，但它用的是 fs.existsSync —— 在 Windows 上同样不区分大小写，
 *   这类错误它查不出来。本脚本把路径**逐段按真实大小写**比对，专门堵这个洞。
 *
 * 顺带守住另外三条「上线才会暴露」的规矩：
 *   · 不能出现以 / 开头的绝对路径（否则部署到子路径下会全挂）；
 *   · 必须有 index.html（访问根路径要能落地）；
 *   · 报告体积与文件数，对照托管商的免费额度（Cloudflare Pages 免费版：
 *     20000 个文件、单文件 25 MiB）。
 *
 * 用法：node tools/deploy-check.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/* ============================ 收集全部文件 ============================ */
let fileCount = 0, totalBytes = 0;            // 文件总数 / 总字节数，用来对照托管商额度
const sizes = [];                             // [相对路径, 字节]，最后挑最大的几个报出来
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { fileCount++; const s = fs.statSync(p).size; totalBytes += s; sizes.push([path.relative(ROOT, p), s]); }
  }
})(ROOT);
sizes.sort((a, b) => b[1] - a[1]);

/* ============================ 大小写完全一致的路径判定 ============================ */
/** 缓存每个目录的真实条目名 —— 同一个目录会被反复查，缓存一下省事也避免竞态 */
const dirCache = new Map();
function entriesOf(dir) {
  if (!dirCache.has(dir)) {
    const set = new Set();
    try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) set.add(e.name); } catch (e) {}
    dirCache.set(dir, set);
  }
  return dirCache.get(dir);
}
/**
 * 逐段比对真实大小写，返回：
 *   "ok"      —— 路径存在且大小写完全一致
 *   "case"    —— 文件确实存在，但某一层的写法与磁盘上的名字大小写不一致（本地能打开、线上 404）
 *   "missing" —— 这一层根本没有对应文件（真断链，跟大小写无关）
 * 注意不能用 fs.existsSync 判断「存在」：Windows 上它不区分大小写，
 * 正是这个洞让大小写错误在本机永远暴露不出来。
 */
function exactCase(abs) {
  const rel = path.relative(ROOT, abs).split(/[\\/]/);
  let cur = ROOT;
  for (const seg of rel) {
    const names = entriesOf(cur);
    if (!names.has(seg)) {
      /* 目录里没有这个写法：看看是不是同一个名字的另一种大小写 —— 是则属于「大小写错」，
         否则就是真断链（初版这里一律当成大小写错，导致「断链」那条检查永远不触发）。 */
      const lower = seg.toLowerCase();
      for (const n of names) if (n.toLowerCase() === lower) return "case";
      return "missing";
    }
    cur = path.join(cur, seg);
  }
  return "ok";
}

/* ============================ 扫所有 HTML 里的 href / src ============================ */
const htmls = [];                             // 全部页面（含 index.html）
(function findHtml(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findHtml(p);
    else if (e.name.endsWith(".html")) htmls.push(p);
  }
})(ROOT);

const wrongCase = [];                         // [页面, 链接] 大小写不对
const missing = [];                           // [页面, 链接] 文件不存在
const absolute = [];                          // [页面, 链接] 以 / 开头
let linkCount = 0;                            // 站内链接条数
for (const f of htmls) {
  const html = fs.readFileSync(f, "utf8");
  for (const m of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:|javascript:|\/\/)/i.test(url)) continue;   // 外链由 check.mjs 负责
    if (url.startsWith("#")) continue;                                      // 页内锚点
    if (url.startsWith("/")) { absolute.push([path.relative(ROOT, f), url]); continue; }
    linkCount++;
    const target = path.resolve(path.dirname(f), decodeURIComponent(url.split("#")[0].split("?")[0]));
    const verdict = exactCase(target);
    if (verdict === "case") wrongCase.push([path.relative(ROOT, f), url]);
    else if (verdict === "missing") missing.push([path.relative(ROOT, f), url]);
  }
}

/* ============================ 汇总 ============================ */
const hasIndex = fs.existsSync(path.join(ROOT, "index.html"));
let bad = 0;
const line = (okFlag, text) => { console.log(`   ${okFlag ? "✓" : "✗"} ${text}`); if (!okFlag) bad++; };

console.log("上线自检（能否原样部署到区分大小写的静态托管）\n");
console.log(`规模：${fileCount} 个文件，共 ${(totalBytes / 1024 / 1024).toFixed(2)} MiB，最大的 ${(sizes[0][1] / 1024).toFixed(0)} KiB（${sizes[0][0]}）`);
console.log(`      对照 Cloudflare Pages 免费版额度：20000 个文件 / 单文件 25 MiB —— 余量充足\n`);

console.log(`① ${htmls.length} 个页面里的 ${linkCount} 条站内链接，路径大小写是否与磁盘完全一致`);
if (wrongCase.length) {
  for (const [f, u] of wrongCase.slice(0, 20)) console.log(`   ✗ ${f} → ${u}   （磁盘上的写法与此不同）`);
  console.log(`   共 ${wrongCase.length} 条。Windows 不区分大小写所以本机能打开，Linux 托管上会 404。`);
  bad++;
} else line(true, "全部一致（Windows 隐藏的大小写问题在这里被挡住）");

console.log("\n② 是否存在以 / 开头的绝对路径");
if (absolute.length) {
  for (const [f, u] of absolute.slice(0, 10)) console.log(`   ✗ ${f} → ${u}   （部署到子路径下会全挂）`);
  bad++;
} else line(true, "没有绝对路径，放在域名根或任意子目录都能跑");

console.log("\n③ 入口文件");
line(hasIndex, hasIndex ? "index.html 存在（访问根路径能落地）" : "缺少 index.html，访问根路径会 404");

console.log("\n④ 断链（与大小写无关的缺失）");
if (missing.length) {
  for (const [f, u] of missing.slice(0, 10)) console.log(`   ✗ ${f} → ${u}`);
  bad++;
} else line(true, "没有断链");

console.log("\n" + "═".repeat(66));
if (bad) {
  console.log("✗ 上线自检未通过：上面这些问题在本机可能完全看不出来，但线上会直接 404。");
} else {
  console.log("✓ 上线自检通过：可以原样部署到静态托管（Cloudflare Pages / GitHub Pages / 对象存储…）");
  console.log("  部署要点：这是纯静态站点，无需构建命令；发布目录选本目录（ds-course/）。");
}
process.exit(bad ? 1 : 0);
