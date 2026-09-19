#!/usr/bin/env node
/**
 * verify-stats.mjs —— 交叉核对「公开文档里写的数字」与「实测数字」是否一致
 * 这是 stats.mjs 的配套校验：防止 README / index.html 里的规模表再次过期。
 * 用法：node tools/verify-stats.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPO = path.resolve(ROOT, "..");
const han = (s) => (s.match(/[\u4e00-\u9fff]/g) || []).length;

function plainText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "").replace(/\s+/g, "");
}

/* ---------- 实测 ---------- */
const pages = ["index.html", ...fs.readdirSync(ROOT).filter(f => /^ch\d\d-.*\.html$/.test(f)).sort()];
let prose = 0, codeNotes = 0, cpp = 0, fig = 0, viz = 0;
for (const f of pages) {
  const html = fs.readFileSync(path.join(ROOT, f), "utf8");
  const blocks = [...html.matchAll(/<pre[^>]*data-lang="cpp"[^>]*>([\s\S]*?)<\/pre>/g)].map(m => m[1]);
  const codePlain = plainText(blocks.join(""));
  const allPlain = plainText(html);
  const isIndex = f === "index.html";
  if (!isIndex) {
    prose += han(allPlain) - han(codePlain);
    codeNotes += han(codePlain);
    cpp += blocks.length;
    fig += (html.match(/<svg/g) || []).length - (html.match(/<svg[^>]*aria-hidden="true"/g) || []).length;
    viz += (html.match(/id="viz-/g) || []).length;
  }
}
const wan = (n) => (n / 10000).toFixed(1);

/* ---------- 逐项断言 ---------- */
let bad = 0;
const check = (label, file, text, patterns) => {
  for (const [desc, re, expected] of patterns) {
    const m = text.match(re);
    if (!m) { console.log(`  ⚠ ${label} 里找不到「${desc}」`); bad++; continue; }
    const got = m[1];
    if (got !== String(expected)) {
      console.log(`  ✗ ${file}　${desc}：写的是 ${got}，实测 ${expected}`);
      bad++;
    } else {
      console.log(`  ✓ ${file}　${desc} = ${got}`);
    }
  }
};

const rootReadme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
const courseReadme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("实测：正文 " + prose + " 汉字（≈" + wan(prose) + " 万）　代码注释 " + codeNotes +
  "　C++ " + cpp + " 段　图解 " + fig + " 张　动画 " + viz + " 个\n");

console.log("── 仓库根 README.md");
check("root README", "README.md", rootReadme, [
  ["正文万字数", /约 ([\d.]+) 万字（另含代码内注释/, wan(prose)],
  ["代码注释万字数", /代码内注释约 ([\d.]+) 万字/, wan(codeNotes)],
  ["动画个数", /\*\*(\d+) 个\*\*（逐帧渲染/, viz],
  ["图解张数", /静态结构图解 \| (\d+) 张/, fig],
  ["C++ 段数", /C\+\+ 代码 \| (\d+) 段/, cpp],
]);

console.log("\n── ds-course/README.md");
check("course README", "ds-course/README.md", courseReadme, [
  ["正文万字数", /\| 正文 \| 约 ([\d.]+) 万字（另含/, wan(prose)],
  ["代码注释万字数", /代码内注释约 ([\d.]+) 万字/, wan(codeNotes)],
  ["动画个数", /\| 可单步交互动画 \| (\d+) 个/, viz],
  ["图解张数", /\| 静态结构图解 \| (\d+) 张/, fig],
  ["C++ 段数", /\| C\+\+ 代码 \| (\d+) 段/, cpp],
]);

console.log("\n── index.html（hero 统计）");
check("index.html", "index.html", indexHtml, [
  ["讲义万字数", /讲 · ([\d.]+) 万字讲义/, wan(prose)],
  ["动画个数", /<b>(\d+)<\/b><span>个可单步交互动画/, viz],
  ["图解张数", /<b>(\d+)<\/b><span>张结构图解/, fig],
  ["C++ 段数", /<b>(\d+)<\/b><span>段 C\+\+ 代码/, cpp],
]);

console.log("\n" + (bad ? `✗ 有 ${bad} 处公开数字与实测不符` : "✓ 所有公开数字与实测一致"));
process.exit(bad ? 1 : 0);
