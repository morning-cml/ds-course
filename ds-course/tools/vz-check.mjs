#!/usr/bin/env node
/**
 * vz-check.mjs —— 校验「动画用到的 vz-* 状态类」是否都在 course.css 里定义
 *
 * 为什么需要它（2026-09 新增）：
 *   动画脚本是通过拼字符串产生 class 的（SVG.box(x,y,w,h,"warn",...) → class="vz-box warn"），
 *   这类类名**静态扫描很难查全**，一旦 course.css 少定义了一个，症状是「高亮不生效」
 *   或「白字落在浅色底上，整格文字看不见」—— 而 check.mjs / dom-sim.mjs 都发现不了
 *   （DOM 结构没错、脚本也没报错）。
 *
 *   历史事故：`.vz-box.warn / .dim` 一度没进 course.css，于是 ch02/ch03/ch04/ch06/ch11
 *   各自在页内打了补丁，而 ch05/ch07/ch08/ch09/ch10/ch12/ch13 没打 —— 这些章的
 *   「冲突/交换」红色高亮与 dim 淡出完全不生效。
 *
 * 做法：把每个 chNN-viz.js 真正跑一遍（用记录型假 SVG），收集**运行时实际出现**的
 *       vz-* 类，再要求它们全部在 assets/css/course.css 里有定义。
 *       按 SPEC 第 0 节的规定，页内 <style> 补丁不再被认可。
 *
 * 用法：node tools/vz-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const JS_DIR = path.join(ROOT, "assets/js");
const CSS = path.join(ROOT, "assets/css/course.css");

/* ============================ 记录型假 SVG ============================ */
function mkNode(name, attrs, text) {
  const n = {
    name,
    attrs: Object.assign({}, attrs || {}),
    text: text === undefined || text === null ? null : String(text),
    children: [], style: {}, _cls: (attrs && attrs["class"]) || "",
    appendChild(c) { if (c && c.__frag) { c.children.forEach((x) => this.appendChild(x)); return c; } this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this._cls = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    hasAttribute(k) { return k in this.attrs; },
    cloneNode() { return this; },
    querySelector(sel) {
      const isCls = String(sel).startsWith(".");
      const want = String(sel).replace(/^\./, "");
      const walk = (nd) => {
        for (const ch of nd.children) {
          if (isCls ? ch._cls.split(/\s+/).includes(want) : ch.name === sel) return ch;
          const r = walk(ch); if (r) return r;
        }
        return null;
      };
      return walk(this);
    },
    querySelectorAll() { return []; },
  };
  Object.defineProperty(n, "firstChild", { get() { return this.children[0] || null; } });
  return n;
}

const SVG = {
  NS: "http://www.w3.org/2000/svg",
  el: (n, a, t) => mkNode(n, a, t),
  svg: (w, h) => mkNode("svg", { width: w, height: h }),
  box: (x, y, w, h, cls, text, tc) => { const g = mkNode("g"); g.appendChild(mkNode("rect", { class: "vz-box " + (cls || "") })); if (text !== undefined && text !== null) g.appendChild(mkNode("text", { class: "vz-text " + (tc || "") }, text)); return g; },
  circle: (cx, cy, r, cls, text, tc) => { const g = mkNode("g"); g.appendChild(mkNode("circle", { class: "vz-node " + (cls || "") })); if (text !== undefined && text !== null) g.appendChild(mkNode("text", { class: "vz-text " + (tc || "") }, text)); return g; },
  text: (x, y, s, cls, a) => mkNode("text", { class: "vz-text " + (cls || ""), "text-anchor": a || "start" }, s),
  label: (x, y, s, a) => mkNode("text", { class: "vz-label", "text-anchor": a || "start" }, s),
  line: (a, b, c, d, cls) => mkNode("line", { class: "vz-edge " + (cls || "") }),
  path: (d, cls) => mkNode("path", { class: "vz-edge " + (cls || "") }),
  defs: (svg) => { const d = mkNode("defs"); svg.insertBefore(d, svg.firstChild); return svg; },
  tree: () => mkNode("svg"),
};

const BASES = ["vz-box", "vz-node", "vz-edge", "vz-text", "vz-label"];
/** 把一个节点的 class 拆成 "基类" 与 "基类.状态"（CSS 里就是这么匹配的） */
function harvestNode(node, set) {
  const toks = String(node._cls || "").split(/\s+/).filter(Boolean);
  for (const t of toks) if (t.startsWith("vz-")) set.add(t);   // 独立类，如 vz-bucket / vz-dot
  const base = toks.find((t) => BASES.includes(t));
  if (base) {
    for (const t of toks) if (t !== base) set.add(base + "." + t);
  }
  for (const c of node.children) harvestNode(c, set);
}

/* ============================ 跑一个 viz 脚本，收集实际用到的类 ============================ */
function classesUsedBy(file) {
  const used = new Set();
  const collected = [];
  const hosts = {};
  const document = {
    getElementById(id) {
      if (!hosts[id]) hosts[id] = { id, children: [], style: {}, classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} }, appendChild(c) { this.children.push(c); return c; }, setAttribute() {}, getAttribute() { return null; } };
      return hosts[id];
    },
    createElement: () => mkNode("div"), createElementNS: (ns, t) => mkNode(t),
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
  };
  function Viz(root, opts) {
    const host = typeof root === "string" ? document.getElementById(root) : root;
    const res = opts && typeof opts.build === "function" ? opts.build({ frame() {}, svg: (w, h) => mkNode("svg", { width: w, height: h }) }) : null;
    collected.push((res && res.frames) || []);
  }
  const sandbox = {
    DS: { Viz, SVG, get: () => undefined, $: () => null, $$: () => [] },
    document, window: { innerWidth: 1400, addEventListener() {} }, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  sandbox.window.document = document;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  for (const frames of collected) for (const fr of frames) { try { harvestNode(fr.draw(SVG), used); } catch (e) { /* 单帧画失败不影响类名收集 */ } }
  return used;
}

/* ============================ course.css 里定义了哪些类 ============================ */
function harvest(cssText, onlyVz) {
  const set = new Set();
  const re = onlyVz ? /\.(vz-[a-z-]+)(?:\.([a-z0-9-]+))?/g : /\.([a-z][a-z0-9-]*)(?:\.([a-z0-9-]+))?/g;
  for (const m of cssText.matchAll(re)) set.add(m[2] ? m[1] + "." + m[2] : m[1]);
  return set;
}
const defined = harvest(fs.readFileSync(CSS, "utf8"), true);

/** 各页 <style> 里定义的类（只用于放行「页内自有的非 vz- 类」，例如 ch02 的 .ptr-cur） */
const pageDefined = new Map();      // 章前缀（ch02）→ Set(类名)
for (const f of fs.readdirSync(ROOT).filter((x) => /^ch\d\d-.*\.html$/.test(x))) {
  const pre = f.slice(0, 4);
  const t = fs.readFileSync(path.join(ROOT, f), "utf8");
  const set = pageDefined.get(pre) || new Set();
  for (const sm of t.matchAll(/<style>([\s\S]*?)<\/style>/g)) for (const c of harvest(sm[1], false)) set.add(c);
  pageDefined.set(pre, set);
}

/**
 * 判断一个运行时类是否「有样式」。
 *   · 复合类 vz-box.warn：必须在 course.css 里定义 —— 页内打补丁不算数（SPEC 第 0 节）。
 *   · 复合类 vz-text.ptr-cur：允许裸类 .ptr-cur 定义在**本页**（页内自有的装饰类）。
 */
function isDefined(cls, pagePre) {
  if (defined.has(cls)) return true;
  const dot = cls.indexOf(".");
  if (dot < 0) return false;
  const bare = cls.slice(dot + 1);
  if (defined.has(bare)) return true;
  const page = pageDefined.get(pagePre);
  return !!(page && page.has(bare));
}

/* ============================ 主流程 ============================ */
const files = fs.readdirSync(JS_DIR).filter((f) => /^ch\d\d-viz\.js$/.test(f)).sort();
let bad = 0, totalClasses = 0;
const allUsed = new Map();      // class → Set(脚本名)

console.log("动画状态类检查：脚本运行时实际产生的 vz-* 类是否都在 course.css 里有定义\n");
console.log(`course.css 已定义 ${defined.size} 个类\n`);

for (const f of files) {
  let used;
  try { used = classesUsedBy(path.join(JS_DIR, f)); }
  catch (e) { console.log(`✗ ${f}  执行失败: ${e.message}`); bad++; continue; }
  /* 一个类算「有定义」的条件：course.css 里写了 .vz-box.warn 这种复合选择器，
     或者写了 .ptr-cur / .vz-label 这种单类选择器 —— 两者都能给元素上样式
     （元素的 class 列表里本来就有 vz-text，所以 .ptr-cur 一样命中）。 */
  const pagePre = f.slice(0, 4);
  const missing = [...used].filter((c) => !isDefined(c, pagePre)).sort();
  for (const c of used) { if (!allUsed.has(c)) allUsed.set(c, new Set()); allUsed.get(c).add(f); }
  if (missing.length) { bad++; console.log(`✗ ${f.padEnd(14)} 缺定义: ${missing.join(", ")}`); }
  else console.log(`✓ ${f.padEnd(14)} 用到 ${used.size} 个类，全部有定义`);
}

const usedButUndefined = [...allUsed.keys()].filter((c) => {
  const owners = [...allUsed.get(c)];
  return !owners.some((o) => isDefined(c, o.slice(0, 4)));
}).sort();
const neverUsed = [...defined].filter((c) => !allUsed.has(c) && !allUsed.has(c.slice(c.indexOf(".") + 1)));
console.log("\n" + "═".repeat(66));
if (usedButUndefined.length) {
  console.log(`✗ 有 ${usedButUndefined.length} 个类被脚本用到但 course.css 里没有定义：`);
  for (const c of usedButUndefined) console.log(`  - ${c}    （用于 ${[...allUsed.get(c)].join(", ")}）`);
  console.log("\n修法：把这些状态类补进 assets/css/course.css（不要在页面里打补丁 —— 页内补丁只会让没补的章缺样式）。");
} else {
  console.log(`✓ 全部 ${allUsed.size} 个 vz-* 类都在 course.css 里有定义`);
}
console.log(`（course.css 里另有 ${neverUsed.length} 个类当前没被用到，属正常储备：${neverUsed.join(", ") || "无"}）`);
process.exit(bad ? 1 : 0);
