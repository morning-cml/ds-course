#!/usr/bin/env node
/**
 * recover-precise.mjs —— 精确恢复动画脚本
 *
 * 之前的问题：所有子代理的会话一起重放时，不同会话里同名的 chNN-viz.js
 * 会互相覆盖（例如 ch11-sort-advanced 会话里的 ch11-viz.js 会盖掉
 * 真正的第 11 讲脚本），导致内容错位、语法不完整。
 *
 * 正确做法：**一个会话只处理它自己那一个动画脚本**，
 * 并从文件头注释里的「第 NN 讲」反推它属于哪一章，
 * 再与磁盘上现有文件的体积对比做校验。
 *
 * 用法：node tools/recover-precise.mjs [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(import.meta.dirname, "..");
const SESS = "C:\\Users\\test\\.dsh\\sessions\\--C-Users-test-Desktop-~5BB6~6559--";
const ZSTD = "C:\\msys64\\mingw64\\bin\\zstd.exe";
const OUT = path.join(os.tmpdir(), "ds-precise");
fs.mkdirSync(OUT, { recursive: true });

/* 各章应加载的脚本（与页面 <script> 引用一致） */
const TARGET = {
  2: "ch02-viz.js", 3: "ch03-viz.js", 4: "ch04-viz.js", 5: "ch05-viz.js",
  6: "ch06-viz.js", 7: "ch07-viz.js", 8: "ch08-viz.js", 9: "ch09-viz.js",
  10: "ch10-viz.js", 11: "ch11-viz.js", 12: "ch12-viz.js", 13: "ch13-viz.js"
};

/* 关键：会话记录里同一个工具调用会出现多次（同 id 的重复行）。
   必须先按调用 id 去重，否则同一个 edit 会被重复应用——第二次就找不到 old_string 了。 */
function collectOps(val, out, seen) {
  if (!val || typeof val !== "object") return;
  if (Array.isArray(val)) { val.forEach(v => collectOps(v, out, seen)); return; }
  if (typeof val.name === "string" && val.arguments !== undefined) {
    let a = val.arguments;
    if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { a = null; } }
    if (a && typeof a === "object" && /viz\.js$/.test(String(a.file_path || a.path || ""))) {
      const id = val.id || val.callId || val.toolCallId || null;
      const key = id || (val.name + "|" + JSON.stringify(a).slice(0, 200) + "|" + JSON.stringify(a).length);
      if (!seen.has(key)) { seen.add(key); out.push({ tool: val.name, a }); }
    }
  }
  for (const k in val) collectOps(val[k], out, seen);
}

const sessions = fs.readdirSync(SESS).filter(d =>
  fs.statSync(path.join(SESS, d)).isDirectory() &&
  fs.existsSync(path.join(SESS, d, "session.v3.jsonl.zstd")));

console.log("逐会话精确恢复：\n");
const results = [];

for (const d of sessions) {
  const tmp = path.join(os.tmpdir(), "p-" + d + ".jsonl");
  // 关键：stdio 全部忽略、由 zstd 自己写文件，避免 PowerShell 管道把二进制
  // 按本地代码页解码，导致中文全部变成乱码（乱码还会破坏 JS 里的嵌套引号）
  execFileSync(ZSTD, ["-d", "-f", "-q", "-o", tmp, path.join(SESS, d, "session.v3.jsonl.zstd")], { stdio: "ignore" });
  const lines = fs.readFileSync(tmp, "utf8").split("\n").filter(Boolean);
  fs.unlinkSync(tmp);

  const ops = [];
  const seen = new Set();
  for (const line of lines) { let o; try { o = JSON.parse(line); } catch (e) { continue; } collectOps(o, ops, seen); }
  const writes = ops.filter(o => typeof o.a.content === "string").length, edits = ops.length - writes;
  if (!ops.length) continue;

  // 重放：只针对同一个文件（每个会话只会写一个 viz 脚本）
  let cur = null, ok = 0, miss = 0;
  for (const op of ops) {
    const a = op.a;
    if (typeof a.content === "string") { cur = a.content; ok++; continue; }
    const oldS = a.old_string !== undefined ? a.old_string : a.old_str;
    const newS = a.new_string !== undefined ? a.new_string : a.new_str;
    if (cur !== null && typeof oldS === "string" && cur.includes(oldS)) {
      cur = a.replace_all ? cur.split(oldS).join(newS) : cur.replace(oldS, newS);
      ok++;
    } else miss++;
  }
  if (cur === null) { console.log(`  ${d.slice(0,8)}…  没有 write，跳过`); continue; }

  // 从头部注释里的原始文件名判断它本来叫什么（最可靠：改名后 +1 即可）
  const head = cur.split("\n").slice(0, 12).join("\n");
  const origName = (head.match(/\b(ch\d\d)-viz\.js\b/) || [])[1];
  let target = "(未识别)";
  if (origName) {
    const num = parseInt(origName.slice(2), 10) + 1;      // ch00→ch01 … ch12→ch13
    target = "ch" + String(num).padStart(2, "0") + "-viz.js";
  } else {
    let m = head.match(/第\s*(\d{1,2})\s*讲/);
    if (m) target = TARGET[parseInt(m[1], 10)] || "(未识别)";
  }
  const bytes = Buffer.byteLength(cur, "utf8");
  results.push({ session: d, origName, target, content: cur, ok, miss, bytes });
  console.log(`  ${d.slice(0,8)}…  ${ops.length} 个操作（write ${writes} / edit ${edits}），重放成功 ${ok} 失败 ${miss}` +
    `  ${origName || "?"} → ${target}  ${bytes} 字节`);
}

/* 校验：每个目标脚本只能来自一个会话，且讲次自洽 */
console.log("\n映射检查：");
const byTarget = new Map();
for (const r of results) {
  if (!byTarget.has(r.target)) byTarget.set(r.target, []);
  byTarget.get(r.target).push(r);
}
let bad = 0;
for (const [t, list] of [...byTarget.entries()].sort()) {
  const disk = path.join(ROOT, "assets/js", t);
  const diskSize = fs.existsSync(disk) ? fs.statSync(disk).size : 0;
  const flag = list.length > 1 ? "⚠ 多个会话产出同名文件" : "";
  console.log(`  ${t.padEnd(14)} ← 会话 ${list.map(x=>x.session.slice(0,8)).join(",")}  重放体积 ${list.map(x=>x.bytes).join(",")}  磁盘 ${diskSize} ${flag}`);
  if (list.length > 1) bad++;
}

if (APPLY) {
  let n = 0;
  for (const [t, list] of byTarget.entries()) {
    if (list.length !== 1) continue;
    fs.writeFileSync(path.join(ROOT, "assets/js", t), list[0].content, "utf8");
    n++;
  }
  console.log(`\n已写回 ${n} 个脚本`);
} else {
  console.log("\n（预览模式，加 --apply 写回）");
}
