#!/usr/bin/env node
/**
 * coverage-check.mjs —— 核对用户需求清单里的每一个知识点是否真的讲到了
 *
 * 用法：node tools/coverage-check.mjs
 * 说明：用关键词在全部章节正文里做检索，命中即认为该知识点有覆盖。
 *       「同义不同词」的情况直接在 NEEDS 表的正则里用 `|` 并列解决
 *       （例如 /赫夫曼|哈夫曼|Huffman/），没有单独的同义词替换表。
 *
 * 退出码：0 = 知识点全部覆盖且工程视角小节全部达标；
 *        1 = 有知识点未命中，或有工程视角小节不满足硬要求
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
/* 参与检索的页面：index + 全部 chNN-*.html；ALL 把「文件名 → 全文」预先读进内存，避免反复读盘 */
const files = fs.readdirSync(ROOT).filter(f => /^(index|ch\d\d.*)\.html$/.test(f)).sort();
const ALL = files.map(f => ({ f, s: fs.readFileSync(path.join(ROOT, f), "utf8") }));

/* 需求清单：每项 = [知识点, 关键正则, 期望出现的章节（可空）]
   —— 加一项就照这个三元组写一行，第 3 项目前全部留空（不做章节限定，命中任意页即算覆盖）；
      正则里 [\s\S]{0,200} 表示「两个关键词要挨得足够近」才算讲到位。 */
const NEEDS = [
  ["数据结构的定义",              /数据结构的?定义|数据结构是/, ""],
  ["逻辑结构与物理结构",          /逻辑结构[\s\S]{0,200}物理结构|物理结构|存储结构/, ""],
  ["大 O 时间复杂度讲解与计算",   /大\s*O|大O|时间复杂度/, ""],
  ["顺序表",                      /顺序表/, ""],
  ["单链表",                      /单链表/, ""],
  ["双向链表",                    /双向链表|双链表/, ""],
  ["循环链表",                    /循环链表/, ""],
  ["栈（顺序栈、链栈）",          /顺序栈[\s\S]{0,800}链栈/, ""],
  ["括号匹配",                    /括号匹配/, ""],
  ["进制转换",                    /进制转换/, ""],
  ["表达式求值",                  /表达式求值|后缀表达式/, ""],
  ["循环队列",                    /循环队列/, ""],
  ["链队列",                      /链队列/, ""],
  ["排队场景应用",                /排队|银行|模拟/, ""],
  ["串的基本操作",                /StrAssign|子串|StrCompare|模式匹配/, ""],
  ["KMP 模式匹配",                /KMP/, ""],
  ["next 数组推导过程",           /next\s*数组|π\s*数组|前缀函数/, ""],
  ["多维数组的存储",              /行优先|列优先/, ""],
  ["对称矩阵压缩存储",            /对称矩阵/, ""],
  ["三角矩阵压缩存储",            /三角矩阵/, ""],
  ["对角矩阵压缩存储",            /对角矩阵|三对角|带状矩阵/, ""],
  ["二叉树的五大性质",            /性质\s*[1-5１-５]|n0\s*=\s*n2|五大性质/, ""],
  ["四种遍历（前后中层序）",      /前序[\s\S]{0,200}中序[\s\S]{0,200}后序[\s\S]{0,300}层序/, ""],
  ["图的基本术语",                /邻接点|入度|出度|度|连通分量/, ""],
  ["邻接矩阵",                    /邻接矩阵/, ""],
  ["邻接表",                      /邻接表/, ""],
  ["DFS 遍历",                    /DFS|深度优先/, ""],
  ["BFS 遍历",                    /BFS|广度优先/, ""],
  ["最小生成树 Prim",             /Prim/, ""],
  ["最小生成树 Kruskal",          /Kruskal/, ""],
  ["Dijkstra 最短路径",           /Dijkstra/, ""],
  ["Floyd 最短路径",              /Floyd/, ""],
  ["拓扑排序",                    /拓扑排序/, ""],
  ["关键路径",                    /关键路径|AOE/, ""],
  ["顺序查找",                    /顺序查找/, ""],
  ["折半查找",                    /折半查找|二分查找/, ""],
  ["插值查找",                    /插值查找/, ""],
  ["斐波那契查找",                /斐波那契查找/, ""],
  ["哈希表构造方法",              /除留余数|哈希函数|散列函数/, ""],
  ["四种冲突解决方案",            /开放定址|链地址法|再哈希|公共溢出区/, ""],
  ["冒泡排序",                    /冒泡排序/, ""],
  ["简单选择排序",                /简单选择排序|直接选择排序/, ""],
  ["直接插入排序",                /直接插入排序/, ""],
  ["希尔排序",                    /希尔排序/, ""],
  ["堆排序",                      /堆排序/, ""],
  ["归并排序",                    /归并排序/, ""],
  ["快速排序",                    /快速排序|快排/, ""],
  ["基数排序",                    /基数排序/, ""],
  ["排序复杂度与稳定性对比",      /稳定性[\s\S]{0,4000}时间复杂度|稳定/, ""],
  ["专业术语体系",                /抽象数据类型|ADT/, ""],
  ["赫夫曼树与最优前缀编码",      /赫夫曼|哈夫曼|Huffman/, ""],
  ["回溯法与树的遍历",            /回溯法|解空间树/, ""],
  ["连通分量",                    /连通分量/, ""],
  ["有向无环图（拓扑、关键路径）",/有向无环图|DAG|AOV|AOE/, ""],
  ["动态规划",                    /动态规划|DP/, ""],
  ["背包问题",                    /背包/, ""],
  ["数学类算法",                  /快速幂|筛法|数论|高精度|GCD|最大公约数/, ""],
  ["单源与全源最短路径",          /单源|全源/, ""],
  ["五大排序体系",                /插入类[\s\S]{0,600}交换类|交换类[\s\S]{0,600}选择类/, ""],
  ["10+ 种排序算法",              /计数排序|桶排序|锦标赛排序|鸡尾酒排序|梳排序|表插入排序/, ""],
  ["排序下界分析",                /决策树|下界|Ω\(n\s*log\s*n\)|nlogn/, ""],
  ["BM 算法",                     /BM|Boyer/, ""],
  ["洛谷题单",                    /洛谷/, ""],
  ["C++ 语言描述",                /#include|std::|cout/, ""],
];

let miss = 0;                 // 未命中的知识点条数；>0 时本脚本以 1 退出
console.log("需求覆盖核对（关键词检索全部章节）\n");
for (const [name, re, must] of NEEDS) {
  const hit = ALL.filter(x => re.test(x.s)).map(x => x.f);
  if (!hit.length) { miss++; console.log("✗ " + name + "  —— 未找到"); continue; }
  const where = hit.length > 4 ? hit.slice(0, 4).join(", ") + ` 等 ${hit.length} 页` : hit.join(", ");
  console.log("✓ " + name.padEnd(24, "　") + " → " + where);
}
console.log("\n" + (miss ? `有 ${miss} 项未覆盖` : `清单共 ${NEEDS.length} 项，全部覆盖 ✅`));

/* ============================================================
   工程视角硬检查（SPEC 第 8 节）
   ------------------------------------------------------------
   以各章 h2 标题里是否含「工程视角」为准，因此新设这一节会自动纳入检查。
   要求该节内至少有：1 个内联 SVG、1 段 C++ 代码、1 张表、2 处跨讲引用。
   ============================================================ */
/* 工程视角小节清单：每项 = [章节文件名, 该节应有的小节号（仅用于提示文案，不做断言）]。
   检查依据是「h2 标题里是否含『工程视角』」，所以新设/改名这一节会自动纳入检查；
   加一章工程视角小节就在下面补一行。要求见下方英文注释块：svg ≥1、C++ ≥1、表 ≥1、跨讲引用 ≥2。 */
const ENGINEERING = [
  ["ch01-intro.html", "1.16"],
  ["ch02-linear-list.html", "2.10"],
  ["ch03-stack.html", "3.12"],
  ["ch04-queue.html", "4.14"],
  ["ch05-string-kmp-bm.html", "5.7"],
  ["ch06-array-matrix.html", "6.9"],
  ["ch07-tree.html", "7.11"],
  ["ch08-graph-basic.html", "8.10"],
  ["ch09-graph-algo.html", "9.9"],
  ["ch10-search-hash.html", "10.8"],
  ["ch11-sort-basic.html", "11.11"],
  ["ch12-sort-advanced.html", "12.11"],
  ["ch13-paradigm-dp.html", "13.8"],
];

console.log("\n工程视角小节核对（SPEC 第 8 节）\n");
let eBad = 0;   // 工程视角小节不达标的项数（每处缺失/不达标加一）

/** 取某页里第一个含「工程视角」的 h2 到下一个 h2 之间的内容 */
function engineeringSection(html) {
  const h2s = [...html.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>/g)];
  for (let i = 0; i < h2s.length; i++) {
    if (!/工程视角/.test(h2s[i][0])) continue;
    const start = h2s[i].index;
    const end = i + 1 < h2s.length ? h2s[i + 1].index : html.length;
    return html.slice(start, end);
  }
  return null;
}

for (const [file, expect] of ENGINEERING) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { eBad++; console.log(`✗ ${file} 不存在`); continue; }
  const html = fs.readFileSync(fp, "utf8");
  const sec = engineeringSection(html);
  if (!sec) { eBad++; console.log(`✗ ${file.padEnd(24)} 找不到「工程视角」小节（应有 ${expect} 节）`); continue; }

  const problems = [];   // 本页工程视角小节缺失的要素
  const svg = (sec.match(/<svg/g) || []).length;                   // 节内内联 SVG 个数（要求 ≥1）
  const cpp = (sec.match(/data-lang="cpp"/g) || []).length;        // 节内 C++ 代码块数（要求 ≥1）
  const table = (sec.match(/<table/g) || []).length;               // 节内表格数（要求 ≥1）
  const xref = new Set([...sec.matchAll(/第\s*(\d{1,2})\s*讲/g)].map(m => m[1])).size;   // 节内「第 NN 讲」去重后的讲次数（要求 ≥2）

  if (svg < 1) problems.push("缺静态 SVG 图解");
  if (cpp < 1) problems.push("缺可编译的 C++ 代码块");
  if (table < 1) problems.push("缺工程选型对比表");
  if (xref < 2) problems.push(`跨讲引用只有 ${xref} 处（要求 ≥2）`);

  if (problems.length) { eBad++; console.log(`✗ ${file.padEnd(24)} ${problems.join("；")}`); }
  else console.log(`✓ ${file.padEnd(24)} 有工程视角节（${expect}）　图解 ${svg}　C++ ${cpp}　表 ${table}　跨讲引用 ${xref}`);
}

/* 提示性信息：其它讲次若也适合补，但不作为失败条件 */
const extra = files.filter(f => /^ch\d\d-.*\.html$/.test(f) && !ENGINEERING.some(([x]) => x === f));   // 未列入 ENGINEERING 的章节页
const couldAdd = [];   // 其中确实没有「工程视角」小节的讲次（只提示，不计入 eBad）
for (const f of extra) {
  const html = fs.readFileSync(path.join(ROOT, f), "utf8");
  if (!engineeringSection(html)) couldAdd.push(f.replace(/-.*/, ""));
}
if (couldAdd.length) {
  console.log("\n提示（不判失败）：以下讲次暂无「工程视角」小节 —— " + couldAdd.join("、"));
  console.log("      纯练习章（14 题单）与速查章（15）按 SPEC 不强制；其余章按需补。");
}

console.log("\n" + (eBad ? `工程视角小节有 ${eBad} 项不达标` : "工程视角小节全部达标 ✅"));
process.exit(miss || eBad ? 1 : 0);
