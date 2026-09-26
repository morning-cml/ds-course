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
 *
 * 退出码：0 = 没有错误（允许有警告）；1 = 至少 1 处错误（校验失败）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || path.join(import.meta.dirname, ".."));

/* 待校验的页面清单：每项是相对 ROOT 的文件名（顺序决定控制台输出顺序）。
   ⚠ 新增 / 改名一讲时必须同步本清单与 assets/js/course.js 里的页面注册表。 */
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
  "ch15-review.html",
  "ch16-plan.html"
];

/* 顺手检查有没有残留的临时文件 */
const strayTmp = fs.readdirSync(ROOT).filter(f => /^\.tmp|\.tmp-|~$|\.bak$/.test(f));   // 命中的临时文件名清单（只提示，不计入错误）
if (strayTmp.length) console.log("提示：目录中存在临时文件，交付前应清理 → " + strayTmp.join(", ") + "\n");

let errors = 0, warns = 0, checks = 0;   // 错误 / 警告 / 通过 三个计数器（errors 决定退出码，checks 只用于末尾汇总）
const err = (m) => { errors++; console.log("  ✗ " + m); };    // 记一条错误：errors 加一
const warn = (m) => { warns++; console.log("  ! " + m); };    // 记一条警告：warns 加一（不影响退出码）
const ok = (m) => { checks++; console.log("  ✓ " + m); };     // 记一条通过：checks 加一

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

  // 外链资源检查：脚本 / 图片（src=）和样式表（<link href=）必须在本地，否则离线打不开。
  // 普通超链接 <a href="https://…"> 不算资源（例如第 14 讲指向洛谷题目页），离线时只是点不开，页面照常显示。
  const ext = html.match(/\bsrc\s*=\s*"(https?:)?\/\/[^"]+"|<link\b[^>]*\bhref\s*=\s*"(https?:)?\/\/[^"]+"/gi);
  if (ext) err("存在外链资源（不允许离线打开）: " + ext.slice(0, 3).join(", "));

  // 3. 标题 id（卡片/引导区里的装饰性标题不参与本页目录，可豁免）
  const headsAll = [...html.matchAll(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)];   // 全部 h2/h3：m[1]=层级，m[2]=属性串，m[3]=内部 HTML
  const EXEMPT = /class\s*=\s*"[^"]*(chapter-card|hero|card|no-toc|figure)/;     // 豁免名单：带这些 class 的标题不算正式小节（要放宽就改这里）
  const headsRaw = headsAll.filter(m => !EXEMPT.test(m[2]) && !EXEMPT.test(m[3]));   // 去掉装饰性标题后的候选小节
  // 章节卡片是整块 <a>，内部标题不参与本页目录，直接跳过
  const heads = page === "index.html" ? [] : headsRaw;   // index 视为导航页，不做目录/id 检查
  const noId = heads.filter(m => !/\bid\s*=/.test(m[2]));   // 缺 id 的小节（本页目录靠 id 跳转，缺了就是错误）
  if (heads.length === 0) warn("没有任何 h2/h3 标题");
  else if (noId.length) err(`${noId.length}/${heads.length} 个 h2/h3 缺少 id`);
  else ok(`${heads.length} 个 h2/h3 均带 id`);

  // 重复 id（只扫描元素起始标签，避免误匹配标题正文里的文字）
  const tags = [...html.matchAll(/<[a-zA-Z][^>]*>/g)].map(m => m[0]);   // 页面里所有元素的起始标签原文
  const ids = tags.map(t => (t.match(/\sid\s*=\s*"([^"]+)"/) || [])[1]).filter(Boolean);   // 从起始标签里抠出的 id 值
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);   // 第二次及以后出现的 id（即重复 id）
  if (dup.length) err("重复 id: " + [...new Set(dup)].join(", "));

  // 4. viz 容器对应关系
  const containers = [...html.matchAll(/id\s*=\s*"(viz-[A-Za-z0-9_-]+)"/g)].map(m => m[1]);   // 页面声明的动画容器 id
  const jsFiles = [...html.matchAll(/src\s*=\s*"(assets\/js\/[^"]+\.js)"/g)]
    .map(m => m[1]).filter(f => !/course\.js$/.test(f));   // 本页引用的章节脚本（排除公共 course.js）
  let jsText = "";   // 上述脚本的源码拼接，用于反查脚本引用了哪些 viz 容器
  for (const f of jsFiles) {
    const jp = path.join(ROOT, f);
    if (!exists(jp)) { err("引用的脚本不存在: " + f); continue; }
    jsText += read(jp) + "\n";
  }
  const wired = [...jsText.matchAll(/getElementById\(\s*['"](viz-[A-Za-z0-9_-]+)['"]\s*\)/g)].map(m => m[1]);   // 脚本真正去取的容器 id
  const missingImpl = containers.filter(c => !wired.includes(c));   // 页面有容器、但脚本没实现（动画是空的）
  const missingHost = wired.filter(c => !containers.includes(c));   // 脚本实现了、但页面没有容器（脚本会拿到 null）
  if (missingImpl.length) err("页面有容器但脚本未实现: " + missingImpl.join(", "));
  if (missingHost.length) err("脚本有实现但页面无容器: " + missingHost.join(", "));
  if (containers.length && !missingImpl.length && !missingHost.length) {
    ok(`${containers.length} 个交互动画容器全部对应`);
  }
  if (!containers.length && /ch0[1-9]|ch1[0-2]/.test(page)) warn("该章没有交互动画容器");

  // 5. 代码块转义检查：块内所有 < 都必须写成 &lt;
  //    ⚠ 老写法是「块里只要出现过 &lt; 或 &gt; 就整块跳过」，有漏洞：
  //      一个块内既有正确转义、又漏了某个裸 < 时会被整块放行。
  //      2026-09 用逐字符判定重写后，查出 4 处漏网的裸 <（ch12 / ch14）。
  const pres = [...html.matchAll(/<pre[^>]*data-lang[^>]*>([\s\S]*?)<\/pre>/gi)];   // 本页所有带 data-lang 的代码块
  const badPre = [];   // 记录了「含未转义裸 <」的代码块（形如 "文件名 第 N 行"）
  for (const p of pres) {
    const body = p[1];
    const scan = /&lt;|<|&gt;/g;   // 逐字符扫描：遇到裸 < 立即判失败，&lt; / &gt; 视为已转义
    let m2, badAt = -1;            // m2 = 当前匹配，badAt = 第一个裸 < 的下标（-1 表示本块合格）
    while ((m2 = scan.exec(body)) !== null) {
      if (m2[0] === "<") { badAt = m2.index; break; }
    }
    if (badAt >= 0) {
      const file = (p[0].match(/data-file="([^"]+)"/) || [])[1] || "(未命名)";
      const line = body.slice(0, badAt).split("\n").length;
      badPre.push(`${file} 第 ${line} 行`);
    }
  }
  if (badPre.length) err(`${badPre.length} 个代码块存在未转义的 < （应写成 &lt;）：` + badPre.slice(0, 4).join("；"));
  else ok(`${pres.length} 个代码块转义正常`);

  // 6. 语法检查
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);   // 内联脚本（无 src）的代码体
  inlineScripts.forEach((s, i) => { if (s.trim()) checkJsSyntax(s, `${page} 内联脚本#${i + 1}`); });
  for (const f of jsFiles) {
    const jp = path.join(ROOT, f);
    if (exists(jp)) checkJsSyntax(read(jp), f);
  }

  // 7. pager 链接
  const links = [...html.matchAll(/href\s*=\s*"([^"#][^"]*\.html)"/g)].map(m => m[1]);   // 本页所有站内 .html 链接
  const broken = [...new Set(links)].filter(l => !exists(path.join(ROOT, l)));          // 去重后指向不存在文件的死链
  if (broken.length) err("死链: " + broken.join(", "));

  // 8. 内容体量
  /* textLen：正文体量（去掉 script/style/标签/空白后的字符数，含代码块文字）
     codeBlocks：C++ 代码块个数 */
  const textLen = html.replace(/<script[\s\S]*?<\/script>/g, "")
                      .replace(/<style[\s\S]*?<\/style>/g, "")
                      .replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
  const codeBlocks = (html.match(/data-lang="cpp"/g) || []).length;
  console.log(`     正文字数≈${textLen}　C++代码块=${codeBlocks}　标题=${heads.length}　动画=${containers.length}`);
  // 两个经验下限（只警告不判失败）：正文 6000 字、C++ 6 段，低于它就说明这一讲内容偏薄
  if (page !== "index.html" && textLen < 6000) warn("正文偏少（<6000 字）");
  if (page !== "index.html" && codeBlocks < 6) warn("C++ 代码块偏少（<6）");
}

console.log("\n════════════════════════════════");
console.log(`通过检查 ${checks} 项　警告 ${warns} 项　错误 ${errors} 项`);
process.exit(errors ? 1 : 0);
