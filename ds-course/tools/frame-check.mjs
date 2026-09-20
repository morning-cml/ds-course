#!/usr/bin/env node
/**
 * frame-check.mjs —— 检测动画「画面冻结在最终态」
 *
 * 为什么需要它（2026-09 新增）：
 *   course.js 的 DS.Viz 构造器会先**同步跑完** opts.build()（整个算法执行完、
 *   把所有帧 push 进 frames），之后才 go(0) 渲染第 0 帧。
 *   如果某一帧的 draw 闭包直接读算法过程中被改写的**活变量**（而不是在推帧时
 *   深拷贝一份快照），那么渲染时算法早已结束 —— 每一帧画出来的都是最终状态，
 *   只有 frame 参数驱动的高亮颜色会变。表现是「第 0 帧写着『初始化』，画面却是
 *   完成图」。
 *
 *   dom-sim.mjs 抓不到这种问题：它只验证 draw 不抛异常、画布非空、desc 非空。
 *
 * 判定方法（精确法，主判据）：
 *   同一个动画跑两遍：
 *     · 第一遍正常跑，拿到 frames，build 结束后逐帧渲染 → t1
 *     · 第二遍给 Array.prototype.push 装钩子：帧被 push 进数组的**那一刻**立刻
 *       渲染一次 → t0
 *   如果某帧 t0 === t1，说明它的画面只依赖「push 时就已经确定的东西」，健康；
 *   **t0 ≠ t1 就说明 draw 读了 push 之后还会被改写的活变量** —— 该帧画的是
 *   最终态，实锤。
 *   两遍的帧数与 desc 必须一致，否则说明「提前渲染」干扰了算法本身
 *   （draw 有副作用），此时退回下面的文本启发式并明确标注「无法判定」。
 *
 * 判定方法（启发式，仅在精确法不可用时兜底）：
 *   相邻两帧「画面文本完全相同、但 desc 不同」的比例过高 → 疑似冻结。
 *   ⚠ 这个启发式**只比较 <text> 文字、忽略颜色**，所以「纯高亮动画」
 *   （每帧只移动聚光灯、文字不变）会被误判，而「只有一小部分数据冻结」
 *   （局部冻结）又会被漏判 —— 这正是要用精确法做主判据的原因。
 *
 * 用法：
 *   node tools/frame-check.mjs                 # 检查全部，失败则退出码 1
 *   node tools/frame-check.mjs ch09-viz.js     # 只检查某个脚本
 *   node tools/frame-check.mjs --report        # 打印每个动画的详细指标
 *   node tools/frame-check.mjs --dump viz-prim ch09-viz.js
 *                                              # 打印某动画若干帧真正画出来的文字
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const JS_DIR = path.join(ROOT, "assets/js");

/* ============================ 记录型假 SVG ============================ */
function mkNode(name, attrs, text) {
  const n = {
    name,
    attrs: Object.assign({}, attrs || {}),
    text: text === undefined || text === null ? null : String(text),
    children: [],
    style: {},
    _cls: (attrs && attrs["class"]) || "",
    appendChild(c) {
      if (c && c.__frag) { c.children.forEach((x) => this.appendChild(x)); return c; }
      this.children.push(c); return c;
    },
    insertBefore(c) { this.children.unshift(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this._cls = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    hasAttribute(k) { return k in this.attrs; },
    cloneNode() { return this; },
    querySelector(sel) {
      const isCls = String(sel).startsWith(".");
      const want = String(sel).replace(/^\./, "");
      const walk = (node) => {
        for (const ch of node.children) {
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
  el: (name, attrs, text) => mkNode(name, attrs, text),
  svg: (w, h) => mkNode("svg", { width: w, height: h }),
  box: (x, y, w, h, cls, text, textCls) => {
    const g = mkNode("g");
    g.appendChild(mkNode("rect", { x, y, width: w, height: h, class: "vz-box " + (cls || "") }));
    if (text !== undefined && text !== null) g.appendChild(mkNode("text", { class: "vz-text " + (textCls || "") }, text));
    return g;
  },
  circle: (cx, cy, r, cls, text, textCls) => {
    const g = mkNode("g");
    g.appendChild(mkNode("circle", { cx, cy, r, class: "vz-node " + (cls || "") }));
    if (text !== undefined && text !== null) g.appendChild(mkNode("text", { class: "vz-text " + (textCls || "") }, text));
    return g;
  },
  text: (x, y, str, cls, anchor) => mkNode("text", { x, y, class: "vz-text " + (cls || ""), "text-anchor": anchor || "start" }, str),
  label: (x, y, str, anchor) => mkNode("text", { x, y, class: "vz-label", "text-anchor": anchor || "start" }, str),
  line: (x1, y1, x2, y2, cls, arrow) => mkNode("line", { x1, y1, x2, y2, class: "vz-edge " + (cls || ""), "marker-end": arrow ? "url(#vz-arrow)" : null }),
  path: (d, cls, arrow) => mkNode("path", { d, class: "vz-edge " + (cls || ""), "marker-end": arrow ? "url(#vz-arrow)" : null }),
  defs: (svg) => {
    const defs = mkNode("defs");
    defs.appendChild(mkNode("marker", { id: "vz-arrow" }));
    defs.appendChild(mkNode("marker", { id: "vz-arrow-a" }));
    svg.insertBefore(defs, svg.firstChild);
    return svg;
  },
  tree: () => mkNode("svg"),
};

/** 完整序列化一帧画面：文字 + 颜色类（t0/t1 比较用这个，纯高亮差异也算「变了」） */
function renderAll(node) {
  let out = "";
  const walk = (n) => {
    if (n.name === "rect" || n.name === "circle") out += `${n.name}[${(n.attrs["class"] || "").trim()}];`;
    else if (n.name === "text") out += `T("${n.text}")[${(n.attrs["class"] || "").trim()}];`;
    else if (n.name === "line" || n.name === "path") out += `${n.name}[${(n.attrs["class"] || "").trim()}];`;
    for (const c of n.children) walk(c);
  };
  walk(node);
  return out;
}

/** 只要文字（--dump 与文本启发式用） */
function textsOf(node) {
  const out = [];
  const walk = (n) => {
    if (n.name === "text" && n.text !== null) { const s = String(n.text).trim(); if (s) out.push(s); }
    for (const c of n.children) walk(c);
  };
  walk(node);
  return out.join("|");
}

/* ============================ 加载一个 viz 脚本 ============================ */
/**
 * @param file  脚本路径
 * @param hook  true = 给 Array.prototype.push 装钩子，在 push 那一刻立刻渲染（t0）
 */
function loadViz(file, hook) {
  const collected = [];
  const t0 = new Map();          // frame 对象 → push 时刻的画面
  const hosts = {};
  const document = {
    getElementById(id) {
      if (!hosts[id]) {
        hosts[id] = {
          id, _viz: null, children: [], style: {},
          classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
          appendChild(c) { this.children.push(c); return c; },
          setAttribute() {}, getAttribute() { return null; },
        };
      }
      return hosts[id];
    },
    createElement: () => mkNode("div"),
    createElementNS: (ns, t) => mkNode(t),
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  function Viz(root, opts) {
    const host = typeof root === "string" ? document.getElementById(root) : root;
    const res = opts && typeof opts.build === "function"
      ? opts.build({ frame() {}, svg: (w, h) => mkNode("svg", { width: w, height: h }) })
      : null;
    collected.push({
      id: host ? host.id : "(?)",
      title: (opts && opts.title) || "",
      frames: (res && res.frames) || [],
    });
  }

  const sandbox = {
    DS: {
      Viz, SVG,
      get: (o, p, d) => { const parts = String(p).split("."); let cur = o; for (const k of parts) { if (cur == null) return d; cur = cur[k]; } return cur === undefined ? d : cur; },
      $: () => null, $$: () => [],
    },
    document,
    window: { innerWidth: 1400, addEventListener() {} },
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    /* 注意：不要把宿主的 Array / Object / JSON 等内建对象注入进来。
       注进来会让 `Array.prototype.push` 指向**宿主**的原型，而脚本里 `[]` 这类
       数组字面量用的是**沙箱 realm 自己**的 Array.prototype —— 于是钩子装上了却
       永远不会被调用（2026-09 踩过这个坑）。vm 上下文自带全套内建对象，不需要注入。 */
  };
  sandbox.window.document = document;
  if (hook) {
    /* __onFramePushed —— 钩子回调：帧刚被 push 进数组时，趁算法还在这一帧的现场立刻画一次，
       结果按「帧对象」存进 t0（Map 用对象身份做键，跨 vm 边界仍是同一个引用）。
       画挂了就存一个带 \u0000 的哨兵串，后面比对时自然不相等 → 会被报出来。 */
    sandbox.__onFramePushed = (f) => {
      try { t0.set(f, renderAll(f.draw(SVG))); } catch (e) { t0.set(f, "\u0000ERR:" + e.message); }
    };
  }
  vm.createContext(sandbox);
  if (hook) {
    /* 在沙箱里替换 Array.prototype.push：原样调用原 push，再对新增的每一项看看
       是不是「帧」（有 draw 函数），是就叫回调。
       必须在沙箱**内部**取 [].constructor.prototype —— 见上面那段注释的坑。 */
    vm.runInContext(`(function(){
      var proto = [].constructor.prototype;   /* 本 realm 的 Array.prototype */
      var orig = proto.push;
      proto.push = function () {
        var r = orig.apply(this, arguments);
        for (var i = 0; i < arguments.length; i++) {
          var f = arguments[i];
          if (f && typeof f.draw === "function") { try { __onFramePushed(f); } catch (e) {} }
        }
        return r;
      };
    })();`, sandbox, { filename: "frame-hook" });
  }
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return { collected, t0 };
}

/* ============================ 文本启发式阈值 ============================ */
/* 由 --report 在 81 个动画上校准过：健康动画普遍 < 0.6，纯高亮动画可到 1.0。
   因此这个阈值只用于「精确法不可用」时兜底 + 提示，不做主判据。 */
const HEUR_WARN = 0.6;    // 相邻帧「文本不动但 desc 不同」的比例 ≥ 此值 → 判警告
const MIN_PAIRS = 5;      // 相邻帧对少于这么多就不判（帧太少，比例没有统计意义）

/* ============================ 主流程 ============================ */
const args = process.argv.slice(2);
const REPORT = args.includes("--report");            // 只打印每个动画的指标（用于校准阈值）
const only = args.filter((a) => !a.startsWith("--")); // 命令行里给的脚本名（限定只检查这几个）

/* --fingerprint：把每个动画每一帧真正画出来的内容（文字 + 颜色类）算成一个指纹。
   用途：只改注释/重构、不该改变渲染结果时，前后各跑一次比对指纹，
        指纹一致就证明「行为没变」。 */
if (args.includes("--fingerprint")) {
  const files2 = fs.readdirSync(JS_DIR).filter((f) => /^ch\d\d-viz\.js$/.test(f)).sort();
  const total = crypto.createHash("sha256");
  for (const f of files2) {
    const perFile = crypto.createHash("sha256");
    let vizzes;
    try { vizzes = loadViz(path.join(JS_DIR, f), false).collected; }
    catch (e) { console.log(`${f}  <执行失败: ${e.message}>`); continue; }
    let frames = 0;
    for (const v of vizzes) {
      perFile.update(v.id + "\u0001");
      for (const fr of v.frames) {
        frames++;
        perFile.update(String(fr.desc) + "\u0002");
        try { perFile.update(renderAll(fr.draw(SVG))); } catch (e) { perFile.update("ERR:" + e.message); }
        perFile.update("\u0003");
      }
    }
    const h = perFile.digest("hex").slice(0, 16);
    total.update(f + ":" + h + "\u0004");
    console.log(`${f.padEnd(16)} 动画 ${String(vizzes.length).padStart(2)} 帧 ${String(frames).padStart(4)}  指纹 ${h}`);
  }
  console.log("\n总指纹 " + total.digest("hex").slice(0, 32));
  process.exit(0);
}

/* --dump <viz-id> <脚本名> */const dumpIdx = args.indexOf("--dump");
if (dumpIdx >= 0) {
  const wantId = args[dumpIdx + 1];
  const fileArg = args[dumpIdx + 2] || null;
  const files = (fileArg ? [fileArg] : fs.readdirSync(JS_DIR).filter((f) => /^ch\d\d-viz\.js$/.test(f)))
    .map((f) => path.join(JS_DIR, path.basename(f)));
  let found = false;
  for (const file of files) {
    for (const v of loadViz(file, false).collected) {
      if (v.id !== wantId) continue;
      found = true;
      const n = v.frames.length;
      const picks = [...new Set([0, 1, Math.floor(n / 2), n - 1])].filter((p) => p >= 0 && p < n);
      console.log(`### ${path.basename(file)} :: ${wantId}　共 ${n} 帧`);
      for (const p of picks) {
        console.log(`\n----- 第 ${p} 帧 -----`);
        console.log("  desc: " + String(v.frames[p].desc).replace(/<[^>]+>/g, ""));
        console.log("  画面: " + textsOf(v.frames[p].draw(SVG)).split("|").join(" · "));
      }
    }
  }
  if (!found) { console.log("找不到动画 " + wantId); process.exit(2); }
  process.exit(0);
}

const files = (only.length ? only : fs.readdirSync(JS_DIR).filter((f) => /^ch\d\d-viz\.js$/.test(f)).sort())
  .map((f) => path.join(JS_DIR, path.basename(f)));

/* 总计与三份清单，供最后汇总打印 */
let totalViz = 0;               // 检查过的动画总数
let fails = 0;                  // 判失败的动画数（有冻结帧 / 执行失败）
let warns = 0;                  // 判警告的动画数（仅启发式下可能出现）
let undecided = 0;              // 精确法不可用、退回启发式的脚本数
const failList = [], warnList = [], undecidedList = [];

console.log("动画帧状态检查（精确法：push 时刻 vs build 结束后，同一帧画出来是否相同）\n");

for (const file of files) {
  const base = path.basename(file);
  /* plain  —— 正常跑一遍：拿去和 t0 比，得到「渲染时是不是已经变了」
     hooked —— 装了 push 钩子跑一遍：提供 t0（push 那一刻的画面） */
  let plain, hooked;
  try { plain = loadViz(file, false); }
  catch (e) { console.log(`✗ ${base}  执行失败: ${e.message}`); fails++; failList.push(`${base} 执行失败`); continue; }

  const rows = [];              // 本脚本每个动画的结果行，供 --report 或摘要打印
  let useExact = true;          // 精确法是否可用；一旦发现干扰就置 false，改用启发式
  let exactNote = "";           // 不可用的原因，会打印出来
  try { hooked = loadViz(file, true); }
  catch (e) { useExact = false; exactNote = "装钩子后执行失败: " + e.message; }

  if (useExact) {
    /* 自检：两遍的帧数与 desc 必须一致。
       「提前渲染」若改了算法状态（draw 有副作用），帧数就会变 —— 那种情况下 t0 不可信，必须退回启发式。 */
    const hp = new Map(hooked.collected.map((v) => [v.id, v]));
    for (const v of plain.collected) {
      const h = hp.get(v.id);
      if (!h || h.frames.length !== v.frames.length ||
          v.frames.some((f, i) => String(f.desc) !== String(h.frames[i].desc))) {
        useExact = false;
        exactNote = `动画 ${v.id} 的帧数/desc 在两次运行间不一致（draw 可能有副作用）`;
        break;
      }
    }
  }

  for (const v of plain.collected) {
    totalViz++;
    const n = v.frames.length;
    if (n < 2) { rows.push([v.id, n, "—", "—", "skip"]); continue; }   // 单帧图无从判断

    if (useExact) {
      /* ---- 精确法：逐帧比 t0 与 t1 ----
         frozen —— 画的是最终态的帧数（本工具要抓的就是它）
         nondet —— 同一帧连画两次结果都不同（画面本身不确定），这类帧跳过不判，避免误报 */
      const h = hooked.collected.find((x) => x.id === v.id);
      let frozen = 0, nondet = 0;
      const samples = [];       // 记几个冻结帧的下标，报错时给出例子
      for (let i = 0; i < n; i++) {
        const f = v.frames[i];
        const t1a = safeRender(f);
        const t1b = safeRender(f);
        if (t1a === null) continue;                       // 这一帧画不出来（另有 draw 抛异常的检查管）
        if (t1a !== t1b) { nondet++; continue; }          // 画面本身不确定，跳过
        const t0v = hooked.t0.get(h.frames[i]);           // 注意取的是 hooked 那一遍的帧对象（键就是它）
        if (t0v === undefined) continue;
        if (t0v !== t1a) { frozen++; if (samples.length < 4) samples.push(i); }
      }
      const st = frozen > 0 ? "fail" : "ok";
      if (st === "fail") {
        fails++;
        failList.push(`${base} ${v.id}（${frozen}/${n} 帧画的是最终态，例如第 ${samples.join("、")} 帧）`);
      }
      rows.push([v.id, n, frozen + "/" + n, nondet ? "不确定 " + nondet : "—", st]);
    } else {
      /* ---- 文本启发式兜底：只看文字，忽略颜色 ----
         texts/descs —— 每一帧的「文字签名」与描述；same/pairs 统计「文字没变但描述变了」的比例 */
      const texts = [], descs = [];
      let bad = null;           // 第一帧画失败的帧号
      for (let i = 0; i < n; i++) {
        const t = safeRender(v.frames[i]);
        if (t === null) { bad = i; break; }
        texts.push(textsOf(v.frames[i].draw(SVG)));
        descs.push(String(v.frames[i].desc === undefined ? "" : v.frames[i].desc));
      }
      if (bad !== null) {
        fails++; failList.push(`${base} ${v.id} 第 ${bad} 帧 draw 抛异常`);
        rows.push([v.id, n, "—", "—", "err"]);
        continue;
      }
      let same = 0, pairs = 0;
      for (let i = 1; i < n; i++) { pairs++; if (texts[i] === texts[i - 1] && descs[i] !== descs[i - 1]) same++; }
      const ratio = pairs ? same / pairs : 0;
      const st = (pairs >= MIN_PAIRS && ratio >= HEUR_WARN) ? "warn" : "ok";
      if (st === "warn") { warns++; warnList.push(`${base} ${v.id}（${(ratio * 100).toFixed(0)}%，启发式）`); }
      rows.push([v.id, n, (ratio * 100).toFixed(0) + "%", "启发式", st]);
    }
  }

  if (!useExact) { undecided++; undecidedList.push(`${base}：${exactNote}`); }

  if (REPORT) {
    console.log("── " + base + (useExact ? "" : "　（精确法不可用，已退回文本启发式）"));
    for (const r of rows) {
      console.log(`   ${String(r[0]).padEnd(22)} 帧=${String(r[1]).padStart(3)}  ` +
        (useExact ? "冻结帧=" + String(r[2]).padStart(7) : "文本不动=" + String(r[2]).padStart(4)) +
        `  其它=${String(r[3]).padStart(8)}  ${r[4]}`);
    }
  } else {
    /* 摘要行：✓ 全好 / ! 只有警告或无法判定 / ✗ 有冻结 */
    const bad = rows.filter((r) => r[4] === "fail" || r[4] === "err");
    const wn = rows.filter((r) => r[4] === "warn");
    const mark = bad.length ? "✗" : (wn.length || !useExact ? "!" : "✓");
    console.log(`${mark} ${base.padEnd(16)} 动画 ${rows.length} 个` +
      (bad.length ? `  冻结 ${bad.length}: ` + bad.map((r) => r[0] + "(" + r[2] + ")").join(", ") : "") +
      (wn.length ? `  警告 ${wn.length}: ` + wn.map((r) => r[0] + "(" + r[2] + ")").join(", ") : "") +
      (!useExact ? `  ⚠ 精确法不可用，退回启发式：${exactNote}` : ""));
  }
}

function safeRender(f) {
  try { return renderAll(f.draw(SVG)); } catch (e) { return null; }
}

console.log("\n" + "═".repeat(66));
console.log(`共检查 ${totalViz} 个动画：冻结 ${fails} 个，警告 ${warns} 个` +
  (undecided ? `，${undecided} 个脚本只能用启发式` : ""));
if (!REPORT) {
  if (fails) {
    console.log("\n冻结清单（这些帧的 draw 读了 push 之后会被改写的活变量，画的是最终态）：");
    failList.forEach((f) => console.log("  - " + f));
    console.log("\n修法：在推帧时把该帧要画的状态**深拷贝**进闭包（如 A.slice()、JSON.parse(JSON.stringify(x))），");
    console.log("      不要直接读算法过程中会被改写的变量。详见 SPEC 第 5.7 节。");
  }
  if (warns) {
    console.log("\n警告清单（启发式判据，请人工确认）：");
    warnList.forEach((f) => console.log("  - " + f));
  }
  if (undecidedList.length) {
    console.log("\n下列脚本无法用精确法判定（提前渲染会干扰算法，说明 draw 有副作用）：");
    undecidedList.forEach((f) => console.log("  - " + f));
  }
  if (!fails && !warns && !undecided) console.log("\n所有动画的每一帧都画「当时」的状态 ✅");
}
process.exit(fails ? 1 : 0);
