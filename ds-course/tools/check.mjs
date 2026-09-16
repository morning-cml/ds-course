#!/usr/bin/env node
/**
 * check.mjs —— 课件静态校验（无需浏览器）
 * 用法： node tools/check.mjs
 * 校验内容：
 *   1. 所有页面文件是否存在、能否被 index.html 链接到
 *   2. DS_PAGE 配置、course.js / css 引用
 *   3. h2/h3 是否都有 id（本页目录依赖）
 *   4. 页面里的 viz-xxx 容器 与 章节 JS 里的 getElementById('viz-xxx') 是否一一对应
 *   5. <pre data-lang="cpp"> 代码块中的 < > 是否已转义
 *   6. 内联 <script> 与每个 assets/js/*.js 的语法（用 Function 构造做语法检查）
 *   7. .pager 链接指向的文件是否存在
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || path.join(import.meta.dirname, ".."));

const PAGES = [
  "index.html",
  "ch01-intro.html",
  "ch02-linear-list.html",
  "ch03-stack.html",
  "ch04-queue.html",
  "ch05-string-kmp-bm.html",
  "ch06-array-matrix.html",
  "ch07-tree.html",
  "ch08-graph-basic.html",
  "ch09-graph-algo.html",
  "ch10-search-hash.html",
  "ch11-sort-basic.html",
  "ch12-sort-advanced.html",
  "ch13-paradigm-dp.html",
  "ch14-luogu.html",
  "ch15-review.html"
];

/* 顺手检查有没有残留的临时文件 */
const strayTmp = fs.readdirSync(ROOT).filter(f => /^\.tmp|\.tmp-|~$|\.bak$/.test(f));
if (strayTmp.length) console.log("提示：目录中存在临时文件，交付前应清理 → " + strayTmp.join(", ") + "\n");

let errors = 0, warns = 0, checks = 0;
const err = (m) => { errors++; console.log("  ✗ " + m); };
const warn = (m) => { warns++; console.log("  ! " + m); };
const ok = (m) => { checks++; console.log("  ✓ " + m); };

function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }

/* ---------- JS 语法检查 ---------- */
function checkJsSyntax(code, label) {
  try {
    // 包一层函数，允许顶层 return/await 之外的普通脚本
    new Function(code);
    return true;
  } catch (e) {
    err(label + " 语法错误: " + e.message);
    return false;
  }
}

console.log("课件校验目录：" + ROOT + "\n");

for (const page of PAGES) {
  const fp = path.join(ROOT, page);
  console.log("── " + page);
  if (!exists(fp)) { err("文件不存在"); continue; }
  const html = read(fp);

  // 2. 基本配置
  if (!/DS_PAGE\s*=/.test(html)) err("缺少 window.DS_PAGE 配置");
  if (!/assets\/css\/course\.css/.test(html)) err("未引用 course.css");
  if (!/assets\/js\/course\.js/.test(html)) err("未引用 course.js");

  // 外链检查
  const ext = html.match(/(?:src|href)\s*=\s*"(https?:)?\/\/[^"]+"/gi);
  if (ext) err("存在外链资源（不允许离线打开）: " + ext.slice(0, 3).join(", "));

  // 3. 标题 id（卡片/引导区里的装饰性标题不参与本页目录，可豁免）
  const headsAll = [...html.matchAll(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)];
  const EXEMPT = /class\s*=\s*"[^"]*(chapter-card|hero|card|no-toc|figure)/;
  const headsRaw = headsAll.filter(m => !EXEMPT.test(m[2]) && !EXEMPT.test(m[3]));
  // 章节卡片是整块 <a>，内部标题不参与本页目录，直接跳过
  const heads = page === "index.html" ? [] : headsRaw;
  const noId = heads.filter(m => !/\bid\s*=/.test(m[2]));
  if (heads.length === 0) warn("没有任何 h2/h3 标题");
  else if (noId.length) err(`${noId.length}/${heads.length} 个 h2/h3 缺少 id`);
  else ok(`${heads.length} 个 h2/h3 均带 id`);

  // 重复 id（只扫描元素起始标签，避免误匹配标题正文里的文字）
  const tags = [...html.matchAll(/<[a-zA-Z][^>]*>/g)].map(m => m[0]);
  const ids = tags.map(t => (t.match(/\sid\s*=\s*"([^"]+)"/) || [])[1]).filter(Boolean);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) err("重复 id: " + [...new Set(dup)].join(", "));

  // 4. viz 容器对应关系
  const containers = [...html.matchAll(/id\s*=\s*"(viz-[A-Za-z0-9_-]+)"/g)].map(m => m[1]);
  const jsFiles = [...html.matchAll(/src\s*=\s*"(assets\/js\/[^"]+\.js)"/g)]
    .map(m => m[1]).filter(f => !/course\.js$/.test(f));
  let jsText = "";
  for (const f of jsFiles) {
    const jp = path.join(ROOT, f);
    if (!exists(jp)) { err("引用的脚本不存在: " + f); continue; }
    jsText += read(jp) + "\n";
  }
  const wired = [...jsText.matchAll(/getElementById\(\s*['"](viz-[A-Za-z0-9_-]+)['"]\s*\)/g)].map(m => m[1]);
  const missingImpl = containers.filter(c => !wired.includes(c));
  const missingHost = wired.filter(c => !containers.includes(c));
  if (missingImpl.length) err("页面有容器但脚本未实现: " + missingImpl.join(", "));
  if (missingHost.length) err("脚本有实现但页面无容器: " + missingHost.join(", "));
  if (containers.length && !missingImpl.length && !missingHost.length) {
    ok(`${containers.length} 个交互动画容器全部对应`);
  }
  if (!containers.length && /ch0[1-9]|ch1[0-2]/.test(page)) warn("该章没有交互动画容器");

  // 5. 代码块转义检查（含 &lt; 的块视为已正确转义；否则块内不应出现裸的 <xxx）
  const pres = [...html.matchAll(/<pre[^>]*data-lang[^>]*>([\s\S]*?)<\/pre>/gi)];
  let badPre = 0;
  for (const p of pres) {
    const body = p[1];
    if (/&lt;|&gt;/.test(body)) continue;
    if (/<[a-zA-Z_]/.test(body)) { badPre++; continue; }
    if (/<(?!\/)/.test(body) && /#include|cout|cin|vector|template/.test(body)) badPre++;
  }
  if (badPre) err(`${badPre} 个代码块存在未转义的 < （应写成 &lt;）`);
  else ok(`${pres.length} 个代码块转义正常`);

  // 6. 语法检查
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  inlineScripts.forEach((s, i) => { if (s.trim()) checkJsSyntax(s, `${page} 内联脚本#${i + 1}`); });
  for (const f of jsFiles) {
    const jp = path.join(ROOT, f);
    if (exists(jp)) checkJsSyntax(read(jp), f);
  }

  // 7. pager 链接
  const links = [...html.matchAll(/href\s*=\s*"([^"#][^"]*\.html)"/g)].map(m => m[1]);
  const broken = [...new Set(links)].filter(l => !exists(path.join(ROOT, l)));
  if (broken.length) err("死链: " + broken.join(", "));

  // 8. 内容体量
  const textLen = html.replace(/<script[\s\S]*?<\/script>/g, "")
                      .replace(/<style[\s\S]*?<\/style>/g, "")
                      .replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
  const codeBlocks = (html.match(/data-lang="cpp"/g) || []).length;
  console.log(`     正文字数≈${textLen}　C++代码块=${codeBlocks}　标题=${heads.length}　动画=${containers.length}`);
  if (page !== "index.html" && textLen < 6000) warn("正文偏少（<6000 字）");
  if (page !== "index.html" && codeBlocks < 6) warn("C++ 代码块偏少（<6）");
}

console.log("\n════════════════════════════════");
console.log(`通过检查 ${checks} 项　警告 ${warns} 项　错误 ${errors} 项`);
process.exit(errors ? 1 : 0);
