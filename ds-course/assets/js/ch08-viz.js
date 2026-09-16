/* ==========================================================================
   ch07-viz.js —— 第 08 讲《图：术语与存储结构》交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG

   全篇贯穿同一张固定示例图 G（无向、无权、连通）：
     V = {0,1,2,3,4,5,6,7}   n = 8
     E = {(0,1),(0,6),(1,2),(1,7),(2,3),(3,4),(4,5),(5,6),(5,7)}   e = 9
     各顶点度数：2 3 2 2 2 3 2 2，总和 18 = 2e（握手定理）
     奇数度顶点恰好 2 个（1 与 5）→ 存在欧拉路径 1→5

   连通分量动画在 G 的基础上追加顶点 8、9、10：
     G' = G + 边(8,9) + 孤立点 10  →  11 个顶点、10 条边、3 个连通分量
   ========================================================================== */
(function () {
  "use strict";
  var SVG = DS.SVG;

  /* ======================= 0. 固定示例图的数据 ======================= */
  var POS = [
    [96, 64], [300, 50], [520, 78], [644, 236],
    [470, 350], [200, 356], [62, 214], [330, 190],
    [592, 392], [656, 466], [104, 452]      /* 8 / 9 / 10 仅供连通分量演示 */
  ];
  var EX = [[0, 1], [0, 6], [1, 2], [1, 7], [2, 3], [3, 4], [4, 5], [5, 6], [5, 7]];
  var EX2 = EX.concat([[8, 9]]);
  var NV = 8, NV2 = 11;

  function range(n) { var r = [], i; for (i = 0; i < n; i++) r.push(i); return r; }
  function ek(a, b) { return a < b ? a + "-" + b : b + "-" + a; }
  function cp(o) { return JSON.parse(JSON.stringify(o)); }
  function buildAdj(n, edges) {
    var a = range(n).map(function () { return []; });
    edges.forEach(function (e) { a[e[0]].push(e[1]); a[e[1]].push(e[0]); });
    a.forEach(function (l) { l.sort(function (x, y) { return x - y; }); });
    return a;
  }
  var ADJ = buildAdj(NV, EX);
  var ADJ2 = buildAdj(NV2, EX2);

  /* ======================= 1. 绘图小工具 ======================= */

  /* 指定字号的顶点圆（SVG 的 .vz-text 固定 13px，缩放画布时需要覆盖） */
  function vnode(cx, cy, r, cls, label, fs) {
    var g = SVG.el("g");
    g.appendChild(SVG.el("circle", { cx: cx, cy: cy, r: r, "class": "vz-node " + (cls || "") }));
    var t = SVG.el("text", {
      x: cx, y: cy + Math.round(fs * 0.36), "text-anchor": "middle",
      "class": "vz-text" + (/active|done|warn|compare/.test(cls || "") ? " on" : "")
    }, String(label));
    t.style.fontSize = fs + "px";
    g.appendChild(t);
    return g;
  }

  /* 覆盖一层指定字号的普通文本（默认与正文同色，保证可读） */
  function gtext(x, y, str, anchor, fs, cls) {
    var t = SVG.el("text", {
      x: x, y: y, "text-anchor": anchor || "start",
      "class": "vz-text" + (cls ? " " + cls : "")
    }, String(str));
    if (fs) t.style.fontSize = fs + "px";
    return t;
  }

  /* 把示例图画到 svg 上。o = {scale,x,y,eCls,vCls,edges,vs,size,fsize} */
  function drawGraph(s, o) {
    o = o || {};
    var sc = o.scale || 1, ox = o.x || 0, oy = o.y || 0;
    var r = o.size || 12, fs = o.fsize || 11;
    var edges = o.edges || EX;
    var vs = o.vs || range(NV);
    function pt(i) { return [ox + POS[i][0] * sc, oy + POS[i][1] * sc]; }
    var i, a, b;
    for (i = 0; i < edges.length; i++) {
      a = pt(edges[i][0]); b = pt(edges[i][1]);
      s.appendChild(SVG.line(a[0], a[1], b[0], b[1],
        (o.eCls && o.eCls[ek(edges[i][0], edges[i][1])]) || ""));
    }
    for (i = 0; i < vs.length; i++) {
      var v = vs[i], p = pt(v);
      s.appendChild(vnode(p[0], p[1], r, (o.vCls && o.vCls[v]) || "", v, fs));
      if (o.vNote && o.vNote[v] !== undefined) {
        s.appendChild(gtext(p[0] + r + 2, p[1] - r + 1, o.vNote[v], "start", fs + 1));
      }
    }
  }

  /* n×n 的 0/1 矩阵。opt.cell(i,j) -> {cls, val} */
  function drawMatrix(s, x0, y0, n, opt) {
    opt = opt || {};
    var cs = opt.cs || 34, pitch = opt.pitch || 38, i, j;
    for (j = 0; j < n; j++) {
      s.appendChild(SVG.label(x0 + 44 + j * pitch + cs / 2, y0 - 9, "j" + j, "middle"));
    }
    for (i = 0; i < n; i++) {
      s.appendChild(SVG.label(x0 + 36, y0 + i * pitch + cs / 2 + 4, "i" + i, "end"));
      for (j = 0; j < n; j++) {
        var c = opt.cell(i, j) || { cls: "", val: "" };
        var cls = c.cls || "";
        s.appendChild(SVG.box(x0 + 44 + j * pitch, y0 + i * pitch, cs, cs, cls, c.val,
          /active|done|warn|compare/.test(cls) ? "on" : ""));
      }
    }
  }

  /* 矩阵下方的“行和 / 度”一行 */
  function drawSumRow(s, x0, y0, n, sums, opt) {
    opt = opt || {};
    var cs = opt.cs || 34, pitch = opt.pitch || 38, j;
    s.appendChild(SVG.label(x0 + 36, y0 + cs / 2 + 4, opt.label || "和", "end"));
    for (j = 0; j < n; j++) {
      s.appendChild(SVG.box(x0 + 44 + j * pitch, y0, cs, cs, opt.cls || "compare", sums[j], "on"));
    }
  }

  /* 一维数组（head / to / nxt / dist / 队列 / 栈 / 访问序列 都用它）。opt.cls(i) */
  function drawArray(s, x0, y, label, vals, opt) {
    opt = opt || {};
    var cs = opt.cs || 28, pitch = opt.pitch || 32, i;
    if (label) s.appendChild(gtext(x0 - 6, y + cs / 2 + 4, label, "end", opt.lfs || 11));
    for (i = 0; i < vals.length; i++) {
      var cls = opt.cls ? (opt.cls(i) || "") : "";
      s.appendChild(SVG.box(x0 + i * pitch, y, cs, cs, cls, vals[i],
        /active|done|warn|compare/.test(cls) ? "on" : ""));
      if (opt.index !== false) {
        s.appendChild(SVG.label(x0 + i * pitch + cs / 2, y + cs + 13, String((opt.base || 0) + i), "middle"));
      }
    }
    return x0 + vals.length * pitch;
  }

  /* 链式前向星：把顶点 u 的出边链写成人能读的一行 */
  function chainText(head, to, nxt, u) {
    var out = "head[" + u + "] = " + head[u], p = head[u], guard = 0, list = [];
    while (p !== -1 && guard++ < 60) {
      out += "  →  边结点#" + p + "(to=" + to[p] + ", nxt=" + nxt[p] + ")";
      list.push(to[p]);
      p = nxt[p];
    }
    out += "  →  -1（空）";
    if (list.length) out += "　即邻接点：" + list.join(", ");
    return out;
  }

  /* ==========================================================================
     动画 1：邻接矩阵的建立过程
     ========================================================================== */
  (function vizMatrix() {
    var host = document.getElementById("viz-graph-matrix");
    if (!host) return;

    var A = [], i, j;
    for (i = 0; i < NV; i++) { var r0 = []; for (j = 0; j < NV; j++) r0.push(0); A.push(r0); }
    var frames = [];

    function eclass(cur, written) {
      var m = {};
      for (var t = 0; t < EX.length; t++) {
        if (t < cur || (t === cur && written)) {
          m[ek(EX[t][0], EX[t][1])] = (t === cur ? "active" : "done");
        }
      }
      return m;
    }

    function snap(desc, cur, written) {
      var Ac = cp(A), m = eclass(cur, written);
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(980, 500);
          svg.appendChild(gtext(14, 22, "示例图 G（无向图，n = 8，e = 9）", "start", 13, ""));
          svg.appendChild(gtext(470, 22, "邻接矩阵 A[8][8]", "start", 13, ""));
          drawGraph(svg, { scale: 0.6, x: 14, y: 44, eCls: m, size: 12, fsize: 11 });
          svg.appendChild(gtext(14, 300, "绿色边 = 已经写进矩阵的边　　蓝色边 = 本次正在处理的边", "start", 11));
          svg.appendChild(gtext(14, 324, "无向图的邻接矩阵一定关于主对角线对称：A[i][j] = A[j][i]，一条边写两格。", "start", 11));
          var sums = [], a, b;
          for (a = 0; a < NV; a++) { var t2 = 0; for (b = 0; b < NV; b++) t2 += Ac[a][b]; sums.push(t2); }
          svg.appendChild(gtext(14, 348, "第 i 行之和 = 顶点 i 的度：" + sums.join(" + ") + " = " + (2 * EX.length) + " = 2e", "start", 11));
          drawMatrix(svg, 470, 76, NV, {
            cell: function (x, y) {
              var cls = "";
              if (cur >= 0 && cur < EX.length) {
                var e = EX[cur];
                if ((x === e[0] && y === e[1]) || (x === e[1] && y === e[0])) cls = "compare";
              }
              if (!cls && Ac[x][y]) cls = "done";
              return { cls: cls, val: Ac[x][y] };
            }
          });
          drawSumRow(svg, 470, 76 + NV * 38 + 10, NV, sums, { label: "度 d(v)" });
          svg.appendChild(gtext(470, 470, "矩阵里 1 的个数 = 2e = 18；求某点的度只要数一行，判断两点是否相邻只要看一眼 A[i][j]。", "start", 11));
          return svg;
        }
      });
    }

    snap("初始状态：8×8 的邻接矩阵全部填 0。无向图的边没有方向，所以每条边都要写<b>对称的两格</b>。", -1, false);
    for (var k = 0; k < EX.length; k++) {
      var u = EX[k][0], v = EX[k][1];
      snap("第 " + (k + 1) + " 条边 (" + u + "," + v + ")：先在矩阵里定位第 " + u + " 行第 " + v + " 列，以及对称的第 " + v +
        " 行第 " + u + " 列。", k, false);
      A[u][v] = 1; A[v][u] = 1;
      snap("执行 <code>A[" + u + "][" + v + "] = A[" + v + "][" + u + "] = 1</code>：两格同时变成 1——这就是“对称矩阵”的由来。" +
        "当前第 " + u + " 行有 " + A[u].reduce(function (p, c) { return p + c; }, 0) + " 个 1。", k, true);
    }
    snap("9 条边全部处理完：矩阵中共 18 个 1，正好等于 2e。每行的和就是该顶点的度（2,3,2,2,2,3,2,2），" +
      "八个度数相加 = 18。空间开销固定为 n² = 64 个存储单元，<b>与边数完全无关</b>——这就是稀疏图的浪费所在。", EX.length, true);

    new DS.Viz(host, {
      title: "邻接矩阵的建立过程",
      sub: "逐条边填充对称的两格",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     动画 2：邻接表 / 链式前向星的构建过程
     ========================================================================== */
  (function vizList() {
    var host = document.getElementById("viz-graph-list");
    if (!host) return;

    var head = [], i;
    for (i = 0; i < NV; i++) head.push(-1);
    var to = [], nxt = [], w = [];
    var frames = [], idx = 0;

    function snap(desc, curEdge, curArc, note1, note2) {
      var st = { head: head.slice(), to: to.slice(), nxt: nxt.slice(), n: to.length };
      var m = {};
      if (curEdge >= 0 && curEdge < EX.length) m[ek(EX[curEdge][0], EX[curEdge][1])] = "active";
      for (var t = 0; t < curEdge && t < EX.length; t++) m[ek(EX[t][0], EX[t][1])] = "done";
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(1000, 500);
          svg.appendChild(gtext(10, 22, "示例图 G（无向图，e = 9 → 边结点 2e = 18 个）", "start", 12));
          drawGraph(svg, { scale: 0.5, x: 8, y: 34, eCls: m, size: 10, fsize: 10 });

          svg.appendChild(gtext(360, 40, "链式前向星（数组模拟邻接表）", "start", 12));
          var hi = [], ti = [], ni = [], q;
          for (q = 0; q < NV; q++) hi.push(st.head[q]);
          for (q = 0; q < st.n; q++) { ti.push(st.to[q]); ni.push(st.nxt[q]); }

          drawArray(svg, 372, 56, "head[]", hi, {
            cs: 28, pitch: 32,
            cls: function (k) { return curArc >= 0 && curArc === k ? "compare" : ""; }
          });
          drawArray(svg, 372, 146, "to[]", ti, {
            cs: 26, pitch: 32,
            cls: function (k) {
              if (k === curArc) return "compare";
              if (curArc >= 0 && k < curArc) return "done";
              return "";
            }
          });
          drawArray(svg, 372, 236, "nxt[]", ni, {
            cs: 26, pitch: 32,
            cls: function (k) {
              if (k === curArc) return "compare";
              if (curArc >= 0 && k < curArc) return "done";
              return "";
            }
          });

          svg.appendChild(gtext(10, 300, note1 || "", "start", 12));
          svg.appendChild(gtext(10, 326, note2 || "", "start", 12));
          var u = curEdge >= 0 && curEdge < EX.length ? EX[curEdge][0] : -1;
          svg.appendChild(gtext(10, 372, curArc >= 0 && u >= 0 ? chainText(st.head, st.to, st.nxt, u) : "（当前还没有插入任何边结点）", "start", 11.5));
          if (curArc >= 0 && curEdge >= 0) {
            var vv = EX[curEdge][1];
            var isRev = (curArc % 2 === 1);
            var uu = isRev ? vv : EX[curEdge][0];
            svg.appendChild(gtext(10, 398, chainText(st.head, st.to, st.nxt, uu), "start", 11.5));
          }
          svg.appendChild(gtext(10, 436, "插入语句：to[idx]=v; nxt[idx]=head[u]; head[u]=idx; ++idx;　" +
            "（u 是弧尾、v 是弧头，插入在链表头部，O(1)）", "start", 11.5));
          svg.appendChild(gtext(10, 462, "无向图每条边调用两次 addEdge，所以边结点数 = 2e = 18；有向图只调用一次，边结点数 = e。", "start", 11.5));
          svg.appendChild(gtext(10, 486, "三个一维数组内存连续、没有指针，缓存友好——这是竞赛选手偏爱链式前向星的原因。", "start", 11.5));
          return svg;
        }
      });
    }

    snap("初始状态：head[0..7] 全部为 -1，表示还没有挂任何出边；to[]、nxt[] 为空表，idx = 0（下一个可用边结点下标）。", -1, -1);

    for (var k = 0; k < EX.length; k++) {
      var a = EX[k][0], b = EX[k][1];
      /* addEdge(a,b) */
      to.push(b); nxt.push(head[a]); w.push(1);
      var p1 = idx; head[a] = idx; idx++;
      snap("处理第 " + (k + 1) + " 条边 (" + a + "," + b + ")：调用 <code>addEdge(" + a + "," + b + ")</code>。" +
        "新边结点 #" + p1 + " 记录 to[" + p1 + "]=" + b + "，nxt[" + p1 + "] = head[" + a + "] = " + nxt[p1] +
        "，然后 head[" + a + "] = " + p1 + "。", k, p1,
        "① to[idx] = v：把弧头 v = " + b + " 记进 to 数组；",
        "② nxt[idx] = head[u]：新结点接在原来链表的<b>头部</b>；③ head[u] = idx：头指针指向新结点。");
      /* addEdge(b,a) */
      to.push(a); nxt.push(head[b]); w.push(1);
      var p2 = idx; head[b] = idx; idx++;
      snap("因为是<b>无向图</b>，同一条边还要反向再插一次：<code>addEdge(" + b + "," + a + ")</code>，" +
        "生成边结点 #" + p2 + "（to[" + p2 + "]=" + a + "）。无向图的边结点数因此是 2e。", k, p2,
        "无向边 (u,v) 等价于两条方向相反的弧 u→v 与 v→u，所以两个顶点的链表里各要出现一次。",
        "这就是为什么教材说：无向图邻接表的边结点数为 2e，有向图才是 e。");
    }

    snap("18 个边结点全部插入完毕。此时 head[u] 就是顶点 u 的“邻接表头”，顺着 nxt 一路走下去即可枚举 u 的所有邻接点，" +
      "花费的时间正比于 u 的度（精确地说是有向图的出度）。", EX.length, -1,
      "最终 head[] = [" + head.join(", ") + "]",
      "空间：head 占 n 个、to/nxt 各占 2e 个 → O(n + 2e) = O(n + e)。");

    new DS.Viz(host, {
      title: "邻接表 / 链式前向星的构建过程",
      sub: "一条一条边插入，观察 head / to / nxt 三个数组",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     动画 3：DFS 深度优先遍历（含递归栈、访问序列、树边 / 回边）
     ========================================================================== */
  (function vizDFS() {
    var host = document.getElementById("viz-dfs");
    if (!host) return;

    var frames = [];
    var vis = [], vCls = {}, eCls = {}, order = [], stack = [];
    var tree = [], back = [], edgeType = {}, curV = -1, skipped = 0;
    for (var t = 0; t < NV; t++) vis.push(false);

    function snap(desc) {
      var st = {
        vCls: cp(vCls), eCls: cp(eCls), order: order.slice(), stack: stack.slice(),
        tree: tree.slice(), back: back.slice(), cur: curV
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(1020, 500), i;
          svg.appendChild(gtext(10, 22, "示例图 G：从顶点 0 出发，邻接点按编号从小到大访问", "start", 12));
          var vc = cp(st.vCls);
          if (st.cur >= 0) vc[st.cur] = "active";
          drawGraph(svg, { scale: 0.6, x: 6, y: 40, eCls: st.eCls, vCls: vc, size: 11, fsize: 11 });

          svg.appendChild(gtext(10, 300, "绿实线 = 树边（DFS 生成树的边，共 n-1 = 7 条）　红实线 = 回边（说明有环）", "start", 11.5));
          svg.appendChild(gtext(10, 324, "蓝色顶点 = 当前正在访问的顶点　　绿色顶点 = 已经访问完的顶点", "start", 11.5));
          svg.appendChild(gtext(10, 348, "递归栈深度最大为 8；每个顶点恰好入栈一次、出栈一次。", "start", 11.5));

          svg.appendChild(gtext(430, 60, "访问序列（visiting order）", "start", 12));
          var seq = [], q;
          for (q = 0; q < NV; q++) seq.push(q < st.order.length ? st.order[q] : "");
          drawArray(svg, 442, 70, "次序", seq, {
            cs: 30, pitch: 36,
            cls: function (k) { return k === st.order.length - 1 ? "active" : (k < st.order.length ? "done" : "dim"); }
          });

          svg.appendChild(gtext(430, 160, "递归栈（左 = 栈底，右 = 栈顶；栈顶就是当前结点）", "start", 12));
          var sk = st.stack.length ? st.stack.slice() : [];
          drawArray(svg, 442, 170, "栈", sk, {
            cs: 30, pitch: 36,
            cls: function (k) { return k === sk.length - 1 ? "compare" : "done"; }
          });

          svg.appendChild(gtext(760, 60, "树边（" + st.tree.length + " 条）", "start", 12));
          for (i = 0; i < st.tree.length; i++) {
            svg.appendChild(gtext(768, 82 + i * 20, "(" + st.tree[i].replace("-", ",") + ")", "start", 11));
          }
          svg.appendChild(gtext(760, 250, "回边（" + st.back.length + " 条）", "start", 12));
          for (i = 0; i < st.back.length; i++) {
            svg.appendChild(gtext(768, 272 + i * 20, "(" + st.back[i].replace("-", ",") + ")", "start", 11));
          }
          svg.appendChild(gtext(430, 250, "已访问顶点数：" + st.order.length + " / " + NV, "start", 11.5));
          svg.appendChild(gtext(430, 276, "栈深：" + st.stack.length, "start", 11.5));
          svg.appendChild(gtext(430, 420, "算法本质：一条路走到黑，撞墙再回头（回溯）。", "start", 12));
          svg.appendChild(gtext(430, 446, "邻接表存图 → 时间 O(n + e)；邻接矩阵存图 → 时间 O(n²)。", "start", 12));
          return svg;
        }
      });
    }

    snap("初始状态：visited[] 全为 false，递归栈为空。从顶点 0 开始 DFS。");

    function dfs(u, parent) {
      vis[u] = true; vCls[u] = "done"; order.push(u); stack.push(u); curV = u;
      snap("访问顶点 <b>" + u + "</b>：visited[" + u + "] = true，打印/记录 " + u + "，同时压入递归栈。当前访问序列：" +
        order.join(" → ") + "。");
      for (var k = 0; k < ADJ[u].length; k++) {
        var v = ADJ[u][k];
        if (!vis[v]) {
          var key = ek(u, v);
          edgeType[key] = "tree"; tree.push(key); eCls[key] = "done";
          snap("在 " + u + " 的邻接表里看到 " + v + "（邻接点按升序枚举）：visited[" + v + "] 还是 false，" +
            "于是走这条边 (" + u + "," + v + ")。它是 <b>树边</b>，递归进入 " + v + "。");
          dfs(v, u);
          curV = u;
        } else if (v !== parent && !edgeType[ek(u, v)]) {
          edgeType[ek(u, v)] = "back"; back.push(ek(u, v)); eCls[ek(u, v)] = "warn";
          snap("邻接点 " + v + " 已经访问过，而且它<b>不是</b> " + u + " 的父结点 → 边 (" + u + "," + v + ") 是 <b>回边</b>，" +
            "它指向一个祖先，说明图中存在环。");
        } else if (v === parent && skipped === 0) {
          skipped = 1;
          snap("邻接点 " + v + " 恰好是 " + u + " 的<b>父结点</b>，直接跳过。这一步至关重要：无向图的每条边在邻接表里存了两次，" +
            "如果不排除父结点，就会把来路误判成环。");
        }
      }
      stack.pop(); curV = stack.length ? stack[stack.length - 1] : -1;
      snap("顶点 " + u + " 的邻接表已经扫描完毕，没有未访问的邻接点了 → <b>回溯</b>，从递归栈中弹出。" +
        (stack.length ? "回到 " + stack[stack.length - 1] + " 继续它的下一个邻接点。" : "栈已空，DFS 结束。"));
    }

    dfs(0, -1);
    snap("DFS 结束：访问序列为 <b>" + order.join(" → ") + "</b>（注意它并不是“层序”，而是“深度优先”）。" +
      "共产生 " + tree.length + " 条树边（= n − 1 = 7，构成一棵 DFS 生成树）与 " + back.length +
      " 条回边；回边数 = e − (n − 1) = 2，恰好是图中独立回路的个数。");

    new DS.Viz(host, {
      title: "DFS 深度优先遍历",
      sub: "递归实现：递归栈 + 访问序列 + 树边 / 回边分类",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     动画 4：BFS 广度优先遍历（队列 + 分层 + dist）
     ========================================================================== */
  (function vizBFS() {
    var host = document.getElementById("viz-bfs");
    if (!host) return;

    var frames = [], vis = [], dist = [], pre = [], vCls = {}, eCls = {}, order = [], queue = [], curV = -1, treeE = [];
    for (var t = 0; t < NV; t++) { vis.push(false); dist.push(-1); pre.push(-1); }

    function snap(desc) {
      var st = {
        vCls: cp(vCls), eCls: cp(eCls), order: order.slice(), queue: queue.slice(),
        dist: dist.slice(), cur: curV, tree: treeE.slice()
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(1020, 500), i;
          svg.appendChild(gtext(10, 22, "示例图 G：从顶点 0 出发做 BFS，队列用 STL queue 模拟", "start", 12));
          var vc = cp(st.vCls);
          if (st.cur >= 0) vc[st.cur] = "active";
          var note = {};
          for (i = 0; i < NV; i++) if (st.dist[i] >= 0) note[i] = "d=" + st.dist[i];
          drawGraph(svg, { scale: 0.6, x: 6, y: 40, eCls: st.eCls, vCls: vc, size: 11, fsize: 11, vNote: note });

          svg.appendChild(gtext(10, 300, "绿边 = BFS 生成树的边（共 n-1 = 7 条）　蓝顶点 = 正在出队处理的顶点", "start", 11.5));
          svg.appendChild(gtext(10, 324, "顶点旁 d=… 表示从源点 0 到它的最短边数（BFS 天然按层推进，第一次到达即最短）", "start", 11.5));
          svg.appendChild(gtext(10, 372, "BFS 的层次划分：", "start", 12));
          var layers = [], q2;
          for (q2 = 0; q2 < NV; q2++) {
            if (st.dist[q2] < 0) continue;
            if (!layers[st.dist[q2]]) layers[st.dist[q2]] = [];
            layers[st.dist[q2]].push(q2);
          }
          for (q2 = 0; q2 < layers.length; q2++) {
            svg.appendChild(gtext(10, 396 + q2 * 22, "第 " + q2 + " 层：" + (layers[q2] || []).join(", "), "start", 11.5));
          }

          svg.appendChild(gtext(430, 60, "队列内容（左 = 队头 front，右 = 队尾 back）", "start", 12));
          var qu = st.queue.slice();
          drawArray(svg, 442, 70, "queue", qu.length ? qu : ["空"], {
            cs: 32, pitch: 38,
            cls: function (k) { return k === 0 && qu.length ? "compare" : "active"; }
          });

          svg.appendChild(gtext(430, 160, "访问序列（= 出队顺序）", "start", 12));
          var seq = [];
          for (i = 0; i < NV; i++) seq.push(i < st.order.length ? st.order[i] : "");
          drawArray(svg, 442, 170, "次序", seq, {
            cs: 30, pitch: 36,
            cls: function (k) { return k === st.order.length - 1 ? "active" : (k < st.order.length ? "done" : "dim"); }
          });

          svg.appendChild(gtext(430, 250, "dist[]（源点 0 到各点的最短边数，-1 表示还没到达）", "start", 12));
          var ds = [];
          for (i = 0; i < NV; i++) ds.push(st.dist[i] < 0 ? "-1" : st.dist[i]);
          drawArray(svg, 442, 260, "dist", ds, {
            cs: 30, pitch: 36,
            cls: function (k) { return st.dist[k] < 0 ? "dim" : "done"; }
          });

          svg.appendChild(gtext(430, 340, "时间：邻接表 O(n + e)，邻接矩阵 O(n²)；空间：O(n)（队列 + visited）。", "start", 12));
          svg.appendChild(gtext(430, 366, "BFS 生成树" + "的边：" + st.tree.map(function (x) { return "(" + x.replace("-", ",") + ")"; }).join(" "), "start", 11.5));
          svg.appendChild(gtext(430, 420, "BFS 本质：以源点为中心一圈一圈向外扩散，像水波一样。", "start", 12));
          svg.appendChild(gtext(430, 446, "“第一次到达某个顶点时的层数”就是它到源点的最短距离（仅限无权图）。", "start", 12));
          return svg;
        }
      });
    }

    snap("初始状态：visited[0] = true，dist[0] = 0，队列中只有源点 0。");
    vis[0] = true; dist[0] = 0; vCls[0] = "done"; queue.push(0);

    while (queue.length) {
      var u = queue.shift();
      curV = u; order.push(u);
      snap("出队：u = <b>" + u + "</b>（dist[" + u + "] = " + dist[u] + "）。现在扫描它的整个邻接表，把所有“还没被访问过”的邻接点一次性入队。");
      for (var k = 0; k < ADJ[u].length; k++) {
        var v = ADJ[u][k];
        if (!vis[v]) {
          vis[v] = true; dist[v] = dist[u] + 1; pre[v] = u; vCls[v] = "done";
          eCls[ek(u, v)] = "done"; treeE.push(ek(u, v));
          queue.push(v);
          snap("邻接点 " + v + " 未被访问 → 立刻打标记、入队，并令 dist[" + v + "] = dist[" + u + "] + 1 = " + dist[v] +
            "，pre[" + v + "] = " + u + "（用来还原路径）。此时队列 = [" + queue.join(", ") + "]。");
        } else {
          snap("邻接点 " + v + " 已经访问过（dist[" + v + "] = " + dist[v] + "），跳过——BFS 不重复处理已经确定最短路的顶点。");
        }
      }
      curV = -1;
    }

    snap("队列已空，BFS 结束。访问序列 <b>" + order.join(" → ") + "</b> 完全按层递增：" +
      "第 0 层 {0}、第 1 层 {1,6}、第 2 层 {2,5,7}、第 3 层 {3,4}。" +
      "每个顶点只入队一次、出队一次，每条边最多被检查两次，所以总时间是 O(n + e)。");

    new DS.Viz(host, {
      title: "BFS 广度优先遍历",
      sub: "队列变化 + 层次推进 + dist 数组",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     动画 5：连通分量的计算（G' = G + (8,9) + 孤立点 10）
     ========================================================================== */
  (function vizConnected() {
    var host = document.getElementById("viz-connected");
    if (!host) return;

    var frames = [], vis = [], comp = [], comps = [], cur = -1, vCls = {};
    for (var t = 0; t < NV2; t++) { vis.push(false); comp.push(-1); }
    var COMPCLS = ["active", "compare", "done"];

    function snap(desc, compCount, edgeHi) {
      var st = { vCls: cp(vCls), vis: vis.slice(), comp: comp.slice(), comps: cp(comps), cur: cur, cnt: compCount, eh: edgeHi || {} };
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(1020, 500), i;
          svg.appendChild(gtext(10, 22, "G′ = 示例图 G + 边(8,9) + 孤立点 10　→　n = 11，e = 10，3 个连通分量", "start", 12));
          var vc = cp(st.vCls);
          if (st.cur >= 0) vc[st.cur] = "compare";
          drawGraph(svg, {
            scale: 0.6, x: 6, y: 40, edges: EX2, vs: range(NV2),
            eCls: st.eh, vCls: vc, size: 11, fsize: 11
          });
          svg.appendChild(gtext(10, 340, "颜色即分量编号：① 蓝　② 橙　③ 绿　（灰色 = 尚未访问）", "start", 11.5));
          svg.appendChild(gtext(10, 364, "计数规则：外层 for 扫描每个顶点，遇到 visited[i] == false 就把分量计数 +1，并从 i 出发遍历整个分量。", "start", 11.5));
          svg.appendChild(gtext(10, 388, "顶点 10 是孤立点：它自己构成一个连通分量——单个顶点也算连通分量，这是最容易被忽略的边界。", "start", 11.5));

          svg.appendChild(gtext(470, 60, "已发现的分量", "start", 12));
          for (i = 0; i < st.comps.length; i++) {
            var label = "分量" + (i + 1) + "（" + st.comps[i].length + " 个顶点）：" + st.comps[i].join(", ");
            svg.appendChild(gtext(480, 88 + i * 26, label, "start", 12));
          }
          svg.appendChild(gtext(470, 190, "visited[]", "start", 12));
          var vv = [];
          for (i = 0; i < NV2; i++) vv.push(st.vis[i] ? "1" : "0");
          drawArray(svg, 482, 200, "vis", vv, {
            cs: 30, pitch: 36,
            cls: function (k) { return st.vis[k] ? (st.comp[k] >= 0 ? COMPCLS[st.comp[k]] : "done") : "dim"; }
          });
          svg.appendChild(gtext(470, 290, "comp[]（每个顶点属于哪个分量）", "start", 12));
          var cc = [];
          for (i = 0; i < NV2; i++) cc.push(st.comp[i] < 0 ? "-" : st.comp[i] + 1);
          drawArray(svg, 482, 300, "comp", cc, {
            cs: 30, pitch: 36,
            cls: function (k) { return st.comp[k] < 0 ? "dim" : COMPCLS[st.comp[k]]; }
          });

          svg.appendChild(gtext(470, 400, "当前连通分量个数：" + st.cnt, "start", 14));
          svg.appendChild(gtext(470, 430, "结论：连通分量个数 = 外层循环真正发起遍历的次数。", "start", 12));
          svg.appendChild(gtext(470, 456, "若只需计数，完全不必存 comp[]，一个计数器就够了。", "start", 12));
          return svg;
        }
      });
    }

    snap("初始状态：visited[] 全为 false，comp[] 全为 -1，连通分量个数 cnt = 0。", 0);

    var cnt = 0, i;
    for (i = 0; i < NV2; i++) {
      if (vis[i]) continue;
      cnt++;
      var ci = cnt - 1;
      var members = [], q = [i];
      vis[i] = true; comp[i] = ci; vCls[i] = COMPCLS[ci]; members.push(i); comps.push(members);
      cur = i;
      snap("扫描到顶点 " + i + "，它的 visited[" + i + "] 仍然是 false → <b>发现新的连通分量</b>，cnt = " + cnt +
        "。把它标记为分量 " + cnt + " 的成员并加入队列，准备向外扩展。", cnt);
      while (q.length) {
        var u = q.shift();
        for (var k = 0; k < ADJ2[u].length; k++) {
          var v = ADJ2[u][k];
          if (!vis[v]) {
            vis[v] = true; comp[v] = ci; vCls[v] = COMPCLS[ci]; members.push(v); q.push(v);
            cur = v;
            var eh = {}; eh[ek(u, v)] = "active";
            snap("从 " + u + " 出发，邻接点 " + v + " 未访问 → 归入分量 " + cnt + "（染色），继续扩展。" +
              "当前分量成员：" + members.slice().sort(function (a, b) { return a - b; }).join(", ") + "。", cnt, eh);
          }
        }
      }
      cur = -1;
      snap("从顶点 " + i + " 出发能到达的顶点已经全部访问完，<b>分量 " + cnt + " 结束</b>：" +
        "它包含 " + members.slice().sort(function (a, b) { return a - b; }).join(", ") + "，共 " + members.length + " 个顶点。", cnt);
    }

    snap("外层循环扫描完全部 11 个顶点，共得到 <b>3 个连通分量</b>：{0..7}、{8,9}、{10}。" +
      "整张图有 n 个顶点、e 条边时，连通分量个数 k 满足 e ≥ n − k，或者说“至少需要 n − k 条边”才能把 k 个分量各自连通。", cnt);

    new DS.Viz(host, {
      title: "连通分量的计算",
      sub: "每个分量从某个未访问顶点出发，一次扩展完并染色",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     动画 6：无权图 BFS 单源最短路（dist[] 更新 + 路径还原）
     ========================================================================== */
  (function vizShortest() {
    var host = document.getElementById("viz-bfs-shortest");
    if (!host) return;

    var SRC = 0, DST = 4;
    var frames = [], vis = [], dist = [], pre = [], vCls = {}, eCls = {}, queue = [], cur = -1;
    var path = [], pathEdges = {}, done = false;
    for (var t = 0; t < NV; t++) { vis.push(false); dist.push(-1); pre.push(-1); }

    function snap(desc) {
      var st = {
        vis: vis.slice(), dist: dist.slice(), pre: pre.slice(), vCls: cp(vCls), eCls: cp(eCls),
        queue: queue.slice(), cur: cur, path: path.slice(), pe: cp(pathEdges), done: done
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(1020, 500), i;
          svg.appendChild(gtext(10, 22, "无权图单源最短路：源点 " + SRC + "，目标点 " + DST, "start", 12));
          var vc = cp(st.vCls), note = {};
          for (i = 0; i < NV; i++) if (st.dist[i] >= 0) note[i] = "d=" + st.dist[i];
          if (st.cur >= 0) vc[st.cur] = "compare";
          if (st.done) {
            for (i = 0; i < st.path.length; i++) vc[st.path[i]] = "active";
          }
          drawGraph(svg, { scale: 0.6, x: 6, y: 40, eCls: st.eCls, vCls: vc, size: 11, fsize: 11, vNote: note });

          svg.appendChild(gtext(10, 320, "d=… 是从源点 " + SRC + " 到该顶点的最短边数；蓝线 = 还原出来的最短路径。", "start", 11.5));
          svg.appendChild(gtext(10, 344, "关键结论：BFS 中<b>第一次</b>到达某顶点时走过的边数，就是它到源点的最短距离。", "start", 11.5));
          svg.appendChild(gtext(10, 368, "把每个顶点的前驱 pre[] 记下来，就能从终点一路倒推到源点，还原出整条路径。", "start", 11.5));
          svg.appendChild(gtext(10, 400, "从 " + SRC + " 到 " + DST + " 的最短路径长度 = " + (st.dist[DST] < 0 ? "不可达" : st.dist[DST]), "start", 14));

          svg.appendChild(gtext(470, 60, "dist[]（-1 表示尚未到达）", "start", 12));
          var ds = [];
          for (i = 0; i < NV; i++) ds.push(st.dist[i] < 0 ? "-1" : st.dist[i]);
          drawArray(svg, 482, 70, "dist", ds, {
            cs: 30, pitch: 36,
            cls: function (k) { return st.dist[k] < 0 ? "dim" : (k === DST ? "compare" : "done"); }
          });

          svg.appendChild(gtext(470, 150, "pre[]（前驱，-1 表示源点或未到达）", "start", 12));
          var ps = [];
          for (i = 0; i < NV; i++) ps.push(st.pre[i] < 0 ? "-1" : st.pre[i]);
          drawArray(svg, 482, 160, "pre", ps, {
            cs: 30, pitch: 36,
            cls: function (k) { return st.pre[k] < 0 ? "dim" : "compare"; }
          });

          svg.appendChild(gtext(470, 240, "队列", "start", 12));
          var qu = st.queue.slice();
          drawArray(svg, 482, 250, "queue", qu.length ? qu : ["空"], { cs: 30, pitch: 36 });

          svg.appendChild(gtext(470, 330, "路径还原（从终点沿 pre 倒推）", "start", 12));
          var pp = st.path.slice();
          drawArray(svg, 482, 340, "path", pp.length ? pp : ["—"], {
            cs: 30, pitch: 36,
            cls: function () { return "active"; }
          });
          svg.appendChild(gtext(470, 420, st.done
            ? "路径：" + st.path.slice().reverse().join(" → ") + "　长度 " + st.dist[DST]
            : "还没有开始还原路径。", "start", 12));
          return svg;
        }
      });
    }

    snap("初始化：dist[] 全部为 -1（∞），pre[] 全部为 -1。源点 0 入队：visited[0] = true，dist[0] = 0。");
    vis[0] = true; dist[0] = 0; vCls[0] = "done"; queue.push(0);

    while (queue.length) {
      var u = queue.shift();
      cur = u;
      snap("出队 u = " + u + "（dist = " + dist[u] + "）。用它的最短路去“松弛”所有邻接点：只要邻接点没被访问过，就说明找到了更短（其实是<b>最短</b>）的一条路。");
      for (var k = 0; k < ADJ[u].length; k++) {
        var v = ADJ[u][k];
        if (!vis[v]) {
          vis[v] = true; dist[v] = dist[u] + 1; pre[v] = u; vCls[v] = "done";
          eCls[ek(u, v)] = "done"; queue.push(v);
          snap("邻接点 " + v + " 未访问 → dist[" + v + "] = dist[" + u + "] + 1 = " + dist[v] +
            "，pre[" + v + "] = " + u + "，入队。因为 BFS 是按层推进的，所以这个值一定是最终答案，以后不会再被改小。");
        }
      }
      cur = -1;
    }

    snap("BFS 结束，dist[] = [" + dist.join(", ") + "]。源点 0 到顶点 " + DST + " 的最短距离是 " + dist[DST] +
      "。下面开始还原路径：从终点 " + DST + " 出发，反复执行 v = pre[v]，直到回到源点。");

    var v2 = DST;
    path.push(v2);
    snap("路径节点暂存：" + path.join(" ← ") + "（pre[" + v2 + "] = " + pre[v2] + "）");
    while (pre[v2] !== -1) {
      var pv = pre[v2];
      pathEdges[ek(v2, pv)] = "active";
      v2 = pv;
      path.push(v2);
      snap("v = pre[" + path[path.length - 2] + "] = " + v2 + "，把顶点 " + v2 + " 也加进来。" +
        (pre[v2] === -1 ? "它没有前驱，说明已经回到源点，停止。" : "继续往前推。"));
    }
    done = true;
    snap("把 path 反转就得到正序路径：<b>" + path.slice().reverse().join(" → ") + "</b>，长度恰好是 dist[" + DST + "] = " + dist[DST] +
      "。整段代码只用了一次 BFS（O(n + e)）加一次 O(路径长度) 的倒推，比 Dijkstra 更适合无权图。");

    new DS.Viz(host, {
      title: "无权图 BFS 求单源最短路",
      sub: "dist[] 逐层更新 + pre[] 路径还原",
      build: function () { return { frames: frames }; }
    });
  })();

})();
