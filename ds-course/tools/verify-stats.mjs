#!/usr/bin/env node
/**
 * verify-stats.mjs —— 交叉核对「公开文档里写的数字」与「实测数字」是否一致
 * 这是 stats.mjs 的配套校验：防止 README / index.html 里的规模表再次过期。
 * 用法：node tools/verify-stats.mjs
 *
 * 退出码：0 = 所有公开数字与实测一致；1 = 至少 1 处不符，或文档里找不到对应字段
 */
import fs from "node:fs";
import path from "node:path";
/* 帧数要把动画脚本真跑一遍才数得出来，垫片与 loadViz 在 lib-viz.mjs 里（与 frame-check 共用） */
import { countAll } from "./lib-viz.mjs";

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
/* 统计范围：index 之外的全部章节页（index 自身的 hero 数字不算进规模） */
const pages = ["index.html", ...fs.readdirSync(ROOT).filter(f => /^ch\d\d-.*\.html$/.test(f)).sort()];
let prose = 0, codeNotes = 0, cpp = 0, fig = 0, viz = 0;   // 正文汉字 / 代码内注释汉字 / C++ 段数 / 图解张数 / 动画个数 的累计值
for (const f of pages) {
  const html = fs.readFileSync(path.join(ROOT, f), "utf8");
  const blocks = [...html.matchAll(/<pre[^>]*data-lang="cpp"[^>]*>([\s\S]*?)<\/pre>/g)].map(m => m[1]);   // 本页 C++ 代码块内容
  const codePlain = plainText(blocks.join(""));   // 代码块纯文本（用于扣掉代码里的汉字）
  const allPlain = plainText(html);               // 整页纯文本
  const isIndex = f === "index.html";             // index 的正文/图解不计入「讲义」规模
  if (!isIndex) {
    prose += han(allPlain) - han(codePlain);
    codeNotes += han(codePlain);
    cpp += blocks.length;
    fig += (html.match(/<svg/g) || []).length - (html.match(/<svg[^>]*aria-hidden="true"/g) || []).length;
    viz += (html.match(/id="viz-/g) || []).length;
  }
}
const wan = (n) => (n / 10000).toFixed(1);   // 汉字数换成「万字」字符串，保留 1 位小数（公开文档就是按这个口径写的）

/* 帧数：把 12 个动画脚本各跑一遍，数「动画个数」与「总帧数」。
   文档里那行「N 个（逐帧渲染共 M 帧）」的后半截就靠它把关 ——
   任何一次动画改动都可能增减帧数（2026-09 就出现过：修好 ch05 的 π 数组后多了 2 帧，
   而当时没人核对，README 里的 2565 一直挂到下次人工发现）。 */
const counted = countAll();

/* ---------- 逐项断言 ---------- */
let bad = 0;   // 不一致 / 找不到字段的项数，决定退出码
/**
 * 按 patterns 逐条把「文档里写的数字」与实测值比对。
 * @param {string} label   打印用的分组名（如 "root README"）
 * @param {string} file    出错信息里显示的文档路径
 * @param {string} text    文档全文
 * @param {Array}  patterns 每项 = [字段描述, 只捕获数字的组(第 1 组)的正则, 实测期望值]
 */
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
  "　C++ " + cpp + " 段　图解 " + fig + " 张　动画 " + viz + " 个" +
  "　逐帧渲染共 " + counted.frames + " 帧（脚本里实有 " + counted.anims + " 个动画）\n");

console.log("── 仓库根 README.md");
check("root README", "README.md", rootReadme, [
  ["正文万字数", /约 ([\d.]+) 万字（另含代码内注释/, wan(prose)],
  ["代码注释万字数", /代码内注释约 ([\d.]+) 万字/, wan(codeNotes)],
  ["动画个数", /\*\*(\d+) 个\*\*（逐帧渲染/, viz],
  ["动画总帧数", /逐帧渲染共 (\d+) 帧/, counted.frames],
  ["图解张数", /静态结构图解 \| (\d+) 张/, fig],
  ["C++ 段数", /C\+\+ 代码 \| (\d+) 段/, cpp],
]);

console.log("\n── ds-course/README.md");
check("course README", "ds-course/README.md", courseReadme, [
  ["正文万字数", /\| 正文 \| 约 ([\d.]+) 万字（另含/, wan(prose)],
  ["代码注释万字数", /代码内注释约 ([\d.]+) 万字/, wan(codeNotes)],
  ["动画个数", /\| 可单步交互动画 \| (\d+) 个/, viz],
  ["动画总帧数", /逐帧渲染共 (\d+) 帧/, counted.frames],
  ["单文件方案的帧数", /个动画、(\d+) 帧同时建 DOM/, counted.frames],
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
