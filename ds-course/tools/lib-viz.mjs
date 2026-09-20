#!/usr/bin/env node
/**
 * lib-viz.mjs —— 「在 Node 里跑动画脚本」的公共底座（供 frame-check / vz-check / verify-stats 复用）
 *
 * 为什么需要它：要检查动画，必须真的把 chNN-viz.js 跑起来，这需要三样东西垫在下面：
 *   1) 一个**记录型假 SVG**（DS.SVG 的替身）—— 不生成真 DOM，只把每次画的东西记成节点树，
 *      之后可以序列化成字符串来比较；
 *   2) 一个**最小 document / window** —— 脚本一开头就 getElementById 取容器、取不到就 return，
 *      所以必须为每个 id 返回一个假容器，动画才会被建出来；
 *   3) 一个 **vm 沙箱** —— 让脚本在独立 realm 里跑，互不污染，也便于装钩子。
 *
 * 三个使用方各自关心不同的事：
 *   · frame-check.mjs  —— 逐帧比「push 那一刻」与「build 结束后」画的是不是同一个东西
 *   · vz-check.mjs     —— 收集运行时出现的 vz-* 类名，核对 course.css 里有没有定义
 *   · verify-stats.mjs —— 数动画个数与总帧数，核对 README 里的公开数字
 *
 * ⚠ 踩过的坑（改这里之前先看）：
 *   · 千万不要把宿主的 Array / Object / JSON 等内建对象注入沙箱。注进去会让
 *     `Array.prototype.push` 指向**宿主**的原型，而脚本里 `[]` 用的是**沙箱 realm 自己**的
 *     Array.prototype —— 于是钩子装上了却永远不会被调用。vm 上下文自带全套内建对象，不用注入。
 *   · 钩子必须在沙箱**内部**用 `[].constructor.prototype` 取到本 realm 的 Array.prototype 再替换。
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/** 仓库根（ds-course/）与动画脚本目录 */
export const ROOT = path.resolve(import.meta.dirname, "..");
export const JS_DIR = path.join(ROOT, "assets/js");

/** 列出全部章节动画脚本（排序后，输出稳定） */
export function allVizFiles() {
  return fs.readdirSync(JS_DIR).filter((f) => /^ch\d\d-viz\.js$/.test(f)).sort();
}

/* ============================ 记录型假 SVG ============================ */
/**
 * 造一个「假 DOM 节点」：只记名字、属性、文字和孩子，不涉及真实渲染。
 * @param {string} name  标签名（svg / g / rect / circle / text / line / path / defs / marker …）
 * @param {object} attrs 属性表；class 会被单独记到 _cls 上，方便按类名查找
 * @param {*} text       文本内容（仅 <text> 用）
 */
export function mkNode(name, attrs, text) {
  const n = {
    name,
    attrs: Object.assign({}, attrs || {}),
    text: text === undefined || text === null ? null : String(text),
    children: [],
    style: {},
    _cls: (attrs && attrs["class"]) || "",          // 当前 class（setAttribute 改 class 时同步）
    appendChild(c) {
      if (c && c.__frag) { c.children.forEach((x) => this.appendChild(x)); return c; }   // 支持 DocumentFragment
      this.children.push(c); return c;
    },
    insertBefore(c) { this.children.unshift(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this._cls = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    hasAttribute(k) { return k in this.attrs; },
    cloneNode() { return this; },
    /* 极简选择器：只支持 ".class" 与 "tag"（课程脚本里只用到这两种） */
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
  Object.defineProperty(n, "firstChild", { get() { return this.children[0] || null; } });   // SVG.defs 会用它
  return n;
}

/** DS.SVG 的替身：接口与 assets/js/course.js 里的 DS.SVG 一一对应 */
export const SVG = {
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

/* ============================ 把一帧序列化成可比较的字符串 ============================ */
/**
 * 完整序列化一帧画面：**文字 + 颜色类**。
 * frame-check 的 t0/t1 比较用它 —— 只比文字会漏掉「纯换高亮」的差异，所以类名必须一起比。
 */
export function renderAll(node) {
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

/** 只要文字（--dump 打印、以及 frame-check 的文本启发式兜底用） */
export function textsOf(node) {
  const out = [];
  const walk = (n) => {
    if (n.name === "text" && n.text !== null) { const s = String(n.text).trim(); if (s) out.push(s); }
    for (const c of n.children) walk(c);
  };
  walk(node);
  return out.join("|");
}

/* ============================ 在沙箱里跑一个动画脚本 ============================ */
/**
 * 执行一个 chNN-viz.js，把它建出来的每个动画（容器 id、标题、帧数组）收集回来。
 *
 * @param {string} file  脚本的绝对路径
 * @param {boolean} hook true = 给沙箱的 Array.prototype.push 装钩子：
 *                       帧被 push 进数组的**那一刻**立刻渲染一次，结果存进返回值的 t0
 *                       （frame-check 的精确判据就靠它 —— push 时画一次、build 结束后再画一次，
 *                        两次不同即说明 draw 读了「push 之后还会被改写的活变量」）
 * @returns {{collected: Array<{id,title,frames}>, t0: Map<object,string>}}
 */
export function loadViz(file, hook) {
  const collected = [];
  const t0 = new Map();          // frame 对象 → push 时刻的画面（仅 hook=true 时有内容）
  const hosts = {};              // id → 假容器，保证 getElementById 永远有得返回

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

  /** DS.Viz 的替身：只把 build() 跑完并收下 frames，不做任何渲染 */
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
    /* 注意：**不要**把宿主的 Array / Object / JSON 等内建对象注入进来，理由见文件头。 */
  };
  sandbox.window.document = document;

  if (hook) {
    /* __onFramePushed —— 帧刚 push 进数组时，趁算法还停在那一帧的现场立刻画一次。
       画挂了就存一个带 \u0000 的哨兵串，后面比对时自然不相等 → 会被报出来。 */
    sandbox.__onFramePushed = (f) => {
      try { t0.set(f, renderAll(f.draw(SVG))); } catch (e) { t0.set(f, "\u0000ERR:" + e.message); }
    };
  }

  vm.createContext(sandbox);
  if (hook) {
    vm.runInContext(`(function(){
      var proto = [].constructor.prototype;   /* 本 realm 的 Array.prototype（不是宿主的） */
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

/**
 * 便利函数：把所有动画脚本跑一遍，汇总「动画个数」与「总帧数」。
 * verify-stats.mjs 用它核对 README 里的公开数字。
 * @returns {{anims:number, frames:number, perFile:Array<{file,anims,frames}>}}
 */
export function countAll() {
  let anims = 0, frames = 0;
  const perFile = [];
  for (const f of allVizFiles()) {
    const { collected } = loadViz(path.join(JS_DIR, f), false);
    const nf = collected.reduce((s, v) => s + v.frames.length, 0);
    anims += collected.length;
    frames += nf;
    perFile.push({ file: f, anims: collected.length, frames: nf });
  }
  return { anims, frames, perFile };
}
