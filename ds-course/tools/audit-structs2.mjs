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
 *
 * 退出码：恒为 0 —— 只输出「建议去壳 / 建议保留」清单，需人工照着改
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const pages = fs.readdirSync(ROOT).filter(f => /^ch\d\d.*\.html$/.test(f)).sort();
const un = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

/* 算法型结构体名/文件名特征：自带状态与方法的模板（并查集、树状数组、线段树…），竞赛通行写法 → 保留 */
const ALGO_TYPES = /(DSU|UnionFind|Fenwick|BIT|SegmentTree|TreeArray|Heap|SparseTable|Trie|MonoQueue|单调|并查集)/i;
/* 结点/纯数据类型名（必须整体匹配）：只描述数据长什么样 → 保留 */
const NODE_TYPES = /^(Node|TreeNode|ThreadNode|OLNode|ListNode|Edge|EdgeBox|Point|Customer|Task|Triple|VexNode\d?|CSNode|CTree|Stat)$/;
/* 方法名黑名单：这些是关键字/控制流，被正则误当成成员函数时直接剔除 */
const KEYWORDS = new Set(["if", "for", "while", "switch", "return", "sizeof", "catch"]);

const rows = [];   // 含 struct 的代码块明细：{page, file, detail[]}，detail 见下方字段说明
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const blocks = [...html.matchAll(/<pre[^>]*data-lang="cpp"[^>]*>([\s\S]*?)<\/pre>/gi)];
  blocks.forEach((m, i) => {
    const code = un(m[1]);
    const file = (m[0].match(/data-file="([^"]+)"/) || [])[1] || `block${i + 1}`;
    const names = [...code.matchAll(/\bstruct\s+(\w+)\s*\{/g)].map(x => x[1]);   // 本块里定义的结构体名
    if (!names.length) return;

    const detail = names.map(name => {   // 逐个 struct 给出判定，字段含义见 return 处
      const start = code.indexOf("struct " + name);   // 该 struct 在代码块里的起点
      // 精确定位结构体结尾：从 struct 开始的第一个「顶格 };」
      let end = -1;   // 结构体结尾下标（-1 = 没找到，退化为固定截取 1200 字符）
      for (let p = start; p < code.length - 2; p++) {
        if (code[p] === "}" && code[p + 1] === ";" && (p === 0 || code[p - 1] === "\n")) { end = p; break; }
      }
      const body = code.slice(start, end > 0 ? end + 2 : start + 1200);   // 结构体全文
      const flat = body.replace(/\s+/g, " ");   // 压成一行，方便正则扫成员函数

      const methods = [];   // 判定为「真正的成员函数」的名字列表
      const re = /([~]?\w[\w:<>*&\s]*?)\s*\(([^()]*)\)\s*(?:[:][^{;]*)?\{/g;   // 扫「返回类型 名字(参数) {」形态
      let mm;
      while ((mm = re.exec(flat)) !== null) {
        const raw = mm[1].trim();   // 捕获到的「返回类型 + 名字」
        const fn = raw.split(/[\s*&]+/).filter(Boolean).pop() || raw;   // 取最后一段作为函数名
        if (fn === name || fn === "~" + name) continue;   // 构造/析构
        if (/operator/.test(raw)) continue;               // 运算符重载
        if (KEYWORDS.has(fn)) continue;
        if (fn === "main") continue;                      // 不可能在 struct 里，属误识别
        methods.push(fn);
      }
      return {
        name,                                             // 结构体名
        methods,                                          // 判定出的成员函数名（不含构造/析构/运算符重载）
        hasMethod: methods.length > 0 || /\b(public|private)\s*:/.test(body),   // 是否带「真封装」特征
        algo: ALGO_TYPES.test(name) || ALGO_TYPES.test(file),   // 算法型（按结构体名或文件名判断）
        node: NODE_TYPES.test(name)                             // 结点/纯数据类型
      };
    });
    rows.push({ page, file, detail });
  });
}

const need = rows.filter(r => r.detail.some(d => d.hasMethod && !d.algo && !d.node));   // 建议去壳的代码块（写了真成员函数、且不是算法型/结点型）
console.log(`含 struct 的代码块共 ${rows.length} 个`);
console.log(`其中「写了真正的成员函数、且不属于算法型/结点型」的：${need.length} 个\n`);
console.log("建议去壳的清单（改成全局数组 + 自由函数）：");
for (const r of need) {
  const items = r.detail.filter(d => d.hasMethod && !d.algo && !d.node)
    .map(d => `${d.name}(${d.methods.slice(0, 5).join("/")}${d.methods.length > 5 ? "…" : ""})`);
  console.log(`  ${r.page.padEnd(24)} ${r.file.padEnd(30)} ${items.join(", ")}`);
}

const keepAlgo = [...new Set(rows.flatMap(r => r.detail.filter(d => d.algo)).map(d => d.name))];   // 判定为算法型、建议保留的结构体名（去重）
const pureData = rows.flatMap(r => r.detail.filter(d => !d.hasMethod)).map(d => d.name);            // 只有数据字段、没有成员函数的结构体名
console.log(`\n保留（算法型）：${keepAlgo.length} 处 → ${keepAlgo.join(", ") || "无"}`);
console.log(`保留（结点/纯数据）：${pureData.length} 处`);
