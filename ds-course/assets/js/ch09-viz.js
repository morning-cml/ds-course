/* ==========================================================================
   ch09-viz.js —— 第 09 讲 图论算法：生成树与最短路径 · 交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG

   本文件里出现的所有数组、矩阵、集合关系都是「算法现场算出来」的，
   不是写死的常量，保证动画里的数值与正文手推表格完全一致。

   贯穿全章的示例图 G（7 个顶点、11 条带权无向边，权值全为正）：
     V = {0,1,2,3,4,5,6}
     E = {(0,1)2 (1,2)2 (2,6)4 (0,2)3 (0,3)3 (1,3)5 (3,4)2 (4,6)5 (3,5)5 (1,5)6 (0,6)11}
     结论：MST 权值和 = 18（不唯一）；dist(0,·) = [0,2,3,3,5,8,7]

   动画清单（与页面容器一一对应）：
     viz-prim  viz-kruskal  viz-dijkstra  viz-floyd
     viz-topo  viz-critical  viz-bellman
   ========================================================================== */
(function () {
  "use strict";

  var SVG = DS.SVG;
  var INF = Infinity;

  /* ==========================================================================
     0) 公共绘图工具
     ========================================================================== */

  // 带权重标签的边（外加一块底色，防止标签被其它边穿过看不清）
  function edge(s, x1, y1, x2, y2, cls, txt, tx, ty) {
    s.appendChild(SVG.line(x1, y1, x2, y2, cls || ""));
    if (txt === undefined || txt === null) return;
    tx = (tx === undefined) ? (x1 + x2) / 2 : tx;
    ty = (ty === undefined) ? (y1 + y2) / 2 - 6 : ty;
    var str = String(txt), hw = str.length * 3.9 + 5;
    s.appendChild(SVG.el("rect", {
      x: tx - hw, y: ty - 10, width: hw * 2, height: 14, rx: 3,
      fill: "var(--panel)", stroke: "var(--border)", "stroke-width": 0.7
    }));
    s.appendChild(SVG.text(tx, ty, str, "vz-label", "middle"));
  }

  // 画一个数组（下标 + 值），clsOf(i) 决定第 i 格的样式
  function arrRow(s, x, y, values, clsOf, bw, bh, lab, idxBelow) {
    bw = bw || 44; bh = bh || 28;
    if (lab) s.appendChild(SVG.text(x - 8, y + bh / 2 + 4, lab, "vz-label", "end"));
    for (var i = 0; i < values.length; i++) {
      var c = clsOf ? clsOf(i) : "";
      s.appendChild(SVG.box(x + i * (bw + 4), y, bw, bh, c, values[i],
        /active|done|warn|compare/.test(c) ? "on" : ""));
      s.appendChild(SVG.label(x + i * (bw + 4) + bw / 2, idxBelow ? y + bh + 14 : y - 5, String(i), "middle"));
    }
    return x + values.length * (bw + 4);
  }

  // 画一行「顶点 → 值」的小卡片
  function cardRow(s, x, y, texts, clsOf, w, h) {
    w = w || 84; h = h || 26;
    for (var i = 0; i < texts.length; i++) {
      var c = clsOf ? clsOf(i) : "";
      s.appendChild(SVG.box(x + i * (w + 5), y, w, h, c, texts[i],
        /active|done|warn|compare/.test(c) ? "on" : ""));
    }
    return x + texts.length * (w + 5);
  }

  /* ---------------- 贯穿全章的示例图 ---------------- */
  var VX = [110, 240, 370, 500, 110, 240, 370];
  var VY = [90, 90, 90, 90, 330, 330, 330];
  var W = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ];
  var EDGES = [
    { u: 0, v: 1, w: 2, lx: null, ly: 56 },
    { u: 0, v: 2, w: 3, lx: null, ly: 56 },
    { u: 0, v: 3, w: 3, lx: null, ly: 56 },
    { u: 0, v: 6, w: 11, lx: 203, ly: 196 },
    { u: 1, v: 2, w: 2, lx: null, ly: 56 },
    { u: 1, v: 3, w: 5, lx: null, ly: 56 },
    { u: 1, v: 5, w: 6, lx: 256, ly: 210 },
    { u: 2, v: 6, w: 4, lx: 386, ly: 210 },
    { u: 3, v: 4, w: 2, lx: 253, ly: 302 },
    { u: 3, v: 5, w: 5, lx: null, ly: 296 },
    { u: 4, v: 6, w: 5, lx: null, ly: 296 }
  ];
  var ADJ = [[], [], [], [], [], [], []];
  (function initW() {
    var i;
    for (i = 0; i < 7; i++) for (var j = 0; j < 7; j++) W[i][j] = (i === j ? 0 : INF);
    for (i = 0; i < EDGES.length; i++) {
      var e = EDGES[i];
      W[e.u][e.v] = e.w; W[e.v][e.u] = e.w;
      ADJ[e.u].push(e.v); ADJ[e.v].push(e.u);
    }
  })();

  var NODE_CLS = {};
  var EDGE_CLS = {};
  function resetGraph() { NODE_CLS = {}; EDGE_CLS = {}; }
  function setNode(i, c) { NODE_CLS[i] = c; }
  function markEdge(a, b, c) { EDGE_CLS[a + "-" + b] = c; EDGE_CLS[b + "-" + a] = c; }

  /* 画示例图。txtOf(i) 可让顶点里显示 dist 值；foot 是画布底部的一行小字 */
  function drawGraph(s, opt) {
    opt = opt || {};
    var svg = s.svg(700, 460);
    var i, e;
    var txtOf = opt.txtOf || function (k) { return String(k); };
    for (i = 0; i < EDGES.length; i++) {
      e = EDGES[i];
      var cls = EDGE_CLS[e.u + "-" + e.v] || "";
      var lx = (e.lx === null) ? (VX[e.u] + VX[e.v]) / 2 : e.lx;
      var ly = (e.ly === null) ? (VY[e.u] + VY[e.v]) / 2 - 6 : e.ly;
      edge(svg, VX[e.u], VY[e.u], VX[e.v], VY[e.v], cls, "w=" + e.w, lx, ly);
    }
    for (i = 0; i < 7; i++) {
      var nc = NODE_CLS[i] || "";
      svg.appendChild(SVG.circle(VX[i], VY[i], 22, nc, txtOf(i),
        /active|done|warn|compare/.test(nc) ? "on" : ""));
    }
    if (opt.foot) svg.appendChild(SVG.text(16, 444, opt.foot, "vz-label", "start"));
    return svg;
  }

  function setEdgeSet(list, c) { for (var i = 0; i < list.length; i++) markEdge(list[i][0], list[i][1], c); }

  /* ==========================================================================
     1) viz-prim —— Prim 逐轮加边
     ========================================================================== */
  (function prim() {
    var host = document.getElementById("viz-prim");
    if (!host) return;

    var inT = [true, false, false, false, false, false, false];
    var low = [INF, 2, 3, 3, INF, INF, 11];
    var clo = [-1, 0, 0, 0, -1, -1, 0];
    var mst = [], total = 0, frames = [];

    /* 把「当前这一步」的状态画出来 */
    function snapshot(desc, opt) {
      opt = opt || {};
      /* 关键：把「这一帧要画的状态」在此刻深拷贝下来。
         DS.Viz 会先同步跑完整个 build()、之后才逐帧渲染，
         若 draw 直接读 inT / low / clo / mst / total 这些活变量，
         画出来的就永远是算法结束后的最终态（第 0 帧显示完成图）。 */
      var snap = {
        inT: inT.slice(),
        low: low.slice(),
        clo: clo.slice(),
        mst: mst.map(function (e) { return e.slice(); }),
        total: total
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          resetGraph();
          var i;
          for (i = 0; i < 7; i++) if (snap.inT[i]) setNode(i, "active");
          if (opt.pick >= 0) setNode(opt.pick, "done");
          setEdgeSet(snap.mst, "done");
          if (opt.cand !== undefined && opt.cand >= 0) markEdge(snap.clo[opt.cand], opt.cand, "compare");
          if (opt.newEdge) markEdge(opt.newEdge[0], opt.newEdge[1], "done");
          if (opt.dead !== undefined && opt.dead >= 0) markEdge(snap.clo[opt.dead], opt.dead, "dim");
          var svg = drawGraph(s, {
            foot: "生成树顶点数 = " + snap.inT.filter(Boolean).length +
              "　已选边 = " + snap.mst.length + " 条　当前总权值 = " + snap.total
          });
          var vals = [];
          for (i = 0; i < 7; i++) vals.push(snap.low[i] === INF ? "∞" : String(snap.low[i]));
          arrRow(svg, 66, 386, vals, function (k) {
            if (snap.inT[k]) return "done";
            if (opt.cand === k) return "compare";
            if (opt.pick === k) return "active";
            return "";
          }, 44, 24, "lowcost", true);
          var cl = [];
          for (i = 0; i < 7; i++) cl.push(snap.inT[i] ? "—" : (snap.clo[i] < 0 ? "—" : String(snap.clo[i])));
          arrRow(svg, 66, 430, cl, function (k) {
            return opt.cand === k ? "compare" : (snap.inT[k] ? "done" : "");
          }, 44, 24, "closest", true);
          return svg;
        }
      });
    }

    snapshot("<b>初始化</b>：生成树 T = {0}，其余顶点到 T 的距离 <code>lowcost[i] = w(0,i)</code>，" +
      "不可达为 ∞；<code>closest[i]</code> 记录「这条最短连接是从哪个树内顶点伸出来的」。", { pick: -1 });

    for (var step = 1; step <= 6; step++) {
      var cand = -1;
      for (var v = 1; v < 7; v++) if (!inT[v] && low[v] < INF && (cand < 0 || low[v] < low[cand])) cand = v;
      snapshot("第 " + step + " 轮：在未加入的顶点里挑 <code>lowcost</code> 最小的那个（橙色格子）——" +
        "顶点 <b>" + cand + "</b>，距离 " + low[cand] + "，对应边 <b>(" + clo[cand] + "," + cand + ")</b>。",
        { pick: cand, cand: cand });

      var eu = clo[cand], ew = low[cand];
      mst.push([eu, cand]); total += ew;
      setNode(cand, "active"); inT[cand] = true;
      snapshot("<b>加入顶点 " + cand + "</b>：边 (" + eu + "," + cand + ") 进入生成树，总权值累加到 <b>" + total + "</b>。" +
        "接下来用 " + cand + " 去「松弛」剩下的顶点。",
        { pick: cand, newEdge: [eu, cand] });

      var upd = [];
      for (var k = 0; k < 7; k++) {
        if (!inT[k] && W[cand][k] < low[k]) {
          upd.push("lowcost[" + k + "]: " + (low[k] === INF ? "∞" : low[k]) + "→" + W[cand][k] + "（closest[" + k + "]" + clo[k] + "→" + cand + "）");
          low[k] = W[cand][k]; clo[k] = cand;
        }
      }
      snapshot(upd.length
        ? "松弛：<code>w(" + cand + ",k) &lt; lowcost[k]</code> 的顶点全部更新 —— " + upd.join("；") + "。"
        : "松弛：与顶点 " + cand + " 相邻且未入树的顶点，其 <code>lowcost</code> 都没有变小，<b>本步 lowcost 不变</b>。",
        { pick: cand, newEdge: [eu, cand] });
    }

    setEdgeSet(mst, "done");
    frames.push({
      desc: "<b>完成！</b>6 条边把 7 个顶点全部连通，最小生成树总权值 = <b>" + total +
        "</b>。选边序列：" + mst.map(function (e) { return "(" + e[0] + "," + e[1] + ")"; }).join(" → ") +
        "。注意：MST 可能不唯一（例如权值同为 3 的 (0,2) 与 (0,3) 互换也能得到 18），但<b>权值和一定相同</b>。",
      draw: function (s) {
        resetGraph();
        for (var i = 0; i < 7; i++) setNode(i, "active");
        setEdgeSet(mst, "done");
        return drawGraph(s, { foot: "最小生成树总权值 = " + total + "（7 个顶点 / 6 条边）" });
      }
    });

    new DS.Viz(host, {
      title: "Prim 算法：从顶点 0 出发不断「吞并最近的顶点」",
      sub: "绿色 = 已入树的边，橙色 = 本轮候选（lowcost 最小）",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     2) viz-kruskal —— 按边权排序 + 并查集判环
     ========================================================================== */
  (function kruskal() {
    var host = document.getElementById("viz-kruskal");
    if (!host) return;

    var sorted = EDGES.slice().sort(function (a, b) { return a.w - b.w || a.u - b.u; });
    var port = [0, 1, 2, 3, 4, 5, 6];          // 并查集父指针
    function find(x) { while (port[x] !== x) x = port[x] = port[port[x]]; return x; }
    /* 在任意一份父指针数组上找根（画图时用快照，避免渲染去改活状态） */
    function findIn(p, x) { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }

    var frames = [], picked = [], rejected = [], total = 0;

    /* 小格子：画一个并查集森林。p 是**该帧的**父指针快照 */
    function drawUF(svg, p) {
      var groups = {}, i;
      for (i = 0; i < 7; i++) {
        var r = findIn(p.slice(), i);           // 再拷一份，格式压缩不污染快照本身
        (groups[r] = groups[r] || []).push(i);
      }
      var roots = Object.keys(groups).sort(function (a, b) { return a - b; });
      var x = 258;
      svg.appendChild(SVG.text(x, 402, "并查集当前集合：", "vz-label", "start"));
      for (i = 0; i < roots.length; i++) {
        var txt = "{" + groups[roots[i]].join(",") + "}";
        svg.appendChild(SVG.box(x + i * 96, 410, 92, 24, "", txt));
        svg.appendChild(SVG.label(x + i * 96 + 46, 446, "root=" + roots[i] + " size=" + groups[roots[i]].length, "middle"));
      }
    }

    function snapshot(desc, cur) {
      /* 关键：推帧时深拷贝该帧的状态（含并查集父指针），draw 只读快照。
         DS.Viz 先跑完 build() 再逐帧渲染，读活变量会画成最终态。 */
      var snap = {
        picked: picked.map(function (e) { return e.slice(); }),
        rejected: rejected.map(function (e) { return e.slice(); }),
        total: total,
        port: port.slice()
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          resetGraph();
          setEdgeSet(snap.picked, "done");
          setEdgeSet(snap.rejected, "dim");
          if (cur >= 0) markEdge(sorted[cur].u, sorted[cur].v, "compare");
          var svg = drawGraph(s, {
            foot: "已采纳 " + snap.picked.length + " 条边　累计权值 = " + snap.total +
              "　还需要 " + (6 - snap.picked.length) + " 条"
          });
          /* 排序后的边列表：分两行小格子 */
          var i, list = [];
          for (i = 0; i < sorted.length; i++) list.push(sorted[i].w + "(" + sorted[i].u + "," + sorted[i].v + ")");
          var cls = function (k) {
            if (k === cur) return "compare";
            var e = sorted[k];
            for (var j = 0; j < snap.picked.length; j++) if (snap.picked[j][0] === e.u && snap.picked[j][1] === e.v) return "done";
            for (var m = 0; m < snap.rejected.length; m++) if (snap.rejected[m][0] === e.u && snap.rejected[m][1] === e.v) return "dim";
            return "";
          };
          arrRow(svg, 20, 386, list.slice(0, 6), cls, 104, 24, "排序后的边", true);
          arrRow(svg, 20, 440, list.slice(6), function (k) { return cls(k + 6); }, 104, 24, "（续）", true);
          drawUF(svg, snap.port);
          return svg;
        }
      });
    }

    snapshot("<b>第 ① 步：排序。</b>把所有边按权值从小到大排好（权值相同按端点编号），得到边序列 " +
      sorted.map(function (e) { return e.w + "(" + e.u + "," + e.v + ")"; }).join("、") +
      "。下面从最便宜的边开始，逐条判断「能不能用」。", -1);

    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i], ru = find(e.u), rv = find(e.v);
      var head = "第 " + (i + 1) + " 条边 <b>(" + e.u + "," + e.v + ")</b>，权值 <b>" + e.w + "</b>：";
      if (ru !== rv) {
        /* 注意：members() 必须**在合并之前**求值，否则 ru 与 rv 已经并到一起，
           描述里会印出两个一模一样的集合，跟「不同集合 → 采纳」自相矛盾。 */
        var memU = members(ru), memV = members(rv);
        port[ru] = rv; picked.push([e.u, e.v]); total += e.w;
        snapshot(head + "两端点分别属于集合 {" + memU + "} 与 {" + memV + "}，<b>不同集合 → 采纳</b>，" +
          "合并两个集合。累计权值 = <b>" + total + "</b>，已选 " + picked.length + " 条边。", i);
      } else {
        rejected.push([e.u, e.v]);
        snapshot(head + "两端点已经在<b>同一个集合</b>里（" + ru + "），说明它们之间本来就已经连通；" +
          "这条边加上去会<b>形成环 → 丢弃</b>。累计权值仍是 " + total + "，已选 " + picked.length + " 条边。", i);
      }
      if (picked.length === 6) { snapshot("<b>已经选满 n−1 = 6 条边</b>，最小生成树完成，后面的边不用再看了。", i); break; }
    }

    frames.push({
      desc: "<b>Kruskal 完成。</b>选中的 6 条边：" +
        picked.map(function (e) { return "(" + e[0] + "," + e[1] + ")"; }).join(" → ") +
        "，总权值 = <b>" + total + "</b>，与 Prim 的结果完全一致——这正是「同一张图的所有 MST 权值和相同」的体现。",
      draw: function (s) {
        resetGraph();
        setEdgeSet(picked, "done");
        setEdgeSet(rejected, "dim");
        return drawGraph(s, { foot: "最小生成树总权值 = " + total + "（共判定了 " + (picked.length + rejected.length) + " 条边）" });
      }
    });

    /* 生成树里某个连通块的成员（用于描述文字：只看已采纳的边做连通块，与 union 顺序无关） */
    function members(root) {
      var out = [], seen = {}, stack = [root];
      while (stack.length) {
        var x = stack.pop();
        if (seen[x]) continue;
        seen[x] = 1; out.push(x);
        for (var m = 0; m < picked.length; m++) {
          if (picked[m][0] === x) stack.push(picked[m][1]);
          if (picked[m][1] === x) stack.push(picked[m][0]);
        }
      }
      out.sort(function (a, b) { return a - b; });
      return out.join(",");
    }

    new DS.Viz(host, {
      title: "Kruskal 算法：按权值从小到大「能用就用」",
      sub: "绿色 = 采纳，橙色 = 正在判定，灰色 = 因成环被丢弃",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     3) viz-dijkstra —— 单源最短路（从 0 出发）
     ========================================================================== */
  (function dijkstra() {
    var host = document.getElementById("viz-dijkstra");
    if (!host) return;

    var dist = [0, INF, INF, INF, INF, INF, INF];
    var done = [false, false, false, false, false, false, false];
    var pre = [-1, -1, -1, -1, -1, -1, -1];
    var spt = [], frames = [];

    function snapshot(desc, opt) {
      opt = opt || {};
      var sptSnap = spt.slice();          // 快照：避免后面的帧污染前面的图
      /* dist / done / pre 同样必须快照：它们是逐轮被改写的活变量，
         不拷的话每一帧都会画出「全部确定完」的最终表格。 */
      var snap = { dist: dist.slice(), done: done.slice(), pre: pre.slice() };
      frames.push({
        desc: desc,
        draw: function (s) {
          resetGraph();
          var i;
          for (i = 0; i < 7; i++) if (snap.done[i]) setNode(i, "done");
          if (opt.cur !== undefined && opt.cur >= 0) setNode(opt.cur, "active");
          for (i = 0; i < opt.upd.length; i++) setNode(opt.upd[i], "compare");
          setEdgeSet(sptSnap, "done");
          if (opt.relax) for (i = 0; i < opt.relax.length; i++) markEdge(opt.relax[i][0], opt.relax[i][1], "compare");
          var svg = drawGraph(s, {
            txtOf: function (k) { return snap.dist[k] === INF ? "∞" : String(snap.dist[k]); },
            foot: "圆内数字 = 当前最短距离估计 dist[]　绿色顶点 = 已确定最短路（visited = √）"
          });
          var i2, ds = [];
          for (i2 = 0; i2 < 7; i2++) ds.push(snap.dist[i2] === INF ? "∞" : String(snap.dist[i2]));
          arrRow(svg, 66, 386, ds, function (k) {
            if (opt.upd.indexOf(k) >= 0) return "compare";
            if (opt.cur === k) return "active";
            if (snap.done[k]) return "done";
            return "";
          }, 44, 22, "dist", true);
          var vs = [], ps = [];
          for (i2 = 0; i2 < 7; i2++) {
            vs.push(snap.done[i2] ? "√" : "");
            ps.push(snap.done[i2] && snap.pre[i2] >= 0 ? String(snap.pre[i2]) : "—");
          }
          arrRow(svg, 66, 428, vs, function (k) {
            return snap.done[k] ? "done" : (opt.cur === k ? "active" : "");
          }, 44, 22, "visited", true);
          arrRow(svg, 66, 470, ps, function (k) { return snap.done[k] ? "done" : ""; }, 44, 22, "pre", true);
          return svg;
        }
      });
    }

    snapshot("<b>初始化</b>：<code>dist[0] = 0</code>，其余全部为 ∞（不可达）；<code>visited[]</code> 全为假。" +
      "注意顶点圆里的数字会随算法推进不断变小，这就是「松弛」在起作用。",
      { upd: [], relax: null });

    for (var it = 0; it < 7; it++) {
      var u = -1;
      for (var v = 0; v < 7; v++) if (!done[v] && dist[v] < INF && (u < 0 || dist[v] < dist[u])) u = v;
      if (u < 0) { snapshot("剩下的顶点全都不可达（dist = ∞），算法结束——这说明从源点出发到不了它们。", { upd: [], relax: null }); break; }
      done[u] = true;
      snapshot("第 " + (it + 1) + " 轮选点：在 <code>visited = false</code> 的顶点里挑 <code>dist</code> 最小的 —— " +
        "顶点 <b>" + u + "</b>（dist = " + dist[u] + "）。<b>它的最短路就此确定，之后不会再改</b>（这正是 Dijkstra 的贪心前提）。",
        { cur: u, upd: [], relax: null });

      var upd = [], rel = [];
      for (var k = 0; k < 7; k++) {
        if (!done[k] && W[u][k] < INF && dist[u] + W[u][k] < dist[k]) {
          upd.push(k); rel.push([u, k]);
          dist[k] = dist[u] + W[u][k]; pre[k] = u;
          spt.push([u, k]);                 // 记下最短路树的一条边
        }
      }
      snapshot(rel.length
        ? "松弛：对 " + u + " 的每个未确定邻接点 k，判断 <code>dist[u] + w(u,k) &lt; dist[k]</code> 是否成立。" +
          "本轮变小的顶点（橙色）：" + rel.map(function (e) { return "dist[" + e[1] + "] = " + dist[e[1]] + "（经 " + e[0] + "）"; }).join("；")
        : "松弛：顶点 " + u + " 的邻接点要么已经确定，要么走 " + u + " 过去并不会更短，<b>本轮的 dist 数组没有变化</b>。",
        { cur: u, upd: upd, relax: rel });
    }

    /* 路径还原 0 → 5 */
    var path = [], cur = 5;
    while (cur >= 0) { path.unshift(cur); cur = pre[cur]; }
    if (path[0] !== 0) path = [];
    var pedges = [];
    for (var j = 0; j + 1 < path.length; j++) pedges.push([path[j], path[j + 1]]);

    frames.push({
      desc: "<b>算法结束</b>，最终 <code>dist = [" + dist.join(", ") + "]</code>。<br>路径还原：从终点沿着 <code>pre[]</code> 往回退，" +
        "得到 0 → 5 的最短路径 <b>" + path.join(" → ") + "</b>，长度 <b>" + dist[5] + "</b>。" +
        "注意 <code>pre[]</code> 记录的是一棵「最短路树」，任何一条最短路径都能从它回溯出来。",
      draw: function (s) {
        resetGraph();
        for (var i = 0; i < 7; i++) if (done[i]) setNode(i, "done");
        for (i = 0; i < path.length; i++) setNode(path[i], "active");
        setEdgeSet(spt, "");
        setEdgeSet(pedges, "active");
        return drawGraph(s, {
          txtOf: function (k) { return String(dist[k]); },
          foot: "0 → 5 的最短路径：" + path.join(" → ") + "　长度 = " + dist[5] +
            "　（绿色细边 = 整棵最短路树）"
        });
      }
    });

    new DS.Viz(host, {
      title: "Dijkstra：每轮锁定一个 dist 最小的顶点，再松弛它的邻居",
      sub: "橙色 = 本轮被更新的顶点 / 被松弛的边",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     4) viz-floyd —— 全源最短路：dist 矩阵逐轮变化
     ========================================================================== */
  (function floyd() {
    var host = document.getElementById("viz-floyd");
    if (!host) return;

    var D = [], i, j;
    for (i = 0; i < 7; i++) { D.push([]); for (j = 0; j < 7; j++) D[i].push(W[i][j]); }

    var CW = 52, CH = 30, ORGX = 62, ORGY = 62;
    var frames = [];

    function drawMatrix(s, snap, k, changed, desc) {
      var svg = s.svg(640, 300);
      svg.appendChild(SVG.text(ORGX - 30, ORGY - 40, "dist[i][j]　（k = " + (k < 0 ? "初始（只允许直连边）" : k) + "）", "vz-text", "start"));
      for (j = 0; j < 7; j++) svg.appendChild(SVG.text(ORGX + j * CW + CW / 2, ORGY - 8, "j=" + j, "vz-label", "middle"));
      for (i = 0; i < 7; i++) {
        svg.appendChild(SVG.text(ORGX - 10, ORGY + i * CH + CH / 2 + 4, "i=" + i, "vz-label", "end"));
        for (j = 0; j < 7; j++) {
          var cls = "";
          if (k >= 0 && (i === k || j === k)) cls = "active";
          if (k >= 0 && changed && changed[i + "," + j]) cls = "compare";
          if (i === j && !cls) cls = "done";
          var val = snap[i][j] === INF ? "∞" : String(snap[i][j]);
          svg.appendChild(SVG.box(ORGX + j * CW + 3, ORGY + i * CH + 2, CW - 6, CH - 5, cls, val));
        }
      }
      /* 图例 */
      svg.appendChild(SVG.box(ORGX + 7 * CW + 22, ORGY + 20, 16, 16, "active", ""));
      svg.appendChild(SVG.text(ORGX + 7 * CW + 44, ORGY + 33, "第 k 行 / 第 k 列", "vz-label", "start"));
      svg.appendChild(SVG.box(ORGX + 7 * CW + 22, ORGY + 46, 16, 16, "compare", ""));
      svg.appendChild(SVG.text(ORGX + 7 * CW + 44, ORGY + 59, "本轮被更新的格子", "vz-label", "start"));
      svg.appendChild(SVG.box(ORGX + 7 * CW + 22, ORGY + 72, 16, 16, "done", ""));
      svg.appendChild(SVG.text(ORGX + 7 * CW + 44, ORGY + 85, "dist[i][i] = 0（自身）", "vz-label", "start"));
      svg.appendChild(SVG.text(16, 288, desc, "vz-label", "start"));
      return svg;
    }

    /* 初始矩阵：推帧时就把 D 拷下来（若把 D.map 写进 draw，渲染发生在整个 build
       之后，拷到的会是最终矩阵 —— 第 0 帧就显示结果）。 */
    var d0 = D.map(function (r) { return r.slice(); });
    frames.push({
      desc: "<b>初始矩阵</b>：<code>dist[i][j]</code> 就是邻接矩阵——直接有边就是边权，没有边是 ∞，" +
        "<code>dist[i][i] = 0</code>。此时「只允许不中转」，即路径必须是一条边。",
      draw: function (s) {
        return drawMatrix(s, d0, -1, null,
          "k = 0 开始：依次允许用顶点 0、1、2、…、6 作为中转点");
      }
    });

    for (var k = 0; k < 7; k++) {
      var changed = {}, cnt = 0, detail = [];
      for (i = 0; i < 7; i++) {
        for (j = 0; j < 7; j++) {
          if (D[i][k] + D[k][j] < D[i][j]) {
            detail.push("dist[" + i + "][" + j + "] = " + (D[i][j] === INF ? "∞" : D[i][j]) +
              " → " + (D[i][k] + D[k][j]) + "（经 " + k + "）");
            D[i][j] = D[i][k] + D[k][j];
            changed[i + "," + j] = 1; cnt++;
          }
        }
      }
      (function (kk, ch, c, det) {
        var dSnap = D.map(function (r) { return r.slice(); });   /* ← 推帧时快照，别放进 draw */
        frames.push({
          desc: "<b>k = " + kk + "</b>：允许经过顶点 <b>" + kk + "</b> 中转（表格中蓝底的" +
            "第 " + kk + " 行与第 " + kk + " 列）。对每个 (i,j) 判断 <code>dist[i][k] + dist[k][j] &lt; dist[i][j]</code>。" +
            (c ? "本轮更新了 <b>" + c + "</b> 个格子（橙色）：" + det.join("；") :
              "本轮<b>没有任何格子变小</b>——经过 " + kk + " 中转都占不到便宜。"),
          draw: function (s) {
            return drawMatrix(s, dSnap, kk, ch,
              "已允许的中转点：0 … " + kk + "　本轮更新 " + c + " 个格子");
          }
        });
      })(k, changed, cnt, detail);
    }

    var finalRow = D[0].map(function (x) { return x === INF ? "∞" : x; }).join(", ");
    var dFinal = D.map(function (r) { return r.slice(); });
    frames.push({
      desc: "<b>k 走到 6，矩阵不再变化，算法结束。</b>此时 <code>dist[i][j]</code> 就是 i 到 j 的真实最短距离。" +
        "第 0 行 <code>[" + finalRow + "]</code> 正好等于从 0 出发跑一遍 Dijkstra 得到的 dist 数组——两种算法互相验证。",
      draw: function (s) {
        return drawMatrix(s, dFinal, 6, null, "最终的全源最短路径矩阵：任意两点之间的距离都在表里");
      }
    });

    new DS.Viz(host, {
      title: "Floyd：n 轮 DP，每轮多允许一个中转点",
      sub: "蓝底 = 第 k 行 / 第 k 列（中转站），橙底 = 本轮松弛成功的格子",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     5) viz-topo —— AOV 网拓扑排序（Kahn）
     ========================================================================== */
  (function topo() {
    var host = document.getElementById("viz-topo");
    if (!host) return;

    var n = 6, i;
    var E = [[0, 1, 7], [0, 2, 5], [1, 3, 6], [2, 3, 4], [2, 4, 3], [3, 5, 6], [4, 5, 8]];
    var indeg = [0, 0, 0, 0, 0, 0];
    for (i = 0; i < E.length; i++) indeg[E[i][1]]++;
    var outAdj = [[], [], [], [], [], []];
    var inAdj = [[], [], [], [], [], []];
    for (i = 0; i < E.length; i++) { outAdj[E[i][0]].push(E[i][1]); inAdj[E[i][1]].push(E[i][0]); }

    /* AOV 网布局：0 在左，1/2 在中上/中下，3/4 在右，5 在最右 */
    var PX = [80, 250, 250, 430, 430, 600];
    var PY = [200, 110, 290, 170, 320, 245];

    var removed = [], queue = [], order = [], frames = [];

    function drawNet(s, cur, activeE, st) {
      var svg = s.svg(680, 380);
      var k;
      for (k = 0; k < E.length; k++) {
        var e = E[k], cls = "";
        if (st.removed.indexOf(E[k][0]) >= 0) cls = activeE && activeE.indexOf(k) >= 0 ? "compare" : "dim";
        if (st.order.indexOf(e[0]) >= 0 && st.order.indexOf(e[1]) >= 0 && cls === "") cls = "done";
        var dx = PX[e[1]] - PX[e[0]], dy = PY[e[1]] - PY[e[0]];
        var len = Math.sqrt(dx * dx + dy * dy);
        var x1 = PX[e[0]] + dx / len * 24, y1 = PY[e[0]] + dy / len * 24;
        var x2 = PX[e[1]] - dx / len * 24, y2 = PY[e[1]] - dy / len * 24;
        edge(svg, x1, y1, x2, y2, cls, String(e[2]), (x1 + x2) / 2 + 12, (y1 + y2) / 2 - 6);
      }
      for (k = 0; k < n; k++) {
        var c = "";
        if (st.removed.indexOf(k) >= 0) c = "dim";
        if (st.queue.indexOf(k) >= 0) c = "compare";
        if (cur === k) c = "active";
        if (st.order.indexOf(k) >= 0 && st.queue.indexOf(k) < 0 && cur !== k) c = "done";
        svg.appendChild(SVG.circle(PX[k], PY[k], 22, c, String(k),
          /active|done|warn|compare/.test(c) ? "on" : ""));
        svg.appendChild(SVG.label(PX[k], PY[k] - 30, "in=" + st.indeg[k], "middle"));
      }
      return svg;
    }

    function snapshot(desc, cur, activeE) {
      /* indeg / removed / queue / order 都是逐轮改写的活变量，必须在此刻快照 */
      var st = {
        indeg: indeg.slice(),
        removed: removed.slice(),
        queue: queue.slice(),
        order: order.slice()
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = drawNet(s, cur, activeE, st);
          arrRow(svg, 66, 330, st.indeg.map(String), function (k) {
            if (cur >= 0 && E[cur] && E[cur][1] === k) return "compare";
            return st.indeg[k] === 0 ? "done" : "";
          }, 44, 24, "入度 indeg", true);
          svg.appendChild(SVG.text(16, 300, "队列 queue：[ " + st.queue.join(", ") + " ]　　" +
            "输出序列 topo：[ " + st.order.join(", ") + " ]", "vz-text", "start"));
          return svg;
        }
      });
    }

    for (i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);
    queue.sort(function (a, b) { return a - b; });

    snapshot("<b>第 ① 步：统计入度。</b>入度为 0 的顶点表示「没有前驱活动」，可以最先做。" +
      "本例中只有顶点 <b>0</b> 的入度为 0，把它入队。", -1, null);

    var guard = 0;
    while (queue.length && guard++ < 30) {
      queue.sort(function (a, b) { return a - b; });
      var u = queue.shift();
      snapshot("出队：取出顶点 <b>" + u + "</b>（入度已为 0），追加到拓扑序列末尾。", u, null);
      order.push(u); removed.push(u);
      var act = [];
      for (i = 0; i < outAdj[u].length; i++) {
        var v = outAdj[u][i];
        indeg[v]--;
        for (var t = 0; t < E.length; t++) if (E[t][0] === u && E[t][1] === v) act.push(t);
        if (indeg[v] === 0) queue.push(v);
      }
      /* 为避免重复，只保留第一条同 (u,v) 的边序号 */
      act = act.filter(function (x, idx) { return act.indexOf(x) === idx; });
      snapshot("删除 " + u + " 的所有出边：邻接点 " + outAdj[u].map(function (x) { return x + " 的入度减 1"; }).join("、") +
        (outAdj[u].length ? "；减到 0 的顶点立刻入队。" : "（没有出边）") +
        "　当前 queue = [ " + queue.slice().sort(function (a, b) { return a - b; }).join(", ") + " ]", u, act);
    }

    frames.push({
      desc: "<b>拓扑排序完成</b>，序列为 <b>" + order.join(" → ") + "</b>。" +
        (order.length === n
          ? "所有 " + n + " 个顶点都成功输出，说明这张有向图<b>无环（是 DAG）</b>。"
          : "只输出了 " + order.length + " 个顶点，还剩 " + (n - order.length) + " 个没输出——说明图里<b>存在环</b>！") +
        "用队列得到的顺序不唯一；若把队列换成<b>小根堆</b>，就能得到字典序最小的拓扑序。",
      draw: function (s) {
        var st = { indeg: indeg.slice(), removed: removed.slice(), queue: [], order: order.slice() };
        var svg = drawNet(s, -1, null, st);
        svg.appendChild(SVG.text(16, 300, "拓扑序：[ " + order.join(" → ") + " ]", "vz-text", "start"));
        return svg;
      }
    });

    new DS.Viz(host, {
      title: "拓扑排序（Kahn 算法）：不断摘掉入度为 0 的顶点",
      sub: "橙色 = 队列中的候选顶点，绿色 = 已输出",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     6) viz-critical-path —— AOE 网关键路径（ve / vl / e / l 四步）
     ========================================================================== */
  (function criticalPath() {
    var host = document.getElementById("viz-critical");
    if (!host) return;

    var n = 6, i;
    var E = [[0, 1, 7], [0, 2, 5], [1, 3, 6], [2, 3, 4], [2, 4, 3], [3, 5, 6], [4, 5, 8]];
    var topo = [0, 1, 2, 3, 4, 5];          // 本例拓扑序（唯一）
    var PX = [70, 220, 220, 390, 390, 570];
    var PY = [180, 90, 280, 150, 300, 210];

    /* ① 正推求 ve */
    var ve = [0, 0, 0, 0, 0, 0];
    for (i = 0; i < topo.length; i++) {
      var u = topo[i];
      for (var t = 0; t < E.length; t++) if (E[t][0] === u) ve[E[t][1]] = Math.max(ve[E[t][1]], ve[u] + E[t][2]);
    }
    /* ② 逆推求 vl */
    var vl = [ve[5], ve[5], ve[5], ve[5], ve[5], ve[5]];
    for (i = topo.length - 1; i >= 0; i--) {
      var x = topo[i], has = false;
      for (t = 0; t < E.length; t++) if (E[t][0] === x) { has = true; vl[x] = Math.min(vl[x], vl[E[t][1]] - E[t][2]); }
      if (!has) vl[x] = ve[5];
    }
    /* ③ 每条弧的 e / l / 松弛量 */
    var act = [];
    for (t = 0; t < E.length; t++) {
      var e0 = ve[E[t][0]], l0 = vl[E[t][1]] - E[t][2];
      act.push({ u: E[t][0], v: E[t][1], w: E[t][2], e: e0, l: l0, slack: l0 - e0, crit: e0 === l0 });
    }
    var critEdges = [], critNodes = {}, kmax = 0;
    for (t = 0; t < act.length; t++) if (act[t].crit) {
      critEdges.push([act[t].u, act[t].v]);
      critNodes[act[t].u] = 1; critNodes[act[t].v] = 1;
      kmax = Math.max(kmax, act[t].slack);
    }

    var frames = [];

    function drawNet(s, opt) {
      opt = opt || {};
      var svg = s.svg(680, 480), k;
      for (k = 0; k < E.length; k++) {
        var e = E[k], cls = "";
        if (opt.crit && act[k].crit) cls = "done";
        else if (opt.dim) cls = "dim";
        var dx = PX[e[1]] - PX[e[0]], dy = PY[e[1]] - PY[e[0]];
        var len = Math.sqrt(dx * dx + dy * dy);
        edge(svg, PX[e[0]] + dx / len * 24, PY[e[0]] + dy / len * 24,
          PX[e[1]] - dx / len * 24, PY[e[1]] - dy / len * 24, cls,
          String(e[2]), (PX[e[0]] + PX[e[1]]) / 2 + 12, (PY[e[0]] + PY[e[1]]) / 2 - 6);
      }
      for (k = 0; k < n; k++) {
        var c = "";
        if (opt.hi && opt.hi.indexOf(k) >= 0) c = "active";
        if (opt.crit && critNodes[k]) c = "done";
        if (opt.cur === k) c = "compare";
        svg.appendChild(SVG.circle(PX[k], PY[k], 24, c, String(k),
          /active|done|warn|compare/.test(c) ? "on" : ""));
        if (opt.showVe) svg.appendChild(SVG.label(PX[k] + 28, PY[k] - 26, "ve=" + ve[k], "middle"));
        if (opt.showVl) svg.appendChild(SVG.label(PX[k] + 30, PY[k] + 6, "vl=" + vl[k], "middle"));
      }
      return svg;
    }

    function snapshot(desc, opt) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = drawNet(s, opt);
          if (opt.showVe) {
            arrRow(svg, 74, 372, ve.map(String), function (k) { return opt.cur === k ? "compare" : "done"; },
              44, 22, "ve（最早）", true);
          }
          if (opt.showVl) {
            arrRow(svg, 74, 414, vl.map(String), function (k) { return opt.cur === k ? "compare" : "done"; },
              44, 22, "vl（最迟）", true);
          }
          if (opt.foot) svg.appendChild(SVG.text(16, 464, opt.foot, "vz-label", "start"));
          return svg;
        }
      });
    }

    snapshot("<b>AOE 网</b>：顶点 = 事件，弧 = 活动，弧上的权 = 活动持续时间。" +
      "顶点 0 是<b>源点</b>（入度为 0，工程开始），顶点 5 是<b>汇点</b>（出度为 0，工程结束）。" +
      "下面四步依次算出 ve、vl、e、l。", { hi: [0, 5] });

    /* ① ve */
    snapshot("<b>第 ① 步：按拓扑序正推 ve（事件最早发生时间）。</b>" +
      "源点 <code>ve(0) = 0</code>；其余顶点 <code>ve(v) = max{ ve(u) + w(u,v) }</code>，" +
      "因为一个事件必须等所有前驱活动都完成才能发生，所以取 <b>max</b>。", { hi: [0], showVe: true });
    for (i = 0; i < topo.length; i++) {
      var uu = topo[i];
      var parts = [];
      for (t = 0; t < E.length; t++) if (E[t][0] === uu) parts.push("ve(" + E[t][1] + ") = max(…, " + ve[uu] + "+" + E[t][2] + " = " + (ve[uu] + E[t][2]) + ")");
      snapshot("处理顶点 <b>" + uu + "</b>（ve = " + ve[uu] + "）：用它的每条出边去更新后继 —— " +
        (parts.length ? parts.join("；") : "它没有出边（汇点），不再向后更新。"),
        { cur: uu, showVe: true, hi: topo.slice(0, i + 1) });
    }
    snapshot("<b>ve 全部求出</b>：[" + ve.join(", ") + "]。<code>ve(5) = " + ve[5] + "</code> 就是" +
      "<b>整个工程的最短完成时间</b>——它同时也是从源点到汇点最长路径的长度。",
      { showVe: true, hi: topo });

    /* ② vl */
    snapshot("<b>第 ② 步：按逆拓扑序倒推 vl（事件最迟发生时间）。</b>" +
      "汇点 <code>vl(5) = ve(5) = " + ve[5] + "</code>（工程不能拖延）；其余 <code>vl(u) = min{ vl(v) − w(u,v) }</code>，" +
      "取 <b>min</b>：必须保证所有后继活动都来得及。", { showVe: true, showVl: true, hi: [5] });
    for (i = topo.length - 1; i >= 0; i--) {
      var w2 = topo[i], ps = [];
      for (t = 0; t < E.length; t++) if (E[t][0] === w2) ps.push("vl(" + w2 + ") = min(…, vl(" + E[t][1] + ")−" + E[t][2] + " = " + (vl[E[t][1]] - E[t][2]) + ")");
      snapshot("处理顶点 <b>" + w2 + "</b>：看它的每条出边 —— " +
        (ps.length ? ps.join("；") + "，取最小 ⇒ vl(" + w2 + ") = " + vl[w2] : "没有出边（汇点），vl = ve = " + ve[5]),
        { cur: w2, showVe: true, showVl: true, hi: topo.slice(i) });
    }
    snapshot("<b>vl 全部求出</b>：[" + vl.join(", ") + "]。对比 ve 可以发现：" +
      "ve(2) = 5 而 vl(2) = 8，说明事件 2 有 3 个单位的「机动时间」，可以晚点发生也不影响总工期。",
      { showVe: true, showVl: true, hi: topo });

    /* ③ e / l */
    var list = [];
    for (t = 0; t < act.length; t++) list.push("a" + t + "(" + act[t].u + "," + act[t].v + ")");
    var clsAct = function (k) { return act[k].crit ? "done" : "compare"; };
    frames.push({
      desc: "<b>第 ③ 步：求每条弧（活动）的 e 与 l。</b>" +
        "<code>e(a) = ve(u)</code>（最早开始 = 起点事件最早发生时间）；" +
        "<code>l(a) = vl(v) − w(u,v)</code>（最迟开始 = 终点事件最迟发生时间减去活动时长）。" +
        "下表依次是每条活动的 <b>e、l、l − e（时间余量）</b>。",
      draw: function (s) {
        var svg = drawNet(s, { showVe: true, showVl: false });
        arrRow(svg, 126, 360, list, clsAct, 74, 24, "活动 a", true);
        arrRow(svg, 126, 402, act.map(function (a) { return String(a.e); }), clsAct, 74, 24, "e（最早）", true);
        arrRow(svg, 126, 444, act.map(function (a) { return String(a.l); }), clsAct, 74, 24, "l（最迟）", true);
        svg.appendChild(SVG.text(16, 300, "e(a) = ve(u)　　l(a) = vl(v) − w(a)", "vz-label", "start"));
        return svg;
      }
    });

    /* ④ 关键活动 */
    frames.push({
      desc: "<b>第 ④ 步：找出关键活动。</b>凡是 <code>e(a) = l(a)</code>（时间余量 l − e = 0）的活动就是<b>关键活动</b>，" +
        "它们在图中用绿色标出：" + act.map(function (a, k) {
          return a.crit ? "a" + k + "(" + a.u + "," + a.v + ") 余量 0 ★" : null;
        }).filter(Boolean).join("、") + "。" +
        "其余活动都有正的机动时间（" + act.map(function (a, k) {
          return a.crit ? null : "a" + k + " 余量 " + a.slack;
        }).filter(Boolean).join("、") + "），晚开始几天不会影响总工期。",
      draw: function (s) {
        var svg = drawNet(s, { crit: true });
        arrRow(svg, 126, 360, act.map(function (a) { return a.crit ? "★ 0" : String(a.slack); }),
          function (k) { return act[k].crit ? "done" : "compare"; }, 74, 24, "余量 l−e", true);
        svg.appendChild(SVG.text(16, 300, "余量为 0 的活动 = 关键活动（绿色）", "vz-label", "start"));
        return svg;
      }
    });

    /* ⑤ 关键路径高亮 */
    frames.push({
      desc: "<b>关键路径</b>：把关键活动首尾相接，得到从源点到汇点的路径 <b>0 → 1 → 3 → 5</b>，" +
        "长度 7 + 6 + 6 = <b>" + ve[5] + "</b>。它就是源点到汇点的<b>最长路径</b>——" +
        "正因为它是全场最长的一条，工程的最短完成时间才由它决定。缩短这条路上的任一活动都可能缩短总工期，" +
        "但缩短到一定程度后，别的路径会变成新的关键路径（比如 0 → 2 → 4 → 5 长度 5 + 3 + 8 = 16）。",
      draw: function (s) {
        var svg = drawNet(s, { crit: true });
        svg.appendChild(SVG.text(16, 462, "关键路径 0 → 1 → 3 → 5　长度 = " + ve[5] +
          "　（次长路径 0 → 2 → 4 → 5 长度 16）", "vz-label", "start"));
        return svg;
      }
    });

    new DS.Viz(host, {
      title: "关键路径：正推 ve → 逆推 vl → 求 e、l → 标出关键活动",
      sub: "关键活动满足 e(a) = l(a)，即时间余量为 0",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     7) viz-bellman —— Bellman-Ford 逐轮松弛 + 负环判定
     ========================================================================== */
  (function bellman() {
    var host = document.getElementById("viz-bellman");
    if (!host) return;

    var n = 5;
    var E = [[0, 1, 2], [1, 2, 2], [0, 2, 5], [2, 4, 4], [1, 4, 7], [4, 3, 4]];
    var PX = [70, 230, 380, 560, 460];
    var PY = [200, 80, 140, 260, 350];
    var dist = [0, INF, INF, INF, INF];
    var frames = [], round = 0;

    function drawNet(s, hiE, doneRound, distSnap) {
      var svg = s.svg(660, 420), k;
      for (k = 0; k < E.length; k++) {
        var e = E[k], cls = hiE === k ? "compare" : "";
        var dx = PX[e[1]] - PX[e[0]], dy = PY[e[1]] - PY[e[0]];
        var len = Math.sqrt(dx * dx + dy * dy);
        edge(svg, PX[e[0]] + dx / len * 26, PY[e[0]] + dy / len * 26,
          PX[e[1]] - dx / len * 26, PY[e[1]] - dy / len * 26, cls, "e" + k + ":" + e[2],
          (PX[e[0]] + PX[e[1]]) / 2 + 14, (PY[e[0]] + PY[e[1]]) / 2 - 6);
      }
      for (k = 0; k < n; k++) {
        var c = distSnap[k] === INF ? "dim" : (k === 0 ? "done" : "active");
        svg.appendChild(SVG.circle(PX[k], PY[k], 26, c, distSnap[k] === INF ? "∞" : String(distSnap[k]),
          /active|done|warn|compare/.test(c) ? "on" : ""));
        svg.appendChild(SVG.label(PX[k], PY[k] - 34, "v" + k, "middle"));
      }
      arrRow(svg, 66, 356, distSnap.map(function (x) { return x === INF ? "∞" : String(x); }),
        function (k) { return distSnap[k] === INF ? "dim" : "done"; }, 62, 26, "dist", true);
      svg.appendChild(SVG.text(560, 366, "已完成", "vz-label", "start"));
      svg.appendChild(SVG.text(560, 384, doneRound + " / " + (n - 1) + " 轮", "vz-label", "start"));
      return svg;
    }

    /* 第 0 帧：dist 的初始状态也要快照（draw 在整个 build 之后才跑） */
    var distInit = dist.slice();
    frames.push({
      desc: "<b>Bellman-Ford 初始化</b>：<code>dist[0] = 0</code>，其余为 ∞。核心动作只有一句话：" +
        "<b>每一轮把所有的边都松弛一遍</b>（不做任何挑选）。",
      draw: function (s) { return drawNet(s, -1, 0, distInit); }
    });

    for (var r = 1; r <= n - 1; r++) {
      round = r;
      var changed = [], det = [];
      for (var k = 0; k < E.length; k++) {
        var u = E[k][0], v = E[k][1], w = E[k][2];
        if (dist[u] < INF && dist[u] + w < dist[v]) {
          det.push("e" + k + "(" + u + "→" + v + ")：dist[" + v + "] " + (dist[v] === INF ? "∞" : dist[v]) + " → " + (dist[u] + w));
          dist[v] = dist[u] + w;
          changed.push(k);
        }
      }
      (function (rr, ch, det2, rd) {
        var distSnap = dist.slice();          /* ← 推帧时快照本轮结束后的 dist */
        frames.push({
          desc: "<b>第 " + rr + " 轮</b>：按固定顺序扫描全部 " + E.length + " 条边。" +
            (det2.length ? "发生松弛的边：" + det2.join("；") : "本轮<b>所有边都没能松弛</b>——dist 已经收敛。"),
          draw: function (s) {
            var svg = drawNet(s, ch.length ? ch[ch.length - 1] : -1, rd, distSnap);
            svg.appendChild(SVG.text(16, 404, "本轮更新 " + ch.length + " 次" +
              (ch.length ? "（边序号 " + ch.join(",") + "）" : "") +
              "　dist = [" + distSnap.map(function (x) { return x === INF ? "∞" : x; }).join(", ") + "]", "vz-label", "start"));
            return svg;
          }
        });
      })(r, changed, det, r);
    }

    var distFinal = dist.slice();
    frames.push({
      desc: "<b>n − 1 = 4 轮结束</b>，最终 <code>dist = [" + dist.map(function (x) { return x === INF ? "∞" : x; }).join(", ") + "]</code>。" +
        "为什么最多 n−1 轮就够？任何一条最短路径最多经过 n 个顶点、n−1 条边；" +
        "第 1 轮至少能确定「只含 1 条边」的最短路，第 r 轮至少能确定「含 r 条边」的最短路，所以 n−1 轮足以覆盖所有情况。" +
        "<br>实战中再加一轮扫描：如果还能松弛，就说明存在<b>从源点可达的负环</b>。",
      draw: function (s) {
        var svg = drawNet(s, -1, n - 1, distFinal);
        svg.appendChild(SVG.text(16, 404, "最终 dist = [" + distFinal.map(function (x) { return x === INF ? "∞" : x; }).join(", ") + "]，第 2 轮起就没有再更新过", "vz-label", "start"));
        return svg;
      }
    });

    /* 负环演示 */
    frames.push({
      desc: "<b>负环长什么样？</b>把上图换成 0→1(1)、1→2(−2)、2→0(−3) 三条边，" +
        "环 0→1→2→0 的总权值是 1 + (−2) + (−3) = <b>−4 &lt; 0</b>。" +
        "把 dist 全部初始化成 0（等价于加一个到所有点权为 0 的超级源点），每跑一轮所有 dist 就整体减 4：" +
        "第 1 轮 [−5,0,−2] → 第 2 轮 [−9,−4,−6] → 第 3 轮 [−13,−8,−10] …" +
        "<b>只要还能松弛就说明绕一圈能更短，最短路根本不存在</b>（可以绕无穷多圈，距离趋于 −∞）。" +
        "这正是 Bellman-Ford 判负环的原理：跑满 n−1 轮后再扫一遍所有边，若仍能松弛 ⇒ 有负环。",
      draw: function (s) {
        var svg = s.svg(660, 420);
        var A = [120, 330, 540], B = [110, 320, 110];
        var NE = [[0, 1, 1], [1, 2, -2], [2, 0, -3]];
        for (var k = 0; k < NE.length; k++) {
          var e = NE[k];
          var i0 = e[0], i1 = e[1];
          var dx = A[i1] - A[i0], dy = B[i1] - B[i0], len = Math.sqrt(dx * dx + dy * dy);
          edge(svg, A[i0] + dx / len * 28, B[i0] + dy / len * 28,
            A[i1] - dx / len * 28, B[i1] - dy / len * 28, "warn", String(e[2]),
            (A[i0] + A[i1]) / 2 + 16, (B[i0] + B[i1]) / 2 - 8);
        }
        for (var q = 0; q < 3; q++) {
          svg.appendChild(SVG.circle(A[q], B[q], 28, "warn", String(q), "on"));
        }
        svg.appendChild(SVG.text(16, 250, "负环：0 → 1(1) → 2(−2) → 0(−3)，环总权 = −4", "vz-text", "start"));
        svg.appendChild(SVG.text(16, 280, "第 1 轮 dist = [−5, 0, −2]", "vz-label", "start"));
        svg.appendChild(SVG.text(16, 302, "第 2 轮 dist = [−9, −4, −6]", "vz-label", "start"));
        svg.appendChild(SVG.text(16, 324, "第 3 轮 dist = [−13, −8, −10]　……永远收敛不了", "vz-label", "start"));
        svg.appendChild(SVG.text(16, 356, "无负环时，dist 最多 n−1 轮后必然稳定。", "vz-label", "start"));
        return svg;
      }
    });

    new DS.Viz(host, {
      title: "Bellman-Ford：n−1 轮「暴力松弛所有边」",
      sub: "圆内数字 = 当前 dist，橙色边 = 本轮正在松弛的边",
      build: function () { return { frames: frames }; }
    });
  })();

})();
