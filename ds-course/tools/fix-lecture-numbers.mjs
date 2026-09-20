#!/usr/bin/env node
/**
 * fix-lecture-numbers.mjs —— 校正「第 NN 讲」的口径
 *
 * 背景：改名脚本把全文的「第 NN 讲」都 +1 了。这带来两个后果：
 *   · 正文里对其它讲次的交叉引用：原来是对的，+1 之后就错了 → 需要撤销
 *   · 每页页头（doc-head）里的讲次：原来就写错了（用 0 基），需要改成正确值
 *
 * 做法：
 *   1. 全文「第 NN 讲」整体 -1（撤销改名脚本的 +1）
 *   2. 再把页头 doc-head 区块里的讲次改成该页真实讲次
 *
 * 用法：node tools/fix-lecture-numbers.mjs [--apply]
 *
 * 退出码：恒为 0；不加 --apply 时只预览不写盘（加 --apply 才会改文件）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APPLY = process.argv.includes("--apply");

/* 页面清单：每项 = [文件名, 该页真实讲次]。
   ⚠ 第 2 列用来改写页头 doc-head，必须与该页实际讲次一致；新增一讲就补一行。 */
const PAGES = [
  ["ch01-intro.html",          1],
  ["ch02-linear-list.html",    2],
  ["ch03-stack.html",          3],
  ["ch04-queue.html",          4],
  ["ch05-string-kmp-bm.html",  5],
  ["ch06-array-matrix.html",   6],
  ["ch07-tree.html",           7],
  ["ch08-graph-basic.html",    8],
  ["ch09-graph-algo.html",     9],
  ["ch10-search-hash.html",   10],
  ["ch11-sort-basic.html",    11],
  ["ch12-sort-advanced.html", 12],
  ["ch13-paradigm-dp.html",   13],
  ["ch14-luogu.html",         14],
  ["ch15-review.html",        15]
];

const fmt = (n) => "第 " + String(n).padStart(2, "0") + " 讲";   // 统一的讲次写法（两位补零）

let changed = 0;   // 内容有变化的文件数（不加 --apply 时也统计，用于预览提示）
for (const [file, lec] of PAGES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { console.log("跳过（不存在）: " + file); continue; }
  const src = fs.readFileSync(fp, "utf8");
  let out = src;

  /* 1) 全文「第 NN 讲」整体 -1 */
  let undo = 0;   // 本页被撤销 +1 的引用条数
  out = out.replace(/第\s*(\d{1,2})\s*讲/g, (m, num) => {
    const v = parseInt(num, 10);
    if (v < 1 || v > 15) return m;
    undo++;
    return fmt(v - 1);
  });

  /* 2) 页头 doc-head 区块内的讲次改成该页真实讲次 */
  const headRe = /(<div class="doc-head">[\s\S]*?<div class="kicker">)([\s\S]*?)(<\/div>)/;   // 捕获 2 就是 kicker 里的文字
  const m = out.match(headRe);
  let headFrom = "", headTo = "";   // 改写前后的页头文字（仅用于打印对比）
  if (m) {
    headFrom = m[2].replace(/<[^>]+>/g, "").trim();
    let inner = m[2];
    if (/第\s*\d{1,2}\s*讲/.test(inner)) {
      // 保留前缀（例如「线性结构 · 」）
      inner = inner.replace(/第\s*\d{1,2}\s*讲/, fmt(lec));
    } else if (/讲义\s*\d+/.test(inner)) {                       // 老格式「讲义 N」
      inner = inner.replace(/讲义\s*\d+/, fmt(lec));
    } else {
      inner = fmt(lec);                                          // 完全没有讲次信息：直接写入正确讲次
    }
    headTo = inner.replace(/<[^>]+>/g, "").trim();
    out = out.replace(headRe, "$1" + inner + "$3");
  }

  const diff = out !== src;   // 本页是否有实际改动
  if (diff) changed++;
  console.log((diff ? "✓ " : "· ") + file.padEnd(24) +
    `撤销 ${undo} 处 +1，页头 [${headFrom}] → [${headTo || "（无 doc-head）"}]`);
  if (APPLY && diff) fs.writeFileSync(fp, out, "utf8");
}

console.log(`\n共修改 ${changed} 个文件` + (APPLY ? "，已写回。" : "（预览模式，加 --apply 写回）"));
