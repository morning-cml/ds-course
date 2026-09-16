/* ==========================================================================
   ch01-viz.js —— 第 02 讲《线性表：顺序表与链表》交互动画
   六个演示（页面容器 id 与脚本一一对应）：
     viz-seq-insert     顺序表插入：元素后移、size 变化、移动次数统计
     viz-singly-insert  单链表插入：指针顺序 + 错误顺序导致断链的对比
     viz-singly-delete  单链表删除：先保存 q / 跨过 q / delete q，以及后继覆盖法
     viz-reverse        单链表反转：pre / cur / nxt 三指针逐帧
     viz-cycle          快慢指针判环（Floyd）+ 环入口第二阶段
     viz-doubly         双向链表插入四条指针的顺序（附错误顺序与删除）
   依赖：course.js 提供的 DS.Viz 与 DS.SVG
   ========================================================================== */
(function () {
  "use strict";

  var SVG = DS.SVG;

  /* ====================== 公共绘制小工具 ====================== */

  /* 注册箭头 marker：默认灰 + 品牌蓝（SVG.defs 已带）+ 本页补充的绿 / 红 / 橙 */
  function defsEx(svg) {
    SVG.defs(svg);                                  // vz-arrow（灰）、vz-arrow-a（蓝）
    var defs = svg.querySelector("defs");
    if (!defs) return svg;
    var more = [
      ["vz-arrow-ok", "var(--ok)"],
      ["vz-arrow-warn", "var(--danger)"],
      ["vz-arrow-acc", "var(--accent)"]
    ];
    for (var i = 0; i < more.length; i++) {
      var m = SVG.el("marker", {
        id: more[i][0], viewBox: "0 0 10 10", refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse"
      });
      m.appendChild(SVG.el("path", { d: "M0,0 L10,5 L0,10 z", fill: more[i][1] }));
      defs.appendChild(m);
    }
    return svg;
  }

  /* 带颜色选择的箭头 */
  var MARK = {
    plain: "url(#vz-arrow)",
    brand: "url(#vz-arrow-a)",
    ok: "url(#vz-arrow-ok)",
    warn: "url(#vz-arrow-warn)",
    acc: "url(#vz-arrow-acc)"
  };
  function arrow(svg, x1, y1, x2, y2, cls, mark) {
    var e = SVG.line(x1, y1, x2, y2, cls || "", false);
    e.setAttribute("marker-end", mark || MARK.plain);
    svg.appendChild(e);
    return e;
  }
  function pathArrow(svg, d, cls, mark) {
    var e = SVG.path(d, cls || "", false);
    e.setAttribute("marker-end", mark || MARK.plain);
    svg.appendChild(e);
    return e;
  }

  var BOX_H = 36;

  /* 单链表结点：左半数据域 + 右半指针域（带一个代表指针的小圆点） */
  function lnode(svg, x, y, val, cls, w) {
    w = w || 88;
    var hw = Math.round(w / 2);
    var g = SVG.el("g");
    g.appendChild(SVG.el("rect", { x: x, y: y, width: hw, height: BOX_H, rx: 6, "class": "vz-box " + (cls || "") }));
    g.appendChild(SVG.el("rect", { x: x + hw, y: y, width: w - hw, height: BOX_H, rx: 6, "class": "vz-box " + (cls || "") }));
    g.appendChild(SVG.el("text", {
      x: x + hw / 2, y: y + 24, "text-anchor": "middle", "class": "vz-text"
    }, String(val)));
    g.appendChild(SVG.el("circle", { cx: x + hw + (w - hw) / 2, cy: y + BOX_H / 2, r: 3.6, "class": "vz-dot" }));
    svg.appendChild(g);
    return g;
  }

  /* 双向链表结点：prior | data | next 三个域 */
  function dnode(svg, x, y, val, cls) {
    var cw = 32, dw = 36, w = cw * 2 + dw;
    var g = SVG.el("g");
    g.appendChild(SVG.el("rect", { x: x, y: y, width: cw, height: BOX_H, rx: 6, "class": "vz-box " + (cls || "") }));
    g.appendChild(SVG.el("rect", { x: x + cw, y: y, width: dw, height: BOX_H, rx: 2, "class": "vz-box " + (cls || "") }));
    g.appendChild(SVG.el("rect", { x: x + cw + dw, y: y, width: cw, height: BOX_H, rx: 6, "class": "vz-box " + (cls || "") }));
    g.appendChild(SVG.el("text", {
      x: x + cw + dw / 2, y: y + 24, "text-anchor": "middle", "class": "vz-text"
    }, String(val)));
    g.appendChild(SVG.el("circle", { cx: x + cw / 2, cy: y + BOX_H / 2, r: 3.2, "class": "vz-dot" }));
    g.appendChild(SVG.el("circle", { cx: x + cw + dw + cw / 2, cy: y + BOX_H / 2, r: 3.2, "class": "vz-dot" }));
    svg.appendChild(g);
    return g;
  }

  /* NULL 结束标记 */
  function nullBox(svg, x, y, w) {
    var g = SVG.el("g");
    g.appendChild(SVG.el("rect", { x: x, y: y, width: w || 64, height: BOX_H, rx: 6, "class": "vz-box" }));
    g.appendChild(SVG.el("text", {
      x: x + (w || 64) / 2, y: y + 24, "text-anchor": "middle",
      "class": "vz-text", style: "fill:var(--text-faint);font-size:12px"
    }, "NULL"));
    svg.appendChild(g);
    return g;
  }

  /* 底部信息面板 */
  function panel(svg, x, y, w, h, lines) {
    svg.appendChild(SVG.el("rect", { x: x, y: y, width: w, height: h, rx: 8, "class": "vz-box" }));
    for (var i = 0; i < lines.length; i++) {
      svg.appendChild(SVG.el("text", {
        x: x + 14, y: y + 24 + i * 20, "class": "vz-text",
        style: "font-size:12.5px;font-family:var(--mono);fill:var(--text-soft)"
      }, lines[i]));
    }
  }

  /* 矩形边界上朝目标点的那一点（用来画出贴边的箭头） */
  function edgePoint(cx, cy, hw, hh, tx, ty) {
    var dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    var t = Math.min(
      dx !== 0 ? hw / Math.abs(dx) : Infinity,
      dy !== 0 ? hh / Math.abs(dy) : Infinity
    );
    return { x: cx + dx * t, y: cy + dy * t };
  }

  /* 统一的 Viz 构造入口 */
  function mount(id, title, sub, frames) {
    var host = document.getElementById(id);
    if (!host) return null;
    return new DS.Viz(host, {
      title: title, sub: sub,
      build: function () { return { frames: frames }; }
    });
  }

  /* ==================================================================
     演示 1：顺序表插入
     ================================================================== */
  (function seqInsert() {
    var host = document.getElementById('viz-seq-insert');
    if (!host) return;

    var CAP = 8;
    var INS = 50, IPOS = 4, IDX = IPOS - 1;          // 位序 4 → 下标 3
    var data, len, moves, frames = [];

    function snap(desc, hl) {
      var D = data.slice(), L = len, M = moves, H = hl || {};
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 800, Hh = 250;
          var svg = defsEx(SVG.svg(W, Hh));
          var bw = 78, gap = 10, x0 = 24, y0 = 44;

          svg.appendChild(SVG.text(x0, 26, "顺序表 data[0 … " + (CAP - 1) + "]　（灰色格子超出当前表长，逻辑上不属于线性表）", "vz-label", "start"));

          for (var k = 0; k < CAP; k++) {
            var x = x0 + k * (bw + gap);
            var cls = "";
            var val = (D[k] === null || D[k] === undefined) ? "·" : String(D[k]);
            if (H.write === k) cls = "done";
            else if (H.dst === k) cls = "done";
            else if (H.src === k) cls = "compare";
            else if (H.target === k) cls = "active";
            else if (H.shift && H.shift.indexOf(k) >= 0) cls = "compare";
            else if (k >= L) cls = "dim";
            svg.appendChild(SVG.box(x, y0, bw, 46, cls, val));
            svg.appendChild(SVG.label(x + bw / 2, y0 + 66, "[" + k + "]", "middle"));
          }

          /* 位序刻度 */
          svg.appendChild(SVG.text(x0, y0 + 88, "位序：1　　2　　3　　4　　5　　6　　7　　8（位序 = 下标 + 1）", "vz-label", "start"));

          var p2 = ["len（表长） = " + L + "　　capacity（容量） = " + CAP,
                    "元素移动次数 moves = " + M + "　　插入目标：位序 " + IPOS + "（下标 " + IDX + "），值 = " + INS];
          panel(svg, x0, 168, W - 2 * x0, 62, p2);

          if (H.note) {
            svg.appendChild(SVG.el("text", {
              x: x0, y: 152, "class": "vz-text",
              style: "font-size:12.5px;font-family:var(--mono);fill:var(--brand)"
            }, H.note));
          }
          return svg;
        }
      });
    }

    function reset() {
      data = [21, 32, 45, 58, 66, 79, null, null];
      len = 6; moves = 0; frames = [];
    }

    reset();
    snap("初始顺序表：<b>len = 6</b>、capacity = 8。目标：在位序 <b>4</b>（下标 3）插入 <b>50</b>。表尾还有空位，不需要扩容。", {});

    snap("先算出要挪哪些元素：位序 4 对应下标 3，原来的 <code>a[3..5]</code>（58、66、79）必须整体后移一格，共 <b>n − i + 1 = 6 − 4 + 1 = 3</b> 个。", { target: IDX, shift: [IDX, IDX + 1, IDX + 2] });

    for (var k = len - 1; k >= IDX; k--) {
      data[k + 1] = data[k];                      // 真实内存动作：后一个位置被前一个覆盖
      moves++;
      snap("第 " + moves + " 次移动：<code>data[" + (k + 1) + "] = data[" + k + "]</code>，把 " + data[k] +
           " 从下标 " + k + " 搬到下标 " + (k + 1) + "。<b>必须从后往前</b>——如果从前往后搬，" +
           "下标 " + k + " 会被前一个元素覆盖，原值就丢了。", { src: k, dst: k + 1 });
    }

    snap("三个元素都让开了，下标 <b>3</b> 现在是空位。接下来只做一次赋值：<code>data[" + IDX + "] = " + INS + "</code>。" +
         "注意此时 <b>len 还是 6</b>，新元素尚未计入表长。", { write: IDX });

    data[IDX] = INS;
    snap("写入完成：下标 3 变成 <b>" + INS + "</b>。现在才执行 <code>++len</code>，把它纳入线性表。", { write: IDX });

    len++;
    snap("插入结束：<b>len 从 6 变成 7</b>，元素序列为 21 32 45 <b>50</b> 58 66 79，共移动了 <b>" + moves +
         " = n − i + 1</b> 次。", { write: IDX });

    frames.push({
      desc: "复杂度小结：本次 <code>i = 4</code>，移动 3 次；<b>最好</b>情况是 <code>i = n+1</code>（插到表尾）移动 <b>0</b> 次；" +
            "<b>最坏</b>情况是 <code>i = 1</code>（插到表头）移动 <b>n</b> 次。等概率下平均移动 <b>n/2</b> 次，故插入的时间复杂度为 <b>O(n)</b>。" +
            "（只有「一直往表尾追加」才是均摊 O(1)。）",
      draw: function (s) {
        var svg = defsEx(SVG.svg(800, 250));
        var x0 = 24;
        svg.appendChild(SVG.text(x0, 30, "顺序表插入的移动次数与复杂度", "vz-label", "start"));
        var rows = [
          ["插入位置", "移动元素个数", "说明"],
          ["i = 1（表头）", "n", "最坏情况"],
          ["i = 4（本次）", "n − i + 1 = 3", "一般情况"],
          ["i = n + 1（表尾）", "0", "最好情况，均摊 O(1)"],
          ["等概率平均", "n / 2", "故时间复杂度 O(n)"]
        ];
        for (var r = 0; r < rows.length; r++) {
          for (var c = 0; c < 3; c++) {
            var cls = r === 0 ? "active" : (r === rows.length - 1 ? "done" : "");
            svg.appendChild(SVG.box(x0 + c * 250, 52 + r * 34, 234, 30, cls, rows[r][c]));
          }
        }
        return svg;
      }
    });

    mount('viz-seq-insert', "顺序表插入：在第 4 个位置插入 50", "单步 › 看元素如何从后往前让位", frames);
  })();

  /* ==================================================================
     演示 2：单链表插入（含错误顺序对比）
     ================================================================== */
  (function singlyInsert() {
    var host = document.getElementById('viz-singly-insert');
    if (!host) return;

    /* 屏幕布局：head 头结点 + 4 个数据结点 12 34 56 78 + NULL */
    var HX = 20, HW = 76;                 // 头结点
    var NX = [116, 236, 356, 476];        // 数据结点左边界
    var NW = 88, ROW = 70, SROW = 168;    // 主行 y / s 行 y
    var NULLX = 596;
    var VALS = [12, 34, 56, 78];
    var IPOS = 3;                          // 在位序 3 插入 99 → p 为第 2 个结点（34）

    var frames = [];

    /* cfg: {pStep:0..2, s:false|true, sNext:null|3|'self', pNext:3|'s', lost:bool, selfLoop:bool, err:bool, hlS:bool, hlP:bool} */
    function snap(desc, cfg) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 800, H = 270;
          var svg = defsEx(SVG.svg(W, H));
          var i, x, cx;

          svg.appendChild(SVG.text(HX, 30, cfg.err ? "✘ 错误顺序：先执行 p->next = s，再执行 s->next = p->next"
                                                   : "✔ 正确顺序：① s->next = p->next;　② p->next = s;",
            "vz-label", "start"));

          /* 头结点 */
          var hCls = cfg.hlHead ? "active" : "";
          lnode(svg, HX, ROW, "∅", hCls, HW);
          svg.appendChild(SVG.label(HX + HW / 2, ROW - 6, "head（头结点）", "middle"));

          /* 数据结点 */
          for (i = 0; i < 4; i++) {
            var cls = "";
            if (cfg.pStep === i + 1) cls = "active";                 // p 停在这里
            if (cfg.q === i) cls = "warn";
            if (cfg.err && i >= 2) cls = "dim";                       // 后半段丢失
            x = NX[i];
            lnode(svg, x, ROW, VALS[i], cls, NW);
            svg.appendChild(SVG.label(x + NW / 2, ROW + 56, "a" + (i + 1), "middle"));
          }
          nullBox(svg, NULLX, ROW, 64);

          /* 原始相邻边（1→2 永远存在；2→3 在 ② 执行后失效） */
          for (i = 0; i < 3; i++) {
            var from = NX[i] + NW, to = NX[i + 1];
            var broken = (i === 1) && (cfg.pNext === "s" || cfg.err);
            if (i === 1 && cfg.pNext === null) {
              arrow(svg, from, ROW + 18, to, ROW + 18, "vz-edge", MARK.plain);
            } else if (!broken) {
              arrow(svg, from, ROW + 18, to, ROW + 18, "vz-edge", MARK.plain);
            } else {
              pathArrow(svg, "M" + from + "," + (ROW + 18) + " L" + to + "," + (ROW + 18) + "",
                        "vz-edge ghost", MARK.plain);
            }
          }
          /* 尾结点 -> NULL */
          arrow(svg, NX[3] + NW, ROW + 18, NULLX, ROW + 18,
                cfg.err ? "vz-edge ghost" : "vz-edge", MARK.plain);

          /* 头结点 -> 首元结点 */
          arrow(svg, HX + HW, ROW + 18, NX[0], ROW + 18, "vz-edge", MARK.plain);

          /* p 指示 */
          if (cfg.pStep >= 1 && cfg.pStep <= 4) {
            var pi = cfg.pStep - 1;
            cx = NX[pi] + NW / 2;
            svg.appendChild(SVG.text(cx, ROW - 10, "p", "ptr-cur", "middle"));
            arrow(svg, cx, ROW - 6, cx, ROW - 2, "", MARK.brand);
          }

          /* 新结点 s */
          if (cfg.s) {
            var sx = NX[1];
            lnode(svg, sx, SROW, 99, cfg.err ? "warn" : "done", NW);
            svg.appendChild(SVG.text(sx + NW / 2, SROW - 8, "s = new Node(99)", "ptr-nxt", "middle"));
          }

          /* ① s->next = p->next */
          if (cfg.sNext === 3) {
            pathArrow(svg, "M" + (NX[1] + NW) + "," + (SROW + 12) + " Q " + (NX[2] + 40) + "," + (SROW + 4) +
                           " " + (NX[2] + 14) + "," + (ROW + 40), "vz-edge active", MARK.brand);
            svg.appendChild(SVG.text(NX[2] + 46, SROW + 22, "① s->next = p->next（新结点先接管后半段）", "vz-label", "start"));
          }
          if (cfg.selfLoop) {
            pathArrow(svg, "M" + (NX[1] + NW - 6) + "," + (SROW + 8) + " C " + (NX[1] + NW + 52) + "," + (SROW - 6) +
                           " " + (NX[1] + NW + 52) + "," + (SROW + 42) + " " + (NX[1] + NW - 6) + "," + (SROW + 30) + "",
                      "vz-edge danger", MARK.warn);
            svg.appendChild(SVG.text(NX[1] + NW + 60, SROW + 26, "s->next 读到的其实是 s 自己 → 自环", "vz-label", "start"));
          }

          /* ② p->next = s */
          if (cfg.pNext === "s") {
            var ax = NX[1] + NW / 2 + 12;
            pathArrow(svg, "M" + ax + "," + (ROW + BOX_H) + " L" + ax + "," + (SROW - 4),
                      cfg.err ? "vz-edge danger" : "vz-edge done",
                      cfg.err ? MARK.warn : MARK.ok);
            svg.appendChild(SVG.text(NX[2], ROW + 80, cfg.err ? "先断：旧路标丢失" : "② p->next = s（最后再断开旧路标）", "vz-label", "start"));
          }

          if (cfg.lost) {
            svg.appendChild(SVG.text(NX[2], ROW + 106, "56、78 及以后再也找不到路 ⇒ 内存泄漏", "vz-label", "start"));
          }

          panel(svg, 20, 214, 760, 46, [
            "位序 i = " + IPOS + "：需要先走 i−1 = 2 步找到前驱 p（值为 34），再执行两根指针的赋值。"
          ]);
          return svg;
        }
      });
    }

    snap("初始单链表：<code>head -&gt; 12 -&gt; 34 -&gt; 56 -&gt; 78 -&gt; NULL</code>。目标：在位序 <b>3</b> 插入 <b>99</b>，" +
         "也就是插在 34 和 56 之间。第一步必须先找到「第 i−1 = 2 个结点」。", { pStep: 0, s: false, pNext: null });

    snap("<b>定位前驱</b>：<code>p = head; for (k = 1; k &lt; i; ++k) p = p-&gt;next;</code> —— 走 2 步后 p 停在结点 <b>34</b>。" +
         "这一步是 O(n)，也就是「链表按位插入整体仍是 O(n)」的原因。", { pStep: 2, s: false, pNext: null });

    snap("<b>申请新结点</b>：<code>Node* s = new Node(99);</code>。此时 s 独立存在，还没有接进链表。" +
         "接下来两根指针的顺序，决定了链表会不会断。", { pStep: 2, s: true, pNext: null });

    snap("<b>① 先连</b>：<code>s-&gt;next = p-&gt;next;</code> 让新结点接管 p 原来的后继（56）。" +
         "此刻 34 同时指向 56 和 s，链表临时「两条路」，但两条都通，数据一个都没丢。",
         { pStep: 2, s: true, sNext: 3, pNext: null });

    snap("<b>② 后断</b>：<code>p-&gt;next = s;</code> 让前驱改指新结点，旧的 34→56 这条边自动失效（灰色虚线）。" +
         "插入完成，全程没有丢链。", { pStep: 2, s: true, sNext: 3, pNext: "s" });

    snap("插入后的链表：<code>head -&gt; 12 -&gt; 34 -&gt; <b>99</b> -&gt; 56 -&gt; 78 -&gt; NULL</code>。" +
         "整个过程只改了 2 根指针，没有搬动任何元素，这一步是 O(1)；加上找前驱的 O(n)，总时间 O(n)。",
         { pStep: 0, s: true, sNext: 3, pNext: "s" });

    snap("<b>现在看错误示范。</b>假如把两句话写反：先 <code>p-&gt;next = s;</code>。此刻 34 已经指向 s，" +
         "「原来后继是 56」这条信息被覆盖掉了，<b>56 和 78 从此无人引用</b>。",
         { pStep: 2, s: true, pNext: "s", err: true, lost: true });

    snap("接着执行 <code>s-&gt;next = p-&gt;next;</code>：因为 p-&gt;next 现在就是 s，所以读到的是 <b>s 自己</b>，" +
         "结果是 <code>s-&gt;next == s</code> —— 一个孤零零的自环。", 
         { pStep: 2, s: true, pNext: "s", selfLoop: true, err: true, lost: true });

    snap("<b>结论</b>：顺序绝对不能交换。口诀是「<b>新结点先认路，老结点再改路</b>」。" +
         "正确顺序 <code>s-&gt;next = p-&gt;next;</code> → <code>p-&gt;next = s;</code> 之所以安全，" +
         "是因为在改写 p-&gt;next 之前，旧的后继地址已经被 s-&gt;next 保存下来了。",
         { pStep: 2, s: true, sNext: 3, pNext: "s" });

    mount('viz-singly-insert', "单链表插入：先连后断", "最后两帧演示顺序写反会怎样断链", frames);
  })();

  /* ==================================================================
     演示 3：单链表删除（按位删除 + 后继覆盖法）
     ================================================================== */
  (function singlyDelete() {
    var host = document.getElementById('viz-singly-delete');
    if (!host) return;

    var HX = 20, HW = 76;
    var NX = [116, 236, 356, 476];
    var NW = 88, ROW = 84, NULLX = 596;
    var frames = [];

    /* cfg:
       mode    : 'index' | 'cover'
       vals    : 4 个结点当前显示的值
       pIdx/qIdx : 要标注的指针下标（-1 表示不画）
       goneIdx : 显示为「已释放」的结点下标
       skip    : true 时画 34 → 78 的跨结点边
       note    : 额外提示
       title   : 顶部标题
    */
    function snap(desc, cfg) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 800, H = 292;
          var svg = defsEx(SVG.svg(W, H));
          var i;

          svg.appendChild(SVG.text(HX, 30, cfg.title || "", "vz-label", "start"));

          lnode(svg, HX, ROW, "∅", "", HW);
          svg.appendChild(SVG.label(HX + HW / 2, ROW - 8, "head（头结点）", "middle"));

          var EX = cfg.exists || [true, true, true, true];
          var nx = cfg.nx || [1, 2, 3, -1];

          for (i = 0; i < 4; i++) {
            var cls = "";
            if (cfg.pIdx === i) cls = "active";
            if (cfg.qIdx === i) cls = "warn";
            if (cfg.coverIdx === i) cls = "compare";
            if (!EX[i]) cls = "dim";
            node(svg, NX[i], ROW, cfg.vals[i], cls, i);
          }
          nullBox(svg, NULLX, ROW, 64);
          arrow(svg, HX + HW, ROW + 18, NX[0], ROW + 18, "vz-edge", MARK.plain);

          /* 按 nx 数组画链：相邻走直线，跳结点走上方弧线 */
          for (i = 0; i < 4; i++) {
            if (!EX[i]) continue;
            var t = nx[i];
            if (t === null || t === undefined) continue;
            var hl = cfg.hl && cfg.hl.indexOf(i) >= 0;
            if (t === -1) {
              arrow(svg, NX[i] + NW, ROW + 18, NULLX, ROW + 18, "vz-edge", MARK.plain);
            } else if (t === i + 1) {
              arrow(svg, NX[i] + NW, ROW + 18, NX[t], ROW + 18, hl ? "vz-edge done" : "vz-edge", hl ? MARK.ok : MARK.plain);
            } else if (t > i) {
              var ax = NX[i] + NW - 10, bx = NX[t] + 8, cy = ROW - 40;
              pathArrow(svg, "M" + ax + "," + (ROW - 2) + " C " + (ax + 40) + "," + cy + " " +
                             (bx - 40) + "," + cy + " " + bx + "," + (ROW + 2),
                        hl ? "vz-edge done" : "vz-edge active", hl ? MARK.ok : MARK.brand);
              if (cfg.arcLabel) {
                svg.appendChild(SVG.text(NX[3] + 96, ROW - 34, cfg.arcLabel, "vz-label", "start"));
              }
            } else {
              var mx = NX[i] + NW / 2, mxx = NX[t] + NW / 2;
              pathArrow(svg, "M" + mx + "," + (ROW + BOX_H) + " C " + (mx + 40) + "," + (ROW + BOX_H + 44) + " " +
                             (mxx - 40) + "," + (ROW + BOX_H + 44) + " " + mxx + "," + (ROW + BOX_H + 2),
                        "vz-edge active", MARK.brand);
            }
          }
          /* 后继覆盖法中 34 的值被后继覆盖 */
          if (cfg.coverIdx >= 0) {
            svg.appendChild(SVG.text(NX[cfg.coverIdx] + NW / 2, ROW - 26, "值被后继覆盖", "ptr-nxt", "middle"));
          }
          /* 自环（错误顺序/覆盖法的边界） */
          if (cfg.selfLoop) {
            pathArrow(svg, "M" + (NX[1] + NW - 4) + "," + (ROW + 6) + " C " + (NX[1] + NW + 60) + "," + (ROW - 10) + " " +
                           (NX[1] + NW + 60) + "," + (ROW + 50) + " " + (NX[1] + NW - 4) + "," + (ROW + 30),
                      "vz-edge danger", MARK.warn);
          }

          /* 指针标注 */
          if (cfg.pIdx >= 0) {
            var px = NX[cfg.pIdx] + NW / 2;
            svg.appendChild(SVG.text(px - 18, ROW - 8, "p", "ptr-cur", "middle"));
            arrow(svg, px - 18, ROW - 4, px - 18, ROW - 1, "", MARK.brand);
          }
          if (cfg.qIdx >= 0) {
            var qx = NX[cfg.qIdx] + NW / 2;
            svg.appendChild(SVG.text(qx + 22, ROW - 8, "q", "ptr-nxt", "middle"));
            arrow(svg, qx + 22, ROW - 4, qx + 22, ROW - 1, "", MARK.acc);
          }
          if (cfg.goneIdx >= 0) {
            svg.appendChild(SVG.text(NX[cfg.goneIdx] + NW / 2, ROW + BOX_H + 40, "delete q → 内存已归还", "vz-label", "middle"));
          }

          panel(svg, 20, 236, 760, 46, [cfg.note || ""]);
          return svg;
        }
      });
    }

    /* 结点绘制（带下标标签，便于讲解「谁被删了」） */
    function node(svg, x, y, val, cls, i) {
      lnode(svg, x, y, val, cls, NW);
      svg.appendChild(SVG.label(x + NW / 2, y + BOX_H + 16, "结点" + (i + 1), "middle"));
    }

    var V = [12, 34, 56, 78];

    /* ---------- 第一部分：按位删除（删位序 3，即结点 56） ---------- */
    snap("单链表：<code>head -&gt; 12 -&gt; 34 -&gt; 56 -&gt; 78 -&gt; NULL</code>。目标：删除位序 <b>3</b> 的结点。",
      { title: "第一部分：删除位序 i = 3 的结点（标准做法）", vals: V.slice(), pIdx: -1, qIdx: -1, goneIdx: -1,
        note: "删除位序 i 的结点，合法范围是 1 ≤ i ≤ len；注意插入能到 len+1，删除只能到 len。" });

    snap("<b>找前驱</b>：<code>p = head; for (k = 1; k &lt; i; ++k) p = p-&gt;next;</code>，走 i−1 = 2 步，p 停在结点 34。" +
         "删除必须先拿到前驱，这是单链表删除慢的根源。",
      { title: "第一部分：删除位序 i = 3 的结点（标准做法）", vals: V.slice(), pIdx: 1, qIdx: -1, goneIdx: -1,
        note: "p 指向第 i−1 个结点；这一步是 O(n)。" });

    snap("<b>保存待删结点</b>：<code>q = p-&gt;next;</code> 让 q 指向 56，同时 <code>e = q-&gt;data;</code> 把值 56 交给调用者。" +
         "<b>这两步必须在改指针之前做</b>，否则 q 的地址就永远丢了。",
      { title: "第一部分：删除位序 i = 3 的结点（标准做法）", vals: V.slice(), pIdx: 1, qIdx: 2, goneIdx: -1,
        note: "q = p->next;  e = q->data;    ← 先保存，后改指针" });

    snap("<b>跨过 q</b>：<code>p-&gt;next = q-&gt;next;</code> 让 34 直接指向 78。原来的 34→56 这条边失效（灰色虚线），" +
         "但此刻 56 这块内存仍然存在，还需要手动释放。",
      { title: "第一部分：删除位序 i = 3 的结点（标准做法）", vals: V.slice(), pIdx: 1, qIdx: 2, goneIdx: -1,
        nx: [1, 3, null, -1], hl: [1], arcLabel: "p->next = q->next（跨过 q）",
        note: "p->next = q->next;   ← 逻辑上 56 已经不在表里了" });

    snap("<b>释放内存</b>：<code>delete q;</code>（建议再补一句 <code>q = nullptr;</code> 防野指针），然后 <code>--len</code>。" +
         "<b>漏掉 delete 就是内存泄漏</b>——链表结点是 new 出来的，不会自动回收。",
      { title: "第一部分：删除位序 i = 3 的结点（标准做法）", vals: V.slice(), pIdx: -1, qIdx: 2, goneIdx: 2,
        exists: [true, true, false, true], nx: [1, 3, null, -1], hl: [1], arcLabel: "p->next = q->next（跨过 q）",
        note: "delete q;  q = nullptr;  --len;   ← 释放 + 置空 + 减表长，三件事一件都不能少" });

    snap("删除完成：<code>head -&gt; 12 -&gt; 34 -&gt; 78 -&gt; NULL</code>。注意删除本身只改了 1 根指针（O(1)），" +
         "但找前驱是 O(n)，所以<b>按位删除整体仍是 O(n)</b>。",
      { title: "第一部分：删除位序 i = 3 的结点（标准做法）", vals: V.slice(), pIdx: -1, qIdx: -1, goneIdx: 2,
        exists: [true, true, false, true], nx: [1, 3, null, -1], hl: [1],
        note: "单链表按位删除：找前驱 O(n) + 摘链 O(1) = O(n)。" });

    /* ---------- 第二部分：只给待删结点指针时的 O(1) 后继覆盖法 ---------- */
    snap("<b>换一个场景</b>：现在只给你一个指向结点 34 的指针 p，<b>没有任何前驱信息</b>，要求 O(1) 删除它。" +
         "单链表回头无路，怎么办？",
      { title: "第二部分：只给待删结点指针 p，如何 O(1) 删除？", vals: V.slice(), pIdx: 1, qIdx: -1, goneIdx: -1,
        note: "如果按老办法找前驱，就得 O(n)；本题要求 O(1)。" });

    snap("<b>偷梁换柱第一步</b>：<code>p-&gt;data = p-&gt;next-&gt;data;</code> 把后继 56 的值抄到 p 身上。" +
         "从这一刻起，结点 34 里装的是 56。",
      { title: "第二部分：只给待删结点指针 p，如何 O(1) 删除？", vals: [12, 56, 56, 78], pIdx: 1, qIdx: 2, goneIdx: -1, coverIdx: 1,
        note: "p->data = p->next->data;   ← 先把自己「变成」后继" });

    snap("<b>偷梁换柱第二步</b>：<code>q = p-&gt;next; p-&gt;next = q-&gt;next; delete q;</code> —— 真正被释放的是原来的后继结点。" +
         "从外部看，值 34 消失了，效果和删除 34 完全一样。",
      { title: "第二部分：只给待删结点指针 p，如何 O(1) 删除？", vals: [12, 56, 56, 78], pIdx: 1, qIdx: 2, goneIdx: 2,
        exists: [true, true, false, true], nx: [1, 3, null, -1], hl: [1],
        note: "q = p->next;  p->next = q->next;  delete q;   ← 全部 O(1)" });

    snap("结果：<code>head -&gt; 12 -&gt; 56 -&gt; 78 -&gt; NULL</code>，删除只用 O(1)。" +
         "但要注意副作用：<b>被 delete 的其实是原 56 那个结点，而 34 那个结点的地址仍然有效但内容变了</b>。" +
         "如果外部还有别的指针指向原 56，它们会变成悬垂指针。",
      { title: "第二部分：只给待删结点指针 p，如何 O(1) 删除？", vals: [12, 56, 56, 78], pIdx: -1, qIdx: -1, goneIdx: 2,
        exists: [true, true, false, true], nx: [1, 3, null, -1], hl: [1],
        note: "外部看到的是「34 被删了」，实际被释放的是原 56 —— 这是一个隐式行为，工程上要谨慎。" });

    snap("<b>致命限制</b>：如果 p 恰好是<b>尾结点</b>，<code>p-&gt;next</code> 是 <code>nullptr</code>，" +
         "<code>p-&gt;next-&gt;data</code> 立刻解空指针崩溃。所以后继覆盖法<b>删不了尾结点</b>，" +
         "那种情况只能老老实实花 O(n) 找前驱。",
      { title: "第二部分：只给待删结点指针 p，如何 O(1) 删除？", vals: [12, 34, 56, 78], pIdx: 3, qIdx: -1, goneIdx: -1,
        note: "p 是尾结点 ⇒ p->next == nullptr ⇒ p->next->data 直接崩溃。面试追问点！" });

    mount('viz-singly-delete', "单链表删除：保存 q → 跨过 q → 释放 q", "并附 O(1) 的后继覆盖法", frames);
  })();

  /* ==================================================================
     演示 4：单链表反转（pre / cur / nxt 三指针）
     ================================================================== */
  (function reverse() {
    var host = document.getElementById('viz-reverse');
    if (!host) return;

    var VALS = [1, 2, 3, 4];
    var CX = [110, 226, 342, 458];        // 结点中心 x
    var BW = 76, ROW = 70, NULLX = 552;
    var frames = [];

    /* cfg: {pre, cur, nxt, nextOf:[...], headTarget, flip, done} */
    function snap(desc, cfg) {
      var NO = cfg.nextOf.slice();
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 760, H = 262;
          var svg = defsEx(SVG.svg(W, H));
          var i;

          svg.appendChild(SVG.text(14, 26, "pre = 已反转段的头　cur = 当前待处理结点　nxt = 必须先存档的后继", "vz-label", "start"));

          /* head 指针 */
          var ht = cfg.headTarget;
          if (ht >= 0) {
            svg.appendChild(SVG.text(14, ROW + 24, "head", "vz-label", "start"));
            arrow(svg, 52, ROW + 18, CX[ht] - BW / 2, ROW + 18, "vz-edge active", MARK.brand);
          }

          /* 结点 */
          for (i = 0; i < 4; i++) {
            var cls = "";
            if (i < cfg.cur || cfg.done) cls = "done";
            if (i === cfg.cur) cls = "active";
            if (i === cfg.nxt) cls = "compare";
            if (cfg.cur < 0 && i === cfg.pre) cls = "done";
            var x = CX[i] - BW / 2;
            lnode(svg, x, ROW, VALS[i], cls, BW);
            svg.appendChild(SVG.label(CX[i], ROW + BOX_H + 16, "原第 " + (i + 1) + " 个", "middle"));
          }
          void NULLX;

          /* 每一条 next 边都从结点底部绕行，避免交叉歧义 */
          for (i = 0; i < 4; i++) {
            var t = NO[i];
            var dip = 150 + i * 24;
            var hot = (cfg.flip === i);
            var clsE = hot ? "vz-edge done" : (t < i && t >= 0 ? "vz-edge active" : "vz-edge");
            var mk = hot ? MARK.ok : (t < i && t >= 0 ? MARK.brand : MARK.plain);
            if (t >= 0) {
              pathArrow(svg, "M" + CX[i] + "," + (ROW + BOX_H + 2) + " L" + CX[i] + "," + dip +
                             " L" + CX[t] + "," + dip + " L" + CX[t] + "," + (ROW + BOX_H + 3), clsE, mk);
            } else {
              pathArrow(svg, "M" + CX[i] + "," + (ROW + BOX_H + 2) + " L" + CX[i] + "," + dip +
                             " L" + (CX[i] - 40) + "," + dip, clsE, mk);
              svg.appendChild(SVG.text(CX[i] - 46, dip + 4, "NULL", "vz-label", "end"));
            }
          }

          /* 指针标签 */
          function tag(idx, label, cls, mark) {
            if (idx < 0) return;
            svg.appendChild(SVG.text(CX[idx], 46, label, cls, "middle"));
            arrow(svg, CX[idx], 50, CX[idx], ROW - 4, "", mark);
          }
          tag(cfg.pre, "pre", "ptr-pre", MARK.ok);
          tag(cfg.cur, "cur", "ptr-cur", MARK.brand);
          tag(cfg.nxt, "nxt", "ptr-nxt", MARK.acc);

          panel(svg, 14, 224, 732, 32, [cfg.note || ""]);
          return svg;
        }
      });
    }

    var nextOf = [1, 2, 3, -1];
    var pre = -1, cur = 0, nxt = -1, round = 1;

    snap("初始状态：<code>pre = NULL</code>（已反转段为空），<code>cur</code> 指向首元结点 1，" +
         "所有边都还是原来的方向。反转的目标是把每一条 <code>next</code> 边掉头。",
      { pre: -1, cur: 0, nxt: -1, nextOf: nextOf, headTarget: 0, note: "每轮固定四步：① nxt = cur->next　② cur->next = pre　③ pre = cur　④ cur = nxt" });

    while (cur !== -1 && round <= 8) {
      nxt = nextOf[cur];
      snap("<b>第 " + round + " 轮 ①</b>：<code>nxt = cur-&gt;next</code> = " + (nxt < 0 ? "NULL" : VALS[nxt]) +
           "。这一步是<b>存档</b>，必须最先做——因为下一步就要把 <code>cur-&gt;next</code> 改掉，" +
           "不存档就再也找不到后半段了。",
        { pre: pre, cur: cur, nxt: nxt, nextOf: nextOf, headTarget: 0, note: "① nxt = cur->next;　　// 先存档" });

      nextOf[cur] = pre;
      snap("<b>第 " + round + " 轮 ②</b>：<code>cur-&gt;next = pre</code>，把结点 " + VALS[cur] +
           " 的指针指向 " + (pre < 0 ? "NULL" : ("结点 " + VALS[pre])) + "。这条边正式掉头（绿色）。",
        { pre: pre, cur: cur, nxt: nxt, nextOf: nextOf, headTarget: 0, flip: cur, note: "② cur->next = pre;　　// 翻转这条边" });

      pre = cur;
      cur = nxt;
      snap("<b>第 " + round + " 轮 ③④</b>：<code>pre = cur;</code> 与 <code>cur = nxt;</code>，" +
           "两条指针同时前移。现在已反转段是 " + (pre < 0 ? "空" : VALS.slice(0, pre + 1).reverse().join(" ← ")) +
           "，cur 指向 " + (cur < 0 ? "NULL" : VALS[cur]) + "。",
        { pre: pre, cur: cur, nxt: -1, nextOf: nextOf, headTarget: 0, note: "③ pre = cur;　④ cur = nxt;　　// 前移，进入下一轮" });
      round++;
    }

    snap("循环结束（<code>cur == NULL</code>）：所有边都掉完头，<code>pre</code> 指向原来的尾结点 4，" +
         "它就是<b>新链表的表头</b>。最后还差一步：<code>head-&gt;next = pre;</code> 让头指针接纳新链表。",
      { pre: 3, cur: -1, nxt: -1, nextOf: [-1, 0, 1, 2], headTarget: 3, done: true,
        note: "迭代法：时间 O(n)，空间 O(1)。递归法代码更短，但栈深度 O(n)，长链表会爆栈。" });

    mount('viz-reverse', "单链表反转：pre / cur / nxt 三指针", "每轮四步，边翻边走", frames);
  })();

  /* ==================================================================
     演示 5：快慢指针判环（Floyd）+ 环入口
     ================================================================== */
  (function cycle() {
    var host = document.getElementById('viz-cycle');
    if (!host) return;

    /* 链表：0→1→2→3→4→5→6→7→8→5（环入口是 5，尾长 a = 5，环长 b = 4） */
    var NXT = [1, 2, 3, 4, 5, 6, 7, 8, 5];
    var P = [
      { x: 110, y: 250 }, { x: 180, y: 250 }, { x: 250, y: 250 },
      { x: 320, y: 250 }, { x: 390, y: 250 },
      { x: 470, y: 250 },                                   // 环入口
      { x: 590, y: 140 }, { x: 710, y: 250 }, { x: 590, y: 360 }  // 环
    ];
    var HW = 27, HH = 17;
    var frames = [];

    function clip(i, j) { return edgePoint(P[i].x, P[i].y, HW, HH, P[j].x, P[j].y); }
    function clipTo(i, tx, ty) { return edgePoint(P[i].x, P[i].y, HW, HH, tx, ty); }

    /* cfg: {slow, fast, phase, a, b, k, meet, entry, note} */
    function snap(desc, cfg) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 780, H = 414;
          var svg = defsEx(SVG.svg(W, H));
          var i;

          svg.appendChild(SVG.text(14, 108, cfg.phase === 2
            ? "A = 从表头出发的 ptr1　　B = 从相遇点出发的 ptr2（两者每步都走 1 格）"
            : "S = slow（每步 1 格）　　F = fast（每步 2 格）", "vz-label", "start"));

          /* 边 */
          for (i = 0; i < NXT.length; i++) {
            var j = NXT[i];
            var clsE = "vz-edge";
            if (i === cfg.meet || j === cfg.meet) clsE = "vz-edge active";
            if (cfg.entry === i || (cfg.entry === j && i === 8)) clsE = "vz-edge done";
            var p1 = clip(i, j), p2 = clip(j, i);
            arrow(svg, p1.x, p1.y, p2.x, p2.y, clsE, MARK.plain);
          }

          /* head */
          svg.appendChild(SVG.text(14, 256, "head", "vz-label", "start"));
          var hEnd = clipTo(0, 20, 250);
          arrow(svg, 52, 250, hEnd.x, hEnd.y, "vz-edge active", MARK.brand);

          /* 结点 */
          for (i = 0; i < P.length; i++) {
            var cls = "";
            if (i === cfg.entry) cls = "done";
            else if (i === cfg.meet) cls = "warn";
            else if (i === cfg.slow && i === cfg.fast) cls = "warn";
            else if (i === cfg.slow || i === cfg.fast || i === cfg.a || i === cfg.b) cls = "active";
            var on = /active|done|warn|compare/.test(cls) ? "on" : "";
            svg.appendChild(SVG.circle(P[i].x, P[i].y, 17, "vz-node " + cls, String(i), on));
            svg.appendChild(SVG.label(P[i].x, P[i].y + 36, "n" + i, "middle"));
          }
          /* 环入口标注：放在结点 5 正上方，用虚线引下来（刚好落在 S / F 两个标记之间） */
          svg.appendChild(SVG.text(P[5].x, 130, "环入口", "vz-label", "middle"));
          svg.appendChild(SVG.el("line", {
            x1: P[5].x, y1: 136, x2: P[5].x, y2: 204, "class": "vz-edge dim",
            style: "stroke-dasharray:5 4"
          }));

          /* 第一阶段：slow / fast 标记 */
          if (cfg.phase === 1) {
            if (cfg.slow >= 0) svg.appendChild(SVG.circle(P[cfg.slow].x - 16, P[cfg.slow].y - 32, 12, "vz-node active", "S", "on"));
            if (cfg.fast >= 0) svg.appendChild(SVG.circle(P[cfg.fast].x + 16, P[cfg.fast].y - 32, 12, "vz-node compare", "F", "on"));
          }
          /* 第二阶段：ptr1 / ptr2 标记 */
          if (cfg.phase === 2) {
            if (cfg.a >= 0) svg.appendChild(SVG.circle(P[cfg.a].x - 16, P[cfg.a].y + 40, 12, "vz-node active", "A", "on"));
            if (cfg.b >= 0) svg.appendChild(SVG.circle(P[cfg.b].x + 16, P[cfg.b].y + 40, 12, "vz-node done", "B", "on"));
          }

          panel(svg, 14, 8, 752, 76, [
            "带环单链表：0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 5（结点 5 是环入口；尾长 a = 5，环长 b = 4）",
            cfg.note || "",
            cfg.line2 || ""
          ]);
          return svg;
        }
      });
    }

    /* ---------- 第一阶段 ---------- */
    snap("出发前：slow 与 fast 都指向表头结点 0。fast 每次走 2 步、slow 每次走 1 步。",
      { phase: 1, slow: 0, fast: 0, note: "t = 0　slow = n0　fast = n0", line2: "若链表无环，fast 会先撞上 NULL；若有环，fast 会先进环并绕圈。" });

    var slow = 0, fast = 0, t = 0, meet = -1;
    while (t < 40) {
      t++;
      slow = NXT[slow];
      fast = NXT[NXT[fast]];
      snap("第 <b>" + t + "</b> 轮：slow 走 1 步到 <b>n" + slow + "</b>；fast 走 2 步到 <b>n" + fast + "</b>。" +
           (slow === fast ? " <b>两者相遇！</b>" : " 还没追上，继续。"),
        { phase: 1, slow: slow, fast: fast, note: "t = " + t + "　slow = n" + slow + "　fast = n" + fast,
          line2: slow === fast ? "相遇 ⇒ 链表有环。注意 fast 是「追上」而不是「跨过」slow。" :
                                "fast 相对 slow 每轮快 1 步，所以在环内一定会追上。" });
      if (slow === fast) { meet = slow; break; }
    }

    snap("第一阶段结束：slow 与 fast 在 <b>n" + meet + "</b> 相遇（t = " + t + " 轮）。" +
         "设尾长 a = 5、环长 b = 4，相遇点距入口 c = 3 步。代入公式：<code>t = m·b</code>，" +
         "所以 <code>a = m·b − c = (m−1)·b + (b−c)</code>。",
      { phase: 1, slow: meet, fast: meet, meet: meet, note: "相遇点 meet = n" + meet + "　t = " + t,
        line2: "含义：从相遇点走 b−c 步回到入口，再多绕整圈仍在入口；从表头走 a 步也到入口。" });

    /* ---------- 第二阶段 ---------- */
    var a = 0, b = meet, k = 0;
    snap("第二阶段开始：<code>ptr1 = head</code>（结点 0），<code>ptr2 = meet</code>（结点 " + meet + "），" +
         "两个指针都每次走 1 步。依据 <code>a = (m−1)·b + (b − c)</code>，它们必然在环入口会合。",
      { phase: 2, a: a, b: b, note: "ptr1 = n" + a + "　ptr2 = n" + b + "　k = 0",
        line2: "这一步不需要任何额外空间，仍然是 O(1)。" });

    while (a !== b && k < 40) {
      a = NXT[a];
      b = NXT[b];
      k++;
      snap("第 <b>" + k + "</b> 步：ptr1 走到 <b>n" + a + "</b>，ptr2 走到 <b>n" + b + "</b>。" +
           (a === b ? " <b>两者重合 —— 这里就是环入口！</b>" : " 还没重合，继续。"),
        { phase: 2, a: a, b: b, note: "ptr1 = n" + a + "　ptr2 = n" + b + "　k = " + k,
          line2: a === b ? "相遇 ⇒ 该结点就是环入口。" : "ptr1 从表头走了 " + k + " 步，ptr2 从相遇点也走了 " + k + " 步。" });
    }

    snap("答案：环入口是 <b>n" + a + "</b>。整个算法（判环 + 找入口）只遍历了两趟，" +
         "时间 <b>O(n)</b>、空间 <b>O(1)</b>。若要再求环长，从入口绕一圈回到入口即可。",
      { phase: 2, a: a, b: b, entry: a, note: "环入口 = n" + a + "　总时间 O(n)　额外空间 O(1)",
        line2: "变体：环长 = 从入口绕一圈的步数；尾长 a = 表头到入口的步数；总长 = a + b。" });

    mount('viz-cycle', "快慢指针判环（Floyd）", "slow 每步 1 格，fast 每步 2 格", frames);
  })();

  /* ==================================================================
     演示 6：双向链表插入四条指针的顺序（附错误顺序与删除）
     ================================================================== */
  (function doubly() {
    var host = document.getElementById('viz-doubly');
    if (!host) return;

    var SLOT = [90, 250, 410, 570];       // 四个结点的左边界
    var DW = 100, ROW = 150, NULLX = 700;
    var VALS = [12, 34, 99, 56];          // 槽位 2 是待插入的新结点 99
    var frames = [];

    /* cfg:
       exists : [bool x4]
       nx     : [下标 | -1 | null]   next 指向
       pr     : [下标 | -1 | null]   prior 指向
       hlNext : [下标]  高亮这些 next 边
       hlPrior: [下标]  高亮这些 prior 边
       badPrior:[下标]  画成红色（断链）
       selfPrior: 下标  画 prior 自环
       pIdx   : 标注 p
       title  : 顶部标题
    */
    function snap(desc, cfg) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 800, H = 300;
          var svg = defsEx(SVG.svg(W, H));
          var i;

          svg.appendChild(SVG.text(14, 26, cfg.title || "", "vz-label", "start"));

          /* 先画边（会被结点覆盖一部分，但这里边都在结点之间的空隙里，不会重叠） */
          for (i = 0; i < 4; i++) {
            if (!cfg.exists[i]) continue;
            var t = cfg.nx[i];
            var y1 = ROW + 12;
            var hlN = cfg.hlNext && cfg.hlNext.indexOf(i) >= 0;
            if (t === null || t === undefined) continue;
            if (t >= 0) {
              arrow(svg, SLOT[i] + DW, y1, SLOT[t], y1, hlN ? "vz-edge done" : "vz-edge", hlN ? MARK.ok : MARK.plain);
            } else {
              arrow(svg, SLOT[i] + DW, y1, NULLX, y1, "vz-edge", MARK.plain);
            }
          }
          for (i = 0; i < 4; i++) {
            if (!cfg.exists[i]) continue;
            var q = cfg.pr[i];
            var y2 = ROW + 26;
            var hlP = cfg.hlPrior && cfg.hlPrior.indexOf(i) >= 0;
            var badP = cfg.badPrior && cfg.badPrior.indexOf(i) >= 0;
            if (cfg.selfPrior === i) {
              pathArrow(svg, "M" + (SLOT[i] - 4) + "," + (ROW + 10) + " C " + (SLOT[i] - 56) + "," + (ROW - 6) + " " +
                             (SLOT[i] - 56) + "," + (ROW + 46) + " " + (SLOT[i] - 4) + "," + (ROW + 28),
                        "vz-edge danger", MARK.warn);
              svg.appendChild(SVG.text(SLOT[i] + DW / 2, ROW + 74, "③ 实际执行成了 s->prior = s（自环）", "vz-label", "middle"));
              continue;
            }
            if (q === null || q === undefined) continue;
            if (q >= 0) {
              arrow(svg, SLOT[i], y2, SLOT[q] + DW, y2,
                    badP ? "vz-edge danger" : (hlP ? "vz-edge done" : "vz-edge"),
                    badP ? MARK.warn : (hlP ? MARK.ok : MARK.plain));
            } else {
              arrow(svg, SLOT[i], y2, 40, y2, "vz-edge", MARK.plain);
              svg.appendChild(SVG.text(34, y2 + 4, "NULL", "vz-label", "end"));
            }
          }
          /* 右端 NULL */
          svg.appendChild(SVG.el("rect", { x: NULLX, y: ROW, width: 62, height: BOX_H, rx: 6, "class": "vz-box" }));
          svg.appendChild(SVG.el("text", { x: NULLX + 31, y: ROW + 24, "text-anchor": "middle", "class": "vz-text",
                                           style: "fill:var(--text-faint);font-size:12px" }, "NULL"));

          /* 结点 */
          for (i = 0; i < 4; i++) {
            var x = SLOT[i];
            if (!cfg.exists[i]) {
              svg.appendChild(SVG.el("rect", {
                x: x, y: ROW, width: DW, height: BOX_H, rx: 6,
                "class": "vz-box", style: "stroke-dasharray:6 5;opacity:.45"
              }));
              svg.appendChild(SVG.text(x + DW / 2, ROW + 24, "（空位）", "vz-label", "middle"));
              continue;
            }
            var cls = "";
            if (cfg.pIdx === i) cls = "active";
            if (cfg.sIdx === i) cls = "done";
            if (cfg.qIdx === i) cls = "warn";
            if (cfg.coverIdx === i) cls = "compare";
            dnode(svg, x, ROW, cfg.vals ? cfg.vals[i] : VALS[i], cls);
            svg.appendChild(SVG.label(x + DW / 2, ROW - 8, "槽位 " + i, "middle"));
            svg.appendChild(SVG.label(x + 16, ROW + BOX_H + 16, "prior", "middle"));
            svg.appendChild(SVG.label(x + 52, ROW + BOX_H + 16, "data", "middle"));
            svg.appendChild(SVG.label(x + 84, ROW + BOX_H + 16, "next", "middle"));
          }

          if (cfg.pIdx >= 0) svg.appendChild(SVG.text(SLOT[cfg.pIdx] + DW / 2, ROW - 26, "p", "ptr-cur", "middle"));
          if (cfg.qIdx >= 0) svg.appendChild(SVG.text(SLOT[cfg.qIdx] + DW / 2, ROW - 26, "q", "ptr-nxt", "middle"));
          if (cfg.sIdx >= 0) svg.appendChild(SVG.text(SLOT[cfg.sIdx] + DW / 2, ROW - 26, "s", "ptr-pre", "middle"));

          panel(svg, 14, 226, 772, 62, cfg.notes || []);
          return svg;
        }
      });
    }

    var base = [true, true, false, true];

    snap("初始双向链表（不带哨兵，两端用 NULL 表示）：<code>NULL ⇄ 12 ⇄ 34 ⇄ 56 ⇄ NULL</code>。" +
         "每个结点有 3 个域：<b>prior | data | next</b>。上面一行箭头是 next（向右），下面一行是 prior（向左）。",
      { exists: base, nx: [1, 3, null, -1], pr: [-1, 0, null, 1],
        title: "双向链表：NULL ⇄ 12 ⇄ 34 ⇄ 56 ⇄ NULL",
        notes: ["next 边画在上方（→），prior 边画在下方（←）。", "目标：在结点 34 之后插入新结点 99。"] });

    snap("<b>定位 p</b>：p 指向结点 34，它的 <code>p-&gt;next</code> 是结点 56。四条指针的修改都要围绕 p 展开。",
      { exists: base, nx: [1, 3, null, -1], pr: [-1, 0, null, 1], pIdx: 1,
        title: "第 1 步：定位 p（34），p->next 是 56",
        notes: ["p = 第 i−1 个结点；双向链表按位插入同样要先 O(n) 走到这里。", "四条指针 = s 的两条 + p 的一条 + 原后继的一条。"] });

    snap("<b>申请新结点</b>：<code>DNode* s = new DNode(99);</code> 放到中间的空位上。此刻 s 的 prior 与 next 都还没接上，" +
         "链表本身完好无损。",
      { exists: [true, true, true, true], nx: [1, 3, null, -1], pr: [-1, 0, null, 1], pIdx: 1, sIdx: 2,
        title: "第 2 步：new 出新结点 s（99）",
        notes: ["注意 s 现在还「悬空」，任何遍历都还看不到它。", "接下来 4 步按固定顺序接上。"] });

    snap("<b>① <code>s-&gt;prior = p;</code></b> 先把新结点的前驱指向 p（34）。" +
         "这一步不依赖任何旧指针值，放第一最安全。",
      { exists: [true, true, true, true], nx: [1, 3, null, -1], pr: [-1, 0, 1, 1], pIdx: 1, sIdx: 2, hlPrior: [2],
        title: "① s->prior = p",
        notes: ["s->prior = p;　// 新结点的回头路先修好", "此时 s 的 next 还没着落，但链表仍然完整。"] });

    snap("<b>② <code>s-&gt;next = p-&gt;next;</code></b> 让新结点接管 p 原来的后继（56）。" +
         "到这里，新结点自己的两条指针都完成了。",
      { exists: [true, true, true, true], nx: [1, 3, 3, -1], pr: [-1, 0, 1, 1], pIdx: 1, sIdx: 2, hlNext: [2], hlPrior: [2],
        title: "② s->next = p->next",
        notes: ["s->next = p->next;　// 新结点接管后半段", "此时 34 同时指向 3 号槽和 s，但 prior 还没理顺。"] });

    snap("<b>③ <code>p-&gt;next-&gt;prior = s;</code></b> 让原来的后继（56）回头指向新结点。" +
         "<b>这一步必须排在 ④ 之前</b>——因为它要用到「旧的 p-&gt;next」。",
      { exists: [true, true, true, true], nx: [1, 3, 3, -1], pr: [-1, 0, 1, 2], pIdx: 1, sIdx: 2, hlPrior: [3],
        title: "③ p->next->prior = s　（关键：必须在 ④ 之前）",
        notes: ["p->next->prior = s;　// 用旧的 p->next 找到 56，改它的 prior", "若 p 是尾结点，p->next 为 NULL，这一步需要判空。"] });

    snap("<b>④ <code>p-&gt;next = s;</code></b> 最后才让 p 改指新结点，断开旧链。四条指针全部到位，" +
         "正向、反向遍历都能正确经过 99。",
      { exists: [true, true, true, true], nx: [1, 2, 3, -1], pr: [-1, 0, 1, 2], pIdx: 1, sIdx: 2, hlNext: [1],
        title: "④ p->next = s　→ 插入完成",
        notes: ["p->next = s;　// 一旦执行，旧的 p->next 就永久丢失", "结果：NULL ⇄ 12 ⇄ 34 ⇄ 99 ⇄ 56 ⇄ NULL"] });

    snap("<b>错误顺序对比</b>：假如先执行 ④ <code>p-&gt;next = s;</code>，那么 p-&gt;next 就变成 s 了。" +
         "接着执行 ③ <code>p-&gt;next-&gt;prior = s;</code> 时，实际做的是 <code>s-&gt;prior = s</code>（自环）！",
      { exists: [true, true, true, true], nx: [1, 2, 3, -1], pr: [-1, 0, null, 1], pIdx: 1, sIdx: 2,
        selfPrior: 2, badPrior: [3],
        title: "✘ 错误顺序：先 ④ 再 ③",
        notes: ["56 的 prior 仍然指向 34（红色）—— 反向链在这一点断了。",
                "同时 s 的 prior 变成自己（自环）。正向遍历正常，反向遍历会直接跳过 s。"] });

    snap("<b>删除</b>：双向链表删除结点 q 只需要两条指针，而且不需要再找前驱——" +
         "<code>q-&gt;prior</code> 直接就是前驱。这里把刚插入的 99 删掉。",
      { exists: [true, true, true, true], nx: [1, 2, 3, -1], pr: [-1, 0, 1, 2], qIdx: 2,
        title: "删除：q->prior->next = q->next;　q->next->prior = q->prior;",
        notes: ["q->prior->next = q->next;　// 前驱跨过 q（此处 q->prior 一定存在，无需判空）",
                "q->next->prior = q->prior;　// 后继回指前驱（q 是尾结点时要判空）"] });

    snap("<b>删除完成</b>：<code>NULL ⇄ 12 ⇄ 34 ⇄ 56 ⇄ NULL</code>。两条指针一改，q 就从两个方向同时被摘掉，" +
         "最后 <code>delete q;</code> 释放内存。",
      { exists: [true, true, false, true], nx: [1, 3, null, -1], pr: [-1, 0, null, 1], hlNext: [1], hlPrior: [3],
        title: "删除完成",
        notes: ["整个删除只改了 2 根指针，是 O(1)（前提：已经持有 q）。",
                "这就是双向链表相对单链表最大的价值：删除已知结点不用再找前驱。"] });

    mount('viz-doubly', "双向链表：四条指针的修改顺序", "插入 → 错误顺序对比 → 删除", frames);
  })();


})();
