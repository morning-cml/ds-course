#!/usr/bin/env node
/**
 * recover-mine.mjs —— 从父会话记录里恢复"我自己写的"文件最终版
 *
 * 父会话（session-*.jsonl.zstd）里保存着主代理自己的全部 write/edit 调用，
 * 按顺序重放即可还原出我在事故前的最新版本。
 *
 * 用法：node tools/recover-mine.mjs <文件名关键字> [--apply]
 * 例：  node tools/recover-mine.mjs ch04-viz.js --apply
 *
 * 退出码：2 = 没给关键字 / 找不到 zstd；1 = 重放后没有可用内容；其余为 0
 *        （不加 --apply 时只写到临时目录并做语法检查，不动仓库文件）
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const SESS = "C:\\Users\\test\\.dsh\\sessions\\--C-Users-test-Desktop-~5BB6~6559--";   // DSH 会话记录目录
const ZSTD = "C:\\msys64\\mingw64\\bin\\zstd.exe";   // 解压多帧 zstd 用的可执行文件
const key = process.argv[2];                         // 文件名关键字（只重放 file_path 里含它的写操作）
const APPLY = process.argv.includes("--apply");      // 加 --apply 才写回 assets/js/
if (!key) { console.error("用法: node tools/recover-mine.mjs <文件名关键字> [--apply]"); process.exit(2); }

const dir = fs.readdirSync(SESS).find(d => d.startsWith("session-"));   // 父会话目录（session-* 开头那个）
const tmp = path.join(os.tmpdir(), "mine.jsonl");                      // 解压后的 jsonl 临时文件
execFileSync(ZSTD, ["-d", "-f", "-q", "-o", tmp, path.join(SESS, dir, "session.v3.jsonl.zstd")], { stdio: "ignore" });
const lines = fs.readFileSync(tmp, "utf8").split("\n").filter(Boolean);
fs.unlinkSync(tmp);

const WRITE = { write: 1, edit: 1 };   // 只认这两种会改文件的工具
function collect(v, out, seen) {   // v = 任意 JSON 节点，out = 收集到的写操作，seen = 已见过的调用 id（去重）
  if (!v || typeof v !== "object") return;
  if (Array.isArray(v)) { v.forEach(x => collect(x, out, seen)); return; }
  if (typeof v.name === "string" && v.arguments !== undefined && WRITE[v.name]) {
    let a = v.arguments;   // 工具参数（可能是 JSON 字符串）
    if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { a = null; } }
    if (a && typeof a === "object" && String(a.file_path || a.path || "").includes(key)) {
      const id = v.id || JSON.stringify(a).slice(0, 150);   // 去重键：优先用调用 id，没有就用参数指纹
      if (!seen.has(id)) { seen.add(id); out.push({ tool: v.name, a }); }
    }
  }
  for (const k in v) collect(v[k], out, seen);
}
const ops = [], seen = new Set();   // ops = 命中的写操作（按出现顺序），seen = 去重键
for (const l of lines) { let o; try { o = JSON.parse(l); } catch (e) { continue; } collect(o, ops, seen); }

console.log(`父会话中与「${key}」有关的写操作：${ops.length} 个`);
let cur = null, ok = 0, miss = 0;   // cur = 重放出来的当前内容，ok = 成功应用数，miss = 失败数（old_string 找不到）
ops.forEach((op, i) => {
  const a = op.a;
  if (typeof a.content === "string") { cur = a.content; ok++; console.log(`  #${i + 1} write 全文 ${a.content.length}`); return; }
  const o = a.old_string, n = a.new_string;
  if (cur !== null && typeof o === "string" && cur.includes(o)) {
    cur = a.replace_all ? cur.split(o).join(n) : cur.replace(o, n);
    ok++; console.log(`  #${i + 1} edit ok  → ${cur.length}`);
  } else { miss++; console.log(`  #${i + 1} edit ✗   old 头：「${String(o || "").split("\n")[0].slice(0, 50)}」`); }
});

if (!cur) { console.error("没有可用内容"); process.exit(1); }
const outFile = path.join(os.tmpdir(), "ds-mine", key);   // 先落到临时目录待检（避免直接覆盖仓库文件）
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, cur, "utf8");
console.log(`\n重放成功 ${ok}，失败 ${miss}，最终 ${cur.length} 字符`);
console.log("已写出：" + outFile);

let syntaxOK = true;   // 还原出来的内容能否通过语法检查（不通过就不允许写回）
try { new Function(cur); } catch (e) { syntaxOK = false; console.log("语法错误：" + e.message); }
console.log("语法检查：", syntaxOK ? "通过 ✅" : "不通过 ✗");

if (APPLY && syntaxOK) {
  const dst = path.join(ROOT, "assets/js", key);
  if (fs.existsSync(dst)) fs.copyFileSync(dst, dst + ".before-mine-restore");
  fs.writeFileSync(dst, cur, "utf8");
  console.log("已写回 assets/js/" + key + "（原文件备份为 " + key + ".before-mine-restore）");
}
