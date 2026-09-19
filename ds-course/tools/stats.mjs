#!/usr/bin/env node
/**
 * stats.mjs —— 统计课件的公开规模数据（README / index.html 里的数字以此为准）
 *
 * 口径统一说明（关键：正文与代码分开算，避免把 C++ 算进"字数"）：
 *   正文汉字 = 去掉 <script>/<style>/注释/标签/空白后，再剔除所有 C++ 代码块，剩下的汉字数
 *   代码汉字 = 所有 <pre data-lang="cpp"> 里的汉字数（讲解性注释）
 *   总汉字   = 正文汉字 + 代码汉字
 *   代码块   = <pre data-lang="cpp"> 的个数
 *   图解     = <svg> 标签数，去掉「只放箭头 marker 的隐藏 svg」
 *   动画     = id="viz-*" 容器数（与 chNN-viz.js 一一对应）
 *   帧数     = 由 dom-sim.mjs 逐帧渲染后统计，见 --frames
 *
 * 用法：node tools/stats.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const han = (s) => (s.match(/[\u4e00-\u9fff]/g) || []).length;

function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "");
}

/** 只放箭头 marker 的隐藏 svg 不算「图解」 */
function figureCount(html) {
  const all = (html.match(/<svg/g) || []).length;
  const hidden = (html.match(/<svg[^>]*aria-hidden="true"/g) || []).length;
  return all - hidden;
}

const files = ["index.html", ...fs.readdirSync(ROOT).filter((f) => /^ch\d\d-.*\.html$/.test(f)).sort()];

let proseHan = 0, codeHan = 0, cpp = 0, fig = 0, viz = 0, head = 0;
const rows = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), "utf8");
  const codeBlocks = [...html.matchAll(/<pre[^>]*data-lang="cpp"[^>]*>([\s\S]*?)<\/pre>/g)].map((m) => m[1]);
  const codeText = codeBlocks.join("");
  // 正文 = 全文纯文本（含代码）减去代码文本
  const allPlain = plainText(html);
  const codePlain = plainText(codeText);
  const p = han(allPlain) - han(codePlain);
  const c = han(codePlain);
  const n = codeBlocks.length;
  const g = figureCount(html);
  const v = (html.match(/id="viz-/g) || []).length;
  const h = (html.match(/<h[23][ >]/g) || []).length;
  proseHan += p; codeHan += c; cpp += n; fig += g; viz += v; head += h;
  rows.push([f, p, c, n, g, v, h]);
}

console.log("文件".padEnd(26), "正文汉字".padStart(9), "代码汉字".padStart(9), "C++".padStart(5), "图解".padStart(5), "动画".padStart(5), "小节".padStart(5));
console.log("-".repeat(74));
for (const [f, p, c, n, g, v, h] of rows) {
  console.log(f.padEnd(26), String(p).padStart(9), String(c).padStart(9), String(n).padStart(5), String(g).padStart(5), String(v).padStart(5), String(h).padStart(5));
}
console.log("-".repeat(74));
console.log("合计".padEnd(26), String(proseHan).padStart(9), String(codeHan).padStart(9), String(cpp).padStart(5), String(fig).padStart(5), String(viz).padStart(5), String(head).padStart(5));

const idx = rows[0];
const prose = proseHan - idx[1], code = codeHan - idx[2];
console.log(`\n【讲义部分（不含 index）】`);
console.log(`  正文汉字   ${prose}  ≈ ${(prose / 10000).toFixed(1)} 万字`);
console.log(`  代码内注释 ${code} 汉字`);
console.log(`  正文 + 代码注释 合计 ${prose + code} ≈ ${((prose + code) / 10000).toFixed(1)} 万字`);
console.log(`  C++ 代码块 ${cpp - idx[3]} 段　结构图解 ${fig - idx[4]} 张　交互动画 ${viz - idx[5]} 个　h2/h3 小节 ${head - idx[6]} 个`);
