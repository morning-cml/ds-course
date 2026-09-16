#!/usr/bin/env node
/**
 * replace-block.mjs —— 把页面里某个 <pre data-lang="cpp"> 代码块换成新代码
 *
 * 自动处理 HTML 转义（< > & → &lt; &gt; &amp;），避免手写出错。
 *
 * 用法：
 *   node tools/replace-block.mjs <页面> <data-file名> <新代码文件> [--apply]
 * 例：
 *   node tools/replace-block.mjs ch02-linear-list.html seqlist.h _new.cpp --apply
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const [page, fileKey, codeFile] = process.argv.slice(2).filter(a => a !== "--apply");
const APPLY = process.argv.includes("--apply");
if (!page || !fileKey || !codeFile) {
  console.error("用法: node tools/replace-block.mjs <页面> <data-file名> <新代码文件> [--apply]");
  process.exit(2);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const pagePath = path.join(ROOT, page);
const html = fs.readFileSync(pagePath, "utf8");
const newCode = fs.readFileSync(codeFile, "utf8").replace(/\r\n/g, "\n").replace(/^\n+|\s+$/g, "");

/* 定位该 data-file 对应的 <pre> 块 */
const re = new RegExp('<pre[^>]*data-lang="cpp"[^>]*data-file="' +
  fileKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*>[\\s\\S]*?</pre>', "i");
const m = html.match(re);
if (!m) {
  /* 有的块 data-file 在后面，退化为两段式匹配 */
  const alt = new RegExp('<pre[^>]*data-file="' +
    fileKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*data-lang="cpp"[^>]*>[\\s\\S]*?</pre>', "i");
  const m2 = html.match(alt);
  if (!m2) { console.error("找不到 data-file=\"" + fileKey + "\" 的代码块"); process.exit(1); }
  const head = m2[0].slice(0, m2[0].indexOf(">") + 1);
  const replaced = head + "\n" + esc(newCode) + "\n</pre>";
  const out = html.replace(m2[0], replaced);
  finish(out, m2[0].length, replaced.length);
} else {
  const head = m[0].slice(0, m[0].indexOf(">") + 1);
  const replaced = head + "\n" + esc(newCode) + "\n</pre>";
  const out = html.replace(m[0], replaced);
  finish(out, m[0].length, replaced.length);
}

function finish(out, oldLen, newLen) {
  console.log(`${page} 中的 ${fileKey}: ${oldLen} 字符 → ${newLen} 字符`);
  if (APPLY) { fs.writeFileSync(pagePath, out, "utf8"); console.log("已写回"); }
  else console.log("（预览模式，加 --apply 才写回）");
}
