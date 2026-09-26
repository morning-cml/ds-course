#!/usr/bin/env node
/**
 * xref-check.mjs —— 校验正文里「见第 NN 讲」这类交叉引用的讲次是否正确
 *
 * 背景：2026-09 发现 index.html 与 ds-course/README.md 里把「洛谷题单」写成了
 *       「第 15 讲」（实际是第 14 讲）。这类错误 check.mjs / nav-check.mjs 都覆盖不到，
 *       因为链接本身没坏、锚点也存在，只是「讲次编号」指错了页面。
 *
 * 做两件事：
 *   1. 编号合法性：正文/文档里出现的每一个「第 NN 讲」，NN 必须落在 01..15 内。
 *   2. 指代一致性：取「第 NN 讲」前后一小段文字做局部语境，如果语境里出现了
 *      某个「讲次专属关键词」，而该关键词属于另一讲，就判定为串讲次。
 *
 * 用法：
 *   node tools/xref-check.mjs            # 检查课件页面 + 两个 README + 使用说明
 *   node tools/xref-check.mjs --list     # 只打印所有交叉引用出现的位置，不做判定
 *
 * 退出码：0 = 无错误；1 = 存在讲次编号越界或串讲次
 *        （--list 模式只罗列不判定，不会以非 0 退出）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPO = path.resolve(ROOT, "..");                          // 仓库根（ds-course 的上一级），README 等文档在这里
const LIST_ONLY = process.argv.includes("--list");              // --list：只罗列交叉引用，不判定、不设退出码

/* ---------- 1. 从 course.js 读页面注册表，建立「讲次 → 主题词」映射 ---------- */
const courseJs = fs.readFileSync(path.join(ROOT, "assets/js/course.js"), "utf8");
/* PAGES：每项 = {id, file, no(讲次数字), title}，直接从 course.js 的注册表里抠出来 */
const PAGES = [...courseJs.matchAll(/\{\s*id:\s*"([^"]+)",\s*file:\s*"([^"]+)",\s*no:\s*"(\d+)"\s*,\s*title:\s*"([^"]+)"/g)]
  .map(m => ({ id: m[1], file: m[2], no: Number(m[3]), title: m[4] }));

const VALID_NO = new Set(PAGES.map(p => p.no));   // 合法讲次编号集合（新增一讲会自动生效）

/**
 * 「讲次专属关键词」表：每个词只应指向一讲。
 * 只收录**高置信度**的词——即在这个课件里基本只可能出现在那一讲的词，
 * 避免把「图」「数组」这种到处都是的词误判成串讲次。
 *
 * 每项 = {no: 该词所属讲次, word: 报错信息里显示的中文名, re: 匹配该词的正则}。
 * 加词时注意：no 必须与 course.js 里的讲次一致，且词要足够「专属」。
 */
const KEYWORDS = [
  { no: 1,  word: "绪论",              re: /绪论/ },
  { no: 1,  word: "大 O",              re: /大\s*O/ },
  { no: 2,  word: "线性表",            re: /线性表/ },
  { no: 2,  word: "静态链表",          re: /静态链表/ },
  { no: 3,  word: "共享栈",            re: /共享栈/ },
  { no: 3,  word: "表达式求值",        re: /表达式求值/ },
  { no: 4,  word: "循环队列",          re: /循环队列/ },
  { no: 4,  word: "单调队列",          re: /单调队列/ },
  { no: 5,  word: "KMP",               re: /\bKMP\b/ },
  { no: 5,  word: "BM 算法",           re: /\bBM\b/ },
  { no: 5,  word: "next 数组",         re: /next\s*数组/ },
  { no: 6,  word: "对称矩阵",          re: /对称矩阵/ },
  { no: 6,  word: "稀疏矩阵",          re: /稀疏矩阵/ },
  { no: 7,  word: "树与二叉树",        re: /树与二叉树/ },
  { no: 7,  word: "二叉树",            re: /二叉树/ },
  { no: 7,  word: "赫夫曼",            re: /赫夫曼|哈夫曼/ },
  { no: 8,  word: "图的存储",          re: /图的存储/ },
  { no: 8,  word: "邻接矩阵",          re: /邻接矩阵/ },
  { no: 8,  word: "邻接表",            re: /邻接表/ },
  { no: 9,  word: "Dijkstra",          re: /Dijkstra/ },
  { no: 9,  word: "Floyd",             re: /Floyd/ },
  { no: 9,  word: "关键路径",          re: /关键路径/ },
  { no: 9,  word: "最小生成树",        re: /最小生成树/ },
  { no: 10, word: "查找与哈希",        re: /查找与哈希/ },
  { no: 10, word: "哈希",              re: /哈希|散列/ },
  { no: 10, word: "折半查找",          re: /折半查找|二分查找/ },
  { no: 11, word: "八大排序",          re: /八大排序/ },
  { no: 11, word: "堆排序",            re: /堆排序/ },
  { no: 12, word: "排序下界",          re: /排序(的)?下界|决策树/ },
  { no: 12, word: "内省排序",          re: /内省排序/ },
  { no: 12, word: "外部排序",          re: /外部排序/ },
  { no: 13, word: "动态规划",          re: /动态规划/ },
  { no: 13, word: "背包",              re: /背包/ },
  { no: 14, word: "洛谷",              re: /洛谷/ },
  { no: 14, word: "题单",              re: /题单/ },
  { no: 14, word: "对拍",              re: /对拍/ },
  { no: 15, word: "速查手册",          re: /速查手册/ },
  { no: 15, word: "模拟自测卷",        re: /模拟自测卷/ },
  { no: 15, word: "复习路线图",        re: /复习路线图/ },
  { no: 16, word: "家教规划",          re: /家教规划/ },
];

/* ---------- 2. 待检查的文件 ---------- */
/* targets：每项 = {label: 打印用的短名字, full: 绝对路径}。
   前半是全部章节页 + index（在 ROOT 内），后半是仓库根与 ds-course 下的说明文档（存在才加入）。 */
const targets = [];
for (const f of fs.readdirSync(ROOT).filter(x => /^ch\d\d-.*\.html$/.test(x)).sort()) {
  targets.push({ label: f, full: path.join(ROOT, f) });
}
targets.push({ label: "index.html", full: path.join(ROOT, "index.html") });
for (const rel of ["README.md", "ds-course/README.md", "GIT-使用说明.md", "ds-course/SPEC.md"]) {
  const full = path.join(REPO, rel);
  if (fs.existsSync(full)) targets.push({ label: rel, full });
}

/* ---------- 3. 逐文件扫描 ---------- */
/* 判定思路（关键）：
   串讲次的典型形态是「第 NN 讲 + 主题词」，而且主题词紧跟在编号后面，例如
   「第 15 讲的洛谷题单」。所以只看**紧邻编号之后的一小段**，
   并且在这段里遇到「、」「，」「：」「（」或另一个「第」就截断——
   这样「第 07 讲树与二叉树、邻接表（第 08 讲）」里的「邻接表」会归给第 08 讲，
   不会污染第 07 讲。 */
const AFTER = 14;     // 编号之后最多看多少字符（调大更容易漏判远处的串讲次，调小会漏掉稍长的主题词）
/* 截断符里必须包含「<」——否则会一路跨过 </span> 读到下一行，把别的讲的词算进来 */
const TRIM = /[、，,。；;：:（）()【】\[\]「」\/\n<]|第\s*\d+\s*讲/;

/**
 * 取「第 NN 讲」之后的一小段文字作为局部语境（用于找主题词线索）。
 * @param {string} text  文件全文
 * @param {number} from  匹配结束位置（即 re.lastIndex，编号后面那个字符）
 * @returns {string} 最多 AFTER 个字符、遇到 TRIM 截断符即停、并剥掉标签的纯文本
 */
function phraseAfter(text, from) {
  let s = text.slice(from, from + AFTER);
  const cut = s.search(TRIM);
  if (cut >= 0) s = s.slice(0, cut);
  return s.replace(/<[^>]*>/g, "").trim();
}

let errors = 0, warnings = 0, total = 0, filesChecked = 0;   // 错误数 / 警告数 / 「第 NN 讲」出现总次数 / 已扫描文件数
const errs = [], warns = [];   // 错误与警告的文案（最后统一打印）

for (const t of targets) {
  const text = fs.readFileSync(t.full, "utf8");
  filesChecked++;   // 已扫描文件数加一
  const re = /第\s*(\d{1,2})\s*讲/g;   // 交叉引用的统一形态
  let m;
  while ((m = re.exec(text)) !== null) {
    const no = Number(m[1]);   // 引用里写的讲次编号
    total++;   // 交叉引用出现次数加一

    const after = phraseAfter(text, re.lastIndex);   // 编号紧后面的语境（找主题词用）
    const beforeRaw = text.slice(Math.max(0, m.index - 18), m.index).replace(/<[^>]*>/g, "");   // 编号前面 18 字符（--list 打印用）

    if (LIST_ONLY) {
      console.log(`${t.label}: 第${String(no).padStart(2, "0")}讲  «${beforeRaw.slice(-14)}【第${no}讲】${after}»`);
      continue;
    }

    if (!VALID_NO.has(no)) {
      errors++;
      const nos = [...VALID_NO].filter(x => x > 0);   // 去掉总览页的 0
      const range = `第 ${String(Math.min(...nos)).padStart(2, "0")}~${String(Math.max(...nos)).padStart(2, "0")} 讲`;
      errs.push(`${t.label}: 出现「第 ${no} 讲」，但只存在${range}`);
      continue;
    }

    // 只在「第 NN 讲」后面紧跟的主题词里找线索
    const hits = KEYWORDS.filter(k => k.re.test(after));   // 语境里命中的主题词
    if (!hits.length) continue;

    const selfHit = hits.some(h => h.no === no);        // 命中里有属于本讲次的词 → 引用正确
    const other = hits.filter(h => h.no !== no);        // 命中里属于别的讲次的词 → 疑似串讲次
    if (selfHit || !other.length) continue;

    errors++;
    /* 注意：消息里不要把「属于第 N 讲」写成「第 N 讲」——
       否则这行本身会被下一轮扫描当成一处新的交叉引用，造成自我干扰。 */
    const owner = [...new Set(other.map(h => h.no))].join("、");
    errs.push(
      `${t.label}: 「第 ${no} 讲${after}」——主题词【${other.map(h => h.word).join("、")}】` +
      `其实属于第 ${owner} 讲（此处编号应为 ${owner}）`
    );
  }
}

/* ---------- 4. 汇总 ---------- */
if (!LIST_ONLY) {
  for (const w of warns) console.log("  ! " + w);
  for (const e of errs) console.log("  ✗ " + e);
  console.log(`\n扫描 ${filesChecked} 个文件，发现 ${total} 处「第 NN 讲」交叉引用`);
  console.log(`错误 ${errors} 项　警告 ${warnings} 项`);
  if (errors === 0) console.log("交叉引用讲次校验通过 ✅");
  process.exit(errors ? 1 : 0);
}
console.log(`\n共 ${total} 处「第 NN 讲」引用`);
