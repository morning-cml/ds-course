#!/usr/bin/env node
/**
 * nav-check.mjs —— 校验章节链条是否首尾相连
 * 检查每一页的「上一讲 / 下一讲」是否与 course.js 里的注册顺序一致。
 * 用法：node tools/nav-check.mjs
 *
 * 退出码：0 = 所有页面链路正确；1 = 至少 1 个页面有问题
 *        （页面文件缺失 / 缺上一讲或下一讲 / 死链 / DS_PAGE.id 与注册表不符）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const js = fs.readFileSync(path.join(ROOT, "assets/js/course.js"), "utf8");   // course.js 源码，站点结构以它为准
/* 页面注册顺序：从 course.js 里抽出 {id, file} 两项，数组顺序 = 上一讲/下一讲链条顺序 */
const PAGES = [...js.matchAll(/\{\s*id:\s*"([^"]+)",\s*file:\s*"([^"]+)"/g)]
  .map(m => ({ id: m[1], file: m[2] }));

let bad = 0;   // 有问题的页面数（只要某页 problems 非空就加一），决定退出码
console.log("注册顺序：" + PAGES.map(p => p.file).join(" → ") + "\n");

PAGES.forEach((p, i) => {
  const fp = path.join(ROOT, p.file);
  if (!fs.existsSync(fp)) { console.log(`✗ ${p.file} 不存在`); bad++; return; }
  const html = fs.readFileSync(fp, "utf8");

  // 收集 .pager 里的链接
  const pager = (html.match(/<div class="pager">[\s\S]*?<\/div>/) || [""])[0];   // 页脚翻页栏原文（找不到时为空串）
  const links = [...pager.matchAll(/href="([^"#]+\.html)"/g)].map(m => m[1]);    // 翻页栏里指向的页面文件
  const expectPrev = i > 0 ? PAGES[i - 1].file : null;                           // 按注册顺序应有的「上一讲」，首页为 null
  const expectNext = i < PAGES.length - 1 ? PAGES[i + 1].file : null;            // 应有的「下一讲」，末页为 null
  const problems = [];                                                           // 本页发现的问题，非空即计入 bad
  if (expectPrev && !links.includes(expectPrev)) problems.push(`缺「上一讲 → ${expectPrev}」`);
  if (expectNext && !links.includes(expectNext)) problems.push(`缺「下一讲 → ${expectNext}」`);
  if (!expectPrev && links.includes(PAGES[0].file)) problems.push("首页不应有上一讲");

  // 检查所有本地链接是否有效
  const all = [...new Set([...html.matchAll(/href="([^"#][^"]*\.html)"/g)].map(m => m[1]))];   // 本页全部站内 .html 链接（去重）
  const broken = all.filter(l => !fs.existsSync(path.join(ROOT, l)));                         // 其中指向不存在文件的死链
  if (broken.length) problems.push("死链 " + broken.join(", "));

  // 检查 DS_PAGE.id 与注册一致
  const id = (html.match(/DS_PAGE\s*=\s*\{\s*id:\s*'([^']+)'/) || [])[1];   // 页面里 window.DS_PAGE.id 的实际取值
  if (id !== p.id) problems.push(`DS_PAGE.id = '${id}'，应为 '${p.id}'`);

  if (problems.length) { bad++; console.log(`✗ ${p.file.padEnd(24)} ${problems.join("；")}`); }
  else console.log(`✓ ${p.file.padEnd(24)} 链条正常，${all.length} 个站内链接全部有效`);
});

console.log("\n" + (bad ? `有 ${bad} 个页面的导航链路有问题` : "导航链路全部正确 ✅"));
process.exit(bad ? 1 : 0);
