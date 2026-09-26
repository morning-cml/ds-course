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
  /* 全站唯一的「页面清单」，顶栏章节标记、左侧目录、上/下一讲跳转、快捷键翻页都读它。
     每项的字段：
       id    —— 页面标识，必须与各页 <head> 里 window.DS_PAGE.id 完全一致（ch01…ch15）
       file  —— 相对本目录的文件名，同时也是左侧目录链接与 Alt+←/→ 跳转的目标
       no    —— 显示用的讲次号（两位字符串）；"0" 是总览页，目录里显示成「·」
       title —— 目录里显示的中文标题
     顺序即课程顺序：改顺序会让「上一讲/下一讲」跟着变，导航链校验（nav-check.mjs）会比对这里。 */
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
    { id: "ch15",  file: "ch15-review.html",         no: "15", title: "综合自测与速查手册" },
    { id: "ch16",  file: "ch16-plan.html",           no: "16", title: "家教规划" }
  ];
  /* 注意：这里的 id 必须与各页 window.DS_PAGE.id 一致（ch01..ch15），
     否则顶栏章节标记与上/下一讲导航会取不到数据。 */

  /* DS —— 挂到 window 上的全局命名空间，章节脚本通过它取引擎能力：
       DS.PAGES  上面那张页面清单
       DS.page   当前页的 {id, title}（来自页面里的 window.DS_PAGE；总览页取不到时兜底成 index）
       DS.$/DS.$$  查询助手（见下）
       DS.SVG    SVG 构建工具；DS.Viz  动画引擎；DS.highlightCpp  代码高亮 */
  var DS = {};
  window.DS = DS;
  DS.PAGES = PAGES;
  DS.page = window.DS_PAGE || { id: "index" };

  /* ====================== 小工具 ====================== */
  /* $(sel, root)  —— 单个元素查询，等价于 (root||document).querySelector(sel) */
  function $(sel, root) { return (root || document).querySelector(sel); }
  /* $$(sel, root) —— 查询**全部**并转成真数组（便于 forEach/filter，NodeList 在旧浏览器上没有这些方法） */
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  DS.$ = $; DS.$$ = $$;

  /* 渲染数学式里的 ^ 上标：2^n -> 2<sup>n</sup>；仅用于 .math / .formula */
  DS.mathHTML = function (s) {
    return String(s).replace(/\^\{?([^}\s]+)\}?/g, "<sup>$1</sup>")
                    .replace(/_\{?([^}\s]+)\}?/g, "<sub>$1</sub>");
  };

  /* ====================== SVG 构建工具 ====================== */
  /* NS —— SVG 元素必须用 createElementNS 配这个命名空间创建，用 createElement 建出来不会渲染 */
  var NS = "http://www.w3.org/2000/svg";
  var SVG = {
    NS: NS,
    /* el(name, attrs, text) —— 建任意 SVG 元素。
       attrs 里值为 null/undefined 的项会被跳过（方便按条件传可选属性）；
       text 会给 textContent（不是 innerHTML，所以文本里的 < > 不需要转义）。 */
    el: function (name, attrs, text) {
      var e = document.createElementNS(NS, name);
      if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    },
    /* svg(w, h, viewBox) —— 建画布；不传 viewBox 就按 w/h 自动生成「0 0 w h」。
       maxWidth:100% 让它跟着容器自适应缩放。 */
    svg: function (w, h, viewBox) {
      var s = SVG.el("svg", { width: w, height: h, viewBox: viewBox || ("0 0 " + w + " " + h), xmlns: NS });
      s.style.maxWidth = "100%";
      return s;
    },
    /* 圆角矩形节点（数组单元 / 表格单元格）。
       x,y 左上角；w,h 宽高；cls 状态类（active/compare/done/warn/dim…，可空格叠加多个）；
       text 格子里的字（null/undefined 则不画字）；textCls 文字类，底是实色时传 "on"。
       返回的是 <g>，里面是「rect + text」两兄弟 —— course.css 的 .vz-box + .vz-text.on 依赖这个相邻关系。 */
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
    /* 圆（链表结点 / 树结点 / 图的顶点）。
       cx,cy 圆心，r 半径；其余参数含义同 box()。
       注意 .vz-node 的状态底色是**实色**，所以 textCls="on"（白字）在这里才适用。 */
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
    /* text(x, y, str, cls, anchor) —— 普通文字。
       cls 可用 brand/ok/bad/soft/faint/big/sm 等（见 course.css）；anchor 为 start|middle|end，默认左对齐。
       注意 SVG 的 y 是**基线**位置，想让文字在格子里居中通常要 +5 左右。 */
    text: function (x, y, str, cls, anchor) {
      return SVG.el("text", {
        x: x, y: y, "class": "vz-text " + (cls || ""),
        "text-anchor": anchor || "start"
      }, String(str));
    },
    /* label(x, y, str, anchor) —— 小号灰色下标标签（数组下标、下标号等） */
    label: function (x, y, str, anchor) {
      return SVG.el("text", { x: x, y: y, "class": "vz-label", "text-anchor": anchor || "start" }, String(str));
    },
    /* line(x1,y1,x2,y2, cls, arrow) —— 直线；cls 走 .vz-edge.* 状态类；arrow=true 时在**末端**加箭头 */
    line: function (x1, y1, x2, y2, cls, arrow) {
      var a = { x1: x1, y1: y1, x2: x2, y2: y2, "class": "vz-edge " + (cls || "") };
      if (arrow) a["marker-end"] = "url(#vz-arrow)";
      return SVG.el("line", a);
    },
    /* path(d, cls, arrow) —— 任意路径（曲线、折线）。d 是 SVG 路径指令，如 "M0,0 L10,10" */
    path: function (d, cls, arrow) {
      var a = { d: d, "class": "vz-edge " + (cls || "") };
      if (arrow) a["marker-end"] = "url(#vz-arrow)";
      return SVG.el("path", a);
    },
    /* 注册箭头 marker 定义。**画有向边之前必须先对同一个 svg 调一次**，
       否则 line/path 上的 url(#vz-arrow) 找不到目标，箭头不会出现。
       注册两个：vz-arrow（灰，默认）、vz-arrow-a（品牌蓝）。
       定义插在 svg 最前面，所以可以在建完画布后立刻调用。 */
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
    }
  };
  DS.SVG = SVG;

  /* ====================== 主题 ====================== */
  /* 主题只是 <html data-theme="light|dark"> 一个属性，具体配色全在 course.css 的
     :root / html[data-theme="dark"] 两套 CSS 变量里。选择记在 localStorage 的 ds-theme。
     两个函数都包了 try/catch：file:// 下某些浏览器会禁 localStorage，禁止时静默降级成默认浅色。 */
  function initTheme() {
    var saved = null;                       // localStorage 里存的主题名；读不到就是 null
    try { saved = localStorage.getItem("ds-theme"); } catch (e) {}
    var theme = saved || "light";           // 默认浅色
    document.documentElement.setAttribute("data-theme", theme);
    return theme;
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "light";
    var next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ds-theme", next); } catch (e) {}
    /* 已建好的动画是用内联属性画的，换主题后要重画一遍才能吃到新的 CSS 变量。
       _vizRedraw 是 DS.Viz 构造时挂在容器上的回调（见 Viz 里那一行）。 */
    $$(".viz").forEach(function (v) { if (v._vizRedraw) v._vizRedraw(); });
  }

  /* ====================== 顶栏 + 侧边栏 ====================== */
  /* 顶栏与左侧目录都由本函数**动态生成**，所以页面里的
     <header class="topbar"></header> 与 <aside class="sidebar toc-auto"></aside> 必须是空标签。 */
  function buildChrome() {
    var p = DS.page;                        // 当前页 {id, title}
    var bar = $(".topbar");
    if (bar) {
      /* idx —— 当前页在 PAGES 里的下标；顶栏那枚「第 NN 讲」胶囊标签需要它取讲次号 */
      var idx = -1;
      for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === p.id) idx = i;
      var chapterTag = p.id === "index" ? "课程总览" : ("第 " + PAGES[idx].no + " 讲 · " + p.title);
      bar.innerHTML =
        '<button class="icon-btn menu-btn" id="btnMenu" title="目录" aria-label="目录">☰</button>' +
        '<a class="brand" href="index.html"><span class="logo">DS</span><span>数据结构与算法设计</span></a>' +
        '<span class="chapter-tag">' + chapterTag + '</span>' +
        '<span class="spacer"></span>' +
        /* btnToc = 本页导航抽屉的「感应开关」；btnTheme = 明暗切换；btnPrint = 打印/导出 PDF */
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
        var pg = PAGES[k];                  // 该轮要拼的页面条目
        /* pg.no === "0" 是总览页，序号位显示成「·」；当前页那一条加 active 高亮 */
        html += '<a class="nav-link' + (pg.id === p.id ? " active" : "") + '" href="' + pg.file + '">' +
                '<span style="font-family:var(--mono);opacity:.65;margin-right:6px">' +
                (pg.no === "0" ? "·" : pg.no) + '</span>' + pg.title + '</a>';
      }
      side.innerHTML = html;
      // 点击后关闭移动端侧栏（900px 以下左侧栏是抽屉式浮层，点完链接要收起来）
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
    var SENSE_KEY = "ds-toc-sense";         // localStorage 键：感应开关（"1"/"0"）
    var sense = true;                       // 感应是否启用；关闭后鼠标移到右边缘也不再抽出
    try { sense = localStorage.getItem(SENSE_KEY) !== "0"; } catch (e) {}

    // 收集本页目录项：正文里的 h2/h3，但跳过标了 .no-toc 的（那是装饰性标题）
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

    var drawerBody = $(".toc-drawer-body", drawer);   // 目录条目的容器
    if (!heads.length) {
      drawerBody.innerHTML = '<div class="toc-empty">本页暂无小节导航</div>';
    } else {
      // H2 作为分组标题，其后的 H3 作为缩进子项
      var tocHTML = "";
      heads.forEach(function (h) {
        /* t —— 目录里显示的文字：去掉开头的 ▸/# 之类的装饰符，并把 " 转义掉（要写进 title="..."） */
        var t = h.textContent.replace(/^\s*[▸#]?\s*/, "").trim().replace(/"/g, "&quot;");
        if (h.tagName === "H2") tocHTML += '<a class="toc-h2" href="#' + h.id + '" title="' + t + '">' + t + "</a>";
        else tocHTML += '<a class="sub" href="#' + h.id + '" title="' + t + '">' + t + "</a>";
      });
      drawerBody.innerHTML = tocHTML;
    }

    /* ---------- 感应与开合 ----------
       抽屉有两种「展开」状态，对应 body 上两个 class：
         toc-hover —— 鼠标感应临时抽出（移开就收回）
         toc-open  —— 点了「钉住」后固定展开（不随鼠标收回）
       course.css 里这两者都会把抽屉 transform 到屏幕内。bento 只是给这两个动作起了短名字。 */
    var bento = {
      open: function () { document.body.classList.add("toc-open"); },
      close: function () { document.body.classList.remove("toc-open"); }
    };
    var pinned = false;                     // 是否已钉住（钉住后 close() 不再生效）
    var pinBtn = $(".toc-pin", drawer);     // 抽屉里的「钉住」按钮
    var closeBtn = $(".toc-close", drawer); // 抽屉里的「✕ 收起」按钮

    /* 钉住状态的唯一出入口：pinned 变量、抽屉的 pinned 类、按钮文案、body.toc-open 四处一起改。
       之前「✕ / Esc」只摘了 body 上的类、没把 pinned 复位，结果 open() 一直以为还钉着，
       鼠标贴边、点把手都打不开抽屉 —— 所以任何收起抽屉的路径都要走 setPinned(false)。 */
    function setPinned(v) {
      pinned = v;
      drawer.classList.toggle("pinned", v);
      pinBtn.textContent = v ? "已钉住" : "钉住";
      pinBtn.title = v ? "点一下取消钉住（恢复感应式抽出）" : "钉住后抽屉不会自动收回";
      if (v) bento.open(); else bento.close();
    }
    /* 彻底收起：取消钉住 + 收回感应抽出。✕、Esc、关闭感应都走这里 */
    function collapse() {
      setPinned(false);
      document.body.classList.remove("toc-hover");
    }
    DS.closeToc = collapse;                 // 给 bindKeys 里的 Esc 用

    /* 把 sense 同步到三处：body 的 toc-sense 类（控制把手显隐）、顶栏按钮的文案/按下态、localStorage */
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

    // 右侧边缘把手：点击或键盘回车都能抽出（顺手把感应打开，免得用户以为没反应）
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

    if (closeBtn) closeBtn.addEventListener("click", collapse);

    var btnToc = $("#btnToc");
    if (btnToc) {
      btnToc.onclick = function () {
        sense = !sense;
        if (!sense) {
          // 关闭感应：右边彻底不响应鼠标，收起抽屉并取消固定
          collapse();
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
    var SENSE_EDGE = 48;      // 屏幕右边缘多宽算"感应区"（鼠标进入这个宽度内就抽出抽屉）
    var CLOSE_GAP = 110;      // 离抽屉左边缘多远才收回（与 SENSE_EDGE 之间的这段就是防抖动的缓冲带）

    /* 抽屉左边缘的 x 坐标。抽屉宽 min(330px, 88vw)，直接用视口宽度算，
       不去测量真实布局 —— 因为抽屉收起时是 transform 移出去的，量 display 会不准。 */
    function drawerLeft() {
      var w = Math.min(330, window.innerWidth * 0.88);
      return window.innerWidth - w;
    }
    /* open/close 只管「感应式」那一档（body.toc-hover）；钉住那一档是 bento.open（body.toc-open） */
    function open() {
      if (pinned || document.body.classList.contains("toc-hover")) return;
      document.body.classList.add("toc-hover");
    }
    function close() {
      if (pinned) return;
      document.body.classList.remove("toc-hover");
    }

    /* 全局鼠标移动的总调度：决定此刻该抽出还是收回。
       用 passive:true 是因为这个监听只读坐标、不 preventDefault，声明成被动监听能让浏览器不必等它就先滚动。 */
    var moveHandler = function (e) {
      // x —— 鼠标横向坐标；e.clientX 不存在时（键盘/触摸触发的事件）直接忽略
      var x = (typeof e.clientX === "number") ? e.clientX : null;
      if (x === null) return;
      if (window.innerWidth <= 900) return;              // 移动端不启用
      if (!sense && !document.body.classList.contains("toc-hover")) return;

      var opened = document.body.classList.contains("toc-hover");   // 此刻抽屉是否已抽出
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
    pinBtn.addEventListener("click", function () { setPinned(!pinned); });

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
    /* links —— 抽屉里的锚点链接；map 是「锚点 id → 链接元素」的反查表（观察器回调里只拿得到元素 id）。
       IntersectionObserver 判定当前处在视口上方那条线上的是哪个标题，就点亮对应的链接。
       rootMargin 上 -80px 是让顶栏盖住的那一条不算，下 -70% 是让标题进入视口上部才触发。 */
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
    /* 只提示一次：提示过就在 localStorage 打标记。第 3 个条件是移动端不提示（那边本来就不用抽屉）。 */
    var HINT_KEY = "ds-toc-hinted";
    var hinted = false;                     // 是否已经提示过
    try { hinted = localStorage.getItem(HINT_KEY) === "1"; } catch (e) {}
    if (!hinted && sense && heads.length && window.innerWidth > 900) {
      var hint = document.createElement("div");
      hint.className = "toc-hint";
      hint.innerHTML = "鼠标移到<b>屏幕右边缘</b>即可抽出本页导航<br>" +
        "顶栏 <b>☰</b> 按钮可关闭这个感应";
      document.body.appendChild(hint);
      /* 淡出后 400ms 再真正把节点摘掉（等 CSS 的 opacity 过渡走完） */
      var killHint = function () {
        hint.classList.remove("show");
        setTimeout(function () { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 400);
      };
      setTimeout(function () { hint.classList.add("show"); }, 700);   // 进页面 0.7s 后淡入
      setTimeout(killHint, 4200);                                     // 4.2s 后自动消失
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

  /* 极简 C++ 高亮器：把源码按「记号」切段，逐段套上 <span class="tk-*">。
     re 的 6 个捕获组**顺序即优先级**（注释 > 字符串 > 预处理 > 数字 > 标识符 > 运算符），
     靠正则的分支顺序保证「注释里的 // 不会被当成运算符」这类情况。
       m[1] 注释 → tk-com    m[2] 字符串 → tk-str   m[3] #预处理 → tk-pre
       m[4] 数字 → tk-num    m[5] 标识符 → 再看词表分 tk-key / tk-type / tk-func
       m[6] 运算符 → tk-op
     注意：这不是完整词法分析，只求「看起来对」，够课件用。 */
  function highlightCpp(src) {
    var re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^\s*#\s*\w+)|(\b\d[\w.]*\b)|(\b[A-Za-z_]\w*\b)|([{}()\[\];,.<>=+\-*/%!&|^~?:]+)/gm;
    /* out  —— 累积输出的 HTML
       last —— 上一个记号结束的位置；两个记号之间的原文（空白、未被匹配的字符）要原样补上并转义 */
    var out = "", last = 0, m;
    while ((m = re.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      last = re.lastIndex;
      var tok = esc(m[0]);              // 当前记号，已转义（& < > 不能直接进 HTML）
      if (m[1]) out += '<span class="tk-com">' + tok + "</span>";
      else if (m[2]) out += '<span class="tk-str">' + tok + "</span>";
      else if (m[3]) out += '<span class="tk-pre">' + tok + "</span>";
      else if (m[4]) out += '<span class="tk-num">' + tok + "</span>";
      else if (m[5]) {
        if (CPP_KEYWORDS.indexOf(m[5]) >= 0) out += '<span class="tk-key">' + tok + "</span>";
        else if (CPP_TYPES.indexOf(m[5]) >= 0) out += '<span class="tk-type">' + tok + "</span>";
        else {
          /* 是不是函数名？看紧跟其后的两个字符里有没有左括号（跳过空格）。
             after 从 last 开始切，因为 last 已经指向当前记号之后。 */
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

  /* 把页面里每个 <pre data-lang="cpp" data-file="xxx.cpp"> 就地换成
     「标题栏（语言 + 文件名 + 复制按钮）+ 高亮后的代码」。
     带 data-file 的名字会显示在标题栏上，方便学生知道这段存成什么文件。 */
  function buildCodeBlocks() {
    $$("pre[data-lang], pre.code").forEach(function (pre) {
      if (pre.parentNode && pre.parentNode.classList.contains("code-block")) return;   // 已处理过就跳过
      var raw = pre.textContent.replace(/^\n+|\s+$/g, "");   // 原始代码（去掉首尾空行）—— 复制按钮复制的就是它
      var lang = pre.getAttribute("data-lang") || "cpp";
      var name = pre.getAttribute("data-file") || "";        // 显示用的文件名，可空
      var wrap = document.createElement("div");
      wrap.className = "code-block";
      wrap.innerHTML =
        '<div class="code-head"><span class="code-lang">' + esc(lang.toUpperCase()) + "</span>" +
        (name ? '<span class="code-file">' + esc(name) + "</span>" : "") +
        '<span class="spacer"></span><button class="copy-btn">复制</button></div>' +
        '<pre><code>' + (lang === "cpp" || lang === "c++" ? highlightCpp(raw) : esc(raw)) + "</code></pre>";
      pre.parentNode.replaceChild(wrap, pre);
      /* 复制：优先用异步剪贴板 API（file:// 下可能没有），失败就退回临时 textarea + execCommand。
         done 同时挂在成功与失败回调上，所以点了总会给一次「已复制 ✓」的反馈。 */
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
  /* 把 <div class="formula" data-math="T(n)=O(n^2)"></div> 里的 data-math 渲染成带上标/下标的 HTML */
  function buildMath() {
    $$("[data-math]").forEach(function (e) { e.innerHTML = DS.mathHTML(e.getAttribute("data-math")); });
  }

  /* ====================== 可视化引擎 ====================== */
  /**
   * 用法：
   *   var viz = new DS.Viz('#vizX', {
   *     title:'冒泡排序', sub:'每轮把最大元素"冒"到末尾',
   *     build(){ ... 返回 {frames:[{desc, draw}]} }
   *   });
   * 帧渲染约定：每一帧用 frame.draw(svg) 把画布**完全重画**（最简单、最不容易出错）。
   *   ⚠ draw 里只能读「推帧那一刻就确定的量」：DS.Viz 会先同步跑完整个 build()，
   *     之后才开始逐帧渲染，读算法过程中被改写的活变量会导致每一帧都画成最终态。
   *     详见 SPEC 第 5.7 节，改完用 node tools/frame-check.mjs 自查。
   */
  function Viz(root, opts) {
    if (typeof root === "string") root = $(root);
    if (!root) throw new Error("Viz: 容器不存在");
    if (!(this instanceof Viz)) return new Viz(root, opts);
    var self = this;
    /* —— 实例字段一览（章节脚本一般不直接动它们，但调试时会看）——
       root      动画的宿主元素（页面里那个 <div id="viz-xxx">），会被写入整个 UI 并加上 .viz 类
       opts      构造时传进来的配置：title / sub / build / controls
       frames    帧数组，每项形如 { desc, draw(s) }；由 build() 一次性填满
       index     当前显示到第几帧（0 基）
       timer     setInterval 的句柄；null 表示没在播放
       speed     自动播放时每帧的毫秒数（速度滑杆会改它）
       stage/descEl/noEl/counter/bar  分别指向画布区、说明文字、步骤编号、右上计数器、进度条 */
    this.root = root;
    this.opts = opts || {};
    this.frames = [];
    this.index = 0;
    this.timer = null;
    this.speed = 700;      // 每帧毫秒
    this.title = this.opts.title || "算法演示";
    this.sub = this.opts.sub || "";
    this.controls = this.opts.controls !== false;   // 只有显式传 controls:false 才隐藏操作栏

    /* 整块 UI 在这里一次性拼好（标题栏 + 画布 + 说明栏 + 进度条 + 操作栏）。
       操作栏的按钮靠 data-act 属性区分行为，下面用事件委托统一处理。
       注意进度条是 <div class="viz-progress"><i></i></div>，宽度写在那个 <i> 上。 */
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

    /* 操作栏统一用「事件委托」：只在 root 上挂一个 click，
       靠 e.target.closest("[data-act]") 认出点的是哪个按钮。
       这样以后加按钮不用再单独绑事件。INPUT 被排除是因为速度滑杆在操作栏里。 */
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
    /* 速度滑杆：值 1..10 映射成 1180ms..100ms（线性反向）。
       正在播放时先暂停再重开，是为了让新的间隔立刻生效。 */
    var sp = $('[data-act="speed"]', this.root);
    if (sp) sp.addEventListener("input", function () {
      self.speed = 1300 - this.value * 120;   // 1=>1180ms  10=>100ms
      if (self.timer) { self.pause(); self.play(); }
    });

    /* 构建：**同步**跑完章节脚本的 build()，它负责把每一帧 push 进 frames。
       这也是「为什么 draw 里不能读活变量」的根源 —— build 全部跑完之后才开始渲染第 0 帧。
       build 收到的 ctx 提供两个便捷方法：ctx.frame(f) 推一帧、ctx.svg(w,h) 建画布。 */
    var res = null;
    if (typeof this.opts.build === "function") {
      res = this.opts.build({
        frame: function (f) { self.frames.push(f); },
        svg: function (w, h) { return SVG.svg(w, h); }
      });
    }
    /* build 也可以不推帧，而是直接 return {svg: ...} —— 那就是一张静态图 */
    if (res) {
      if (res.svg && !res.frames) { this.stage.appendChild(res.svg); }
      if (res.frames) this.frames = res.frames;
      if (res.title) $(".viz-title", this.root).textContent = res.title;
    }
    /* _vizRedraw：切主题时重画当前帧（内联 SVG 里的颜色取自 CSS 变量，重画才会更新）。
       _viz / _vizList：把实例挂回容器元素，供自动化测试（dom-sim.mjs / frame-check.mjs）
       按容器反查动画，也是「一个容器挂多个 Viz」时的列表。 */
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

  /* 渲染第 i 帧：1) 完全重画画布（frame.draw 返回新的 <svg>，直接替换掉旧的）
                    2) 更新说明栏与步骤号  3) 更新计数器/进度条  4) 首末帧把按钮置灰 */
  Viz.prototype._renderFrame = function (i) {
    var f = this.frames[i];
    if (!f) return;
    // 1) 完全重画（draw(s) 的返回值会被塞进一个 holder，便于整体替换）
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
    // 3) 面板：计数器与进度条（只有 1 帧时进度条直接给 100%，避免除以 0）
    this.counter.textContent = (i + 1) + " / " + this.frames.length;
    if (this.bar) this.bar.style.width = (this.frames.length <= 1 ? 100 : (i / (this.frames.length - 1)) * 100) + "%";
    // 4) 首/末帧时把对应的按钮置灰
    var self = this;
    $$("[data-act]", this.root).forEach(function (b) {
      var a = b.getAttribute("data-act");
      if (a === "prev" || a === "first") b.disabled = (i === 0);
      if (a === "next" || a === "last") b.disabled = (i === self.frames.length - 1);
    });
  };

  /* go(i, stop)：跳到第 i 帧。i 会被夹到合法范围；stop=true 时顺带暂停（手动单步用）。
     播放定时器里调的是 go(i)（stop 省略 = 不停），所以自动播放不会被自己打断。 */
  Viz.prototype.go = function (i, stop) {
    if (stop) this.pause();
    if (!this.frames.length) return;
    this.index = Math.max(0, Math.min(this.frames.length - 1, i));
    this._renderFrame(this.index);
  };
  /* next：已在末帧就停下（不再循环）；prev：手动后退，要顺带暂停 */
  Viz.prototype.next = function () {
    if (this.index >= this.frames.length - 1) { this.pause(); return; }
    this.go(this.index + 1);
  };
  Viz.prototype.prev = function () { this.go(this.index - 1, true); };

  /* play：已经在播（timer 非空）或没有帧就什么都不做；
     若当前停在末帧，先回到第 0 帧再播（相当于重播）。
     定时器每 speed 毫秒走一帧，走到末帧自动暂停。 */
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
  /* 用法：<div class="figure" data-steps> 里放多个 <svg>，脚本自动生成「上一步/下一步」按钮，
     同一时刻只显示其中一张（其余 display:none）。这样静态图也能一步步讲。
     svgs 少于 2 张就不接管（只有一张图没必要翻页）。 */
  function buildStepFigs() {
    $$("[data-steps]").forEach(function (box) {
      var svgs = $$("svg", box);            // 这一组里的所有分步图
      if (svgs.length < 2) return;
      var idx = 0;                          // 当前显示到第几张（0 基）
      var bar = document.createElement("div");
      bar.className = "viz-controls";
      bar.style.marginTop = "10px";
      bar.innerHTML = '<button class="btn" data-s="p">◀ 上一步</button>' +
                      '<span class="viz-sub"><b class="sc">1</b> / ' + svgs.length + '</span>' +
                      '<button class="btn" data-s="n">下一步 ▶</button>';
      box.appendChild(bar);
      var sc = $(".sc", bar);               // 那个「1 / N」里的数字节点
      function show(i) {
        idx = Math.max(0, Math.min(svgs.length - 1, i));
        svgs.forEach(function (s, k) { s.style.display = k === idx ? "" : "none"; });
        sc.textContent = idx + 1;           // 显示用的序号是 1 基
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
     章节翻页：Alt + ← / →   （避免与浏览器手势冲突）
     在输入框里按键一律不拦截 —— 否则打字时空格会变成「播放动画」。 */
  function bindKeys() {
    document.addEventListener("keydown", function (e) {
      var t = e.target;                    // 按键落点；在输入控件里就放行
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;

      /* Esc：收起右侧本页导航抽屉（连钉住一起取消，否则之后再也抽不出来） */
      if (e.key === "Escape") {
        if (DS.closeToc) DS.closeToc();
        return;
      }

      /* 章节翻页：先查当前页在 PAGES 里的下标，越界就不动（首页没有上一讲、末页没有下一讲） */
      if (e.altKey) {
        var idx = -1;
        for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === DS.page.id) idx = i;
        if (idx < 0) return;
        if (e.key === "ArrowRight" && idx + 1 < PAGES.length) { location.href = PAGES[idx + 1].file; e.preventDefault(); }
        if (e.key === "ArrowLeft" && idx - 1 >= 0) { location.href = PAGES[idx - 1].file; e.preventDefault(); }
        return;
      }

      /* 动画控制：作用于"当前可见的第一个动画"（一页里有多个动画，用视口位置挑；
         判定条件是「底边在 80px 之下、顶边还没滑出屏幕」，也就是大致能看见的那个）。
         做法是直接 click 对应的按钮，这样按钮的 disabled 状态、暂停逻辑都不用重复实现。 */
      var vizes = $$(".viz").filter(function (v) {
        var r0 = v.getBoundingClientRect();
        return r0.bottom > 80 && r0.top < (window.innerHeight || 800);
      });
      var host = vizes[0];                 // 当前可见的第一个动画容器
      if (!host || !host._viz) return;
      var act = null;                      // 这次按键对应哪个按钮的 data-act
      if (e.key === "ArrowRight") act = "next";
      else if (e.key === "ArrowLeft") act = "prev";
      else if (e.key === " " || e.code === "Space") act = "play";
      else if (e.key === "r" || e.key === "R") act = "first";
      if (!act) return;
      var btn = $('[data-act="' + act + '"]', host);
      if (btn && !btn.disabled) { btn.click(); e.preventDefault(); }
      /* 末帧时「播放」按钮可能被置灰，这种情况直接调引擎的 toggle，保证空格始终能重播 */
      else if (act === "play" && host._viz) { host._viz.toggle(); e.preventDefault(); }
    });
  }

  /* ====================== 启动 ====================== */
  /* 顺序有讲究：先定主题（避免闪白），再建顶栏/目录，再处理正文里的代码块与静态分步图，
     最后绑定快捷键。本脚本用 defer 引入，所以多数情况 DOMContentLoaded 已经过了。 */
  function boot() {
    initTheme();
    buildChrome();
    buildCodeBlocks();
    buildMath();
    buildStepFigs();
    bindKeys();
    // 页脚年份（页面里写 <span data-year></span> 就会自动填成当前年份）
    $$("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
