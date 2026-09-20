#!/usr/bin/env node
/**
 * dom-sim.mjs —— 无浏览器环境下的页面脚本仿真器
 *
 * 为什么需要它：本机无法运行无头 Chrome（crashpad 崩溃），
 * 而静态语法检查抓不到「脚本在真实 DOM 上跑起来会不会报错」。
 * 于是这里手写一个最小 DOM 垫片，把页面的 <script> 按顺序真正执行一遍，
 * 并且**把所有动画的每一帧都渲染一遍**，任何运行时错误都会当场暴露。
 *
 * 用法：node tools/dom-sim.mjs [页面文件名...]
 *   不带参数则检查全部 HTML 页面。
 *
 * 退出码：0 = 所有页面仿真通过；1 = 至少 1 个页面有问题
 *        （脚本运行时异常 / viz 容器未挂载 / 动画帧渲染失败 / 帧无描述 / 画布为空 /
 *          导航抽屉用例不通过 / 仿真器自身抛异常）
 * 环境变量 DS_DEBUG=1 时额外打印 body 结构等调试信息。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/* ============================ 最小 DOM 垫片 ============================ */
/**
 * 判断单个元素是否匹配一条**简单选择器**。
 * 支持：#id、.class、tag、[attr]、[attr="v"]，以及它们的任意拼接（如 div.viz.active）
 * 不支持：伪类 / 伪元素（:hover、:nth-child…）、> + ~ 组合符、通配符 *、属性选择器的 ^= $= *= 等运算符、
 *        大小写不敏感匹配、命名空间 —— 课程脚本用不到，命中不了就返回 false（不会抛错）。
 * @param {FakeElement} el  待判定元素
 * @param {string} sel      选择器片段（调用方已按空格 / 逗号切分）
 */
function matches(el, sel) {
  sel = sel.trim();
  if (!sel) return false;
  // 支持 .cls  #id  tag  [attr]  [attr="v"]
  const parts = sel.match(/(^[a-zA-Z][\w-]*)|(\.[\w-]+)|(#[-\w]+)|(\[[^\]]+\])/g);
  if (!parts) return false;
  for (const p of parts) {
    if (p[0] === ".") {
      if (!el.classList || !el.classList.contains(p.slice(1))) return false;
    } else if (p[0] === "#") {
      if (el.getAttribute("id") !== p.slice(1)) return false;
    } else if (p[0] === "[") {
      const inner = p.slice(1, -1);
      const eq = inner.indexOf("=");
      if (eq < 0) { if (el.getAttribute(inner) === null) return false; }
      else {
        const name = inner.slice(0, eq);
        const val = inner.slice(eq + 1).replace(/^["']|["']$/g, "");
        if (el.getAttribute(name) !== val) return false;
      }
    } else if (el.tagName !== p.toUpperCase()) return false;
  }
  return true;
}

/**
 * 在 root 子树里收集所有匹配 selector 的元素（等价于 querySelectorAll）。
 * 支持：逗号分组、空格分隔的「祖先 后代」层级；单个片段交给 matches() 判定。
 * 不支持：子代选择器 >、兄弟选择器 + ~、伪类伪元素；层级匹配是「宽松」的
 *         （祖先链上跳过不匹配的中间层，不要求逐级严格相邻）。
 * 返回的是数组（非 NodeList），因此调用方要用 [...x] / .length，别指望 forEach 之外的 NodeList 特性。
 * @param {FakeElement} root     搜索根节点（本身不参与匹配）
 * @param {string} selector      选择器串，例如 ".toc-drawer-body a, #btnToc"
 */
function queryAll(root, selector) {
  const groups = selector.split(",").map(s => s.trim()).filter(Boolean);
  const out = [];
  const walk = (node) => {
    for (const ch of node.children) {
      for (const g of groups) {
        const segs = g.split(/\s+/);
        // 只支持「祖先 后代」与「后代 后代」形式
        if (segs.length === 1) {
          if (matches(ch, segs[0]) && !out.includes(ch)) out.push(ch);
        } else {
          let cur = ch, ok = true;
          for (let i = segs.length - 1; i >= 0; i--) {
            if (!cur || !matches(cur, segs[i])) { ok = false; break; }
            if (i === 0) break;
            cur = cur.parentNode;
            while (cur && cur !== root && !matches(cur, segs[i - 1])) cur = cur.parentNode;
          }
          if (ok && !out.includes(ch)) out.push(ch);
        }
      }
      walk(ch);
    }
  };
  walk(root);
  return out;
}

let uid = 0;   // 元素自增编号，仅用于内部区分（_uid），不参与页面逻辑
/**
 * 假元素：本垫片的核心。只实现课程脚本真正用到的那部分 DOM 接口。
 * 边界（后来人改课程脚本时必须知道）：
 *   · innerHTML 的 setter 是**极简解析**：只用正则扫 <tag ...>，只认 id="..." 与 class="..."，
 *     不建文本节点、不处理嵌套结构、不认注释与自闭合标签 —— 往 innerHTML 塞复杂 HTML 会失真；
 *   · 没有 offsetWidth/scrollHeight 等布局属性（getBoundingClientRect 恒返回 0）；
 *   · 事件不冒泡（fire 只在当前元素上跑监听器与 on* 属性处理器）；
 *   · getElementsByTagName 恒返回空数组；
 *   · 不支持的 CSS 选择器见 matches() 的说明。
 */
class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];        // 子元素数组（只放 FakeElement，不含文本节点）
    this.parentNode = null;
    this.attributes = {};      // 属性名 → 字符串值
    this.style = {};           // 仅作属性袋，不参与任何计算
    this.dataset = {};         // 由 data-* 属性同步写入（kebab-case 转 camelCase）
    this.textContent = "";
    this._html = "";           // innerHTML 的原始字符串（getter 直接回放）
    this._listeners = {};      // 事件名 → 监听函数数组
    this._uid = ++uid;
    const self = this;
    this.classList = {   // 假 classList：只维护一个 Set，够 contains/add/remove/toggle 用
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      contains(c) { return this._set.has(c); },
      toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); },
      get value() { return [...this._set].join(" "); },
    };
    // 允许 el.className = "a b"
    Object.defineProperty(this, "className", {
      get() { return self.classList.value; },
      set(v) { self.classList._set = new Set(String(v).split(/\s+/).filter(Boolean)); },
    });
    // innerHTML：getter 回放写入的原始字符串；setter 做极简解析（见类注释里的边界说明）
    Object.defineProperty(this, "innerHTML", {
      get() { return self._html; },
      set(v) {
        self._html = String(v);
        // 极简解析：只识别 id="..." 与 class="..."，够课程脚本用
        self.children = [];
        const re = /<([a-zA-Z][\w-]*)([^>]*)>/g;
        let m;
        while ((m = re.exec(self._html)) !== null) {
          const tag = m[1];
          if (tag === "br" || tag === "span" && /\/>$/.test(m[2])) { /* 忽略自闭合 */ }
          const e = new FakeElement(tag);
          const idm = m[2].match(/id\s*=\s*"([^"]*)"/);
          if (idm) e.setAttribute("id", idm[1]);
          const clm = m[2].match(/class\s*=\s*"([^"]*)"/);
          if (clm) e.className = clm[1];
          e.parentNode = self;
          self.children.push(e);
        }
      },
    });
  }
  setAttribute(n, v) {
    this.attributes[n] = String(v);
    if (n === "id") this.id = String(v);
    if (n === "class") this.className = String(v);
    if (n.startsWith("data-")) {
      const k = n.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[k] = String(v);
    }
  }
  getAttribute(n) { return n in this.attributes ? this.attributes[n] : null; }
  hasAttribute(n) { return n in this.attributes; }
  removeAttribute(n) { delete this.attributes[n]; }
  appendChild(c) {
    if (c && c.__fragment) { c.children.forEach(x => this.appendChild(x)); return c; }
    c.parentNode = this; this.children.push(c); return c;
  }
  insertBefore(c, ref) {
    c.parentNode = this;
    if (!ref) { this.children.push(c); return c; }
    const i = this.children.indexOf(ref);
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  replaceChild(nw, old) { const i = this.children.indexOf(old); if (i >= 0) { this.children[i] = nw; nw.parentNode = this; } return old; }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return this.parentNode.children[i + 1] || null;
  }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener() {}
  dispatchEvent() { return true; }
  querySelector(s) { return queryAll(this, s)[0] || null; }
  querySelectorAll(s) { return queryAll(this, s); }
  getElementsByTagName() { return []; }
  closest(sel) {
    let c = this;
    while (c && c.tagName) { if (matches(c, sel)) return c; c = c.parentNode; }
    return null;
  }
  fire(type, extra) {
    const ev = Object.assign({
      type, target: this, currentTarget: this,
      preventDefault() {}, stopPropagation() {}, closest: (s) => this.closest(s)
    }, extra || {});
    // 先跑 addEventListener 登记的，再跑 onclick / onmouseenter 这类属性处理器
    (this._listeners[type] || []).forEach(fn => { try { fn(ev); } catch (e) { throw e; } });
    const inline = this["on" + type];
    if (typeof inline === "function") inline.call(this, ev);
    return ev;
  }
  click() { return this.fire("click"); }
  cloneNode() {
    const e = new FakeElement(this.tagName);
    e.attributes = { ...this.attributes };
    e.className = this.className;
    e.textContent = this.textContent;
    return e;
  }
  insertAdjacentHTML() {}
  getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
}

/* ============================ 组装全局环境 ============================ */
/**
 * 造一个页面的全局环境（window / document 垫片）。垫片里各字段的存在理由：
 *   document.readyState="complete"  —— course.js 会据此判断是否还要等 DOMContentLoaded；
 *   body / head / documentElement   —— 脚本直接读写这几个属性，缺一个就报 undefined；
 *   document.* 的 createXxx 系列     —— 动画脚本用它造节点，必须返回 FakeElement；
 *   window.location                 —— 顶栏/链接逻辑会读 href、pathname；
 *   window.innerWidth               —— 抽屉感应的开合判定依赖它（固定 1400，见下方抽屉用例）；
 *   setTimeout 不真调度              —— 避免异步回调在测试中途打乱状态（有返回值即可）；
 *   setInterval 只登记不执行         —— 定时器回调留到需要时手动跑，防止死循环；
 *   localStorage / matchMedia / IntersectionObserver / customElements / getComputedStyle
 *                                   —— 课程脚本会探测这些 API，缺了会抛错，这里给最小可用的空实现；
 *   window.fire                     —— 测试脚本主动派发 mousemove 等 window 级事件（模拟鼠标位置）。
 * @param {string} pageFile 页面文件名，仅用于拼 location.href
 * @returns {{window: object, document: FakeElement}}
 */
function makeEnv(pageFile) {
  const document = new FakeElement("html");
  document.readyState = "complete";
  document.createElement = (t) => new FakeElement(t);
  document.createElementNS = (ns, t) => new FakeElement(t);
  document.createTextNode = (t) => { const e = new FakeElement("#text"); e.textContent = t; return e; };
  document.createComment = (t) => { const e = new FakeElement("#comment"); e.textContent = t; return e; };
  document.createDocumentFragment = () => { const e = new FakeElement("#fragment"); e.__fragment = true; return e; };
  document.querySelector = (s) => queryAll(document, s)[0] || null;
  document.querySelectorAll = (s) => queryAll(document, s);
  document.getElementById = (id) => {
    const all = queryAll(document, "#" + id);
    return all[0] || null;
  };
  document.getElementsByClassName = (c) => queryAll(document, "." + c);

  const body = new FakeElement("body");
  const head = new FakeElement("head");
  document.appendChild(head); document.appendChild(body);
  document.body = body;
  document.head = head;
  document.documentElement = document;

  const window = {
    document,
    location: { href: "file:///" + pageFile, pathname: pageFile },   // 页面脚本可能用 href/pathname 判断当前讲次
    navigator: { clipboard: null, userAgent: "node-dom-sim" },       // userAgent 便于脚本识别「非真实浏览器」
    innerWidth: 1400,                                                // 视口宽度：抽屉感应的开合阈值按它算
    addEventListener(t, fn) { (this._l = this._l || {})[t] = (this._l[t] || []).concat(fn); },   // _l：window 级事件名 → 监听函数数组
    removeEventListener() {},
    setTimeout: (fn, ms) => 0,          // 不真正调度，避免异步干扰
    clearTimeout() {},
    setInterval: (fn, ms) => { (window.__intervals = window.__intervals || []).push(fn); return 1; },   // __intervals：登记下来的定时器回调，不自动执行
    clearInterval() {},
    print() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    localStorage: (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; })(),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame: (fn) => 0,
    customElements: { define() {} },
  };
  window.window = window;
  window.self = window;
  window.globalThis = window;
  // 供测试脚本主动派发 window 级事件（如 mousemove 模拟鼠标位置）
  window.fire = function (type, extra) {
    const ev = Object.assign({ type, target: window, preventDefault() {}, stopPropagation() {} }, extra || {});
    (window._l && window._l[type] ? window._l[type] : []).forEach(fn => fn(ev));
    return ev;
  };
  return { window, document };
}

/* ============================ 提取页面脚本 ============================ */
/**
 * 抽出页面里的 <script>，保持文档顺序（顺序必须保持，课程脚本之间有依赖）。
 * 返回 [{type:"src", src}] 或 [{type:"inline", body}]；空内联脚本被丢弃。
 * 只认 src="..." 双引号写法，且不做网络请求——src 由调用方从本地磁盘读。
 */
function extractScripts(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const src = (attrs.match(/src\s*=\s*"([^"]+)"/) || [])[1];
    if (src) out.push({ type: "src", src });
    else if (body.trim()) out.push({ type: "inline", body });
  }
  return out;
}

/* ============================ 运行一个页面 ============================ */
function runPage(page) {
  const fp = path.join(ROOT, page);
  const html = fs.readFileSync(fp, "utf8");
  const scripts = extractScripts(html);
  const env = makeEnv(page);
  const { window } = env;

  // 收集页面里声明的 id，用于给脚本提供容器
  const ids = [...html.matchAll(/id\s*=\s*"([^"]+)"/g)].map(m => m[1]);   // 页面里出现的全部 id
  const vizIds = ids.filter(i => i.startsWith("viz-"));
  for (const id of vizIds) {
    const d = window.document.createElement("div");
    d.setAttribute("id", id);
    window.document.body.appendChild(d);   // 先造出裸容器，脚本挂载后会被加上 class="viz …"
  }

  /* ---------- 还原页面的骨架元素 ----------
     脚本依赖 .topbar / .sidebar / .content 才能构建顶栏与目录，
     这里按真实页面结构把它们挂到 body 上，并把 h2/h3 放进 .content。 */
  const mkEl = (tag, cls, id) => {   // 造一个带 class / id 的元素，省去重复三行
    const e = window.document.createElement(tag);
    if (cls) e.className = cls;
    if (id) e.setAttribute("id", id);
    return e;
  };
  const topbar = mkEl("header", "topbar");              // 顶栏（course.js 往里插标题与按钮）
  const sidebar = mkEl("aside", "sidebar toc-auto");    // 侧边目录（toc-auto 触发自动生成目录）
  const content = mkEl("main", "content");              // 正文容器（自动目录从这里抓 h2/h3）
  const layout = mkEl("div", "layout");                 // 包住 sidebar + content
  window.document.body.appendChild(topbar);
  window.document.body.appendChild(layout);
  layout.appendChild(sidebar);
  layout.appendChild(content);
  // 在 .content 下按文档顺序重建 h2/h3（保留 id 与文本）
  for (const m of html.matchAll(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)) {
    const id = (m[2].match(/id\s*=\s*"([^"]+)"/) || [])[1];
    if (!id) continue;
    const h = mkEl("h" + m[1], "", id);
    h.textContent = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const cls = (m[2].match(/class\s*=\s*"([^"]*)"/) || [])[1];
    if (cls) h.className = cls;
    content.appendChild(h);
  }

  // 顶层错误捕获
  const runtimeErrors = [];   // 页面脚本抛出的运行时错误（形如 "[标签] 消息"），非空即判本页失败
  const run = (code, label) => {   // 执行一段脚本；label 用于错误信息里指明出处
    try {
      // 用 with 把 window 作为全局作用域
      const fn = new Function("window", "document", "navigator", "localStorage",
        "IntersectionObserver", "setTimeout", "setInterval", "clearInterval",
        "requestAnimationFrame", "location", "print", "console", "customElements",
        "with(window){ " + code + "\n}");
      fn(window, window.document, window.navigator, window.localStorage,
        window.IntersectionObserver, window.setTimeout, window.setInterval,
        window.clearInterval, window.requestAnimationFrame, window.location,
        window.print, console, window.customElements);
    } catch (e) {
      runtimeErrors.push(`[${label}] ${e.message}`);
    }
  };

  for (const s of scripts) {
    if (s.type === "inline") { run(s.body, page + " 内联"); continue; }
    const jp = path.join(ROOT, s.src);
    if (!fs.existsSync(jp)) continue;
    run(fs.readFileSync(jp, "utf8"), s.src);
  }

  // DOMContentLoaded 后再跑一遍启动逻辑（course.js 是 defer）
  if (window._l && window._l.DOMContentLoaded) {
    for (const fn of window._l.DOMContentLoaded) {
      try { fn(); } catch (e) { runtimeErrors.push(`[boot] ${e.message}`); }
    }
  }

  /* ---- 逐帧渲染所有动画 ---- */
  const vizRoots = queryAll(window.document, ".viz");   // 页面里所有动画根节点（挂载成功后才有 .viz）
  /* 五个计数器，任一非 0 都会让本页判失败：
     framesTotal  总帧数（所有动画帧数之和）
     framesFailed 渲染时抛异常的帧数
     emptyFrames  帧对象不合格的帧数（既没有 draw 函数也没有 svg 内容）
     noDesc       缺 desc 说明文字的帧数（右侧说明栏会空着）
     emptyStage   go() 之后 .viz-stage 里一个子元素都没有的帧数（画面是空白） */
  let framesTotal = 0, framesFailed = 0, emptyFrames = 0, noDesc = 0, emptyStage = 0;
  const failDetail = [];   // 帧渲染失败的说明（最多留 4 条，避免刷屏）
  const perViz = [];       // 每个动画的「标题:帧数」，末尾用于打印帧数分布
  for (const v of vizRoots) {
    const list = v._vizList && v._vizList.length ? v._vizList : (v._viz ? [v._viz] : []);   // 一个容器可能挂了多个动画实例
    for (const viz of list) {
      if (!viz || !viz.frames) continue;
      const titleEl = v.querySelector(".viz-title");
      const name = (titleEl && titleEl.textContent) || v.getAttribute("id") || "?";
      perViz.push(name + ":" + viz.frames.length);
      for (let i = 0; i < viz.frames.length; i++) {
        framesTotal++;
        const fr = viz.frames[i];
        if (!fr || (typeof fr.draw !== "function" && !fr.svg)) emptyFrames++;
        if (!fr || fr.desc === undefined || String(fr.desc).trim() === "") noDesc++;
        try {
          viz.go(i, false);
          const stage = v.querySelector(".viz-stage");
          if (!stage || stage.children.length === 0) emptyStage++;
        } catch (e) { framesFailed++; if (failDetail.length < 4) failDetail.push(name + " 第" + (i + 1) + "帧: " + e.message); }
      }
      if (viz.pause) { try { viz.pause(); } catch (e) {} }
    }
  }

  const mounted = vizRoots.filter(v => v.querySelector(".viz-stage")).length;   // 成功挂载出舞台的动画数（应等于 vizDeclared）
  const empty = vizIds.filter(id => {   // 声明了 viz-* 容器但脚本没把它变成 .viz 的（即未挂载）
    const el = queryAll(window.document, "#" + id)[0];
    return el && !el.classList.contains("viz");
  });

  /* ---- 右侧感应抽屉的交互测试 ---- */
  const tocTests = [];   // 抽屉用例结果 [[用例名, 实际值说明, 是否通过], …]
  const bodyEl = window.document.body;   // 抽屉开合状态都体现在 body 的 class 上
  /* 注：不再查询 .toc-trigger —— course.js 早就改成「按鼠标坐标 + 滞回」判定开合，
     页面上根本没有这个感应区元素了（见 course.css 里那段注释）。 */
  const drawer = queryAll(window.document, ".toc-drawer")[0];   // 抽屉本体（course.js 动态创建）
  const btnToc = window.document.getElementById("btnToc");      // 顶栏 ☰ 按钮：切换感应开关
  if (process.env.DS_DEBUG) {
    console.log("    [debug] body.children = " + bodyEl.children.map(c => c.tagName + "." + c.className).join(" | "));
    console.log("    [debug] drawer=" + (drawer ? "found" : "null") +
      " btnToc=" + (btnToc ? "found" : "null"));
  }
  if (drawer) {
    const entries = queryAll(window.document, ".toc-drawer-body a");   // 抽屉里的目录条目
    tocTests.push(["抽屉条目", entries.length > 0 ? entries.length + " 条" : "（本页无小节，正常）", true]);
    if (btnToc) {
      const T = (name, cond, detail) => tocTests.push([name, detail, cond]);   // 记一条用例：name 用例名，cond 是否通过，detail 失败时显示的实际值
      const W = window.innerWidth;                    // 仿真视口宽度
      const pin = queryAll(window.document, ".toc-pin")[0];   // 抽屉上的「钉住」按钮
      const moveTo = (x) => window.fire ? window.fire("mousemove", { clientX: x })   // 把鼠标移到 x（clientX 是判定开合的唯一输入）
                                        : (window._l.mousemove || []).forEach(f => f({ clientX: x }));
      const isOpen = () => bodyEl.classList.contains("toc-hover");   // 当前是否处于抽屉抽出态
      const drawerLeft = W - Math.min(330, W * 0.88);   // 抽屉左边缘坐标（与 course.js 的宽度算法保持一致）

      T("初始未抽出", !isOpen(), String(isOpen()));
      T("初始顶栏按钮为按下态", btnToc.getAttribute("aria-pressed") === "true",
        String(btnToc.getAttribute("aria-pressed")));

      // 鼠标靠近右边缘 → 抽出
      moveTo(W - 10);
      T("鼠标贴近右边缘后抽出", isOpen(), String(isOpen()));

      // 关键：在滞回缓冲带内来回移动，绝不能抖动
      // 缓冲带 = [抽屉左边缘 - 110, 屏幕右边缘]，鼠标在此区间内来回移动状态不变
      moveTo(drawerLeft - 20);
      T("缓冲带内（抽屉左缘内侧 20px）移动仍保持抽出", isOpen(), String(isOpen()));
      moveTo(drawerLeft - 105);
      T("缓冲带内接近外沿（-105px）仍保持抽出", isOpen(), String(isOpen()));
      moveTo(W - 20);
      T("缓冲带内移回也不变", isOpen(), String(isOpen()));
      moveTo(drawerLeft - 130);
      T("向左越过缓冲带（-130px）才收回", !isOpen(), String(isOpen()));

      // 关闭感应后，右侧彻底不响应
      btnToc.click();
      T("点击按钮后关闭感应", !bodyEl.classList.contains("toc-sense"),
        String(bodyEl.classList.contains("toc-sense")));
      T("关闭后按钮为抬起态", btnToc.getAttribute("aria-pressed") === "false",
        String(btnToc.getAttribute("aria-pressed")));
      moveTo(W - 5);
      T("关闭感应后贴边也不再抽出", !isOpen(), String(isOpen()));

      // 再点一次 → 感应恢复
      btnToc.click();
      T("再次点击恢复感应", bodyEl.classList.contains("toc-sense"),
        String(bodyEl.classList.contains("toc-sense")));
      moveTo(W - 5);
      T("恢复后贴边可抽出", isOpen(), String(isOpen()));

      // 右侧边缘把手：点一下也能抽出（不依赖感应）
      const tab = queryAll(window.document, ".toc-tab")[0];   // 屏幕右缘的「本页导航」把手
      if (tab) {
        bodyEl.classList.remove("toc-hover", "toc-open");
        tab.click();
        T("点击右侧把手可抽出抽屉", isOpen(), String(isOpen()));
      } else {
        T("页面存在右侧把手 .toc-tab", false, "未找到");
      }
      // 抽屉的「✕」按钮
      const closeBtn = queryAll(window.document, ".toc-close")[0];   // 抽屉头部的「✕」收起按钮
      if (closeBtn) {
        closeBtn.click();
        T("点击 ✕ 可收起抽屉", !isOpen(), String(isOpen()));
      } else {
        T("抽屉头部有 ✕ 收起按钮", false, "未找到");
      }
      // 钉住按钮的文字应为中文而非符号
      if (pin) {
        T("钉住按钮使用中文文案", /钉住/.test(pin.textContent), pin.textContent);
      }

      // 固定按钮
      if (pin) {
        bodyEl.classList.remove("toc-hover", "toc-open");
        pin.click();
        T("点击钉住后抽屉保持展开", bodyEl.classList.contains("toc-open"),
          String(bodyEl.classList.contains("toc-open")));
        moveTo(40);
        T("钉住状态下鼠标远离也不收回（toc-open 仍在）", bodyEl.classList.contains("toc-open"),
          String(bodyEl.classList.contains("toc-open")));
        pin.click();
        T("取消钉住后收起", !bodyEl.classList.contains("toc-open"),
          String(bodyEl.classList.contains("toc-open")));
      }
      bodyEl.classList.remove("toc-hover", "toc-open");
    }
  }

  return {   // 本页仿真结果，字段含义见 runPage 各计数器的注释
    page, scriptCount: scripts.length,
    vizDeclared: vizIds.length, vizMounted: mounted,
    emptyViz: empty, framesTotal, framesFailed, failDetail, perViz,
    emptyFrames, noDesc, emptyStage, tocTests,
    runtimeErrors,
  };
}

/* ============================ 主流程 ============================ */
const args = process.argv.slice(2);   // 命令行指定的页面；不给就扫全部
const pages = args.length ? args
  : fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !f.startsWith(".")).sort();
let bad = 0;   // 存在问题的页面数（决定退出码）
for (const p of pages) {
  let r;
  try { r = runPage(p); }
  catch (e) { console.log(`✗ ${p}  仿真器自身异常: ${e.message}`); bad++; continue; }
  const ok = r.runtimeErrors.length === 0 && r.emptyViz.length === 0 && r.framesFailed === 0 &&   // 本页是否通过：无运行时错误、无未挂载动画、
             r.emptyFrames === 0 && r.emptyStage === 0 &&                                          // 无坏帧、无空白帧，
             r.tocTests.every(t => t[2]);                                                          // 且抽屉用例全过
  if (!ok) bad++;
  console.log(
    `${ok ? "✓" : "✗"} ${p.padEnd(24)} 脚本${String(r.scriptCount).padStart(2)}个  ` +
    `动画 ${r.vizMounted}/${r.vizDeclared}  帧 ${r.framesTotal}（失败 ${r.framesFailed}` +
    `，无描述 ${r.noDesc}，画布为空 ${r.emptyStage}）` +
    (r.emptyViz.length ? `  未挂载: ${r.emptyViz.join(",")}` : "")
  );
  if (r.tocTests.length) {
    const bad2 = r.tocTests.filter(t => !t[2]);
    console.log(`    本页导航抽屉: ${r.tocTests.length - bad2.length}/${r.tocTests.length} 项通过` +
      (bad2.length ? "  ✗ " + bad2.map(t => t[0] + "[" + t[1] + "]").join(", ") : ""));
  }
  r.runtimeErrors.slice(0, 4).forEach(m => console.log("    ! " + m));
  r.failDetail.forEach(m => console.log("    ! 帧渲染失败: " + m));
  if (r.perViz.length) console.log("    帧数分布: " + r.perViz.join("  "));
}
console.log("\n" + (bad ? `有 ${bad} 个页面存在问题` : "全部页面脚本仿真通过 ✅（含所有动画逐帧渲染）"));
process.exit(bad ? 1 : 0);
