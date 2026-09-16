#!/usr/bin/env node
/**
 * audit-structs2.mjs —— 分析课件里含 struct 的代码块，给出「保留还是去壳」的建议
 *
 * 分类标准（按"这个 struct 是不是在表达一个数据结构本身"判断）：
 *   · 结点型（Node / TreeNode / Edge …）—— 只描述数据长什么样 → 保留
 *   · 算法型（DSU / 树状数组 / 线段树 / 堆 …）—— 自带状态、方法围绕内部状态，
 *       竞赛界（OI-wiki、各类模板）普遍这么写 → 保留
 *   · 简单容器（SeqQueue / CircularQueue1 / SparseMatrix …）—— 「一个数组 + 一个下标」，
 *       方法只是一层壳，去壳改成全局数组 + 自由函数更贴合竞赛写法 → 建议改
 *   · 只有字段 + 构造函数/运算符重载 → 视为纯数据，保留
 *
 * 用法：node tools/audit-structs2.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const pages = fs.readdirSync(ROOT).filter(f => /^ch\d\d.*\.html$/.test(f)).sort();
const un = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

const ALGO_TYPES = /(DSU|UnionFind|Fenwick|BIT|SegmentTree|TreeArray|Heap|SparseTable|Trie|MonoQueue|单调|并查集)/i;
const NODE_TYPES = /^(Node|TreeNode|ThreadNode|OLNode|ListNode|Edge|EdgeBox|Point|Customer|Task|Triple|VexNode\d?|CSNode|CTree|Stat)$/;
const KEYWORDS = new Set(["if", "for", "while", "switch", "return", "sizeof", "catch"]);

const rows = [];
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const blocks = [...html.matchAll(/<pre[^>]*data-lang="cpp"[^>]*>([\s\S]*?)<\/pre>/gi)];
  blocks.forEach((m, i) => {
    const code = un(m[1]);
    const file = (m[0].match(/data-file="([^"]+)"/) || [])[1] || `block${i + 1}`;
    const names = [...code.matchAll(/\bstruct\s+(\w+)\s*\{/g)].map(x => x[1]);
    if (!names.length) return;

    const detail = names.map(name => {
      const start = code.indexOf("struct " + name);
      // 精确定位结构体结尾：从 struct 开始的第一个「顶格 };」
      let end = -1;
      for (let p = start; p < code.length - 2; p++) {
        if (code[p] === "}" && code[p + 1] === ";" && (p === 0 || code[p - 1] === "\n")) { end = p; break; }
      }
      const body = code.slice(start, end > 0 ? end + 2 : start + 1200);
      const flat = body.replace(/\s+/g, " ");

      const methods = [];
      const re = /([~]?\w[\w:<>*&\s]*?)\s*\(([^()]*)\)\s*(?:[:][^{;]*)?\{/g;
      let mm;
      while ((mm = re.exec(flat)) !== null) {
        const raw = mm[1].trim();
        const fn = raw.split(/[\s*&]+/).filter(Boolean).pop() || raw;
        if (fn === name || fn === "~" + name) continue;   // 构造/析构
        if (/operator/.test(raw)) continue;               // 运算符重载
        if (KEYWORDS.has(fn)) continue;
        if (fn === "main") continue;                      // 不可能在 struct 里，属误识别
        methods.push(fn);
      }
      return {
        name,
        methods,
        hasMethod: methods.length > 0 || /\b(public|private)\s*:/.test(body),
        algo: ALGO_TYPES.test(name) || ALGO_TYPES.test(file),
        node: NODE_TYPES.test(name)
      };
    });
    rows.push({ page, file, detail });
  });
}

const need = rows.filter(r => r.detail.some(d => d.hasMethod && !d.algo && !d.node));
console.log(`含 struct 的代码块共 ${rows.length} 个`);
console.log(`其中「写了真正的成员函数、且不属于算法型/结点型」的：${need.length} 个\n`);
console.log("建议去壳的清单（改成全局数组 + 自由函数）：");
for (const r of need) {
  const items = r.detail.filter(d => d.hasMethod && !d.algo && !d.node)
    .map(d => `${d.name}(${d.methods.slice(0, 5).join("/")}${d.methods.length > 5 ? "…" : ""})`);
  console.log(`  ${r.page.padEnd(24)} ${r.file.padEnd(30)} ${items.join(", ")}`);
}

const keepAlgo = [...new Set(rows.flatMap(r => r.detail.filter(d => d.algo)).map(d => d.name))];
const pureData = rows.flatMap(r => r.detail.filter(d => !d.hasMethod)).map(d => d.name);
console.log(`\n保留（算法型）：${keepAlgo.length} 处 → ${keepAlgo.join(", ") || "无"}`);
console.log(`保留（结点/纯数据）：${pureData.length} 处`);
