#!/usr/bin/env node
/**
 * repair-quotes.mjs —— 修复 JS 里"中文串中混入 ASCII 双引号"导致的语法错误
 *
 * 场景：会话记录还原时，个别替换文本里的中文引号变成了 ASCII 的 "，
 * 于是字符串被提前截断：
 *     "……把它"挤"回最左边……"        ← 语法错误
 *     "……把它“挤”回最左边……"        ← 正确
 *
 * 做法：用词法扫描跟踪字符串状态：
 *   · 正常字符串内部的 \" 是合法转义，一律不动；
 *   · 只有当某个 ASCII " 处于字符串**内部**、且它左右紧邻的是中文字符
 *     （即明显是误入的中文引号）时，才成对换成 “ ”。
 *
 * 用法：node tools/repair-quotes.mjs <文件> [--apply]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("用法: node tools/repair-quotes.mjs <文件> [--apply]"); process.exit(2); }
const fp = path.join(ROOT, file);
const src = fs.readFileSync(fp, "utf8");

const isCJK = (ch) => !!ch && /[^\x00-\x7f]/.test(ch);

/** 处理单个物理行（本文件的字符串都不跨行） */
function fixLine(line) {
  let out = "";
  let i = 0;
  let inStr = false;          // 是否位于字符串内部
  const marks = [];           // 记录"候选误入引号"的位置
  let changed = false;

  while (i < line.length) {
    const ch = line[i];
    if (!inStr) {
      if (ch === '"') { inStr = true; }
      out += ch; i++; continue;
    }
    // 字符串内部
    if (ch === "\\") { out += line.slice(i, i + 2); i += 2; continue; }
    if (ch === '"') {
      // 这是字符串内部的引号：判断它是不是中文引号误入
      // 判据：它后面 1~40 字符内能找到另一个 "，且那一对引号两侧都是中文
      let j = i + 1, end = -1;
      while (j < line.length) {
        if (line[j] === "\\") { j += 2; continue; }
        if (line[j] === '"') { end = j; break; }
        j++;
      }
      const left = line[i - 1], right = end >= 0 ? line[end + 1] : null;
      if (end > i && isCJK(left) && (isCJK(right) || right === undefined)) {
        // 成对替换为中文引号
        out += "\u201c" + line.slice(i + 1, end) + "\u201d";
        i = end + 1;
        changed = true;
        continue;
      }
      // 否则视为字符串结束
      inStr = false;
      out += ch; i++; continue;
    }
    out += ch; i++;
  }
  return { text: out, changed };
}

const lines = src.split("\n");
const outLines = [];
let fixed = 0;
lines.forEach((l, idx) => {
  const r = fixLine(l);
  if (r.changed) { fixed++; console.log(`  行 ${idx + 1}: ${l.trim().slice(0, 82)}`); }
  outLines.push(r.text);
});

const next = outLines.join("\n");
console.log(`共修正 ${fixed} 行`);
if (APPLY && next !== src) { fs.writeFileSync(fp, next, "utf8"); console.log("已写回 " + file); }
else if (!APPLY) console.log("（预览模式，加 --apply 写回）");
