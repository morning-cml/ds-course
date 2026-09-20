/* ==========================================================================
   course.js —— 数据结构与算法设计课件 · 公共脚本
   提供：
     1) 主题切换 / 顶栏 / 侧边目录自动生成 / 滚动高亮
     2) C++ 代码块自动高亮 + 复制按钮
     3) DS.Viz —— 通用算法可视化引擎（单步、自动播放、进度条、描述栏）
     4) DS.SVG —— SVG 构建小工具
   页面只需在 <head> 里写：<script>window.DS_PAGE={id:'ch01',...}</script>
   ========================================================================== */
(function () {
  "use strict";

  /* ====================== 站点页面注册表 ====================== */
  var PAGES = [
    { id: "index", file: "index.html",               no: "0",  title: "课程总览" },
    { id: "ch01",  file: "ch01-intro.html",          no: "01", title: "绪论：数据结构与算法分析" },
    { id: "ch02",  file: "ch02-linear-list.html",    no: "02", title: "线性表：顺序表与链表" },
    { id: "ch03",  file: "ch03-stack.html",          no: "03", title: "栈及其经典应用" },
    { id: "ch04",  file: "ch04-queue.html",          no: "04", title: "队列及其应用" },
    { id: "ch05",  file: "ch05-string-kmp-bm.html",  no: "05", title: "串：KMP 与 BM 模式匹配" },
    { id: "ch06",  file: "ch06-array-matrix.html",   no: "06", title: "数组与特殊矩阵压缩存储" },
    { id: "ch07",  file: "ch07-tree.html",           no: "07", title: "树与二叉树" },
    { id: "ch08",  file: "ch08-graph-basic.html",    no: "08", title: "图：术语与存储结构" },
    { id: "ch09",  file: "ch09-graph-algo.html",     no: "09", title: "图论算法：生成树与最短路径" },
    { id: "ch10",  file: "ch10-search-hash.html",    no: "10", title: "查找与哈希表" },
    { id: "ch11",  file: "ch11-sort-basic.html",     no: "11", title: "八大排序算法图解（上）" },
    { id: "ch12",  file: "ch12-sort-advanced.html",  no: "12", title: "排序体系与下界分析（下）" },
    { id: "ch13",  file: "ch13-paradigm-dp.html",    no: "13", title: "算法设计范式与动态规划" },
    { id: "ch14",  file: "ch14-luogu.html",          no: "14", title: "洛谷题单：例题与作业" },
    { id: "ch15",  file: "ch15-review.html",         no: "15", title: "综合自测与速查手册" }
  ];
  /* 注意：这里的 id 必须与各页 window.DS_PAGE.id 一致（ch01..ch15），
     否则顶栏章节标记与上/下一讲导航会取不到数据。 */

  var DS = {};
  window.DS = DS;
  DS.PAGES = PAGES;
  DS.page = window.DS_PAGE || { id: "index" };

  /* ====================== 小工具 ====================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  DS.$ = $; DS.$$ = $$;

  DS.get = function (obj, path, dflt) {
    var cur = obj;
    var parts = String(path).split(".");
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return dflt;
      cur = cur[parts[i]];
    }
    return cur === undefined ? dflt : cur;
  };

  /* 渲染数学式里的 ^ 上标：2^n -> 2<sup>n</sup>；仅用于 .math / .formula */
  DS.mathHTML = function (s) {
    return String(s).replace(/\^\{?([^}\s]+)\}?/g, "<sup>$1</sup>")
                    .replace(/_\{?([^}\s]+)\}?/g, "<sub>$1</sub>");
  };

  /* ====================== SVG 构建工具 ====================== */
  var NS = "http://www.w3.org/2000/svg";
  var SVG = {
    NS: NS,
    el: function (name, attrs, text) {
      var e = document.createElementNS(NS, name);
      if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    },
    svg: function (w, h, viewBox) {
      var s = SVG.el("svg", { width: w, height: h, viewBox: viewBox || ("0 0 " + w + " " + h), xmlns: NS });
      s.style.maxWidth = "100%";
      return s;
    },
    /* 圆角矩形节点 */
    box: function (x, y, w, h, cls, text, textCls) {
      var g = SVG.el("g");
      g.appendChild(SVG.el("rect", { x: x, y: y, width: w, height: h, rx: 6, "class": "vz-box " + (cls || "") }));
      if (text !== undefined && text !== null) {
        g.appendChild(SVG.el("text", {
          x: x + w / 2, y: y + h / 2 + 5, "text-anchor": "middle",
          "class": "vz-text " + (textCls || "")
        }, String(text)));
      }
      return g;
    },
    circle: function (cx, cy, r, cls, text, textCls) {
      var g = SVG.el("g");
      g.appendChild(SVG.el("circle", { cx: cx, cy: cy, r: r, "class": "vz-node " + (cls || "") }));
      if (text !== undefined && text !== null) {
        g.appendChild(SVG.el("text", {
          x: cx, y: cy + 5, "text-anchor": "middle", "class": "vz-text " + (textCls || "")
        }, String(text)));
      }
      return g;
    },
    text: function (x, y, str, cls, anchor) {
      return SVG.el("text", {
        x: x, y: y, "class": "vz-text " + (cls || ""),
        "text-anchor": anchor || "start"
      }, String(str));
    },
    label: function (x, y, str, anchor) {
      return SVG.el("text", { x: x, y: y, "class": "vz-label", "text-anchor": anchor || "start" }, String(str));
    },
    line: function (x1, y1, x2, y2, cls, arrow) {
      var a = { x1: x1, y1: y1, x2: x2, y2: y2, "class": "vz-edge " + (cls || "") };
      if (arrow) a["marker-end"] = "url(#vz-arrow)";
      return SVG.el("line", a);
    },
    path: function (d, cls, arrow) {
      var a = { d: d, "class": "vz-edge " + (cls || "") };
      if (arrow) a["marker-end"] = "url(#vz-arrow)";
      return SVG.el("path", a);
    },
    /* 给 svg 加箭头 marker 定义（画有向边前先调用） */
    defs: function (svg) {
      var defs = SVG.el("defs");
      var m = SVG.el("marker", {
        id: "vz-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse"
      });
      m.appendChild(SVG.el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--border-strong)" }));
      defs.appendChild(m);
      var m2 = SVG.el("marker", {
        id: "vz-arrow-a", viewBox: "0 0 10 10", refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse"
      });
      m2.appendChild(SVG.el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--brand)" }));
      defs.appendChild(m2);
      svg.insertBefore(defs, svg.firstChild);
      return svg;
    },
    /* 一棵二叉树：levels = [[值,...], ...]，返回 svg */
    tree: function (opts) {
      var levels = opts.levels, cls = opts.cls || {};
      var w = opts.width || 760, gapX = opts.gapX || 78, top = 34, gapY = opts.gapY || 74;
      var depth = levels.length;
      var h = top + depth * gapY + 10;
      var s = SVG.svg(w, h, "0 0 " + w + " " + h);
      var pos = {};
      for (var d = 0; d < depth; d++) {
        var n = levels[d].length;
        var span = w / (n + 1);
        for (var i = 0; i < n; i++) {
          var key = d + "," + i;
          pos[key] = { x: span * (i + 1), y: top + d * gapY };
        }
      }
      // 边
      for (var dd = 1; dd < depth; dd++) {
        for (var j = 0; j < levels[dd].length; j++) {
          var pk = (dd - 1) + "," + Math.floor(j / 2);
          if (!pos[pk] || levels[dd][j] === null) continue;
          var c = pos[dd + "," + j];
          var clsE = DS.get(cls, "e" + dd + "_" + j, "");
          s.appendChild(SVG.line(pos[pk].x, pos[pk].y + 20, c.x, c.y - 20, clsE));
        }
      }
      // 节点
      for (var d2 = 0; d2 < depth; d2++) {
        for (var i2 = 0; i2 < levels[d2].length; i2++) {
          if (levels[d2][i2] === null) continue;
          var p = pos[d2 + "," + i2];
          var nodeCls = DS.get(cls, "n" + d2 + "_" + i2, "");
          s.appendChild(SVG.circle(p.x, p.y, 20, nodeCls, levels[d2][i2],
            /active|done|warn|compare/.test(nodeCls) ? "on" : ""));
        }
      }
      return s;
    }
  };
  DS.SVG = SVG;

  /* ====================== 主题 ====================== */
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("ds-theme"); } catch (e) {}
    var theme = saved || "light";
    document.documentElement.setAttribute("data-theme", theme);
    return theme;
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "light";
    var next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ds-theme", next); } catch (e) {}
    $$(".viz").forEach(function (v) { if (v._vizRedraw) v._vizRedraw(); });
  }

  /* ====================== 顶栏 + 侧边栏 ====================== */
  function buildChrome() {
    var p = DS.page;
    var bar = $(".topbar");
    if (bar) {
      var idx = -1;
      for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === p.id) idx = i;
      var chapterTag = p.id === "index" ? "课程总览" : ("第 " + PAGES[idx].no + " 讲 · " + p.title);
      bar.innerHTML =
        '<button class="icon-btn menu-btn" id="btnMenu" title="目录" aria-label="目录">☰</button>' +
        '<a class="brand" href="index.html"><span class="logo">DS</span><span>数据结构与算法设计</span></a>' +
        '<span class="chapter-tag">' + chapterTag + '</span>' +
        '<span class="spacer"></span>' +
        '<button class="icon-btn" id="btnToc" title="本页导航" aria-label="本页导航" aria-pressed="false">☰</button>' +
        '<button class="icon-btn" id="btnTheme" title="切换深色 / 浅色">◐</button>' +
        '<button class="icon-btn" id="btnPrint" title="打印 / 导出 PDF">⎙</button>';
      $("#btnTheme").onclick = toggleTheme;
      $("#btnPrint").onclick = function () { window.print(); };
      $("#btnMenu").onclick = function () { document.body.classList.toggle("nav-open"); };
    }

    /* ---------- 左侧栏：只放课程章节 ---------- */
    var side = $(".sidebar");
    if (side) {
      var html = '<div class="nav-title">课程章节</div>';
      for (var k = 0; k < PAGES.length; k++) {
        var pg = PAGES[k];
        html += '<a class="nav-link' + (pg.id === p.id ? " active" : "") + '" href="' + pg.file + '">' +
                '<span style="font-family:var(--mono);opacity:.65;margin-right:6px">' +
                (pg.no === "0" ? "·" : pg.no) + '</span>' + pg.title + '</a>';
      }
      side.innerHTML = html;
      // 点击后关闭移动端侧栏
      side.addEventListener("click", function (e) {
        if (e.target.closest("a") && window.innerWidth <= 900) document.body.classList.remove("nav-open");
      });
    }

    setupTocDrawer();
  }

  /* ====================== 右侧「感应式抽出」本页导航 ====================== */
  /* 鼠标移到屏幕右边缘（或已抽出的抽屉上）→ 抽屉滑出；移开 → 收回。
     顶栏的 ☰ 按钮可以关闭「感应」，关闭后右边完全不响应鼠标，
     需要时再点一次按钮手动固定展开。状态记在 localStorage 里。 */
  function setupTocDrawer() {
    var SENSE_KEY = "ds-toc-sense";
    var sense = true;
    try { sense = localStorage.getItem(SENSE_KEY) !== "0"; } catch (e) {}

    // 收集本页目录项
    var heads = $$(".content h2[id], .content h3[id]").filter(function (h) {
      return !h.classList.contains("no-toc");
    });

    // 建抽屉骨架（开合完全由鼠标坐标判定，不依赖 DOM 进出事件）
    var drawer = document.createElement("aside");
    drawer.className = "toc-drawer";
    drawer.setAttribute("aria-label", "本页导航");
    drawer.innerHTML =
      '<div class="toc-drawer-head">' +
      '  <span class="toc-drawer-title">本页导航</span>' +
      '  <button class="toc-pin" type="button" title="钉住后抽屉不会自动收回">钉住</button>' +
      '  <button class="toc-close" type="button" title="收起（也可以按 Esc）">✕</button>' +
      '</div>' +
      '<div class="toc-drawer-body"></div>';
    document.body.appendChild(drawer);

    // 右侧边缘把手：看得见、点得到，比"纯感应"好找得多
    var tab = document.createElement("div");
    tab.className = "toc-tab";
    tab.setAttribute("role", "button");
    tab.setAttribute("tabindex", "0");
    tab.setAttribute("title", "点这里，或把鼠标移到屏幕右边缘，打开本页导航");
    document.body.appendChild(tab);

    var drawerBody = $(".toc-drawer-body", drawer);
    if (!heads.length) {
      drawerBody.innerHTML = '<div class="toc-empty">本页暂无小节导航</div>';
    } else {
      // H2 作为分组标题，其后的 H3 作为缩进子项
      var tocHTML = "";
      heads.forEach(function (h) {
        var t = h.textContent.replace(/^\s*[▸#]?\s*/, "").trim().replace(/"/g, "&quot;");
        if (h.tagName === "H2") tocHTML += '<a class="toc-h2" href="#' + h.id + '" title="' + t + '">' + t + "</a>";
        else tocHTML += '<a class="sub" href="#' + h.id + '" title="' + t + '">' + t + "</a>";
      });
      drawerBody.innerHTML = tocHTML;
    }

    /* ---------- 感应与开合 ---------- */
    var bento = {
      open: function () { document.body.classList.add("toc-open"); },
      close: function () { document.body.classList.remove("toc-open"); }
    };
    var pinned = false;

    function applySense() {
      document.body.classList.toggle("toc-sense", sense);
      var btn = $("#btnToc");
      if (btn) {
        btn.title = sense
          ? "本页导航：鼠标移向右侧即可抽出（点击关闭感应）"
          : "本页导航：感应已关闭（点击开启感应）";
        btn.setAttribute("aria-pressed", sense ? "true" : "false");
        btn.classList.toggle("on", sense);
      }
      try { localStorage.setItem(SENSE_KEY, sense ? "1" : "0"); } catch (e) {}
    }
    applySense();

    // 抽屉里的「钉住」按钮：钉住后不随鼠标离开收回
    var pinBtn = $(".toc-pin", drawer);
    var closeBtn = $(".toc-close", drawer);

    // 右侧边缘把手：点击或键盘回车都能抽出
    tab.addEventListener("click", function () {
      if (!sense) { sense = true; applySense(); }
      open();
    });
    tab.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!sense) { sense = true; applySense(); }
        open();
      }
    });

    if (closeBtn) closeBtn.addEventListener("click", function () {
      document.body.classList.remove("toc-hover");
      bento.close();
    });

    var btnToc = $("#btnToc");
    if (btnToc) {
      btnToc.onclick = function () {
        sense = !sense;
        if (!sense) {
          // 关闭感应：右边彻底不响应鼠标，收起抽屉并取消固定
          pinned = false;
          drawer.classList.remove("pinned");
          pinBtn.textContent = "钉住";
          pinBtn.title = "钉住后抽屉不会自动收回";
          document.body.classList.remove("toc-hover");
          bento.close();
        } else {
          // 打开感应：顺便把抽屉抽出来一次，让用户看到在哪
          open();
        }
        applySense();
      };
    }

    /* ---------- 感应逻辑：按鼠标位置判定 + 滞回距离 ----------
       为什么不用 mouseenter/mouseleave：
       抽屉一旦滑出就会盖住右侧感应区，于是立刻触发感应区的 mouseleave，
       抽屉收回、感应区又露出来，再触发 mouseenter……来回抖动。
       所以这里改为监听鼠标坐标并与"抽屉左边缘"比较：
         · 鼠标进入屏幕右侧 48px（SENSE_EDGE 内）        → 抽出
         · 鼠标离抽屉左边缘大于 CLOSE_GAP（默认 110px）  → 收回
       两个阈值之间是一段缓冲带（滞回），鼠标在这一带内来回移动不会有任何变化。
       先移出 110px 再往回也能稳定打开，不会出现"弹出来又弹回去"。
       另外右侧还有一个可见的 .toc-tab 把手：点它也能打开，不依赖感应。 */
    var SENSE_EDGE = 48;      // 屏幕右边缘多宽算"感应区"
    var CLOSE_GAP = 110;      // 离抽屉左边缘多远才收回

    function drawerLeft() {
      // 抽屉宽 min(330, 88vw)；用视口宽度算，不依赖布局（避免 display 影响测量）
      var w = Math.min(330, window.innerWidth * 0.88);
      return window.innerWidth - w;
    }
    function open() {
      if (pinned || document.body.classList.contains("toc-hover")) return;
      document.body.classList.add("toc-hover");
    }
    function close() {
      if (pinned) return;
      document.body.classList.remove("toc-hover");
    }

    var moveHandler = function (e) {
      // x: 鼠标横向坐标；e.clientX 不存在时（键盘/触摸）直接忽略
      var x = (typeof e.clientX === "number") ? e.clientX : null;
      if (x === null) return;
      if (window.innerWidth <= 900) return;              // 移动端不启用
      if (!sense && !document.body.classList.contains("toc-hover")) return;

      var opened = document.body.classList.contains("toc-hover");
      if (!opened) {
        // 未抽出：只有贴近右边缘才打开
        if (sense && x >= window.innerWidth - SENSE_EDGE) open();
      } else {
        // 已抽出：只有明确向左离开一段距离才收回（滞回，避免抖动）
        if (sense && x < drawerLeft() - CLOSE_GAP) close();
      }
    };
    window.addEventListener("mousemove", moveHandler, { passive: true });

    // 鼠标直接落进抽屉内部（例如从上方快速划过来）也要保证它是开的
    drawer.addEventListener("mouseenter", function () { if (sense) open(); });

    // 鼠标移出浏览器窗口时收起（除非钉住）
    document.addEventListener("mouseleave", function () {
      if (!pinned) document.body.classList.remove("toc-hover");
    });

    // 抽屉里的「钉住」按钮：钉住后不随鼠标离开收回
    pinBtn.addEventListener("click", function () {
      pinned = !pinned;
      drawer.classList.toggle("pinned", pinned);
      pinBtn.textContent = pinned ? "已钉住" : "钉住";
      pinBtn.title = pinned ? "点一下取消钉住（恢复感应式抽出）" : "钉住后抽屉不会自动收回";
      if (pinned) { bento.open(); } else { document.body.classList.remove("toc-open"); }
    });

    // 点到某个小节后收回抽屉（除非被钉住）
    drawerBody.addEventListener("click", function (e) {
      if (e.target.closest("a") && !pinned) {
        document.body.classList.remove("toc-hover");
      }
      closeMobileNav();
    });

    // 移动端：抽屉不参与，控制在左侧栏
    function closeMobileNav() {
      if (window.innerWidth <= 900) document.body.classList.remove("nav-open");
    }

    /* ---------- 滚动高亮 ---------- */
    var links = $$(".toc-drawer-body a[href^='#']");
    if (links.length && "IntersectionObserver" in window) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove("active"); });
          var a = map[en.target.id];
          if (a) a.classList.add("active");
        });
      }, { rootMargin: "-80px 0px -70% 0px" });
      heads.forEach(function (h) { io.observe(h); });
    }

    /* ---------- 首次使用的一次性提示 ---------- */
    var HINT_KEY = "ds-toc-hinted";
    var hinted = false;
    try { hinted = localStorage.getItem(HINT_KEY) === "1"; } catch (e) {}
    if (!hinted && sense && heads.length && window.innerWidth > 900) {
      var hint = document.createElement("div");
      hint.className = "toc-hint";
      hint.innerHTML = "鼠标移到<b>屏幕右边缘</b>即可抽出本页导航<br>" +
        "顶栏 <b>☰</b> 按钮可关闭这个感应";
      document.body.appendChild(hint);
      var killHint = function () {
        hint.classList.remove("show");
        setTimeout(function () { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 400);
      };
      setTimeout(function () { hint.classList.add("show"); }, 700);
      setTimeout(killHint, 4200);
      // 鼠标一靠近右边缘（真的把抽屉抽出来了）就提前收掉提示
      window.addEventListener("mousemove", function once(e) {
        if (typeof e.clientX === "number" && e.clientX >= window.innerWidth - SENSE_EDGE) {
          window.removeEventListener("mousemove", once);
          killHint();
        }
      }, { passive: true });
      try { localStorage.setItem(HINT_KEY, "1"); } catch (e) {}
    }
  }

  /* ====================== C++ 语法高亮 ====================== */
  var CPP_KEYWORDS = ("alignas alignof and and_eq asm auto bitand bitor break case catch class compl concept const " +
    "consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do " +
    "dynamic_cast else enum explicit export extern false for friend goto if inline mutable namespace new noexcept " +
    "not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return sizeof " +
    "static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename " +
    "union using virtual volatile while xor xor_eq override final").split(" ");
  var CPP_TYPES = ("int long short char signed unsigned float double void bool wchar_t size_t ptrdiff_t string vector " +
    "pair map set unordered_map unordered_set queue deque stack priority_queue list array bitset tuple make_pair INT_MAX " +
    "INT_MIN LLONG_MAX LLONG_MIN UINT_MAX nullptr_t istream ostream ifstream ofstream stringstream ostringstream " +
    "istringstream Node TreeNode ListNode Edge SegmentTree").split(" ");

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlightCpp(src) {
    var re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^\s*#\s*\w+)|(\b\d[\w.]*\b)|(\b[A-Za-z_]\w*\b)|([{}()\[\];,.<>=+\-*/%!&|^~?:]+)/gm;
    var out = "", last = 0, m;
    while ((m = re.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      last = re.lastIndex;
      var tok = esc(m[0]);
      if (m[1]) out += '<span class="tk-com">' + tok + "</span>";
      else if (m[2]) out += '<span class="tk-str">' + tok + "</span>";
      else if (m[3]) out += '<span class="tk-pre">' + tok + "</span>";
      else if (m[4]) out += '<span class="tk-num">' + tok + "</span>";
      else if (m[5]) {
        if (CPP_KEYWORDS.indexOf(m[5]) >= 0) out += '<span class="tk-key">' + tok + "</span>";
        else if (CPP_TYPES.indexOf(m[5]) >= 0) out += '<span class="tk-type">' + tok + "</span>";
        else {
          var after = src.slice(last, last + 2);
          if (/^\s*\(/.test(after)) out += '<span class="tk-func">' + tok + "</span>";
          else out += tok;
        }
      } else out += '<span class="tk-op">' + tok + "</span>";
    }
    out += esc(src.slice(last));
    return out;
  }
  DS.highlightCpp = highlightCpp;

  function buildCodeBlocks() {
    $$("pre[data-lang], pre.code").forEach(function (pre) {
      if (pre.parentNode && pre.parentNode.classList.contains("code-block")) return;
      var raw = pre.textContent.replace(/^\n+|\s+$/g, "");
      var lang = pre.getAttribute("data-lang") || "cpp";
      var name = pre.getAttribute("data-file") || "";
      var wrap = document.createElement("div");
      wrap.className = "code-block";
      wrap.innerHTML =
        '<div class="code-head"><span class="code-lang">' + esc(lang.toUpperCase()) + "</span>" +
        (name ? '<span class="code-file">' + esc(name) + "</span>" : "") +
        '<span class="spacer"></span><button class="copy-btn">复制</button></div>' +
        '<pre><code>' + (lang === "cpp" || lang === "c++" ? highlightCpp(raw) : esc(raw)) + "</code></pre>";
      pre.parentNode.replaceChild(wrap, pre);
      wrap.querySelector(".copy-btn").onclick = function () {
        var btn = this;
        var done = function () { btn.textContent = "已复制 ✓"; setTimeout(function () { btn.textContent = "复制"; }, 1200); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(raw).then(done, done);
        else {
          var ta = document.createElement("textarea");
          ta.value = raw; document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); } catch (e) {}
          document.body.removeChild(ta); done();
        }
      };
    });
  }

  /* ====================== 数学式渲染 ====================== */
  function buildMath() {
    $$("[data-math]").forEach(function (e) { e.innerHTML = DS.mathHTML(e.getAttribute("data-math")); });
  }

  /* ====================== 可视化引擎 ====================== */
  /**
   * 用法：
   *   var viz = new DS.Viz('#vizX', {
   *     title:'冒泡排序', sub:'每轮把最大元素"冒"到末尾',
   *     build(){ ... 返回 {svg, frames:[{desc, marks:{...}}]} }
   *     或 build(ctx) 中用 ctx.frame({desc, marks}) 逐帧推送
   *   });
   *   viz.mount();        // 渲染到容器
   *   viz.onFrame = fn;   // 每帧回调（拿到 frame 与 index）
   * 帧渲染约定：每一帧画布可以用 frame.draw(svg) 完全重画（最简单），
   *            也可以用 frame.marks 让页面自定义高亮。
   */
  function Viz(root, opts) {
    if (typeof root === "string") root = $(root);
    if (!root) throw new Error("Viz: 容器不存在");
    if (!(this instanceof Viz)) return new Viz(root, opts);
    var self = this;
    this.root = root;
    this.opts = opts || {};
    this.frames = [];
    this.index = 0;
    this.timer = null;
    this.speed = 700;      // 每帧毫秒
    this.title = this.opts.title || "算法演示";
    this.sub = this.opts.sub || "";
    this.controls = this.opts.controls !== false;

    var html =
      '<div class="viz-head"><span class="viz-title">' + esc(this.title) + "</span>" +
      (this.sub ? '<span class="viz-sub">' + esc(this.sub) + "</span>" : "") +
      '<span class="spacer"></span>' +
      '<span class="viz-sub"><b class="viz-counter">0 / 0</b></span></div>' +
      '<div class="viz-body">' +
      '  <div class="viz-stage"></div>' +
      '  <div class="viz-desc"><span class="step-no">准备就绪</span><span class="viz-desc-text">点击「播放」或「下一步」开始</span></div>' +
      '  <div class="viz-progress"><i></i></div>' +
      (this.controls ?
      '  <div class="viz-controls">' +
      '    <button class="btn primary" data-act="play">▶ 播放</button>' +
      '    <button class="btn" data-act="prev">◀ 上一步</button>' +
      '    <button class="btn" data-act="next">下一步 ▶</button>' +
      '    <button class="btn ghost" data-act="first">⏮ 重来</button>' +
      '    <button class="btn ghost" data-act="last">⏭ 末帧</button>' +
      '    <span class="speed">速度 <input type="range" min="1" max="10" value="6" data-act="speed"></span>' +
      '  </div>' : "") +
      "</div>";

    this.root.classList.add("viz");
    this.root.innerHTML = html;
    this.stage = $(".viz-stage", this.root);
    this.descEl = $(".viz-desc-text", this.root);
    this.noEl = $(".step-no", this.root);
    this.counter = $(".viz-counter", this.root);
    this.bar = $(".viz-progress > i", this.root);
    this.extra = $(".viz-extra", this.root);

    // 事件
    this.root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn || btn.tagName === "INPUT") return;
      var act = btn.getAttribute("data-act");
      if (act === "play") self.toggle();
      else if (act === "prev") self.prev();
      else if (act === "next") self.next();
      else if (act === "first") self.go(0, true);
      else if (act === "last") self.go(self.frames.length - 1, true);
    });
    var sp = $('[data-act="speed"]', this.root);
    if (sp) sp.addEventListener("input", function () {
      self.speed = 1300 - this.value * 120;   // 1=>1180ms  10=>100ms
      if (self.timer) { self.pause(); self.play(); }
    });

    // 外部可挂：每帧回调
    this.onFrame = null;

    // 构建
    var res = null;
    if (typeof this.opts.build === "function") {
      res = this.opts.build({
        frame: function (f) { self.frames.push(f); },
        svg: function (w, h) { return SVG.svg(w, h); }
      });
    }
    if (res) {
      if (res.svg && !res.frames) { this.stage.appendChild(res.svg); }
      if (res.frames) this.frames = res.frames;
      if (res.title) $(".viz-title", this.root).textContent = res.title;
    }
    this.defaultSVG = null;
    this._vizRedraw = function () { self.go(self.index, false); };
    root._vizRedraw = this._vizRedraw;
    if (root._viz) (root._vizList = root._vizList || []).push(this);
    root._viz = this;                      /* 便于自动化测试与调试 */

    if (this.frames.length) this.go(0, false);
    else {
      this.counter.textContent = "0 / 0";
      this.descEl.textContent = "（此图为静态图解）";
    }
    return this;
  }

  Viz.prototype._renderFrame = function (i) {
    var f = this.frames[i];
    if (!f) return;
    // 1) 完全重画
    if (typeof f.draw === "function") {
      var holder = document.createElement("div");
      var s = f.draw(SVG) || null;
      if (s) holder.appendChild(s);
      this.stage.innerHTML = "";
      this.stage.appendChild(holder);
    } else if (f.svg) {
      this.stage.innerHTML = "";
      this.stage.appendChild(f.svg.cloneNode(true));
    }
    // 2) 描述（步骤编号采用 0 基，与描述里的数组下标保持一致，方便对照）
    if (f.desc !== undefined) {
      this.noEl.textContent = "步骤 " + i;
      this.descEl.innerHTML = f.desc;
    }
    // 3) 高亮钩子
    if (typeof this.onFrame === "function") this.onFrame(f, i, this.stage);
    // 4) 面板
    this.counter.textContent = (i + 1) + " / " + this.frames.length;
    if (this.bar) this.bar.style.width = (this.frames.length <= 1 ? 100 : (i / (this.frames.length - 1)) * 100) + "%";
    // 5) 按钮状态
    var self = this;
    $$("[data-act]", this.root).forEach(function (b) {
      var a = b.getAttribute("data-act");
      if (a === "prev" || a === "first") b.disabled = (i === 0);
      if (a === "next" || a === "last") b.disabled = (i === self.frames.length - 1);
    });
  };

  Viz.prototype.go = function (i, stop) {
    if (stop) this.pause();
    if (!this.frames.length) return;
    this.index = Math.max(0, Math.min(this.frames.length - 1, i));
    this._renderFrame(this.index);
  };
  Viz.prototype.next = function () {
    if (this.index >= this.frames.length - 1) { this.pause(); return; }
    this.go(this.index + 1);
  };
  Viz.prototype.prev = function () { this.go(this.index - 1, true); };

  Viz.prototype.play = function () {
    var self = this;
    if (this.timer || !this.frames.length) return;
    if (this.index >= this.frames.length - 1) this.go(0);
    var btn = $('[data-act="play"]', this.root);
    if (btn) btn.textContent = "⏸ 暂停";
    this.timer = setInterval(function () {
      if (self.index >= self.frames.length - 1) { self.pause(); return; }
      self.next();
    }, this.speed);
  };
  Viz.prototype.pause = function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    var btn = $('[data-act="play"]', this.root);
    if (btn) btn.textContent = "▶ 播放";
  };
  Viz.prototype.toggle = function () { this.timer ? this.pause() : this.play(); };

  DS.Viz = Viz;

  /* ====================== 步骤式静态图解（.steps） ====================== */
  function buildStepFigs() {
    $$("[data-steps]").forEach(function (box) {
      var svgs = $$("svg", box);
      if (svgs.length < 2) return;
      var idx = 0;
      var bar = document.createElement("div");
      bar.className = "viz-controls";
      bar.style.marginTop = "10px";
      bar.innerHTML = '<button class="btn" data-s="p">◀ 上一步</button>' +
                      '<span class="viz-sub"><b class="sc">1</b> / ' + svgs.length + '</span>' +
                      '<button class="btn" data-s="n">下一步 ▶</button>';
      box.appendChild(bar);
      var sc = $(".sc", bar);
      function show(i) {
        idx = Math.max(0, Math.min(svgs.length - 1, i));
        svgs.forEach(function (s, k) { s.style.display = k === idx ? "" : "none"; });
        sc.textContent = idx + 1;
      }
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-s]");
        if (!b) return;
        show(b.getAttribute("data-s") === "n" ? idx + 1 : idx - 1);
      });
      show(0);
    });
  }

  /* ====================== 键盘快捷键 ====================== */
  /* 动画操作：← → 单步，空格 播放/暂停，R 重来
     章节翻页：Alt + ← / →   （避免与浏览器手势冲突） */
  function bindKeys() {
    document.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;

      /* Esc：收起右侧本页导航抽屉 */
      if (e.key === "Escape") {
        document.body.classList.remove("toc-hover");
        document.body.classList.remove("toc-open");
        return;
      }

      /* 章节翻页 */
      if (e.altKey) {
        var idx = -1;
        for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === DS.page.id) idx = i;
        if (idx < 0) return;
        if (e.key === "ArrowRight" && idx + 1 < PAGES.length) { location.href = PAGES[idx + 1].file; e.preventDefault(); }
        if (e.key === "ArrowLeft" && idx - 1 >= 0) { location.href = PAGES[idx - 1].file; e.preventDefault(); }
        return;
      }

      /* 动画控制：作用于"当前可见的第一个动画" */
      var vizes = $$(".viz").filter(function (v) {
        var r0 = v.getBoundingClientRect();
        return r0.bottom > 80 && r0.top < (window.innerHeight || 800);
      });
      var host = vizes[0];
      if (!host || !host._viz) return;
      var act = null;
      if (e.key === "ArrowRight") act = "next";
      else if (e.key === "ArrowLeft") act = "prev";
      else if (e.key === " " || e.code === "Space") act = "play";
      else if (e.key === "r" || e.key === "R") act = "first";
      if (!act) return;
      var btn = $('[data-act="' + act + '"]', host);
      if (btn && !btn.disabled) { btn.click(); e.preventDefault(); }
      else if (act === "play" && host._viz) { host._viz.toggle(); e.preventDefault(); }
    });
  }

  /* ====================== 启动 ====================== */
  function boot() {
    initTheme();
    buildChrome();
    buildCodeBlocks();
    buildMath();
    buildStepFigs();
    bindKeys();
    // 页脚年份
    $$("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
