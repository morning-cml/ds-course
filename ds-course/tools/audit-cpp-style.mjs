#!/usr/bin/env node
/**
 * audit-cpp-style.mjs —— 统计课件里 C++ 代码块的"写法风格"
 *
 * 分类：
 *   class    —— 用了 class / 模板类 / 封装（竞赛里通常不这么写）
 *   template —— 用了 template（泛型容器）
 *   struct   —— 只用了 struct 存数据（竞赛常见，通常可以保留）
 *   plain    —— 纯函数 + 全局数组，已是竞赛风格
 *
 * 用法：node tools/audit-cpp-style.mjs [章节文件...]
 *
 * 退出码：恒为 0 —— 纯普查脚本，只打印风格分布与改写清单，不作判定
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);   // 命令行指定的章节文件；为空则扫描全部 chNN*.html
const pages = args.length ? args : fs.readdirSync(ROOT).filter(f => /^ch\d\d.*\.html$/.test(f)).sort();

const unescapeHtml = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&");

/* 四类写法的全局计数（键就是分类名，下面 totals[kind]++ 直接累加） */
const totals = { class: 0, template: 0, struct: 0, plain: 0 };
const perPage = [];   // 每页明细 {page, counts(四类计数), rows([{file, kind}])}

for (const page of pages) {
  const fp = path.join(ROOT, page);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, "utf8");
  const blocks = [...html.matchAll(/<pre[^>]*data-lang="cpp"[^>]*>([\s\S]*?)<\/pre>/gi)];
  if (!blocks.length) continue;

  const rows = [];   // 本页每个代码块的 {file, kind}
  for (const m of blocks) {
    const code = unescapeHtml(m[1]);   // 还原实体后的真实 C++ 代码
    const file = (m[0].match(/data-file="([^"]+)"/) || [])[1] || "?";   // 该块的 data-file 名（没有就记 "?"）
    const hasClass = /\bclass\s+\w+/.test(code);        // 用了 class（竞赛里通常不这么写）
    const hasTemplate = /\btemplate\s*</.test(code);    // 用了 template（泛型容器）
    const hasStruct = /\bstruct\s+\w+/.test(code);      // 用了 struct（存数据，通常可保留）
    let kind = "plain";                                // 默认归类：纯函数 + 全局数组，已是竞赛风格
    if (hasClass) kind = "class";                      // 判定优先级：class > template > struct > plain
    else if (hasTemplate) kind = "template";
    else if (hasStruct) kind = "struct";
    totals[kind]++;   // 对应分类计数加一
    rows.push({ file, kind });
  }
  perPage.push({
    page,
    counts: {
      class: rows.filter(r => r.kind === "class").length,
      template: rows.filter(r => r.kind === "template").length,
      struct: rows.filter(r => r.kind === "struct").length,
      plain: rows.filter(r => r.kind === "plain").length
    },
    rows
  });
}

console.log("章节".padEnd(26) + "class  template  struct  plain   合计");
for (const p of perPage) {
  const c = p.counts;
  const sum = c.class + c.template + c.struct + c.plain;
  console.log(p.page.padEnd(26) +
    String(c.class).padStart(5) + String(c.template).padStart(10) +
    String(c.struct).padStart(8) + String(c.plain).padStart(7) + String(sum).padStart(7));
}
const total = Object.values(totals).reduce((a, b) => a + b, 0);   // 四类相加 = 全站 C++ 代码块总数
console.log("-".repeat(60));
console.log("合计".padEnd(26) +
  String(totals.class).padStart(5) + String(totals.template).padStart(10) +
  String(totals.struct).padStart(8) + String(totals.plain).padStart(7) + String(total).padStart(7));
console.log(`\n需要改写的（class + template）：${totals.class + totals.template} 段`);
console.log(`可保留的（struct 存数据）：${totals.struct} 段`);
console.log(`已是竞赛风格（plain）：${totals.plain} 段`);

console.log("\n【需要改写的具体清单】");
for (const p of perPage) {
  const need = p.rows.filter(r => r.kind === "class" || r.kind === "template");
  if (need.length) console.log(`  ${p.page}: ${need.map(r => r.file + "(" + r.kind + ")").join(", ")}`);
}
