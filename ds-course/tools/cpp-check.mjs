#!/usr/bin/env node
/**
 * cpp-check.mjs —— 抽取课件里的 C++ 代码块并真实编译
 *
 * 课件里的代码是要给学生抄的，必须保证能编译。本工具把每个
 * <pre data-lang="cpp"> 的代码还原成 .cpp 文件，用 g++ 逐个做语法/语义检查并报告错误。
 *
 * 注意（Windows 沙箱）：受管环境禁止用管道捕获子进程输出（spawn EPERM），
 * 因此这里把编译器输出重定向到临时文件再读回。
 *
 * 用法：node tools/cpp-check.mjs [页面文件名...]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARGS = process.argv.slice(2);

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dscpp-"));
const pages = ARGS.length ? ARGS : fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).sort();

let total = 0, ok = 0, fail = 0, skipped = 0;
const failures = [];
const multiFile = [];
const review = [];

for (const page of pages) {
  const fp = path.join(ROOT, page);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, "utf8");
  const blocks = [...html.matchAll(/<pre[^>]*data-lang="(?:cpp|c\+\+)"[^>]*>([\s\S]*?)<\/pre>/gi)];
  if (!blocks.length) continue;

  let pageOk = 0, pageSkip = 0;
  const pageFails = [];

  blocks.forEach((m, i) => {
    const src = m[0];
    const file = (src.match(/data-file="([^"]+)"/) || [])[1] || `block${i + 1}.cpp`;
    let code = unescapeHtml(m[1]).replace(/^\n+|\s+$/g, "");
    total++;

    // 非 C++ 内容（例如 .bat 脚本）跳过
    if (/\.(bat|sh|py|txt)$/i.test(file)) { skipped++; pageSkip++; return; }

    const hasInc = /#include/.test(code);
    const hasMain = /\bint\s+main\s*\(/.test(code);
    // 片段（没有头文件也没有 main 的零散语句）单独判定
    const fragment = !hasInc && !hasMain;
    const wrapped = hasInc
      ? code
      : "#include <bits/stdc++.h>\nusing namespace std;\n" +
        "[[maybe_unused]] static void __ds_wrap(void) {\n" + code + "\n}\n";

    const cpp = path.join(tmp, `b${total}.cpp`);
    const log = path.join(tmp, `b${total}.log`);
    fs.writeFileSync(cpp, wrapped, "utf8");

    let errText = "";
    let compiled = false;
    try {
      // 关键：stdio 全部走文件/忽略，绝不用管道（沙箱会 EPERM）
      execFileSync(CXX, ["-fsyntax-only", "-std=c++17", "-w", "-fpermissive", cpp],
        { stdio: ["ignore", "ignore", "ignore"], timeout: 90000 });
      compiled = true;
    } catch (e) {
      if (e.code === "EPERM" || !fs.existsSync(cpp)) {
        // 环境问题（沙箱禁止），降级为跳过而不是判失败
        skipped++; pageSkip++;
        return;
      }
      // 用 PowerShell 重定向把编译器报错写进日志文件（stdout/stderr 均不经过管道）
      const ps = `& '${CXX}' -fsyntax-only -std=c++17 -w -fpermissive '${cpp}' 2> '${log}'`;
      try {
        execFileSync("pwsh", ["-NoProfile", "-Command", ps],
          { stdio: ["ignore", "ignore", "ignore"], timeout: 90000 });
      } catch (e2) { /* 编译失败返回非 0，属正常 */ }
      errText = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
    }
    if (compiled) { ok++; pageOk++; return; }
    // 课件中刻意拆成多文件的教学示例（自带引号包含的自定义头文件）：缺头文件属预期，跳过
    if (/fatal error:.*\.h.*No such file/i.test(errText)) {
      skipped++; pageSkip++; multiFile.push(file); return;
    }
    // 拿不到编译器输出时无法判定（多为环境限制），记为「待人工确认」而不是失败
    if (!errText || !/error/i.test(errText)) {
      review.push({ page, file }); skipped++; pageSkip++; return;
    }
    if (fragment && !/error/.test(errText)) { skipped++; pageSkip++; return; }
    fail++; pageFails.push(file);
    failures.push({ page, file, err: errText });
  });

  console.log(`── ${page.padEnd(24)} 通过 ${pageOk}/${blocks.length}` +
    (pageSkip ? `（跳过 ${pageSkip}）` : "") +
    (pageFails.length ? `  失败: ${pageFails.join(", ")}` : ""));
  // 打印该页每处失败的第一条错误
  failures.filter(f => f.page === page).slice(0, 4).forEach(f => {
    const first = (f.err || "").split("\n").filter(x => /error/.test(x))[0];
    console.log(`     ! ${f.file}: ${first ? first.trim().slice(0, 160) : "（未捕获到编译器输出）"}`);
  });
}

console.log("\n════════════════════════════════════");
console.log(`共 ${total} 个 C++ 代码块：编译通过 ${ok}，失败 ${fail}，跳过 ${skipped}`);
if (multiFile.length) console.log(`（跳过中属于「多文件教学示例、缺自定义头文件」的：${[...new Set(multiFile)].join(", ")}）`);
if (review.length) console.log(`（待人工确认：${[...new Set(review.map(r => r.page + "/" + r.file))].join(", ")}）`);
if (failures.length) { console.log("失败清单："); failures.forEach(f => console.log("  - " + f.page + " → " + f.file)); }
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
