#!/usr/bin/env node
/**
 * recover-from-sessions.mjs —— 从 DSH 会话记录里恢复被误覆盖的文件
 *
 * 背景：.dsh/sessions/<workspace>/<agent-id>/session.v3.jsonl.zstd 里保存着
 * 子代理的完整会话（含 write / edit 工具调用的原始参数）。本脚本把记录解压、
 * 按时间顺序重放所有 write 与 edit，就能还原每个文件的最终内容。
 *
 * 注意：该 zstd 文件是**多帧**的，Node 的 zstdDecompressSync 只能解出第一帧，
 * 所以这里调用 zstd.exe 整体解压（本机 MSYS2 自带）。
 *
 * 用法：
 *   node tools/recover-from-sessions.mjs            预览
 *   node tools/recover-from-sessions.mjs --apply    把结果导出到临时目录
 *
 * 退出码：2 = 找不到 zstd.exe（无法解压）；其余为 0（--apply 只写到系统临时目录，不动仓库文件）
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");                                        // 加 --apply 才把还原结果导出到磁盘
const SESS = "C:\\Users\\test\\.dsh\\sessions\\--C-Users-test-Desktop-~5BB6~6559--";   // DSH 会话记录目录（本工作区的会话都在这）
const TMP = path.join(os.tmpdir(), "ds-recover-jsonl");   // 解压出来的 .jsonl 临时目录
const OUT = path.join(os.tmpdir(), "ds-recovered");       // --apply 时的导出目录
/* zstd 可执行文件：优先用 MSYS2 自带的那份，退化为 PATH 里的 zstd；都找不到就退出 */
const ZSTD = ["C:\\msys64\\mingw64\\bin\\zstd.exe", "zstd"].find(p => {
  try { execFileSync(p, ["--version"], { stdio: "ignore" }); return true; } catch (e) { return false; }
});
if (!ZSTD) { console.error("找不到 zstd，无法解压会话记录"); process.exit(2); }

fs.mkdirSync(TMP, { recursive: true });

/* 递归遍历 JSON，收集所有"像文件写入"的工具调用。
   记录格式：{"type":"tool-call","name":"write","arguments":"{...json...}"} */
function collectOps(val, out) {
  if (!val || typeof val !== "object") return;
  if (Array.isArray(val)) { val.forEach(v => collectOps(v, out)); return; }

  // 形态：工具调用。只认真正会改文件的工具（read / pwsh 等一律排除，
  // 它们同样带 file_path，混进来会让 edit 重放链错位）
  const WRITE_TOOLS = { write: 1, edit: 1, str_replace: 1, create_file: 1, apply_patch: 1 };   // 只认这几个会改文件的工具名
  if (typeof val.name === "string" && val.arguments !== undefined && WRITE_TOOLS[val.name]) {
    let a = val.arguments;   // 工具参数（记录里可能是 JSON 字符串，也可能是对象）
    if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { a = null; } }
    if (a && typeof a === "object") {
      const fp = a.file_path || a.path;
      const hasContent = typeof a.content === "string";
      const hasEdit = typeof (a.old_string !== undefined ? a.old_string : a.old_str) === "string";
      if (typeof fp === "string" && (hasContent || hasEdit)) {
        out.push({
          tool: val.name,
          file: fp,
          content: hasContent ? a.content : null,
          oldS: hasEdit ? (a.old_string !== undefined ? a.old_string : a.old_str) : null,
          newS: hasEdit ? (a.new_string !== undefined ? a.new_string : a.new_str) : null,
          all: !!a.replace_all
        });
      }
    }
  }
  for (const k in val) collectOps(val[k], out);
}

const dirs = fs.readdirSync(SESS).filter(d => {   // 只保留「目录里确实有 session.v3.jsonl.zstd」的会话
  const p = path.join(SESS, d);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "session.v3.jsonl.zstd"));
});

console.log("发现 " + dirs.length + " 个会话记录，用 zstd 解压中…\n");

const files = new Map();       // path → 内容：按时间顺序重放后的「文件最终内容」
let writes = 0, editOk = 0, editMiss = 0, ops = 0;   // write 次数 / edit 命中次数 / edit 未命中次数 / 识别出的写操作总数

for (const d of dirs) {
  const src = path.join(SESS, d, "session.v3.jsonl.zstd");
  const dst = path.join(TMP, d + ".jsonl");
  execFileSync(ZSTD, ["-d", "-f", "-q", "-o", dst, src], { stdio: "ignore" });
  const lines = fs.readFileSync(dst, "utf8").split("\n").filter(Boolean);

  const sessionOps = [];   // 本会话识别出的写操作（保持记录里的先后顺序）
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch (e) { continue; }
    collectOps(obj, sessionOps);
  }
  ops += sessionOps.length;   // 累计写操作数
  let w = 0;                  // 本会话里的 write 次数（打印用）
  for (const op of sessionOps) {
    if (op.content !== null) { files.set(op.file, op.content); writes++; w++; }   // write：整份覆盖
    else {
      const cur = files.get(op.file);   // edit：必须在已还原的内容里找到 old_string 才能应用
      if (cur !== undefined && op.oldS !== null && cur.includes(op.oldS)) {
        files.set(op.file, op.all ? cur.split(op.oldS).join(op.newS) : cur.replace(op.oldS, op.newS));
        editOk++;
      } else editMiss++;   // 找不到 old_string（顺序错位或内容已被别的会话改写）
    }
  }
  console.log(`  ${d.slice(0, 8)}…  ${lines.length} 行，识别出 ${sessionOps.length} 个写操作（其中 write ${w}）`);
  fs.unlinkSync(dst);
}

console.log(`\n合计识别 ${ops} 个写操作：write ${writes} 次，edit 命中 ${editOk}，edit 未命中 ${editMiss}`);
console.log("\n还原出的文件（" + files.size + " 个）：");
const rows = [...files.entries()].sort((a, b) => path.basename(a[0]).localeCompare(path.basename(b[0])));   // 按文件名排序的 [路径, 内容]
for (const [fp, content] of rows) {
  console.log(`  ${path.basename(fp).padEnd(26)} ${String(content.length).padStart(7)} 字符`);
}

if (APPLY) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const [fp, content] of files) {
    fs.writeFileSync(path.join(OUT, path.basename(fp)), content, "utf8");
  }
  console.log("\n已导出到 " + OUT);
} else {
  console.log("\n（预览模式，加 --apply 导出到临时目录）");
}
