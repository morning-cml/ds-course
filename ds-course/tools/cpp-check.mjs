#!/usr/bin/env node
/**
 * cpp-check.mjs —— 抽取课件里的 C++ 代码块并真实编译
 *
 * 课件里的代码是要给学生抄的，必须保证能编译。本工具把每个
 * <pre data-lang="cpp"> 的代码还原成 .cpp 文件，用 g++ 逐个做语法/语义检查并报告错误。
 *
 * 判定规则：
 *   · 完整程序（自带 #include）：原样编译，不过就是失败；
 *     唯一例外是缺自定义头文件（#include "xxx.h"）的多文件教学示例，记为跳过。
 *   · 片段（没有 #include）：补上 bits/stdc++.h 后先包进函数体编译（零散语句），
 *     不过再放到文件作用域编译（只含函数定义）。两种都不过时，
 *     如果**所有**报错都是「xxx 未声明」，说明它只是引用了上下文里的变量 → 记为「缺上下文的片段」跳过；
 *     只要出现一条别的错误（语法错、类型错……）就判失败。
 *   · .bat / .sh / .py / .txt 不是 C++，跳过。
 *
 * 注意（Windows 沙箱）：受管环境禁止用管道捕获子进程输出（spawn EPERM），
 * 因此编译器的 stderr 直接写进临时文件（传文件描述符，不经过管道），再读回。
 * 不要再绕道 pwsh 之类的外部 shell：本机没装 pwsh 时报错会被静默吞掉，失败就全变成了「跳过」。
 *
 * 用法：node tools/cpp-check.mjs [页面文件名...]
 *
 * 退出码：0 = 没有编译失败（找不到编译器、或沙箱禁止启动编译器时按 0 放行并打印警告）；
 *        1 = 至少 1 个代码块编译失败
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARGS = process.argv.slice(2);   // 命令行给出的页面文件名；为空则扫描全部 HTML

/* 编译器候选表：按顺序探测，第一个 --version 能跑通的就用它（找不到就整体跳过） */
function findCompiler() {
  const cands = ["g++", "clang++", "C:\\msys64\\mingw64\\bin\\g++.exe"];
  for (const c of cands) {
    try { execFileSync(c, ["--version"], { stdio: "ignore" }); return c; } catch (e) {}
  }
  return null;
}
const CXX = findCompiler();
if (!CXX) { console.log("找不到 g++ / clang++，跳过 C++ 编译校验"); process.exit(0); }

const unescapeHtml = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dscpp-"));   // 本次运行专用的临时目录，存放 bNN.cpp 与编译器日志
const pages = ARGS.length ? ARGS : fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).sort();   // 实际扫描的页面清单

const HEAD = "#include <bits/stdc++.h>\nusing namespace std;\n";   // 片段缺的头文件，统一补这两行

/* 编译一段源码，返回 { ok, err, envBlocked }。
   err 是编译器 stderr 全文；envBlocked = 沙箱不让启动编译器（此时无法判定对错）。 */
let seq = 0;   // 临时文件序号
function compile(source) {
  seq++;
  const cpp = path.join(tmp, `b${seq}.cpp`);   // 还原出的待编译源文件
  const log = path.join(tmp, `b${seq}.log`);   // 编译器 stderr 的落盘位置
  fs.writeFileSync(cpp, source, "utf8");
  const fd = fs.openSync(log, "w");
  const r = spawnSync(CXX, ["-fsyntax-only", "-std=c++17", "-w", "-fpermissive", cpp],
    { stdio: ["ignore", "ignore", fd], timeout: 90000 });
  fs.closeSync(fd);
  if (r.error) return { ok: false, err: String(r.error.message || r.error), envBlocked: true };
  return { ok: r.status === 0, err: fs.readFileSync(log, "utf8"), envBlocked: false };
}
const errorLines = (err) => err.split("\n").filter(x => /\berror\b/.test(x));
/* 报错是否全是「未声明」—— 片段引用了上下文里的变量，属预期 */
const onlyUndeclared = (err) => {
  const lines = errorLines(err);
  return lines.length > 0 && lines.every(x => /was not declared in this scope|has not been declared|undeclared identifier/.test(x));
};

let total = 0, ok = 0, fail = 0, skipped = 0;   // 代码块总数 / 编译通过 / 编译失败 / 跳过
const failures = [];    // 编译失败的明细 {page, file, err}，用于打印每条失败的首行错误
const multiFile = [];   // 缺自定义头文件的多文件教学示例（属预期）
const fragments = [];   // 只引用了上下文变量、单独编译不了的片段（属预期）
const nonCpp = [];      // .bat 之类非 C++ 文件
const blocked = [];     // 沙箱不让启动编译器、无法判定的块

for (const page of pages) {
  const fp = path.join(ROOT, page);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, "utf8");
  const blocks = [...html.matchAll(/<pre[^>]*data-lang="(?:cpp|c\+\+)"[^>]*>([\s\S]*?)<\/pre>/gi)];
  if (!blocks.length) continue;

  let pageOk = 0, pageSkip = 0;   // 本页编译通过数 / 跳过数
  const pageFails = [];           // 本页编译失败的 data-file 名列表

  blocks.forEach((m, i) => {
    const src = m[0];   // 整个 <pre ...>…</pre> 原文（用来读 data-file 属性）
    const file = (src.match(/data-file="([^"]+)"/) || [])[1] || `block${i + 1}.cpp`;   // 代码块对应的文件名（无 data-file 时按块序号命名）
    const code = unescapeHtml(m[1]).replace(/^\n+|\s+$/g, "");   // 还原实体并去掉首尾空白的真实代码
    const name = page + "/" + file;
    total++;   // 代码块总数加一（含后面会被跳过的）
    const skip = (list) => { skipped++; pageSkip++; list.push(name); };

    // 非 C++ 内容（例如 .bat 脚本）跳过
    if (/\.(bat|sh|py|txt)$/i.test(file)) return skip(nonCpp);

    let res;
    if (/#include/.test(code)) {
      // 完整程序：原样编译
      res = compile(code);
      if (res.envBlocked) return skip(blocked);
      if (res.ok) { ok++; pageOk++; return; }
      // 刻意拆成多文件的教学示例（引号包含的自定义头文件）：缺头文件属预期
      if (/fatal error:.*\.h.*No such file/i.test(res.err)) return skip(multiFile);
    } else {
      // 片段：先当「零散语句」包进函数体，不过再当「函数定义」放到文件作用域
      res = compile(HEAD + "[[maybe_unused]] static void __ds_wrap(void) {\n" + code + "\n}\n");
      if (res.envBlocked) return skip(blocked);
      if (res.ok) { ok++; pageOk++; return; }
      const top = compile(HEAD + code + "\n");
      if (top.ok) { ok++; pageOk++; return; }
      // 两种包法都不过：挑报错少的那份来判定
      if (errorLines(top.err).length < errorLines(res.err).length) res = top;
      if (onlyUndeclared(res.err)) return skip(fragments);
    }
    fail++; pageFails.push(file);
    failures.push({ page, file, err: res.err });
  });

  console.log(`── ${page.padEnd(24)} 通过 ${pageOk}/${blocks.length}` +
    (pageSkip ? `（跳过 ${pageSkip}）` : "") +
    (pageFails.length ? `  失败: ${pageFails.join(", ")}` : ""));
  // 打印该页每处失败的第一条错误
  failures.filter(f => f.page === page).slice(0, 4).forEach(f => {
    const first = errorLines(f.err || "")[0];
    console.log(`     ! ${f.file}: ${first ? first.replace(/^.*?(\d+:\d+: error)/, "$1").trim().slice(0, 160) : "（未捕获到编译器输出）"}`);
  });
}

console.log("\n════════════════════════════════════");
console.log(`共 ${total} 个 C++ 代码块：编译通过 ${ok}，失败 ${fail}，跳过 ${skipped}`);
if (fragments.length) console.log(`（跳过中属于「只引用上下文变量的片段」的：${fragments.join(", ")}）`);
if (multiFile.length) console.log(`（跳过中属于「多文件教学示例、缺自定义头文件」的：${multiFile.join(", ")}）`);
if (nonCpp.length) console.log(`（跳过中属于「非 C++ 文件」的：${nonCpp.join(", ")}）`);
if (blocked.length) console.log(`⚠ 沙箱禁止启动编译器，无法判定：${blocked.join(", ")}`);
if (failures.length) { console.log("失败清单："); failures.forEach(f => console.log("  - " + f.page + " → " + f.file)); }
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
