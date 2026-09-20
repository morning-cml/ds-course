/* ==========================================================================
   ch12-viz.js —— 第 12 讲《排序体系与下界分析（下）》· 交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG

   统一写法：每个演示都先跑一遍「可视化的状态机」，在真实算法的循环里调用
   snap(desc, …) 把当前状态与高亮标记推成一帧，最后交给
   new DS.Viz(host, { title, sub, build: function () { return { frames: frames }; } }) 播放。
   这样动画与算法严格同步，不会出现「图与描述不符」。

   8 个演示（容器 id 与页面一一对应）：
     1. viz-decision-tree  3 元素决策树：2^h ≥ n! 的构造性证明
     2. viz-counting       计数排序三步：频次 → 前缀和 → 倒序放置（稳定性）
     3. viz-bucket         桶排序：分桶 → 桶内插入排序 → 按桶号收集
     4. viz-cocktail       鸡尾酒排序 vs 普通冒泡（同一组数据上下并排）
     5. viz-comb           梳排序：gap ÷ 1.3 逐轮收缩，gap = 1 冒泡收尾
     6. viz-tournament     锦标赛排序（胜者树）：建树 n−1 次，重赛 log n 次
     7. viz-introsort      内省排序：快排主干 + 小区间插排 + 深度超限转堆排
     8. viz-merge-two      2-路归并 / 原地归并手摇算法 / k 路归并与败者树
   ========================================================================== */
(function () {
  "use strict";
  var SVG = DS.SVG;

  /* 全篇数组格子的统一尺寸：格子边长 46px、格间距 8px、步距 54px、第一格左边缘 X0 = 44。 */
  var BOX = 46, GAP = 8, PITCH = BOX + GAP, X0 = 44;

  /* ============================ 通用小工具 ============================ */

  /* 实心圆结点才需要白字（vz-node.active 等是实色）；
     vz-box 的 active / done 都是浅色底，正文色反而更清楚 */
  function nodeOn(cls) { return /active|compare|done|warn/.test(cls || "") ? "on" : ""; }

  /* 小号灰色信息行 */
  function note(s, x, y, str) { s.appendChild(SVG.label(x, y, str, "start")); }

  /* 彩色文字：.vz-text / .vz-label 的 CSS 会盖掉 fill 属性，所以必须写 inline style */
  function tag(s, x, y, str, color, anchor, size, weight) {
    s.appendChild(SVG.el("text", {
      x: x, y: y, "text-anchor": anchor || "start", "class": "vz-text",
      style: "fill:" + (color || "var(--text)") +
        ";font-size:" + (size || 13) + "px;font-weight:" + (weight === undefined ? 700 : weight)
    }, String(str)));
  }

  /* 用 CSS 变量上色的格子（强调「同一个关键字的不同副本」，例如 3a / 3b） */
  function colorBox(s, x, y, w, h, color, text) {
    var g = SVG.el("g");
    g.appendChild(SVG.el("rect", {
      x: x, y: y, width: w, height: h, rx: 6,
      fill: "var(" + color + "-soft)", stroke: "var(" + color + ")", "stroke-width": 2
    }));
    if (text !== undefined && text !== null && text !== "") {
      g.appendChild(SVG.el("text", {
        x: x + w / 2, y: y + h / 2 + 5, "text-anchor": "middle", "class": "vz-text",
        style: "fill:var(" + color + ");font-weight:700"
      }, String(text)));
    }
    s.appendChild(g);
    return g;
  }

  /* 给彩色格子叠一层状态外圈：蓝 = 当前、橙 = 比较中、红 = 正在搬动 */
  function ring(s, x, y, w, h, cls) {
    var c = cls === "compare" ? "--accent" : (cls === "warn" ? "--danger" : "--brand");
    s.appendChild(SVG.el("rect", {
      x: x - 3.5, y: y - 3.5, width: w + 7, height: h + 7, rx: 9, fill: "none",
      style: "stroke:var(" + c + ");stroke-width:3"
    }));
  }

  /* 虚线占位框（空槽 / 已腾空的位置） */
  function dashBox(s, x, y, w, h, text) {
    s.appendChild(SVG.el("rect", {
      x: x, y: y, width: w, height: h, rx: 6, "class": "vz-box",
      "stroke-dasharray": "4 3", opacity: ".5"
    }));
    if (text) s.appendChild(SVG.el("text", {
      x: x + w / 2, y: y + h / 2 + 5, "text-anchor": "middle", "class": "vz-text", opacity: ".55"
    }, String(text)));
  }

  /* 三角指针：文字在三角上方（用于数组行上方的 i / j / k 等） */
  function ptr(s, cx, y, txt, color) {
    var c = color || "var(--brand)";
    var tri = SVG.path("M" + cx + "," + y + " l-7,-10 l14,0 z", "", false);
    tri.setAttribute("style", "fill:" + c + ";stroke:none");
    s.appendChild(tri);
    s.appendChild(SVG.el("text", {
      x: cx, y: y - 14, "text-anchor": "middle", "class": "vz-label",
      style: "fill:" + c + ";font-weight:700"
    }, String(txt)));
  }

  /* 画一行格子：opt = {box, pitch, texts, labels, colors, rings} */
  function row(s, x0, y, n, clsFn, opt) {
    opt = opt || {};
    var box = opt.box || BOX, pitch = opt.pitch || (box + GAP);
    for (var i = 0; i < n; i++) {
      var x = x0 + i * pitch, c = (clsFn ? clsFn(i) : "") || "";
      var t = opt.texts ? opt.texts[i] : "";
      if (t === undefined || t === null) t = "";
      if (opt.colors && opt.colors[i]) colorBox(s, x, y, box, box, opt.colors[i], t);
      else s.appendChild(SVG.box(x, y, box, box, c, t, ""));
      if (opt.labels) {
        var lab = (typeof opt.labels === "function") ? opt.labels(i) : opt.labels[i];
        if (lab !== undefined && lab !== null && lab !== "") {
          s.appendChild(SVG.label(x + box / 2, y + box + 16, String(lab), "middle"));
        }
      }
      if (opt.rings && opt.rings[i]) ring(s, x, y, box, box, opt.rings[i]);
    }
    return x0 + n * pitch;
  }

  /* marks：marksFrom(n, fn) */
  /* marksFrom(n, fn) = 生成 { 下标: 类名 } 的着色表（fn(i) 返回空串的下标就不会出现在表里）；
     本文件所有 snap 的标记参数都是这个形状。 */
  function marksFrom(n, fn) {
    var m = {};
    for (var i = 0; i < n; i++) {
      var v = fn(i);
      if (v) m[i] = v;
    }
    return m;
  }

  /* 曲线连线（连接相距 gap 的两个格子） */
  function arc(s, x1, y1, x2, y2, color, up) {
    var peak = Math.min(y1, y2) - (up === undefined ? 34 : up);
    var d = "M" + x1 + "," + y1 + " Q" + ((x1 + x2) / 2) + "," + peak + " " + x2 + "," + y2;
    var p = SVG.path(d, "", false);
    p.setAttribute("style", "stroke:" + (color || "var(--accent)") + ";stroke-width:2.4;fill:none");
    s.appendChild(p);
  }

  /* 画布内的「状态牌」 */
  function chip(s, x, y, w, h, text, cls) {
    s.appendChild(SVG.box(x, y, w, h, cls || "", text, ""));
  }

  /* ==========================================================================
     演示 1：3 元素决策树 —— 从叶子往根搭树，读出「至少 3 次比较」
     容器：<div id="viz-decision-tree">
     ========================================================================== */
  (function decisionTree() {
    var host = document.getElementById("viz-decision-tree");
    if (!host) return;

    /* 画布尺寸；NODE_W/NODE_H = 内部结点（比较）的框，LEAF_W/LEAF_H = 叶子（输出排列）的框。 */
    var W = 880, H = 476;
    var NODE_W = 88, NODE_H = 32, LEAF_W = 66, LEAF_H = 30;

    /* 6 个叶子 = 3! 种输出排列（字典序放置，方便数「已放下几个」） */
    /* LEAVES[t] = 一个叶子：t = 该输出排列的字符串（如 "abc"），x/y = 画布坐标。
       数组顺序 = 字典序，所以「已放下前 st.leaves 个」就是「已放下的叶子**个数**」（不是下标）。 */
    var LEAVES = [
      { t: "abc", x: 140, y: 252 },
      { t: "acb", x: 288, y: 348 },
      { t: "bac", x: 540, y: 252 },
      { t: "bca", x: 678, y: 348 },
      { t: "cab", x: 400, y: 348 },
      { t: "cba", x: 800, y: 348 }
    ];
    /* 5 个内部结点 = 5 次比较（内部结点总数就是这棵树用到的比较次数） */
    /* NODES = 内部结点（一次比较）：id 是它的名字，q 是判断式，d 是深度（0 基）——
       深度 d 的结点建好，意味着它上面还挂着 3 − d 层；内部结点总数就是这棵树的比较次数。 */
    var NODES = [
      { id: "root", q: "a < b ？", x: 440, y: 62, d: 0 },
      { id: "nL", q: "b < c ？", x: 240, y: 158, d: 1 },
      { id: "nR", q: "a < c ？", x: 640, y: 158, d: 1 },
      { id: "nLL", q: "a < c ？", x: 340, y: 252, d: 2 },
      { id: "nRR", q: "b < c ？", x: 740, y: 252, d: 2 }
    ];
    /* 边：[父结点 id, 子结点 id, 分支标签] */
    /* EDGES = 边表，每条边写成 [父结点 id, 子结点 id, 分支标签]（树形结构全靠它画出来）。 */
    var EDGES = [
      ["root", "nL", "<（真）"], ["root", "nR", "≥（假）"],
      ["nL", "abc", "<"], ["nL", "nLL", "≥"],
      ["nLL", "acb", "<"], ["nLL", "cab", "≥"],
      ["nR", "bac", "<"], ["nR", "nRR", "≥"],
      ["nRR", "bca", "<"], ["nRR", "cba", "≥"]
    ];

    function isNode(id) {
      for (var i = 0; i < NODES.length; i++) if (NODES[i].id === id) return true;
      return false;
    }
    function posOf(id) {
      for (var i = 0; i < NODES.length; i++) if (NODES[i].id === id) return NODES[i];
      for (var j = 0; j < LEAVES.length; j++) if (LEAVES[j].t === id) return LEAVES[j];
      return { x: 0, y: 0 };
    }
    function halfH(id) { return isNode(id) ? NODE_H / 2 : LEAF_H / 2; }
    /* 树高：某个内部结点建好，意味着它上面还挂着 3 − 深度 层 */
    function heightOf(nodes) {
      var h = 0;
      for (var i = 0; i < NODES.length; i++) {
        if (nodes[NODES[i].id]) h = Math.max(h, 3 - NODES[i].d);
      }
      return h;
    }
    function nodesList(ids) {
      var o = {};
      for (var i = 0; i < ids.length; i++) o[ids[i]] = true;
      return o;
    }
    function edgeSet(list) {
      var o = {};
      for (var i = 0; i < list.length; i++) o[list[i]] = true;
      return o;
    }

    /* 帧数组：build() 里被同步填满，之后才逐帧渲染；draw 只能读推帧时就定下来的值。 */
    var frames = [];
    /* 推一帧。st 是**每次调用新建**的参数对象，所以不用拷贝：
       st.nodes = 已经建好的内部结点集合（{id: true}）、st.leaves = 已经放下的叶子**个数**、
       st.hlNode / hlLeaf / hlEdge = 本帧要高亮的结点 / 叶子 / 边，st.pathEdges / pathLeaf = 当前判定路径，
       st.nodeCls = 高亮结点用的类名，st.msg1 / msg2（含颜色）是底部结论区的文字。 */
    function snap(desc, st) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          var h = heightOf(st.nodes), pw = Math.pow(2, h);

          note(svg, 16, 20, "内部结点 = 一次比较（只有「真 / 假」两个分支）；叶子 = 一种输出排列");
          tag(svg, 16, 44, "已放下叶子数 " + st.leaves + " / 6",
            st.leaves >= 6 ? "var(--ok)" : "var(--brand)", "start", 13.5);
          tag(svg, 226, 44, "树高 h = " + h, "var(--purple)", "start", 13.5);
          tag(svg, 340, 44, "2^h = " + pw, "var(--text)", "start", 13.5);
          tag(svg, 424, 44, pw >= 6 ? "≥ 6 → 装得下 6 个叶子 ✅" : "小于 6 → 装不下 6 个叶子 ❌",
            pw >= 6 ? "var(--ok)" : "var(--danger)", "start", 13.5);

          /* 边 */
          for (var e = 0; e < EDGES.length; e++) {
            var ed = EDGES[e];
            if (!st.nodes[ed[0]]) continue;
            var p1 = posOf(ed[0]), p2 = posOf(ed[1]);
            var hot = (st.hlEdge === e);
            var onPath = st.pathEdges && st.pathEdges[e];
            var ecls = hot ? "active" : (onPath ? "done" : "");
            svg.appendChild(SVG.line(p1.x, p1.y + halfH(ed[0]), p2.x, p2.y - halfH(ed[1]), ecls));
            var mx = (p1.x + p2.x) / 2, my = (p1.y + halfH(ed[0]) + p2.y - halfH(ed[1])) / 2;
            tag(svg, mx + 8, my + 4, ed[2],
              hot ? "var(--brand)" : (onPath ? "var(--ok)" : "var(--text-faint)"),
              "start", 11.5, hot ? 700 : 400);
          }

          /* 叶子 */
          for (var i = 0; i < LEAVES.length; i++) {
            var lf = LEAVES[i];
            var placed = (i < st.leaves);
            if (!placed && st.hlLeaf !== lf.t) continue;
            var lcls;
            if (st.hlLeaf === lf.t) lcls = "compare";
            else if (st.pathLeaf === lf.t) lcls = "active";
            else lcls = "done";
            svg.appendChild(SVG.box(lf.x - LEAF_W / 2, lf.y - LEAF_H / 2, LEAF_W, LEAF_H, lcls, lf.t, ""));
          }
          /* 内部结点 */
          for (var k = 0; k < NODES.length; k++) {
            var nd = NODES[k];
            if (!st.nodes[nd.id]) continue;
            var ncls = (st.hlNode === nd.id) ? (st.nodeCls || "compare") : "done";
            svg.appendChild(SVG.box(nd.x - NODE_W / 2, nd.y - NODE_H / 2, NODE_W, NODE_H, ncls, nd.q, ""));
          }

          /* 底部结论区 */
          svg.appendChild(SVG.el("rect", {
            x: 16, y: 392, width: 848, height: 68, rx: 10,
            fill: "var(--panel-2)", stroke: "var(--border)", "stroke-width": 1.4
          }));
          tag(svg, 30, 418, st.msg1 || "", st.msg1Color || "var(--text)", "start", 13);
          if (st.msg2) tag(svg, 30, 442, st.msg2, st.msg2Color || "var(--text-soft)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    /* NONE = 共享的空集合（“一个结点都没建好”），避免每次都新建空对象。 */
    var NONE = {};

    snap("要说明「3 个元素排序至少要比较 3 次」，先把<b>所有可能的输出</b>摆出来：" +
      "3 个元素 a、b、c 一共有 <b>3! = 6</b> 种排列（abc、acb、bac、bca、cab、cba），" +
      "算法最后必须能指出「到底是哪一种」。这 6 种排列就是决策树的<b>叶子</b>。" +
      "下面从叶子开始，一层层往上搭。",
      { leaves: 0, nodes: NONE, hlNode: null, hlLeaf: null, hlEdge: -1,
        msg1: "叶子数目标 = n! = 3! = 6",
        msg1Color: "var(--brand)",
        msg2: "先把 6 个叶子放好，再看要加多少层比较结点才能把它们连成一棵树" });

    for (var li = 0; li < LEAVES.length; li++) {
      var lv = LEAVES[li];
      snap("放下第 <b>" + (li + 1) + "</b> 个叶子：<code>" + lv.t + "</code>（表示输出顺序是 " +
        lv.t.split("").join(" ≤ ") + "）。已放下 <b>" + (li + 1) + " / 6</b> 个排列。" +
        "叶子只负责「有哪些答案」，它自己不做任何比较，所以此刻树高还是 0。",
        { leaves: li + 1, nodes: NONE, hlNode: null, hlLeaf: lv.t, hlEdge: -1,
          msg1: "已放下叶子 " + (li + 1) + " / 6，树高 h = 0，2^0 = 1 小于 6",
          msg2: "叶子再多也挂不上树：它们必须挂在「一次比较」的两个分支下面" });
    }

    snap("6 个叶子全部就位：<b>叶子数正好等于 3! = 6</b>，一个不多一个不少。" +
      "但叶子必须由比较结点连起来，否则算法根本走不到它们。" +
      "下面用内部结点（每个内部结点 = 一次两元素比较）把叶子两两并起来。",
      { leaves: 6, nodes: NONE, hlNode: null, hlLeaf: null, hlEdge: -1,
        msg1: "叶子数 = 6 = 3!，接下来靠比较结点把它们连成一棵树",
        msg1Color: "var(--brand)" });

    snap("建第一个比较结点：<b>a < c ？</b>，两个分支分别通向叶子 <code>acb</code> 与 <code>cab</code>。" +
      "为什么是这两个？因为当 a < b 且 b ≥ c 时，只剩 a 与 c 的大小还没定：a < c → acb，a ≥ c → cab。" +
      "一次比较正好把两种情况分开，这棵小子树的高度 = 1。",
      { leaves: 6, nodes: nodesList(["nLL"]), hlNode: "nLL", hlEdge: 5,
        msg1: "树高 h = 1，2^1 = 2 小于 6 —— 还远远装不下 6 个叶子",
        msg1Color: "var(--danger)" });

    snap("第二个比较结点：<b>b < c ？</b>，分支通向叶子 <code>bca</code> 与 <code>cba</code>。" +
      "现在树上有 2 个比较结点、4 个叶子挂在它们下面，树高仍然是 h = 1。",
      { leaves: 6, nodes: nodesList(["nLL", "nRR"]), hlNode: "nRR", hlEdge: 8,
        msg1: "树高 h = 1，2^1 = 2 小于 6",
        msg1Color: "var(--danger)" });

    snap("再往上并一层：<b>b < c ？</b> 把叶子 <code>abc</code> 与上一层的子树（acb / cab）收拢到自己下面。" +
      "它的含义是：先比较 a 与 b，若 a < b 再比较 b 与 c。" +
      "树高涨到 <b>h = 2</b>，而 <b>2² = 4 仍然小于 6</b> —— 2 次比较最多分辨 4 种输出，不够！",
      { leaves: 6, nodes: nodesList(["nLL", "nRR", "nL"]), hlNode: "nL", hlEdge: 1,
        msg1: "树高 h = 2：2² = 4 小于 3! = 6 → 2 次比较必然不够",
        msg1Color: "var(--danger)",
        msg2: "这一步同时说明「h = 2 时最多只有 4 个叶子」—— 叶子不够就一定有解被漏掉" });

    snap("对称地建出右边的 <b>a < c ？</b>：若 a ≥ b，就先比较 a 与 c。" +
      "它把叶子 <code>bac</code> 与右侧子树（bca / cba）收拢起来。树高仍是 h = 2，2² = 4 仍然小于 6。",
      { leaves: 6, nodes: nodesList(["nLL", "nRR", "nL", "nR"]), hlNode: "nR", hlEdge: 3,
        msg1: "树高 h = 2，2² = 4 小于 6 → 还差一层",
        msg1Color: "var(--danger)" });

    snap("最后一层：<b>根结点 a < b ？</b> 把左右两棵子树接在一起，6 个叶子终于挂到同一棵树上。" +
      "根到最远叶子有 <b>3 条边</b>，所以 <b>树高 h = 3</b>，而 <b>2³ = 8 ≥ 6</b> ✅ " +
      "8 个位置放 6 个叶子，绰绰有余（多出来的 2 个位置正好容纳相等的重复情形）。",
      { leaves: 6, nodes: nodesList(["nLL", "nRR", "nL", "nR", "root"]), hlNode: "root", hlEdge: 0,
        msg1: "树高 h = 3：2³ = 8 ≥ 6 ✅ 叶子装得下了",
        msg1Color: "var(--ok)" });

    snap("把两边的不等式拼起来：<b>2² = 4 小于 3! = 6 ≤ 8 = 2³</b>。" +
      "h = 2 装不下 6 个叶子，所以任何比较排序在 n = 3 时<b>至少</b>要 3 次比较；" +
      "而 h = 3 的这棵树又<b>确实能用 3 次比较走完</b> —— 下界与构造在同一个 h 上闭环，" +
      "所以「3 次」就是最优答案。注意树上共有 5 个内部结点，但最长路径只有 3 个。",
      { leaves: 6, nodes: nodesList(["nLL", "nRR", "nL", "nR", "root"]),
        msg1: "结论：2² = 4 小于 3! = 6 ≤ 8 = 2³ → 至少 3 次比较",
        msg1Color: "var(--brand)",
        msg2: "一般化：叶子数 n! 必须满足 2^h ≥ n!，故 h ≥ ⌈log₂(n!)⌉ = Ω(n log n)",
        msg2Color: "var(--purple)" });

    /* ---------- 走一条具体路径：a = 2, b = 1, c = 3 ---------- */
    var full = nodesList(["nLL", "nRR", "nL", "nR", "root"]);

    snap("光有树不够，走一遍看看它怎么工作。代入具体输入：<b>a = 2，b = 1，c = 3</b>（原始序列 2, 1, 3）。" +
      "第 1 次比较从根开始：<b>a < b ？</b> 即 2 < 1 —— 为假。",
      { leaves: 6, nodes: full, hlNode: "root", nodeCls: "compare",
        msg1: "第 1 次比较：a < b ？ → 2 < 1 为假",
        msg1Color: "var(--accent)" });

    snap("走「≥（假）」分支往右：已知 <b>a ≥ b</b>，也就是 b 比 a 小。" +
      "这一步的信息量很大：一次比较就排除掉了整整一半的可能（以「a 最小」开头的 3 个叶子）。",
      { leaves: 6, nodes: full, hlEdge: 1, pathEdges: edgeSet([1]), hlNode: "nR", nodeCls: "active",
        msg1: "第 1 次比较的结果把 6 个叶子砍掉一半，只剩 3 个候选",
        msg1Color: "var(--brand)" });

    snap("第 2 次比较：<b>a < c ？</b> 即 2 < 3 —— 为真。" +
      "这次比较把「b 最小」的 3 个候选进一步分成 bac 与 bca 两组。",
      { leaves: 6, nodes: full, hlNode: "nR", nodeCls: "compare", pathEdges: edgeSet([1]),
        msg1: "第 2 次比较：a < c ？ → 2 < 3 为真",
        msg1Color: "var(--accent)" });

    snap("走「<（真）」分支往左，直接落到叶子 <code>bac</code>：它表示 <b>b ≤ a ≤ c</b>。" +
      "代入数值：1 ≤ 2 ≤ 3 ✅ 完全正确，排好序的输出就是 <b>1, 2, 3</b>。",
      { leaves: 6, nodes: full, hlLeaf: null, pathLeaf: "bac",
        pathEdges: edgeSet([1, 6]),
        msg1: "到达叶子 bac → 输出 1, 2, 3（这条路径只用了 2 次比较，属于运气好的情况）",
        msg1Color: "var(--ok)" });

    snap("再看最坏情况：若输入是 a = 3、b = 1、c = 2，第 1 次 a < b 为假、第 2 次 a < c 仍为假，" +
      "还要再比一次 b < c 才能落到 cba。也就是说<b>根到各叶子的路径长度并不相同，最长的那条是 3</b>，" +
      "而「最坏情况要几次比较」问的正是最长路径 —— 也就是<b>树高</b>。",
      { leaves: 6, nodes: full, pathEdges: edgeSet([0, 2, 4, 5, 7, 9]),
        msg1: "最坏路径长度 = 树高 = 3；平均路径更短，但复杂度看的是最坏情况",
        msg1Color: "var(--danger)" });

    snap("把整条推理收尾：<b>决策树的叶子必须能表示 n! 种输出，树高 h 必须满足 2^h ≥ n!</b>。" +
      "n = 3 时 2² = 4 小于 6 ≤ 8 = 2³，于是 <b>h ≥ 3</b>；" +
      "推广到任意 n 就是 <b>h ≥ ⌈log₂(n!)⌉ = Ω(n log n)</b> —— " +
      "这就是「任何基于比较的排序，最坏情况至少 Ω(n log n) 次比较」的全部来历。",
      { leaves: 6, nodes: full,
        msg1: "h ≥ ⌈log₂(n!)⌉ = Ω(n log n)：比较排序的下界",
        msg1Color: "var(--brand)",
        msg2: "基数排序 / 计数排序不做元素间比较，所以它们不受这个下界约束",
        msg2Color: "var(--purple)" });

    new DS.Viz(host, {
      title: "3 元素决策树：2^h ≥ n!",
      sub: "叶子数 = n! = 6，树高 h = 3 → 至少 3 次比较（2² = 4 小于 6 ≤ 8 = 2³）",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 2：计数排序三步 —— 频次 → 前缀和 → 倒序放置（稳定性）
     容器：<div id="viz-counting">
     ========================================================================== */
  (function countingSort() {
    var host = document.getElementById("viz-counting");
    if (!host) return;

    /* BW = 格子宽、BP = 步距、BX = 三行（A / cnt / out）共用的左起点。 */
    var W = 880, H = 528;
    var BW = 48, BP = 62, BX = 96;

    /* A0 = 演示数据（只读）；ID 和 COL 是同一批元素的两个“面子”：
       ID[i] = 第 i 个元素的身份标签（4a / 4b、3a / 3b），专为演示稳定性而加；
       COL[i] = 它在画面上的配色（同值的元素同色，一眼能看出谁是谁）。 */
    var A0 = [4, 1, 3, 4, 3, 2];
    var ID = ["4a", "1", "3a", "4b", "3b", "2"];
    var COL = ["--purple", "", "--brand", "--purple", "--brand", ""];
    /* n = 元素个数；K = **值域大小**（值取 0..K-1），也就是计数数组的长度 —— 注意它和 n 是两回事。 */
    var n = A0.length, K = 5;

    /* cnt = 计数数组，**下标就是元素值**（不是位置！）：第 ① 步存频次，第 ② 步原地变成前缀和，
       此后 cnt[v] = 「值 ≤ v 的元素个数」= 值 v 的输出区间上界（开区间）；
       out2 = 输出数组（长度 n，先填 ""）、ocol = 输出格子的配色（跟着元素身份走）。
       这三个都会被算法就地改写，所以每帧画的是 snap 里拷下来的快照。 */
    var A = A0.slice(), cnt = [], out2 = [], ocol = [];
    for (var q = 0; q < K; q++) cnt.push(0);
    for (var q2 = 0; q2 < n; q2++) { out2.push(""); ocol.push(""); }

    var frames = [];
    /* st: {step, aMark, aRing, cntMark, outRing, ptrI, ptrV, msg1, msg2} */
    /* 推一帧。st 每次新建、不用拷贝（字段见下面那行注释）：
       st.step = 走到第几步（0/1/2 = 频次 / 前缀和 / 放置），st.aMark / aRing / cntMark / outRing = 各行标记，
       st.ptrI / ptrV = 指向 A 的下标 i 和指向 cnt 的值 v（-1 = 不画指针）。 */
    function snap(desc, st) {
      /* 关键：把「这一帧要画的状态」在此刻深拷贝下来。
         DS.Viz 会先跑完整个 build() 再逐帧渲染，
         若 draw 直接读活变量（cnt / out2 / ocol），画出来的永远是算法结束后的最终态。 */
      /* sp = **该帧的快照**：cnt / out2 / ocol 三份拷贝。
         build() 早就跑完了，draw 里读活变量会每一帧都画成排好序的终态。 */
      var sp = {
        cnt: cnt.slice(),
        out2: out2.slice(),
        ocol: ocol.slice()
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          var sc = sp.cnt, so = sp.out2, soc = sp.ocol;
          var chips = ["① 统计频次 O(n)", "② 求前缀和 O(k)", "③ 倒序放置 O(n)"];
          for (var c = 0; c < 3; c++) {
            chip(svg, 96 + c * 246, 16, 230, 32, chips[c],
              (st.step === c) ? "active" : (st.step > c ? "done" : ""));
          }

          tag(svg, 60, 140, "A", "var(--text-soft)", "middle", 14);
          row(svg, BX, 124, n, function (i) { return (st.aMark && st.aMark[i]) || ""; }, {
            box: BW, pitch: BP, texts: ID, colors: COL,
            labels: function (i) { return "[" + i + "]"; },
            rings: st.aRing
          });
          if (st.ptrI !== null && st.ptrI !== undefined && st.ptrI >= 0) {
            ptr(svg, BX + st.ptrI * BP + BW / 2, 116, "i=" + st.ptrI, "var(--accent)");
          }

          tag(svg, 56, 266, "cnt", "var(--text-soft)", "middle", 14);
          row(svg, BX, 250, K, function (i) { return (st.cntMark && st.cntMark[i]) || ""; }, {
            box: BW, pitch: BP, texts: sc,
            labels: function (i) { return "v = " + i; }
          });
          if (st.ptrV !== null && st.ptrV !== undefined && st.ptrV >= 0) {
            ptr(svg, BX + st.ptrV * BP + BW / 2, 242, "v=" + st.ptrV, "var(--brand)");
          }

          tag(svg, 60, 396, "out", "var(--text-soft)", "middle", 14);
          row(svg, BX, 380, n, function (i) { return (st.outMark && st.outMark[i]) || ""; }, {
            box: BW, pitch: BP, texts: so, colors: soc,
            labels: function (i) { return "[" + i + "]"; },
            rings: st.outRing
          });

          svg.appendChild(SVG.el("rect", {
            x: 16, y: 452, width: 848, height: 62, rx: 10,
            fill: "var(--panel-2)", stroke: "var(--border)", "stroke-width": 1.4
          }));
          tag(svg, 30, 478, st.msg1 || "", st.msg1Color || "var(--text)", "start", 13);
          if (st.msg2) tag(svg, 30, 502, st.msg2, st.msg2Color || "var(--text-soft)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    snap("计数排序（counting sort）的第 ① 步：<b>统计每个值出现了多少次</b>。" +
      "数据 <b>A = [4, 1, 3, 4, 3, 2]</b>，值域 k = 5（取值 0~4），所以开一个长度为 5 的计数数组 cnt[0..4]，初值全 0。<br>" +
      "为了看清「稳定性」，给每个元素带上身份：<code>4a</code> 是下标 0 处的 4，<code>4b</code> 是下标 3 处的 4；" +
      "3a 在前、3b 在后。排完之后它们必须保持这个先后次序。",
      { step: 0, aMark: {}, cntMark: {}, ptrI: -1, ptrV: -1,
        msg1: "目标：排序 + 稳定 —— 相同关键字的相对次序不能改变",
        msg1Color: "var(--brand)",
        msg2: "值域 k = 5、元素 n = 6，总时间 O(n + k) = O(11)，是线性时间" });

    for (var i = 0; i < n; i++) {
      var v = A[i];
      cnt[v]++;
      var mk = {}; mk[i] = "compare";
      var cmk = {}; cmk[v] = "warn";
      snap("扫描到 <code>A[" + i + "] = " + v + "</code>（身份 <b>" + ID[i] + "</b>）→ " +
        "<code>cnt[" + v + "]++</code>，cnt[" + v + "] 变成 <b>" + cnt[v] + "</b>。" +
        "第 ① 步<b>只记数、不记位置</b>，所以它本身并不区分 3a 和 3b。",
        { step: 0, aMark: mk, cntMark: cmk, ptrI: i, ptrV: v,
          msg1: "已扫描 " + (i + 1) + " / " + n + " 个元素",
          msg2: "cnt 目前为 [" + cnt.join(", ") + "]" });
    }

    snap("第 ① 步结束：<b>cnt = [" + cnt.join(", ") + "]</b>。" +
      "读法：值为 1 的有 1 个、值为 2 的有 1 个、值为 3 的有 2 个、值为 4 的有 2 个，" +
      "加起来 0+1+1+2+2 = <b>6 = n</b> ✅ 一个都没漏。",
      { step: 0, aMark: marksFrom(n, function () { return "done"; }), cntMark: {}, ptrI: -1, ptrV: -1,
        msg1: "① 完成，代价 O(n) = 6 次加法",
        msg1Color: "var(--ok)" });

    snap("第 ② 步：把 cnt 原地变成<b>前缀和</b>。含义是「<code>cnt[v] = 值 ≤ v 的元素一共有几个</code>」，" +
      "也就是<b>值 v 的元素应该占据的输出区间的上界（开区间）</b>。" +
      "做法：从 v = 1 开始，<code>cnt[v] += cnt[v - 1]</code>。",
      { step: 1, aMark: marksFrom(n, function () { return "done"; }), cntMark: {}, ptrI: -1, ptrV: -1,
        msg1: "② 求前缀和：pre[v] = Σ cnt[0..v]",
        msg1Color: "var(--brand)",
        msg2: "只需要扫一遍值域，代价 O(k) = 5" });

    for (var v2 = 1; v2 < K; v2++) {
      var before = cnt[v2 - 1];
      cnt[v2] += cnt[v2 - 1];
      var cmk2 = {}; cmk2[v2] = "compare"; cmk2[v2 - 1] = "active";
      snap("v = " + v2 + "：<code>cnt[" + v2 + "] += cnt[" + (v2 - 1) + "]</code> → " +
        "「自己原有的个数」加上「前面所有值的个数 " + before + "」，得到 <b>" + cnt[v2] + "</b>。",
        { step: 1, aMark: marksFrom(n, function () { return "done"; }), cntMark: cmk2,
          ptrI: -1, ptrV: v2,
          msg1: "cnt 目前为 [" + cnt.join(", ") + "]" });
    }

    snap("第 ② 步结束：<b>pre = cnt = [" + cnt.join(", ") + "]</b>。" +
      "读法：pre[4] = 6 表示「≤ 4 的有 6 个」，所以 4 占 <code>out[4..5]</code>；" +
      "pre[3] = 4 表示「≤ 3 的有 4 个」，所以 3 占 <code>out[2..3]</code>。" +
      "把 pre 当成「每种值的空位末尾」，放置时<b>从后往前取空位</b>就可以了。",
      { step: 1, aMark: marksFrom(n, function () { return "done"; }), cntMark: {}, ptrI: -1, ptrV: -1,
        msg1: "② 完成：pre = [" + cnt.join(", ") + "]",
        msg1Color: "var(--ok)",
        msg2: "1 占 out[0]，2 占 out[1]，3 占 out[2..3]，4 占 out[4..5]" });

    snap("第 ③ 步：<b>倒序</b>遍历原数组放置（i 从 5 走到 0）。" +
      "每遇到一个元素就 <code>--cnt[值]</code>，再把它写进 <code>out[cnt[值]]</code>。<br>" +
      "为什么必须倒序？因为倒序时<b>靠后的同值元素先挑空位，它会占掉该值的最后一个空位</b>，" +
      "于是更靠前的同值元素只能落到更左边 —— 相对次序被保住了。这就是「稳定」的全部秘密。",
      { step: 2, aMark: marksFrom(n, function () { return "done"; }), cntMark: {}, ptrI: -1, ptrV: -1,
        msg1: "③ 倒序放置：i = 5 → 0，先 --cnt[值] 再落位",
        msg1Color: "var(--brand)",
        msg2: "若改成正序（i = 0 → 5），同值元素的先后顺序会被翻转 → 不稳定" });

    for (var idx = n - 1; idx >= 0; idx--) {
      var val = A[idx];
      cnt[val]--;
      var pos = cnt[val];
      out2[pos] = ID[idx]; ocol[pos] = COL[idx];
      var amk2 = {}; amk2[idx] = "compare";
      var cmk3 = {}; cmk3[val] = "warn";
      var oring = {}; oring[pos] = "active";
      var extra = "";
      if (ID[idx] === "4b") {
        extra = "<br>注意：靠后的 <b>4b 先占掉了 4 的最后一个空位 out[5]</b>，" +
          "等会儿更靠前的 4a 只能落到 out[4] → <b>4a 依然在 4b 左边 ✅</b>";
      } else if (ID[idx] === "3b") {
        extra = "<br>同理：靠后的 <b>3b 先占掉 3 的最后一个空位 out[3]</b>，" +
          "更靠前的 3a 只能落到 out[2] → <b>3a 依然在 3b 左边 ✅</b>";
      } else if (ID[idx] === "4a") {
        extra = "<br>最后落位的 4a 被挤到了 out[4]，正好在 4b 左侧 —— <b>相对次序与原来一致</b>。";
      }
      snap("倒序第 " + (n - idx) + " 步：i = " + idx + "，取出 <code>A[" + idx + "] = " + val +
        "</code>（身份 <b>" + ID[idx] + "</b>）。先做 <code>--cnt[" + val + "]</code> → " + cnt[val] +
        "，于是它落在 <code>out[" + pos + "]</code>。" + extra,
        { step: 2, aMark: amk2, cntMark: cmk3, outRing: oring, ptrI: idx, ptrV: val,
          msg1: ID[idx] + " → out[" + pos + "]　（cnt[" + val + "] 用掉一个，剩 " + cnt[val] + "）",
          msg2: "out 目前为 [" + out2.join(", ") + "]" });
    }

    snap("<b>排序完成：out = [" + out2.join(", ") + "]</b>，也就是 <b>[1, 2, 3a, 3b, 4a, 4b]</b>。" +
      "两个 3 里 3a 在前，两个 4 里 4a 在前 —— <b>相同关键字的相对次序被完整保留，计数排序是稳定的</b>。<br>" +
      "作为对照：若把第 ③ 步改成正序（i 从 0 到 5），4a 会先抢到 out[5]，4b 只能退到 out[4]，" +
      "输出就变成 <b>4b, 4a</b> —— 稳定性被破坏。所以「倒序放置」不是优化技巧，而是稳定性的必要条件。",
      { step: 3, aMark: marksFrom(n, function () { return "done"; }), cntMark: {},
        outMark: marksFrom(n, function () { return "done"; }), ptrI: -1, ptrV: -1,
        msg1: "全程代价：O(n + k) = O(6 + 5) 线性时间，额外空间 O(n + k)",
        msg1Color: "var(--ok)",
        msg2: "它真正的身份是基数排序的子过程 —— 不稳定就会毁掉低位已经排好的成果",
        msg2Color: "var(--purple)" });

    new DS.Viz(host, {
      title: "计数排序全过程（含稳定性剖析）",
      sub: "A = [4, 1, 3, 4, 3, 2]　k = 5　三步：统计频次 → 前缀和 → 倒序放置",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 3：桶排序 —— 分桶 → 桶内插入排序 → 按桶号收集
     容器：<div id="viz-bucket">
     ========================================================================== */
  (function bucketSort() {
    var host = document.getElementById("viz-bucket");
    if (!host) return;

    var W = 880, H = 548;
    var ABOX = 54, AP = 66, AX = 84;
    var BBOX = 54, BP = 66, BX = 240;

    /* A0 = 10 个 [0,1) 之间的小数（只读）；M = 桶的个数 5（桶 k 装 [k/M, (k+1)/M) 区间的数据）。 */
    var A0 = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.68, 0.33];
    var M = 5, n = A0.length;

    function f2(x) { return x.toFixed(2); }
    function joined(a) {
      var t = [];
      for (var i = 0; i < a.length; i++) t.push(f2(a[i]));
      return t.join(", ");
    }

    /* buckets[k] = 桶 k 里的元素（数组）；bk[k] = 桶 k 内插入排序的累计比较次数。
       两者都是活变量，每帧画的是 snap 里拷的快照。 */
    var buckets = [], bk = [];
    for (var b = 0; b < M; b++) { buckets.push([]); bk.push(0); }
    /* emptyOut = 长度 n、全 null 的“空输出数组”，收集阶段之前一直用它占位。 */
    var emptyOut = [];
    for (var e = 0; e < n; e++) emptyOut.push(null);

    var frames = [];
    /* st: {phase, i, k, j, out, collectFrom, head, headColor, msg1, msg2} */
    /* 推一帧。st 每次新建、不用拷贝：st.phase = "dist"/"sort"/"collect"（分桶 / 桶内排序 / 收集），
       st.i / st.k / st.j = 当前的元素下标 / 桶号 / 桶内下标（-1 = 不画），st.out = 本帧要画的输出数组，
       st.collectFrom = 已收集个数，st.head / headColor / msg* = 文案。 */
    function snap(desc, st) {
      /* 关键：把「这一帧要画的状态」在此刻深拷贝下来。
         DS.Viz 会先跑完整个 build() 再逐帧渲染，
         若 draw 直接读活变量（buckets / bk），画出来的永远是算法结束后的最终态。 */
      /* sp = **该帧的快照**：逐桶深拷贝的 buckets + bk 的拷贝。桶内容会被后续插入排序改写，
         不拷的话每一帧都会画出排好序的最终桶。 */
      var sp = {
        buckets: buckets.map(function (e) { return e.slice(); }),
        bk: bk.slice()
      };
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          var sBuckets = sp.buckets, sBk = sp.bk;

          note(svg, 16, 20, "数据：10 个 [0, 1) 上的实数　　分桶规则：k = ⌊x · m⌋（m = 5 个桶）");
          if (st.head) tag(svg, 16, 42, st.head, st.headColor || "var(--brand)", "start", 13.5);

          /* 原始数据行 */
          tag(svg, 60, 84, "A", "var(--text-soft)", "middle", 14);
          row(svg, AX, 68, n, function (i) {
            if (st.phase === "dist" && st.i === i) return "compare";
            if (st.phase === "dist" && st.i !== null && st.i >= 0 && i < st.i) return "dim";
            return "";
          }, {
            box: ABOX, pitch: AP,
            texts: (function () { var t = []; for (var i = 0; i < n; i++) t.push(f2(A0[i])); return t; })(),
            labels: function (i) { return "[" + i + "]"; }
          });
          if (st.phase === "dist" && st.i >= 0) {
            ptr(svg, AX + st.i * AP + ABOX / 2, 60, "i=" + st.i, "var(--accent)");
          }

          /* 5 个桶 */
          var totalCmp = 0;
          for (var k = 0; k < M; k++) {
            var y = 168 + k * 52;
            var active = (st.k === k);
            tag(svg, 24, y + 32, "桶 " + k, active ? "var(--brand)" : "var(--text-soft)", "start", 13);
            tag(svg, 78, y + 32, "[" + (k / M).toFixed(1) + ", " + ((k + 1) / M).toFixed(1) + ")",
              "var(--text-faint)", "start", 11.5, 400);
            svg.appendChild(SVG.el("rect", {
              x: 176, y: y + 4, width: 700, height: 44, rx: 8,
              fill: active ? "var(--brand-soft)" : "var(--panel-2)",
              stroke: active ? "var(--brand)" : "var(--border)",
              "stroke-width": active ? 2 : 1.2
            }));
            var texts = [];
            for (var t2 = 0; t2 < sBuckets[k].length; t2++) texts.push(f2(sBuckets[k][t2]));
            row(svg, BX, y, texts.length, function (i2) {
              return (st.phase === "sort" && st.k === k && st.j === i2) ? "compare" : "";
            }, { box: BBOX, pitch: BP, texts: texts });
            tag(svg, 868, y + 32, sBuckets[k].length + " 个",
              sBuckets[k].length ? "var(--text-soft)" : "var(--text-faint)", "end", 12, 400);
            totalCmp += sBk[k];
          }
          tag(svg, 24, 444, "桶内比较次数合计 = " + totalCmp + " 次（数据越均匀，桶内比较越少）",
            "var(--text-soft)", "start", 12.5, 400);

          /* 收集结果 */
          tag(svg, 60, 486, "out", "var(--text-soft)", "middle", 14);
          row(svg, AX, 470, n, function (i3) {
            return (i3 < st.collectFrom) ? "done" : "";
          }, {
            box: ABOX, pitch: AP,
            texts: (function () {
              var t = [];
              for (var i4 = 0; i4 < n; i4++) {
                t.push((st.out && st.out[i4] !== null && st.out[i4] !== undefined) ? f2(st.out[i4]) : "");
              }
              return t;
            })()
          });
          if (st.msg1) tag(svg, 60, 540, st.msg1, st.msg1Color || "var(--text)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    snap("桶排序（bucket sort）的三步：<b>① 按区间分桶 → ② 每个桶内部各自排序 → ③ 按桶号从小到大收集</b>。" +
      "它和计数排序的关系是：计数排序是「一个值一个桶」，桶排序是「一个区间一个桶」，" +
      "所以桶排序<b>不要求关键字是整数</b>，只需要能把值映射到桶号（这里用 k = ⌊x · 5⌋）。" +
      "10 个实数放进 5 个桶，平均每个桶 2 个元素。",
      { phase: "init", i: -1, k: -1, j: -1, out: emptyOut, collectFrom: 0,
        head: "① 分桶：准备 5 个空桶 bucket[0..4]",
        msg1: "均匀分布时：分桶 O(n) + 桶内排序 O(n) + 收集 O(n) = O(n)" });

    for (var i = 0; i < n; i++) {
      var x = A0[i];
      var kk = Math.floor(x * M);
      if (kk >= M) kk = M - 1;
      buckets[kk].push(x);
      snap("取出 <code>A[" + i + "] = " + f2(x) + "</code>：计算 <code>⌊" + f2(x) + " × 5⌋ = ⌊" +
        (x * M).toFixed(2) + "⌋ = " + kk + "</code> → 落进 <b>桶 " + kk + "</b>（区间 [" +
        (kk / M).toFixed(1) + ", " + ((kk + 1) / M).toFixed(1) + ")）。" +
        "分桶时<b>按原数组顺序追加</b>，桶内的先后次序就是原来的先后次序 —— 这是稳定性的第一个条件。",
        { phase: "dist", i: i, k: kk, j: -1, out: emptyOut, collectFrom: 0,
          head: "① 分桶中：已处理 " + (i + 1) + " / " + n,
          msg1: "桶 " + kk + " 目前有 " + buckets[kk].length + " 个元素" });
    }

    /* loads = 各桶的元素个数（只用于文案，画面上不随帧变化）。 */
    var loads = [];
    for (var l = 0; l < M; l++) loads.push(buckets[l].length);
    snap("分桶完成：各桶元素个数 = <b>[" + loads.join(", ") + "]</b>。" +
      (loads[2] === 0 ? "其中<b>桶 2 是空桶</b>（没有数据落在 [0.4, 0.6) 区间），空桶后面直接跳过。" : "") +
      "可以看到数据分布并不绝对均匀，而<b>桶排序的性能完全取决于分布</b>：" +
      "如果所有数据都挤进一个桶（比如全在 [0.9, 1.0)），它就退化成对一个长度 n 的数组做插入排序，" +
      "复杂度从 O(n) 恶化到 <b>O(n²)</b>。",
      { phase: "dist", i: -1, k: -1, j: -1, out: emptyOut, collectFrom: 0,
        head: "② 桶内排序：每个桶各自做插入排序",
        headColor: "var(--ok)",
        msg1: "桶内用插入排序：常数小、天然稳定 → 不会打乱同值元素的相对次序" });

    /* ---------- ② 桶内插入排序 ---------- */
    for (var k2 = 0; k2 < M; k2++) {
      var arr = buckets[k2];
      if (arr.length === 0) {
        snap("桶 " + k2 + " 是空的，没有任何元素需要排序，<b>直接跳过</b>。" +
          "这也说明桶排序的代价随分布浮动：空桶几乎不花钱，而超载的桶会吃掉全部性能。",
          { phase: "sort", k: k2, j: -1, i: -1, out: emptyOut, collectFrom: 0,
            head: "② 桶内插入排序：桶 " + k2 + " 为空，跳过",
            msg1: "桶 " + k2 + " 元素个数 = 0" });
        continue;
      }
      snap("处理 <b>桶 " + k2 + "</b>：内容 [" + joined(arr) + "]，共 " + arr.length +
        " 个元素。桶内从第 2 个元素开始做插入排序：把当前元素 <code>key</code> 暂存，" +
        "比它大的元素整体右移一格，再把它插进空位。",
        { phase: "sort", k: k2, j: -1, i: -1, out: emptyOut, collectFrom: 0,
          head: "② 桶内插入排序：桶 " + k2 + "（" + arr.length + " 个元素）",
          msg1: "桶 " + k2 + " 内容 = [" + joined(arr) + "]" });

      for (var si = 1; si < arr.length; si++) {
        var key = arr[si], sj = si - 1, moved = 0;
        while (sj >= 0 && arr[sj] > key) {
          arr[sj + 1] = arr[sj];
          bk[k2]++;
          moved++;
          sj--;
        }
        arr[sj + 1] = key;
        snap("桶 " + k2 + " 的第 " + (si + 1) + " 个元素 <code>key = " + f2(key) + "</code>：" +
          (moved > 0
            ? "比它大的 " + moved + " 个元素整体右移一格（比较 " + moved + " 次），然后把它插到下标 " + (sj + 1) + "。"
            : "它已经比左边所有元素都大，<b>比较一次就停</b>，原地不动。") +
          "桶内变成 [" + joined(arr) + "]。",
          { phase: "sort", k: k2, j: sj + 1, i: -1, out: emptyOut, collectFrom: 0,
            head: "② 桶内插入排序：桶 " + k2 + "，累计比较 " + bk[k2] + " 次",
            headColor: "var(--ok)",
            msg1: "桶 " + k2 + " = [" + joined(arr) + "]" });
      }
    }

    /* bkTotal = 所有桶内比较次数的合计（用于和 O(n²) 的朴素排序对照）。 */
    var bkTotal = 0;
    for (var bt = 0; bt < M; bt++) bkTotal += bk[bt];

    snap("② 完成：每个桶内部都已经升序。" +
      "注意桶内排好之后，<b>桶号小的桶里的元素全都小于桶号大的桶里的元素</b> ——" +
      "因为桶 k 只装 [" + (0).toFixed(1) + " 到 1.0 之间、按区间切开] 的那一段数据，区间之间天然有序。" +
      "所以第 ③ 步只要按桶号依次拼接即可，<b>不需要任何跨桶比较</b>。",
      { phase: "sort", k: -1, j: -1, i: -1, out: emptyOut, collectFrom: 0,
        head: "③ 收集：按桶号从小到大依次拼接",
        msg1: "桶内比较总次数 = " + bkTotal + " 次" });

    /* ---------- ③ 收集 ---------- */
    /* outArr = 收集结果，按桶号从小到大依次追加（长度就是已收集个数）；
       padded() 把它补满到 n 个（补 null），因为画格子的行需要定长。 */
    var outArr = [];
    function padded() {
      var t = outArr.slice();
      while (t.length < n) t.push(null);
      return t;
    }
    for (var k3 = 0; k3 < M; k3++) {
      if (buckets[k3].length === 0) {
        snap("收集阶段轮到桶 " + k3 + "，但它是<b>空桶</b>（没有数据落在 [" + (k3 / M).toFixed(1) + ", " +
          ((k3 + 1) / M).toFixed(1) + ") 区间），没有内容可以接到结果序列后面，直接跳过 —— " +
          "空桶在桶排序里几乎不花钱，代价只花在有元素的桶上。",
          { phase: "collect", k: k3, j: -1, i: -1, collectFrom: outArr.length, out: padded(),
            head: "③ 收集：桶 " + k3 + " 为空",
            msg1: "已收集 " + outArr.length + " / " + n });
        continue;
      }
      for (var t3 = 0; t3 < buckets[k3].length; t3++) outArr.push(buckets[k3][t3]);
      snap("把 <b>桶 " + k3 + "</b> 的内容 [" + joined(buckets[k3]) + "] 依次接到结果序列后面，" +
        "现在已收集 " + outArr.length + " 个元素。桶内是「按原顺序追加 + 稳定插入排序」得到的，" +
        "所以相同值的元素先后次序不变 —— <b>桶排序是稳定的</b>。",
        { phase: "collect", k: k3, j: -1, i: -1, collectFrom: outArr.length, out: padded(),
          head: "③ 收集：桶 " + k3 + " → 结果序列",
          headColor: "var(--ok)",
          msg1: "已收集 " + outArr.length + " / " + n });
    }

    snap("<b>桶排序完成：out = [" + joined(outArr) + "]</b>。" +
      "全程没有做过任何跨桶比较，代价 = 分桶 O(n) + 桶内插入排序 + 收集 O(n)。" +
      "在「数据均匀分布」这个前提下，每个桶期望只有 1 个元素，桶内代价期望 O(1)，总时间就是 <b>O(n)</b>；" +
      "但只要分布一偏（全部挤进一个桶），立刻退化成 <b>O(n²)</b>。" +
      "工程上因此常配合「先抽样估计分布」来确定桶的边界。",
      { phase: "collect", k: M - 1, j: -1, i: -1, collectFrom: n, out: outArr.slice(),
        head: "桶排序完成：均匀分布 O(n)，最坏 O(n²)，空间 O(n + m)，稳定",
        headColor: "var(--ok)",
        msg1: "桶内比较总次数 = " + bkTotal + " 次（10 个元素全部排好只花了这么多次比较）",
        msg1Color: "var(--ok)" });

    new DS.Viz(host, {
      title: "桶排序：分桶 → 桶内插入排序 → 收集",
      sub: "10 个 [0, 1) 上的实数　5 个桶　均匀分布 O(n)，全挤一个桶退化为 O(n²)",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 4：鸡尾酒排序 vs 普通冒泡 —— 同一组数据上下并排
     容器：<div id="viz-cocktail">
     ========================================================================== */
  (function cocktail() {
    var host = document.getElementById("viz-cocktail");
    if (!host) return;

    var W = 880, H = 444;
    var BW = 48, BP = 62, BX = 168;

    /* A0 = 精心挑的数据：只有 1 在末尾，普通冒泡要把它一路搬到最前面（n−1 趟），
       而鸡尾酒排序反向那一趟就能一步到位 —— 差异一眼可见。 */
    var A0 = [2, 3, 4, 5, 6, 7, 8, 1];
    var n = A0.length;
    /* SORTED = A0 的升序副本，用来判断“某个位置是否已经就位”。 */
    var SORTED = A0.slice().sort(function (a, b) { return a - b; });

    /* 鸡尾酒：正向一趟 + 反向一趟；某一趟没有发生交换就收工 */
    function cocktailTrace(src) {
      /* 轨迹生成器的局部状态：a = 工作副本；lo / hi = 左右两个边界（**闭区间** [lo, hi] 之外已经就位）；
         pass = 趟号（1 基，正向一趟 + 反向一趟各算一趟）；cmp / swp = 累计比较、交换次数；
         tr = 轨迹数组，每个元素 {arr: 这一趟此刻的数组快照, dir: 1 正向 / −1 反向, pass, i, j, vi, vj, doSw, cmp, swp, lo, hi}。 */
      var a = src.slice(), lo = 0, hi = n - 1, pass = 0, cmp = 0, swp = 0, tr = [];
      var guard = 0;
      while (lo < hi && guard++ < 40) {
        var sw = false;
        pass++;
        for (var i = lo; i < hi; i++) {
          cmp++;
          var v1 = a[i], v2 = a[i + 1], doSw = v1 > v2;
          if (doSw) { a[i] = v2; a[i + 1] = v1; sw = true; swp++; }
          tr.push({ arr: a.slice(), dir: 1, pass: pass, i: i, j: i + 1, vi: v1, vj: v2,
            doSw: doSw, cmp: cmp, swp: swp, lo: lo, hi: hi });
        }
        hi--;
        if (!sw) break;
        sw = false;
        pass++;
        for (var i2 = hi; i2 > lo; i2--) {
          cmp++;
          var u1 = a[i2 - 1], u2 = a[i2], doSw2 = u1 > u2;
          if (doSw2) { a[i2 - 1] = u2; a[i2] = u1; sw = true; swp++; }
          tr.push({ arr: a.slice(), dir: -1, pass: pass, i: i2 - 1, j: i2, vi: u1, vj: u2,
            doSw: doSw2, cmp: cmp, swp: swp, lo: lo, hi: hi });
        }
        lo++;
        if (!sw) break;
      }
      /* 整趟都没有交换的那一趟 = 确认趟（不产生任何有效工作） */
      var swpByPass = {};
      for (var t = 0; t < tr.length; t++) {
        swpByPass[tr[t].pass] = (swpByPass[tr[t].pass] || 0) + (tr[t].doSw ? 1 : 0);
      }
      /* check = 该步所在的这一趟是否“一次交换都没有”（确认趟），后面统计有效趟数时要把确认趟排除。 */
      for (var t2 = 0; t2 < tr.length; t2++) tr[t2].check = (swpByPass[tr[t2].pass] === 0);
      return tr;
    }

    /* 普通冒泡：每趟把一个最大值推到末尾，共 n − 1 趟 */
    function bubbleTrace(src) {
      /* 普通冒泡的轨迹：n−1 趟、每趟把最大值顶到末尾；doneFrom = 该步之后已经就位的区间起点。 */
      var a = src.slice(), pass = 0, cmp = 0, swp = 0, tr = [];
      for (var p = 0; p < n - 1; p++) {
        pass++;
        var limit = n - 1 - p;
        for (var j = 0; j < limit; j++) {
          cmp++;
          var v1 = a[j], v2 = a[j + 1], doSw = v1 > v2;
          if (doSw) { a[j] = v2; a[j + 1] = v1; swp++; }
          tr.push({ arr: a.slice(), dir: 1, pass: pass, i: j, j: j + 1, vi: v1, vj: v2,
            doSw: doSw, cmp: cmp, swp: swp, doneFrom: n - p + 1 });
        }
      }
      return tr;
    }

    /* 先把两种算法的完整轨迹都跑出来：cTr / bTr = 鸡尾酒、普通冒泡的轨迹数组；
       cCmp / bCmp、cSwp / bSwp = 各自的最终比较次数、交换次数（取轨迹最后一“步”的累计值）。 */
    var cTr = cocktailTrace(A0), bTr = bubbleTrace(A0);
    var cCmp = cTr[cTr.length - 1].cmp, bCmp = bTr[bTr.length - 1].cmp;
    var cSwp = cTr[cTr.length - 1].swp, bSwp = bTr[bTr.length - 1].swp;
    /* 四个统计量：bPasses = 冒泡的总趟数；cAll = 鸡尾酒的总趟数（含确认趟）；
       cUse = 去掉确认趟后的有效趟数；cCmpEff = 最后一步有效工作时的累计比较次数。 */
    var bPasses = 0, cUse = 0, cAll = 0, cCmpEff = 0;
    for (var q1 = 0; q1 < bTr.length; q1++) bPasses = Math.max(bPasses, bTr[q1].pass);
    for (var q2 = 0; q2 < cTr.length; q2++) {
      cAll = Math.max(cAll, cTr[q2].pass);
      if (!cTr[q2].check) {
        cUse = Math.max(cUse, cTr[q2].pass);
        cCmpEff = Math.max(cCmpEff, cTr[q2].cmp);
      }
    }

    var frames = [];
    function snap(desc, st) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 16, 20, "同一组数据 A = [" + A0.join(", ") + "]　上面跑鸡尾酒排序、下面跑普通冒泡，逐次比较同步推进");

          /* ---- 鸡尾酒 ---- */
          var c = st.c, cDone = st.cDone;
          tag(svg, 24, 88, "鸡尾酒排序", "var(--brand)", "start", 14);
          tag(svg, 24, 106, "（双向交替）", "var(--text-faint)", "start", 11.5, 400);
          tag(svg, 196, 64, cDone
            ? "已排好　有效趟数 " + cUse + "　比较 " + cCmp + "　交换 " + cSwp
            : "第 " + c.pass + " 趟" + (c.dir === 1 ? "（正向 →）" : "（反向 ←）") +
              (c.check ? "·确认趟" : "") + "　比较 " + c.cmp + "　交换 " + c.swp,
            cDone ? "var(--ok)" : "var(--brand)", "start", 13);
          var cArr = cDone ? SORTED : c.arr;
          row(svg, BX, 78, n, function (i) {
            if (cDone) return "done";
            if (i === c.i || i === c.j) return c.doSw ? "warn" : "compare";
            if (i < c.lo || i > c.hi) return "done";
            return "";
          }, { box: BW, pitch: BP, texts: cArr.slice(), labels: function (i) { return "[" + i + "]"; } });
          if (!cDone) {
            var x1 = BX + c.i * BP + BW / 2, x2 = BX + c.j * BP + BW / 2;
            arc(svg, x1, 78, x2, 78, c.doSw ? "var(--danger)" : "var(--accent)", 24);
            tag(svg, (x1 + x2) / 2, 46, c.doSw ? "逆序 → 交换" : "顺序 → 不动",
              c.doSw ? "var(--danger)" : "var(--accent)", "middle", 11.5);
            var sx = (c.dir === 1 ? BX + c.lo * BP : BX + (c.hi + 1) * BP);
            var ex = (c.dir === 1 ? BX + (c.hi + 1) * BP : BX + c.lo * BP);
            svg.appendChild(SVG.line(sx, 154, ex, 154, "active", false));
            tag(svg, (sx + ex) / 2, 174, "扫描方向 " + (c.dir === 1 ? "→" : "←"),
              "var(--brand)", "middle", 11.5, 400);
          } else {
            tag(svg, BX, 174, "已排好：反向那一趟把最小值 1 一口气带到了最左端", "var(--ok)", "start", 12, 400);
          }

          svg.appendChild(SVG.line(16, 200, 864, 200, "", false));

          /* ---- 普通冒泡 ---- */
          var b = st.b;
          tag(svg, 24, 268, "普通冒泡", "var(--accent)", "start", 14);
          tag(svg, 24, 286, "（只向右推）", "var(--text-faint)", "start", 11.5, 400);
          tag(svg, 196, 244, "第 " + b.pass + " 趟（正向 →）　比较 " + b.cmp + "　交换 " + b.swp,
            "var(--accent)", "start", 13);
          row(svg, BX, 258, n, function (i) {
            if (i === b.i || i === b.j) return b.doSw ? "warn" : "compare";
            if (i >= b.doneFrom) return "done";
            return "";
          }, { box: BW, pitch: BP, texts: b.arr.slice(), labels: function (i) { return "[" + i + "]"; } });
          var bx1 = BX + b.i * BP + BW / 2, bx2 = BX + b.j * BP + BW / 2;
          arc(svg, bx1, 258, bx2, 258, b.doSw ? "var(--danger)" : "var(--accent)", 24);
          tag(svg, (bx1 + bx2) / 2, 226, b.doSw ? "逆序 → 交换" : "顺序 → 不动",
            b.doSw ? "var(--danger)" : "var(--accent)", "middle", 11.5);
          svg.appendChild(SVG.line(BX, 334, BX + n * BP, 334, "active", false));
          tag(svg, BX + n * BP / 2, 354, "扫描方向 →（每趟只能把最大值往右推一格）",
            "var(--accent)", "middle", 11.5, 400);

          svg.appendChild(SVG.el("rect", {
            x: 16, y: 374, width: 848, height: 58, rx: 10,
            fill: "var(--panel-2)", stroke: "var(--border)", "stroke-width": 1.4
          }));
          tag(svg, 30, 400, st.msg1 || "", st.msg1Color || "var(--text)", "start", 13);
          if (st.msg2) tag(svg, 30, 424, st.msg2, st.msg2Color || "var(--text-soft)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    function sideDesc(name, st, done) {
      if (done || !st) return "【" + name + "】已经排好，提前收工";
      return "【" + name + "】第 " + st.pass + " 趟" + (st.dir === 1 ? "（正向 →）" : "（反向 ←）") +
        "：比较 <code>A[" + st.i + "] = " + st.vi + "</code> 与 <code>A[" + st.j + "] = " + st.vj + "</code>，" +
        (st.doSw ? "<b>" + st.vi + " 大于 " + st.vj + " → 交换</b>"
                 : st.vi + " 不大于 " + st.vj + " → 不交换");
    }

    snap("<b>退化场景：A = [2, 3, 4, 5, 6, 7, 8, 1]。</b>" +
      "前 7 个已经有序，只有最小值 1 掉在了最右端 —— 这正是冒泡最怕的「乌龟问题」：" +
      "冒泡靠相邻交换推进，<b>每一趟只能让 1 往左挪一格</b>，所以它要挪 7 次 → <b>7 趟</b>。" +
      "下面把两种算法放在同一组数据上<b>同步逐次比较</b>，直接对比趟数、比较次数与交换次数。",
      { c: cTr[0], b: bTr[0], cDone: false,
        msg1: "上面：鸡尾酒排序（正向 + 反向交替）　下面：普通冒泡（只向右推）",
        msg1Color: "var(--brand)",
        msg2: "胜负的关键：反向那一趟能让小元素一次跨越多个位置" });

    for (var t = 0; t < bTr.length; t++) {
      var cs = (t < cTr.length) ? cTr[t] : null;
      var bs = bTr[t];
      var tail = "";
      if (!cs) {
        tail = "<br>此时鸡尾酒排序已经结束（它只用了 " + cUse + " 趟有效扫描），" +
          "而冒泡还在继续做无用功 —— 这就是双向扫描的价值。";
      } else if (cs.dir === -1 && cs.i <= 2) {
        tail = "<br><b>关键时刻：</b>反向这一趟里 1 与左边元素依次比较并一路交换着往左跑，" +
          "一口气从下标 6 挪到下标 1 —— 这是只向右推的冒泡永远做不到的。";
      } else if (cs.check) {
        tail = "<br>鸡尾酒这一趟<b>一次交换都没发生</b>，说明整个序列已经有序，可以安全停止。" +
          "严格地说这一趟只是「确认」，不产生任何交换，所以教材把鸡尾酒排序记作 <b>2 趟</b> 搞定。";
      }
      snap(sideDesc("鸡尾酒", cs, !cs) + "<br>" + sideDesc("普通冒泡", bs, false) + tail,
        { c: cs, b: bs, cDone: !cs });
    }

    snap("两种算法都跑完了，把账算清楚：<br>" +
      "<b>鸡尾酒排序</b>：正向 1 趟把 8 送到末尾，反向 1 趟把 1 送到开头 → <b>2 趟</b>就把数据排好了" +
      "（这 2 趟里比较 " + cCmpEff + " 次、交换 " + cSwp + " 次。严格地说，算法还要再来一趟「确认没有交换」才能停，" +
      "也就是一共 " + cAll + " 趟扫描、比较 " + cCmp + " 次 —— 最后那一趟不产生任何交换，只做收尾检查）。<br>" +
      "<b>普通冒泡</b>：每趟只把最大值推到右端，1 只能一格一格往左爬 → <b>" + bPasses + " 趟</b>，" +
      "比较 " + bCmp + " 次、交换 " + bSwp + " 次 —— 每一趟都在做实事，没有一趟是浪费的。",
      { c: null, b: bTr[bTr.length - 1], cDone: true,
        msg1: "鸡尾酒 " + cUse + " 趟 vs 冒泡 " + bPasses + " 趟；比较 " + cCmpEff + " 次 vs " + bCmp + " 次",
        msg1Color: "var(--ok)",
        msg2: "但两者的最坏情况仍然都是 O(n²)：鸡尾酒只是「特定数据上的特效药」，并不是更快的冒泡" });

    new DS.Viz(host, {
      title: "鸡尾酒排序 vs 普通冒泡（并排逐次对比）",
      sub: "A = [2, 3, 4, 5, 6, 7, 8, 1]　鸡尾酒 2 趟搞定，普通冒泡要 7 趟",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 5：梳排序 —— gap ÷ 1.3 逐轮收缩，gap = 1 时冒泡收尾
     容器：<div id="viz-comb">
     ========================================================================== */
  (function combSort() {
    var host = document.getElementById("viz-comb");
    if (!host) return;

    var W = 880, H = 366;
    var BW = 48, BP = 62, BX = 96;

    /* A0 = 演示数据；SORTED = 它的升序副本（判断哪些位置已经就位）。 */
    var A0 = [8, 4, 2, 1, 7, 3, 9, 5, 6, 0];
    var n = A0.length;
    var SORTED = A0.slice().sort(function (a, b) { return a - b; });

    /* 先跑一遍真实算法，把每一步都记下来 */
    /* 先跑一遍真实算法并逐步记录：steps[k] = 一步的记录
       （kind = "cmp" 一次比较 / "round" 一轮结束；带 gap / round / i / j / vi / vj / doSw /
       以及累计 cmp / swp、本轮 rCmp / rSwp、本轮是否发生过交换 swapped、当时的数组快照 arr）；
       gapSeq = 依次用到的增量值（n → ⌊n/1.3⌋ → … → 1，去掉相邻重复）。 */
    var steps = [], gapSeq = [n];
    (function () {
      var a = A0.slice(), gap = n, swapped = true, cmp = 0, swp = 0, round = 0;
      var guard = 0;
      while ((gap > 1 || swapped) && guard++ < 200) {
        gap = Math.floor(gap / 1.3);
        if (gap < 1) gap = 1;
        if (gapSeq[gapSeq.length - 1] !== gap) gapSeq.push(gap);
        swapped = false; round++;
        var rCmp = 0, rSwp = 0;
        for (var i = 0; i + gap < n; i++) {
          cmp++; rCmp++;
          var v1 = a[i], v2 = a[i + gap], doSw = v1 > v2;
          if (doSw) { a[i] = v2; a[i + gap] = v1; swp++; rSwp++; swapped = true; }
          steps.push({ kind: "cmp", gap: gap, round: round, i: i, j: i + gap, vi: v1, vj: v2,
            doSw: doSw, cmp: cmp, swp: swp, rCmp: rCmp, rSwp: rSwp, swapped: swapped, arr: a.slice() });
        }
        steps.push({ kind: "round", gap: gap, round: round, cmp: cmp, swp: swp,
          rCmp: rCmp, rSwp: rSwp, swapped: swapped, arr: a.slice() });
      }
    })();

    /* totalCmp / totalSwp = 全程比较、交换次数（= 最后一步记录里的累计值）。 */
    var totalCmp = steps[steps.length - 1].cmp, totalSwp = steps[steps.length - 1].swp;

    var frames = [];
    function snap(desc, st) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 16, 20, "梳排序（comb sort）：冒泡的相邻比较 + 希尔的「大间隔先粗排」，gap 每轮收缩为 ⌊gap / 1.3⌋");

          tag(svg, 16, 54, "gap = " + st.gap, st.gap > 1 ? "var(--brand)" : "var(--accent)", "start", 15);
          tag(svg, 128, 54, (st.kind === "round"
            ? "本轮结束：" + (st.rSwp > 0 ? "发生了 " + st.rSwp + " 次交换 → 还要继续" : "一次交换都没有 → 排序结束")
            : "比较 A[" + st.i + "] 与 A[" + st.j + "]（相距 " + st.gap + " 格）"),
            "var(--text)", "start", 13, 400);

          row(svg, BX, 76, n, function (i) {
            if (st.kind === "cmp" && (i === st.i || i === st.j)) return st.doSw ? "warn" : "compare";
            if (!st.swapped && st.gap === 1 && st.kind === "round") return "done";
            return "";
          }, { box: BW, pitch: BP, texts: st.arr.slice(), labels: function (i) { return "[" + i + "]"; } });

          if (st.kind === "cmp") {
            var x1 = BX + st.i * BP + BW / 2, x2 = BX + st.j * BP + BW / 2;
            arc(svg, x1, 76, x2, 76, st.doSw ? "var(--danger)" : "var(--accent)", 44);
            tag(svg, (x1 + x2) / 2, 26, st.doSw ? "逆序 → 交换" : "顺序 → 不动",
              st.doSw ? "var(--danger)" : "var(--accent)", "middle", 11.5);
          }

          tag(svg, 16, 180, "本轮：比较 " + st.rCmp + " 次　交换 " + st.rSwp + " 次　本轮是否交换：" +
            (st.rSwp > 0 ? "是" : "否"), "var(--text-soft)", "start", 12.5, 400);
          tag(svg, 16, 202, "累计：比较 " + st.cmp + " 次　交换 " + st.swp + " 次　已完成轮次 " + st.round,
            "var(--text-soft)", "start", 12.5, 400);

          tag(svg, 16, 240, "gap 序列：", "var(--text-soft)", "start", 12.5, 400);
          for (var g = 0; g < gapSeq.length; g++) {
            var gx = 92 + g * 62;
            var cls = (g === 0) ? "" : ((gapSeq[g] === st.gap) ? "active" : "done");
            svg.appendChild(SVG.box(gx, 222, 46, 26, cls, gapSeq[g], ""));
            if (g < gapSeq.length - 1) tag(svg, gx + 50, 240, "→", "var(--text-faint)", "start", 12, 400);
          }
          tag(svg, 92 + gapSeq.length * 62, 240, "（初值 = n = 10，第一轮先收缩为 7）",
            "var(--text-faint)", "start", 11.5, 400);

          svg.appendChild(SVG.el("rect", {
            x: 16, y: 264, width: 848, height: 88, rx: 10,
            fill: "var(--panel-2)", stroke: "var(--border)", "stroke-width": 1.4
          }));
          tag(svg, 30, 290, st.msg1 || "", st.msg1Color || "var(--text)", "start", 13);
          if (st.msg2) tag(svg, 30, 314, st.msg2, st.msg2Color || "var(--text-soft)", "start", 12.5, 400);
          if (st.msg3) tag(svg, 30, 338, st.msg3, st.msg3Color || "var(--text-soft)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    snap("初始序列 <b>A = [" + A0.join(", ") + "]</b>，n = 10。" +
      "冒泡慢在<b>只能比较相邻元素</b>：一次交换最多消除一个逆序对，小元素在右端时要挪很多趟。" +
      "梳排序先用<b>大间隔</b>比较 <code>A[i]</code> 与 <code>A[i + gap]</code>，一次交换就能跨越很长距离，" +
      "再让 gap 逐步收缩做越来越细的调整 ——「先用大齿距把打结处梳开，再换小齿距理顺」。" +
      "<code>gap</code> 初值取 n = <b>10</b>。",
      { kind: "init", gap: n, round: 0, i: -1, j: -1, doSw: false, cmp: 0, swp: 0, rCmp: 0, rSwp: 0,
        swapped: true, arr: A0.slice(),
        msg1: "规则：gap 初始为 n，每轮 gap = ⌊gap / 1.3⌋（不足 1 时取 1）",
        msg1Color: "var(--brand)",
        msg2: "为什么是 1.3 而不是 2？除以 2 会让 gap 序列带着公约数，每轮都在比同一批下标对；1.3 得到的序列互质性更好",
        msg3: "终止条件：gap = 1 且某一轮完全没有发生交换" });

    for (var t = 0; t < steps.length; t++) {
      var st = steps[t];
      if (st.kind === "cmp") {
        var d = "gap = <b>" + st.gap + "</b>（第 " + st.round + " 轮）：比较 <code>A[" + st.i + "] = " + st.vi +
          "</code> 与 <code>A[" + st.j + "] = " + st.vj + "</code>（下标相差 " + st.gap + "）。";
        if (st.doSw) {
          d += "<b>" + st.vi + " 大于 " + st.vj + " → 交换</b>：一次交换就让 " + st.vj + " 向左跨了 " + st.gap +
            " 格、" + st.vi + " 向右跨了 " + st.gap + " 格 —— 这正是大 gap 的威力。本轮累计交换 " + st.rSwp + " 次。";
        } else {
          d += st.vi + " 不大于 " + st.vj + " → 这一对已经有序，不动。";
          if (st.gap === 1) d += "此时 gap = 1，梳排序已经<b>退化成标准冒泡</b>，正在做最后的收尾扫描。";
        }
        snap(d, {
          kind: "cmp", gap: st.gap, round: st.round, i: st.i, j: st.j, doSw: st.doSw,
          cmp: st.cmp, swp: st.swp, rCmp: st.rCmp, rSwp: st.rSwp, swapped: st.swapped, arr: st.arr,
          msg1: st.gap > 1
            ? "大 gap 阶段：先把远距离的逆序对粗粗换掉，元素一次能跨 " + st.gap + " 格"
            : "gap = 1 阶段：已经退化为冒泡，只做相邻比较",
          msg1Color: st.gap > 1 ? "var(--brand)" : "var(--accent)",
          msg2: "本轮进度：比较 " + st.rCmp + " 次 / 共 " + (n - st.gap) + " 对　本轮交换 " + st.rSwp + " 次",
          msg3: "累计比较 " + st.cmp + " 次、交换 " + st.swp + " 次" });
      } else {
        var nextGap = Math.max(1, Math.floor(st.gap / 1.3));
        snap("第 " + st.round + " 轮（gap = " + st.gap + "）扫描结束：本轮共比较 " + st.rCmp +
          " 次、交换 " + st.rSwp + " 次 → <b>本轮" + (st.rSwp > 0 ? "发生过交换" : "没有任何交换") + "</b>。" +
          (st.rSwp > 0
            ? (st.gap > 1 ? "下一轮 gap = ⌊" + st.gap + " / 1.3⌋ = " + nextGap + "，比较的间距会更细。"
                          : "gap 已经等于 1 且本轮仍有交换，说明还没完全有序，必须再来一轮确认。")
            : "gap = 1 时「整轮无交换」就是排序结束的信号 —— 此时它等同于冒泡，冒泡一整趟无交换说明序列整体有序。"),
          {
            kind: "round", gap: st.gap, round: st.round, i: -1, j: -1, doSw: false,
            cmp: st.cmp, swp: st.swp, rCmp: st.rCmp, rSwp: st.rSwp, swapped: st.swapped, arr: st.arr,
            msg1: st.rSwp > 0 ? "本轮有交换 → 继续收缩 gap" : "本轮无交换 → 已经有序，结束",
            msg1Color: st.rSwp > 0 ? "var(--warn)" : "var(--ok)",
            msg2: "当前数组 = [" + st.arr.join(", ") + "]",
            msg3: "累计比较 " + st.cmp + " 次、交换 " + st.swp + " 次"
          });
      }
    }

    snap("<b>排序完成：A = [" + SORTED.join(", ") + "]</b>。全程比较 " + totalCmp + " 次、交换 " + totalSwp + " 次。" +
      "整个过程只用了 gap = " + gapSeq.join(" → ") + " 这样一条序列：" +
      "绝大部分逆序对在 gap 还很大时就被一次交换解决了，最后 gap = 1 的冒泡只是「收尾确认」。",
      { kind: "round", gap: 1, round: steps[steps.length - 1].round, i: -1, j: -1, doSw: false,
        cmp: totalCmp, swp: totalSwp, rCmp: 0, rSwp: 0, swapped: false, arr: SORTED.slice(),
        msg1: "复杂度：最坏 O(n²)，平均接近 O(n log n)（实测常与快排同量级），空间 O(1)",
        msg1Color: "var(--brand)",
        msg2: "不稳定：gap 大于 1 时的交换跨越了中间元素，相等关键字的相对次序会被打乱",
        msg2Color: "var(--danger)",
        msg3: "对比希尔排序：同样是「缩小增量」，但希尔分组后用的是插入排序，梳排序用的是冒泡式交换" });

    new DS.Viz(host, {
      title: "梳排序（Comb Sort）的 gap 递减过程",
      sub: "A = [" + A0.join(", ") + "]　gap 从 10 一路 ÷1.3 收缩到 1，最后用冒泡收尾",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 6：锦标赛排序（胜者树）—— 建树 n−1 次比较，重赛 log n 次
     容器：<div id="viz-tournament">
     ========================================================================== */
  (function tournament() {
    var host = document.getElementById("viz-tournament");
    if (!host) return;

    /* R = 结点半径；YS[d] = 第 d 层结点的 y 坐标（d 从 0 = 根开始）。 */
    var W = 880, H = 520;
    var R = 21;
    var YS = [46, 138, 230, 322];

    /* A0 = 8 个参赛数据（n = 8，正好是一棵满二叉树）；INF = 哨兵“无穷大”，空位用它。 */
    var A0 = [3, 1, 4, 1, 5, 9, 2, 6];
    var n = A0.length;
    var INF = Infinity;

    /* pos(t) 把结点编号 t 换算成画布坐标：d = ⌊log₂t⌋ 是它的层号，k = t − 2^d 是该层第几个。 */
    function pos(t) {
      var d = Math.floor(Math.log(t) / Math.log(2));
      var k = t - Math.pow(2, d);
      return { x: W * (2 * k + 1) / Math.pow(2, d + 1), y: YS[d], d: d };
    }

    /* 胜者树的两个数组，长度都是 2n、**下标 1 基**（tree[0] 不用）：
       val[t] = 结点 t 上存的值；win[t] = 该子树的胜者所在的**叶子下标**（-1 = 这场还没比）；
       叶子是 t = n..2n−1（val[n+j] = A0[j]），内部结点 t = 1..n−1，根是 win[1]。 */
    var val = [], win = [];
    (function () {
      for (var i = 0; i < 2 * n; i++) { val.push(INF); win.push(-1); }
      for (var j = 0; j < n; j++) { val[n + j] = A0[j]; win[n + j] = n + j; }
    })();

    /* cmp = 比较次数（建树 n−1 次 + 每次重赛 log n 次）；outList = 已经输出的元素（升序）。
       st 每次新建、不用拷贝：st.hlKids / hlNode = 要高亮的两个孩子、父结点，
       st.pathLeaf / hlPath = 当前重赛走的路径。 */
    var frames = [], cmp = 0, outList = [];
    /* st: {hlKids, hlNode, pathLeaf, hlPath, msg1..3} */
    function snap(desc, st) {
      /* 关键：把「这一帧要画的状态」在此刻深拷贝下来。
         DS.Viz 会先跑完整个 build() 再逐帧渲染，
         若 draw 直接读活变量（val / win / outList），画出来的永远是算法结束后的最终态。 */
      /* sVal / sWin / sOut = **该帧的快照**：树上的值、胜者下标、已输出列表。
         这三个在 build() 里一直变，draw 只读快照（下面统一用 sVal / sWin / sOut）。 */
      var sVal = val.slice(), sWin = win.slice(), sOut = outList.slice();
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 16, 20, "胜者树（winner tree）：叶子 = 参赛数据，内部结点 = 这一小场比赛的胜者（实现里存的是胜者所在的叶子下标）");

          function built(t) { return sWin[t] !== -1 || st.hlNode === t; }

          /* 边 */
          for (var t = 2; t <= 2 * n - 1; t++) {
            var par = Math.floor(t / 2);
            if (!built(par)) continue;
            var p = pos(par), c2 = pos(t);
            var onPath = st.hlPath && (st.hlPath.indexOf(par) >= 0 || st.hlPath.indexOf(t) >= 0);
            svg.appendChild(SVG.line(p.x, p.y + R, c2.x, c2.y - R, onPath ? "done" : ""));
          }

          /* 内部结点 */
          for (var t2 = 1; t2 < n; t2++) {
            if (!built(t2)) continue;
            var pp = pos(t2), w = sWin[t2];
            var shown = (w >= 0) ? ((sVal[w] === INF) ? "∞" : sVal[w]) : "?";
            var ncls = (st.hlNode === t2) ? "compare" : "done";
            svg.appendChild(SVG.circle(pp.x, pp.y, R, ncls, shown, nodeOn(ncls)));
            if (w >= 0) {
              tag(svg, pp.x, pp.y + R + 13, "idx " + (w - n),
                (st.hlNode === t2) ? "var(--accent)" : "var(--text-faint)", "middle", 10.5, 400);
            }
          }
          /* 叶子 */
          for (var i = 0; i < n; i++) {
            var lp = pos(n + i);
            var hotKid = st.hlKids && (st.hlKids[0] === n + i || st.hlKids[1] === n + i);
            var cls = "";
            if (hotKid) cls = "compare";
            else if (sVal[n + i] === INF) cls = "dim";
            else if (st.pathLeaf === i) cls = "active";
            var txt = (sVal[n + i] === INF) ? "∞" : sVal[n + i];
            svg.appendChild(SVG.circle(lp.x, lp.y, R, cls, txt, nodeOn(cls)));
            tag(svg, lp.x, lp.y + R + 14, "[" + i + "]",
              hotKid ? "var(--accent)" : "var(--text-faint)", "middle", 10.5, 400);
          }

          /* 输出序列 */
          tag(svg, 16, 398, "输出序列", "var(--text-soft)", "start", 13, 400);
          for (var o = 0; o < n; o++) {
            var x = 110 + o * 62;
            if (o < sOut.length) svg.appendChild(SVG.box(x, 376, 50, 34, "done", sOut[o], ""));
            else dashBox(svg, x, 376, 50, 34, "");
          }
          if (sOut.length) {
            tag(svg, 110 + sOut.length * 62 + 6, 398, "← 第 " + sOut.length + " 小",
              "var(--ok)", "start", 12, 400);
          }

          svg.appendChild(SVG.el("rect", {
            x: 16, y: 424, width: 848, height: 80, rx: 10,
            fill: "var(--panel-2)", stroke: "var(--border)", "stroke-width": 1.4
          }));
          tag(svg, 30, 450, st.msg1 || "", st.msg1Color || "var(--text)", "start", 13);
          if (st.msg2) tag(svg, 30, 474, st.msg2, st.msg2Color || "var(--text-soft)", "start", 12.5, 400);
          if (st.msg3) tag(svg, 30, 498, st.msg3, st.msg3Color || "var(--text-soft)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    snap("锦标赛排序（树形选择排序）用一棵<b>完全二叉树</b>来选最小值：叶子放原始数据，" +
      "内部结点记录这一小场比赛的胜者。数据 <b>A = [" + A0.join(", ") + "]</b>，8 个元素刚好铺满 8 个叶子。" +
      "建树顺序是<b>自底向上</b>：每个内部结点只要比较一次（左右两个胜者谁更小）。" +
      "8 个叶子、7 个内部结点 → 建树恰好 <b>n − 1 = 7</b> 次比较。",
      { hlKids: null, hlNode: -1, pathLeaf: -1,
        msg1: "叶子数 n = 8，内部结点 n − 1 = 7 → 建树 7 次比较",
        msg1Color: "var(--brand)",
        msg2: "注意：建树这 7 次比较和「线性扫描找最小值」的 n − 1 次完全一样，一点没省",
        msg3: "省的是后续：取走最小值后只需沿它走过的路径重赛 ⌈log₂n⌉ = 3 次" });

    /* ---------- 建树：自底向上 ---------- */
    /* 建树的处理顺序：内部结点从 7 号一路倒着比到 1 号（自底向上、自右向左），
       这样每个结点比赛时它的两个孩子都已经有胜者了。 */
    var buildOrder = [7, 6, 5, 4, 3, 2, 1];
    for (var bi = 0; bi < buildOrder.length; bi++) {
      var t3 = buildOrder[bi];
      var L = win[2 * t3], Rr = win[2 * t3 + 1];
      cmp++;
      var winner = (val[L] <= val[Rr]) ? L : Rr;
      win[t3] = winner;
      var lv = (val[L] === INF) ? "∞" : val[L];
      var rv = (val[Rr] === INF) ? "∞" : val[Rr];
      var wTxt = (val[winner] === INF) ? "∞" : val[winner];
      var level = Math.floor(Math.log(t3) / Math.log(2));
      snap("第 " + cmp + " 次比较（第 " + (3 - level) + " 层）：结点 " + t3 + " 的两位选手是叶子 [" + (L - n) +
        "] = " + lv + " 与叶子 [" + (Rr - n) + "] = " + rv + "。比较结果 <b>" + wTxt + " 更小</b>，" +
        "于是这个内部结点记下胜者所在的叶子下标 <code>idx " + (winner - n) + "</code>。" +
        "实现里内部结点<b>存的是下标而不是值</b>，因为重赛时要顺着下标找回路径。" +
        (val[L] === val[Rr] ? "<br>两者相等时约定「左边优先」，这只影响相等元素谁先被取走，不影响结果有序。" : ""),
        { hlKids: [L, Rr], hlNode: t3, pathLeaf: -1,
          msg1: "建树已用 " + cmp + " 次比较（还需要 " + (7 - cmp) + " 次）",
          msg1Color: "var(--brand)",
          msg2: "结点 " + t3 + " 的胜者 = 叶子 [" + (winner - n) + "]，值 " + wTxt });
    }

    /* champion = 冠军所在的叶子下标（根 win[1] 里存的就是它）；它的值就是全局最小值。 */
    var champion = win[1];
    snap("建树完成！根结点给出的胜者是叶子 <b>[" + (champion - n) + "] = " + val[champion] + "</b>，" +
      "它就是整个数组的最小值。建树一共用了 <b>7 = n − 1</b> 次比较 —— " +
      "和线性扫描一遍找最小值的代价一模一样，真正的加速在下一步。",
      { hlKids: null, hlNode: 1, pathLeaf: champion - n,
        msg1: "冠军 = 叶子 [" + (champion - n) + "]，值 " + val[champion],
        msg1Color: "var(--ok)",
        msg2: "建树 n − 1 = 7 次比较（与线性扫描相同）" });

    /* ---------- 连续输出 4 个最小值，每次演示重赛 ---------- */
    for (var rd = 0; rd < 4; rd++) {
      var best = win[1];
      var bIdx = best - n, bVal = val[best];
      outList.push(bVal);
      var pathT = [];
      for (var pt = Math.floor(best / 2); pt >= 1; pt = Math.floor(pt / 2)) pathT.push(pt);
      snap("取出第 <b>" + (rd + 1) + "</b> 个最小值：<code>" + bVal + "</code>（叶子 [" + bIdx +
        "]）写进输出序列。然后让这位选手<b>退赛</b>：把它的叶子置为 <b>+∞</b>。<br>" +
        "关键观察：<b>第二小的元素一定在「冠军走过的这条路径」上、曾经输给过它的那些对手之中</b> —— " +
        "其它元素都是被这些对手直接或间接淘汰掉的。这条路径的长度就是树高 <b>⌈log₂8⌉ = 3</b>。",
        { hlKids: null, hlNode: -1, pathLeaf: bIdx, hlPath: pathT,
          msg1: "输出第 " + (rd + 1) + " 小 = " + bVal + "（叶子 [" + bIdx + "] 置为 +∞）",
          msg1Color: "var(--ok)",
          msg2: "高亮路径 = 冠军路径，长度 3 = ⌈log₂n⌉",
          msg3: "接下来沿这条路径自底向上重赛，每层只需 1 次比较" });
      val[best] = INF;

      for (var pi = 0; pi < pathT.length; pi++) {
        var tt = pathT[pi];
        var LL = win[2 * tt], RR = win[2 * tt + 1];
        cmp++;
        var w2 = (val[LL] <= val[RR]) ? LL : RR;
        win[tt] = w2;
        var a1 = (val[LL] === INF) ? "∞" : val[LL];
        var a2 = (val[RR] === INF) ? "∞" : val[RR];
        var wv = (val[w2] === INF) ? "∞" : val[w2];
        snap("重赛第 " + (pi + 1) + " 步（共 " + pathT.length + " 步）：结点 " + tt + " 重新比较两位选手 " +
          a1 + " 与 " + a2 + " → 胜者 <b>" + wv + "</b>（记作 <code>idx " + (w2 - n) + "</code>）。" +
          "路径之外的子树<b>完全没有动过</b>，不需要重算 —— 这就是胜者树省时间的地方。",
          { hlKids: [LL, RR], hlNode: tt, pathLeaf: bIdx, hlPath: pathT,
            msg1: "重赛第 " + (pi + 1) + " / " + pathT.length + " 次比较，累计比较 " + cmp + " 次",
            msg1Color: "var(--brand)",
            msg2: "当前根结点的候选 = " + ((val[win[1]] === INF) ? "∞" : val[win[1]]) });
      }

      var nb = win[1];
      snap("重赛结束，新的最小值出现在根结点：叶子 <b>[" + (nb - n) + "] = " + val[nb] + "</b>。" +
        "这一轮「取最小 + 重赛」只花了 <b>" + pathT.length + " = ⌈log₂n⌉ = 3</b> 次比较；" +
        "而若用线性扫描在剩下 " + (n - rd - 1) + " 个元素里找最小，需要比较 " + (n - rd - 2) + " 次。",
        { hlKids: null, hlNode: 1, pathLeaf: nb - n,
          msg1: "第 " + (rd + 1) + " 次输出完成，累计比较 " + cmp + " 次",
          msg1Color: "var(--ok)",
          msg2: "线性扫描此刻需要 " + (n - rd - 2) + " 次比较，胜者树只要 3 次" });
    }

    snap("到这里，胜者树已经连续输出了 " + outList.length + " 个最小值：<b>[" + outList.join(", ") + "]</b>。" +
      "把账算清楚：建树 7 次 + 每次重赛 3 次。输出前 4 小总共 7 + 3 × 3 = <b>16</b> 次比较，" +
      "而「线性扫描找最小」要 7 + 6 + 5 + 4 = <b>22</b> 次 —— 树高换来了这个加速。<br>" +
      "输出全部 n 个元素的比较次数是 <b>(n − 1) + (n − 1)·⌈log₂n⌉ = 7 + 7 × 3 = 28</b>，也就是 <b>O(n log n)</b>。",
      { hlKids: null, hlNode: 1, pathLeaf: -1,
        msg1: "总比较 = (n − 1) + (n − 1)⌈log₂n⌉ = O(n log n)",
        msg1Color: "var(--brand)",
        msg2: "额外空间 O(n)（2n 个结点的数组）；不稳定：相等元素谁先被取走取决于树结构",
        msg2Color: "var(--danger)",
        msg3: "它也是 k 路归并里「把选最小从 O(k) 降到 O(log k)」的那套结构的前身（败者树）" });

    new DS.Viz(host, {
      title: "锦标赛排序：胜者树建树 + 沿冠军路径重赛",
      sub: "A = [" + A0.join(", ") + "]　建树 n−1 = 7 次比较，之后每次重赛 ⌈log₂n⌉ = 3 次",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 7：内省排序（Introsort）—— 快排主干 + 小区间插排 + 深度超限转堆排
     容器：<div id="viz-introsort">
     ========================================================================== */
  (function introsort() {
    var host = document.getElementById("viz-introsort");
    if (!host) return;

    var W = 880, H = 528;
    /* 三个关键常量：N32 = 元素个数 32；LIMIT = 递归深度上限 2⌊log₂n⌋ = 10（超过就改堆排兜底）；
       THRESH = 小区间阈值 16（区间长度 ≤ 16 就交给插入排序 —— 小规模下插排常数最小）。 */
    var N32 = 32, LIMIT = 2 * Math.floor(Math.log(N32) / Math.log(2)), THRESH = 16;
    /* A0 = 1..32 的**已有序**数组：对“取首元素作枢轴”的快排来说这就是最坏输入。 */
    var A0 = [];
    for (var z = 1; z <= N32; z++) A0.push(z);      /* 已经有序 = 最坏输入 */

    /* MODES = 三种模式（快排主干 / 插入排序 / 堆排序兜底）的显示名与颜色，用 st.mode 当键。 */
    var MODES = {
      quick: { name: "快速排序（主干）", color: "var(--brand)" },
      ins: { name: "插入排序（长度 ≤ 16）", color: "var(--ok)" },
      heap: { name: "堆排序（深度超限兜底）", color: "var(--danger)" }
    };

    var frames = [];
    /* st: {mode, depth, lo, hi, trace, grid, gridMarks, msg1, msg2} */
    /* 推一帧。st 每次新建、不用拷贝：st.mode = 当前模式键，st.depth = 剩余深度预算，
       st.lo / st.hi = 当前区间（**左闭右开** [lo, hi)），st.trace = 已发生的划分记录，
       st.grid / st.gridMarks = 要画的数组片段与它的标记，st.msg* = 文案。 */
    function snap(desc, st) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 16, 20, "内省排序（introsort）= 快速排序 + 插入排序 + 堆排序，三者各管一段");

          tag(svg, 16, 46, "当前模式：" + MODES[st.mode].name, MODES[st.mode].color, "start", 14);
          tag(svg, 372, 46, "递归深度 " + st.depth + " / 限制 2⌊log₂n⌋ = " + LIMIT, "var(--purple)", "start", 13.5);
          tag(svg, 648, 46, "当前区间 [" + st.lo + ", " + st.hi + ")　长度 " + (st.hi - st.lo),
            "var(--text)", "start", 13.5);

          /* 流程图 */
          var fx = 24, fw = 268, fh = 46;
          var fys = [86, 196, 306];
          var keys = ["quick", "ins", "heap"];
          var label = ["① 快速排序：选枢轴 + 划分，递归主干",
            "② 插入排序：区间长度 ≤ 16 时收尾",
            "③ 堆排序：深度超过 2⌊log₂n⌋ 时兜底"];
          for (var f = 0; f < 3; f++) {
            var act = (st.mode === keys[f]);
            svg.appendChild(SVG.box(fx, fys[f], fw, fh, act ? "active" : "done", label[f], ""));
            if (f < 2) svg.appendChild(SVG.line(fx + fw / 2, fys[f] + fh, fx + fw / 2, fys[f + 1], act ? "active" : ""));
          }
          tag(svg, fx, 382, "快排负责「平均快」、插排负责「小区间」、堆排负责「最坏有保证」",
            "var(--text-faint)", "start", 11.5, 400);
          tag(svg, fx, 402, "阈值 = 16（libstdc++ 的取值）；深度限制 = 2⌊log₂n⌋", "var(--text-faint)", "start", 11.5, 400);

          /* 递归过程表 */
          tag(svg, 330, 78, "递归过程（深度 / 区间 / 长度 / 模式）", "var(--text-soft)", "start", 12.5, 400);
          for (var t = 0; t < st.trace.length && t < 10; t++) {
            var e = st.trace[t];
            var y = 98 + t * 20;
            tag(svg, 330, y, "深度 " + e.d, "var(--text-soft)", "start", 11.5, 400);
            tag(svg, 386, y, "[" + e.lo + ", " + e.hi + ")", "var(--text)", "start", 11.5, 400);
            tag(svg, 468, y, "长度 " + e.len, "var(--text)", "start", 11.5, 400);
            tag(svg, 538, y, MODES[e.mode].name, MODES[e.mode].color, "start", 11.5, 700);
            if (e.note) tag(svg, 700, y, e.note, "var(--text-faint)", "start", 11, 400);
          }

          /* 当前区间元素 */
          tag(svg, 330, 336, "当前区间 [" + st.lo + ", " + st.hi + ") 的元素：", "var(--text-soft)", "start", 12.5, 400);
          var per = 12, gw = 34;
          for (var g = 0; g < st.grid.length; g++) {
            var gx = 330 + (g % per) * gw, gy = 348 + Math.floor(g / per) * 38;
            svg.appendChild(SVG.box(gx, gy, 30, 30, (st.gridMarks && st.gridMarks[g]) || "", st.grid[g], ""));
            tag(svg, gx + 15, gy + 44, String(st.lo + g), "var(--text-faint)", "middle", 9.5, 400);
          }

          svg.appendChild(SVG.el("rect", {
            x: 16, y: 452, width: 848, height: 62, rx: 10,
            fill: "var(--panel-2)", stroke: "var(--border)", "stroke-width": 1.4
          }));
          tag(svg, 30, 478, st.msg1 || "", st.msg1Color || "var(--text)", "start", 13);
          if (st.msg2) tag(svg, 30, 502, st.msg2, st.msg2Color || "var(--text-soft)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    /* gridOf(lo, hi) = 取出区间 [lo, hi) 的元素做画面上的“格子”（最多 24 个，多了画不下）。 */
    function gridOf(lo, hi) {
      var g = [];
      for (var i = lo; i < hi && g.length < 24; i++) g.push(A0[i]);
      return g;
    }
    function firstActive() { return { 0: "active" }; }
    function doneMarks(k) {
      var m = {};
      for (var i = 0; i < k; i++) m[i] = "done";
      return m;
    }

    /* trace = 划分过程记录，每项 {d: 剩余深度, lo, hi, len, mode, note}；画面上那排小格子读的就是它。 */
    var trace = [];
    snap("先看一个「对手刻意构造」的输入：<b>A = [1, 2, 3, …, 32] 已经完全有序</b>，" +
      "而划分策略取<b>区间第一个元素作枢轴</b>（不少教科书版本就是这么写的）。" +
      "对这种输入，每次枢轴都恰好是区间最小值，划分会退化成 <b>1 : n − 1</b>。" +
      "n = 32，深度限制 = <b>2⌊log₂32⌋ = 2 × 5 = 10</b>，小区间阈值 <b>16</b>。下面看它怎么一步步走到「深度用尽」。",
      { mode: "quick", depth: LIMIT, lo: 0, hi: N32, trace: [], grid: gridOf(0, N32), gridMarks: firstActive(),
        msg1: "起点：sort(A)，区间 [0, 32)，长度 32，深度预算 " + LIMIT,
        msg1Color: "var(--brand)",
        msg2: "长度 32 大于阈值 16 → 用快排划分；只要深度没耗尽就一直递归下去" });

    /* 模拟递归的状态：lo / hi = 当前区间（左闭右开）；depth = 剩余深度预算（每划分一次减 1）；
       frags = 已经产生的“长度 1 碎片”个数（它们全部走插入排序分支）。 */
    var lo = 0, hi = N32, depth = LIMIT, frags = 0;
    while (hi - lo > THRESH && depth > 0) {
      var len = hi - lo;
      var pivot = A0[lo];
      trace.push({ d: depth, lo: lo, hi: hi, len: len, mode: "quick", note: "枢轴 = " + pivot });
      frags++;
      var savedLo = lo;
      lo = lo + 1;
      trace.push({ d: depth, lo: savedLo, hi: savedLo + 1, len: 1, mode: "ins", note: "左碎片长度 1" });
      depth = depth - 1;
      snap("深度 " + (depth + 1) + "：区间 [" + savedLo + ", " + hi + ") 长度 " + len +
        " 大于阈值 16 → <b>快排划分</b>。取区间首元素 <code>A[" + savedLo + "] = " + pivot +
        "</code> 作枢轴，它比右边所有元素都小，于是划分结果是 <b>左子区间长度 1、右子区间长度 " + (len - 1) +
        "</b> —— 这就是最坏情形 1 : n − 1。<br>" +
        "长度 1 的碎片 ≤ 16，直接交给<b>插入排序</b>（一个元素天然有序，零代价）；" +
        "右子区间带着<b>深度 " + depth + "</b> 继续递归。",
        { mode: "quick", depth: depth, lo: lo, hi: hi, trace: trace.slice(), grid: gridOf(lo, hi),
          gridMarks: firstActive(),
          msg1: "每次划分只削掉 1 个元素：深度 −1、区间长度也只少 1 → 深度会一路线性增长",
          msg1Color: "var(--warn)",
          msg2: "已产生 " + frags + " 个长度 1 的碎片，全部走插入排序分支（模式在「快排」与「插排」之间切换）" });
    }

    trace.push({ d: 0, lo: lo, hi: hi, len: hi - lo, mode: "heap", note: "深度用尽 → 堆排" });
    snap("深度耗尽：现在区间是 [" + lo + ", " + hi + ")，长度 " + (hi - lo) + "，仍然大于阈值 16，" +
      "但<b>深度预算已经是 0</b>。如果继续递归划分，最坏情况会一路斜到深度 31，时间退化成 <b>O(n²)</b>，" +
      "递归栈还可能爆掉。<br>这正是 introsort 里 <b>introspective（自省）</b> 的含义：" +
      "算法自己盯着递归深度，一旦发现「划分已经严重偏斜」，立刻改用<b>堆排序</b>处理这个区间 —— " +
      "堆排最坏也是 O(n log n)，而且额外空间只要 O(1)。",
      { mode: "heap", depth: 0, lo: lo, hi: hi, trace: trace.slice(), grid: gridOf(lo, hi), gridMarks: {},
        msg1: "深度用尽 → 触发兜底：区间 [" + lo + ", " + hi + ") 改用堆排序",
        msg1Color: "var(--danger)",
        msg2: "堆排不递归 → 深度不再增长，最坏情况的 O(n²) 被彻底堵死" });

    /* heapLo / heapHi = 深度用尽时那个区间（左闭右开）—— 它就是要交给堆排序兜底的部分。 */
    var heapLo = lo, heapHi = hi;
    snap("堆排第一步：<b>建堆</b>。把区间 [" + heapLo + ", " + heapHi + ") 的 " + (heapHi - heapLo) +
      " 个元素看成一棵完全二叉树，自底向上做「下沉」调整，得到一个<b>大顶堆</b>：" +
      "每个父结点都不小于它的孩子，于是<b>最大值一定在堆顶</b>（这里堆顶是 A[" + heapLo + "] = " + A0[heapLo] +
      "，因为这段数据本来就是升序）。建堆的代价是线性的 O(n)。",
      { mode: "heap", depth: 0, lo: heapLo, hi: heapHi, trace: trace.slice(), grid: gridOf(heapLo, heapHi),
        gridMarks: (function () { var m = {}; m[0] = "compare"; return m; })(),
        msg1: "建堆：区间 [" + heapLo + ", " + heapHi + ") → 大顶堆，堆顶 = 最大值",
        msg1Color: "var(--brand)",
        msg2: "堆排不递归、原地进行，额外空间只要 O(1)" });

    for (var ex = 0; ex < 3; ex++) {
      var tailIdx = heapHi - 1 - ex;
      var doneCnt = (heapHi - heapLo) - 1 - ex;
      snap("堆排取最值（第 " + (ex + 1) + " 次）：把堆顶（当前最大值 <b>" + A0[tailIdx] + "</b>）与堆的最后一个元素交换，" +
        "于是 <b>A[" + tailIdx + "] = " + A0[tailIdx] + "</b> 落到了它的最终位置；接着堆长度减 1，" +
        "新的堆顶做一次「下沉」恢复堆序（代价 O(log n)）。",
        { mode: "heap", depth: 0, lo: heapLo, hi: heapHi, trace: trace.slice(), grid: gridOf(heapLo, heapHi),
          gridMarks: (function () { var m = {}; for (var q = 0; q < doneCnt; q++) m[q] = "done"; m[0] = "active"; return m; })(),
          msg1: "A[" + tailIdx + "] = " + A0[tailIdx] + " 就位（它是该区间里第 " + (ex + 1) + " 大的元素）",
          msg1Color: "var(--ok)",
          msg2: "重复「取堆顶 → 放末尾 → 下沉」，整个区间就排好了" });
    }

    snap("区间 [" + heapLo + ", " + heapHi + ") 处理完毕，递归返回，整个数组完全有序：<b>A = [1, 2, 3, …, 32]</b>。" +
      "回头看：如果没有「深度超限转堆排」这道保险，这个已经有序的输入会把快排拖到 <b>O(n²)</b>；" +
      "有了它，最坏情况被钉死在 <b>O(n log n)</b>。",
      { mode: "ins", depth: 0, lo: 0, hi: N32, trace: trace.slice(), grid: gridOf(0, 24), gridMarks: doneMarks(24),
        msg1: "排序完成：三道保险（快排 → 插排 → 堆排）各司其职",
        msg1Color: "var(--ok)",
        msg2: "本例中 " + frags + " 个长度 1 的碎片走了插排分支，1 个长度 " + (heapHi - heapLo) + " 的区间走了堆排分支" });

    snap("把三道保险的分工说清楚：<br>" +
      "<b>① 快排主干</b>：平均 O(n log n)、常数最小、对 cache 友好，负责绝大多数工作。" +
      "<b>② 插入排序</b>：区间长度 ≤ 16（libstdc++ 的阈值）时直接插排 —— " +
      "小区间上插排的比较次数少、没有函数调用开销，比继续递归划分划算得多。" +
      "<b>③ 堆排序</b>：递归深度超过 2⌊log₂n⌋ 就判定划分已经偏斜，改用堆排把最坏情况兜住。",
      { mode: "ins", depth: 0, lo: 0, hi: N32, trace: trace.slice(), grid: gridOf(0, 24), gridMarks: doneMarks(24),
        msg1: "最终复杂度：平均 O(n log n)（接近快排常数）、最坏 O(n log n)（堆排保证）、空间 O(log n)",
        msg1Color: "var(--brand)",
        msg2: "不稳定；C++ 标准库的 std::sort 就是 introsort（libstdc++ 阈值 16、深度限制 2⌊log₂n⌋）",
        msg2Color: "var(--purple)" });

    new DS.Viz(host, {
      title: "内省排序（Introsort）的决策过程",
      sub: "快排主干 + 小区间（≤16）插排 + 深度超 2⌊log₂n⌋ 转堆排　输入为已有序的 32 个元素",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 8：2-路归并 → 原地归并（手摇算法）→ k 路归并与败者树
     容器：<div id="viz-merge-two">
     ========================================================================== */
  (function mergeTwo() {
    var host = document.getElementById("viz-merge-two");
    if (!host) return;

    var W = 880, H = 480;
    var BW = 46, BP = 60, BX = 190;

    /* A0 = 两个长度 3 的有序段拼起来的数组；MID = 2 → 左段 [0, 2]、右段 [3, 5]（都是闭区间）。 */
    var A0 = [1, 4, 7, 2, 3, 9];     /* 两个长度 3 的有序段 */
    var n = A0.length, MID = 2;      /* 左段 [0, 2]，右段 [3, 5] */

    /* A = 工作副本；T = 归并用的辅助数组（初值全 null = 这一格还没写过）。 */
    var A = A0.slice();
    var T = [null, null, null, null, null, null];

    var frames = [];
    /* st: {phase, i, j, k, arr, colors, rings, hl, revLabel, runs, treeMsg, msg1..5} */
    /* 推一帧。st 每次新建、不用拷贝：st.phase = "merge"/"inplace"/"kway" 决定画哪一段，
       st.i / st.j / st.k = 双指针与写入位置（-1 = 不画），st.arr = 本帧要画的数组，
       st.colors / rings / hl = 配色、圈标、高亮下标，st.revLabel = 手摇那一段的标注，
       st.runs / treeMsg = k 路归并的四段首与胜者树说明，st.msg1..5 = 底部文字。 */
    function snap(desc, st) {
      /* 关键：把「这一帧要画的状态」在此刻深拷贝下来。
         DS.Viz 会先跑完整个 build() 再逐帧渲染，
         若 draw 直接读活变量（辅助数组 T），画出来的永远是算法结束后的最终态。 */
      /* sT = **该帧的快照**：辅助数组 T 的拷贝（T 会被不断写入，draw 里读活变量只会看到最终结果）。 */
      var sT = T.slice();
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);

          if (st.phase === "merge") {
            note(svg, 16, 20, "① 标准 2-路归并：需要 O(n) 辅助数组，双指针取小，谁小先输出谁");
            svg.appendChild(SVG.line(BX + 3 * BP - 6, 74, BX + 3 * BP - 6, 300, "dim", false));
            tag(svg, 16, 100, "A", "var(--text-soft)", "middle", 14);
            row(svg, BX, 78, n, function (i) {
              if (st.i === i || st.j === i) return "compare";
              if (i <= MID && i < st.i) return "dim";
              if (i > MID && i < st.j) return "dim";
              return "";
            }, { box: BW, pitch: BP, texts: st.arr, labels: function (i) { return "[" + i + "]"; } });
            tag(svg, BX + BP, 42, "左段 [0, 2] 已有序", "var(--brand)", "middle", 11.5, 400);
            tag(svg, BX + 4.5 * BP, 42, "右段 [3, 5] 已有序", "var(--accent)", "middle", 11.5, 400);
            ptr(svg, BX + st.i * BP + BW / 2, 70, "i=" + st.i, "var(--brand)");
            ptr(svg, BX + st.j * BP + BW / 2, 70, "j=" + st.j, "var(--accent)");

            tag(svg, 16, 220, "T", "var(--text-soft)", "middle", 14);
            for (var i2 = 0; i2 < n; i2++) {
              var x2 = BX + i2 * BP;
              if (sT[i2] === null || sT[i2] === undefined) dashBox(svg, x2, 198, BW, BW, "");
              else svg.appendChild(SVG.box(x2, 198, BW, BW, (i2 === st.k - 1) ? "warn" : "done", sT[i2], ""));
              svg.appendChild(SVG.label(x2 + BW / 2, 198 + BW + 16, "[" + i2 + "]", "middle"));
            }
            ptr(svg, BX + st.k * BP + BW / 2, 190, "k=" + st.k, "var(--purple)");
            tag(svg, BX + n * BP + 20, 226, "辅助数组 T", "var(--text-faint)", "start", 11.5, 400);
          } else if (st.phase === "inplace") {
            note(svg, 16, 20, "② 原地归并（手摇算法）：三次反转把相邻两块互换位置，额外空间 O(1)");
            tag(svg, 16, 100, "A", "var(--text-soft)", "middle", 14);
            row(svg, BX, 78, n, function (i) {
              return (st.hl && st.hl.indexOf(i) >= 0) ? "compare" : "";
            }, { box: BW, pitch: BP, texts: st.arr, colors: st.colors,
                 labels: function (i) { return "[" + i + "]"; }, rings: st.rings });
            tag(svg, BX + 0.5 * BP, 62, "不用动", "var(--text-faint)", "middle", 11.5, 400);
            tag(svg, BX + 5.5 * BP, 62, "不用动", "var(--text-faint)", "middle", 11.5, 400);
            tag(svg, BX + 1.5 * BP, 62, "左块 [4, 7]", "var(--brand)", "middle", 11.5, 400);
            tag(svg, BX + 3.5 * BP, 62, "右块 [2, 3]", "var(--accent)", "middle", 11.5, 400);
            if (st.revLabel) tag(svg, BX, 158, st.revLabel, st.revColor || "var(--brand)", "start", 13);
          } else if (st.phase === "kway") {
            note(svg, 16, 20, "③ k 路归并：从 k 个有序段的段首里反复取最小　朴素扫描 O(k) → 胜者树 / 败者树 O(log k)");
            var runs = st.runs;
            for (var r = 0; r < runs.length; r++) {
              var y = 70 + r * 46;
              tag(svg, 40, y + 26, "段 " + (r + 1), "var(--text-soft)", "start", 12.5, 400);
              for (var q2 = 0; q2 < runs[r].length; q2++) {
                if (runs[r][q2] === null) dashBox(svg, 110 + q2 * 58, y, 46, 40, "");
                else svg.appendChild(SVG.box(110 + q2 * 58, y, 46, 40,
                  (q2 === 0) ? "compare" : "", runs[r][q2], ""));
              }
              if (runs[r][0] !== null) {
                tag(svg, 110 + 2 * 58 + 6, y + 26, "← 段首参与比较", "var(--text-faint)", "start", 11, 400);
              }
            }
            /* 4 个叶子的胜者树 */
            var xs = [520, 620, 720, 820];
            var yl = 230, yi = 150, yr = 86;
            for (var e2 = 0; e2 < 4; e2++) {
              svg.appendChild(SVG.line(xs[e2], yl - 20, 570 + Math.floor(e2 / 2) * 200, yi + 18, ""));
              tag(svg, xs[e2], yl + 34, "段" + (e2 + 1) + "首", "var(--text-faint)", "middle", 11, 400);
            }
            svg.appendChild(SVG.line(570, yi - 18, 670, yr + 18, ""));
            svg.appendChild(SVG.line(770, yi - 18, 670, yr + 18, ""));
            var heads = [];
            for (var h2 = 0; h2 < runs.length; h2++) heads.push(runs[h2][0]);
            var wL = (heads[0] !== null && (heads[1] === null || heads[0] <= heads[1])) ? 0 : 1;
            var wR2 = (heads[2] !== null && (heads[3] === null || heads[2] <= heads[3])) ? 2 : 3;
            var wRoot = (heads[wL] !== null && (heads[wR2] === null || heads[wL] <= heads[wR2])) ? wL : wR2;
            for (var e3 = 0; e3 < 4; e3++) {
              var cls3 = (e3 === wL || e3 === wR2) ? "done" : "dim";
              svg.appendChild(SVG.circle(xs[e3], yl, 20, cls3, heads[e3] === null ? "∞" : heads[e3], nodeOn(cls3)));
            }
            svg.appendChild(SVG.circle(570, yi, 20, "done", heads[wL] === null ? "∞" : heads[wL], "on"));
            svg.appendChild(SVG.circle(770, yi, 20, "done", heads[wR2] === null ? "∞" : heads[wR2], "on"));
            svg.appendChild(SVG.circle(670, yr, 22, "active", heads[wRoot] === null ? "∞" : heads[wRoot], "on"));
            tag(svg, 670, yr - 34, "根 = 全局最小", "var(--brand)", "middle", 12);
            tag(svg, 470, 296, st.treeMsg || "", "var(--text-soft)", "start", 12, 400);
          }

          svg.appendChild(SVG.el("rect", {
            x: 16, y: 320, width: 848, height: 146, rx: 10,
            fill: "var(--panel-2)", stroke: "var(--border)", "stroke-width": 1.4
          }));
          tag(svg, 30, 346, st.msg1 || "", st.msg1Color || "var(--text)", "start", 13);
          if (st.msg2) tag(svg, 30, 372, st.msg2, st.msg2Color || "var(--text-soft)", "start", 12.5, 400);
          if (st.msg3) tag(svg, 30, 398, st.msg3, st.msg3Color || "var(--text-soft)", "start", 12.5, 400);
          if (st.msg4) tag(svg, 30, 424, st.msg4, st.msg4Color || "var(--text-soft)", "start", 12.5, 400);
          if (st.msg5) tag(svg, 30, 450, st.msg5, st.msg5Color || "var(--text-soft)", "start", 12.5, 400);
          return svg;
        }
      });
    }

    snap("先复习 2-路归并。数据 <b>A = [1, 4, 7 | 2, 3, 9]</b>：左段 [0, 2] 与右段 [3, 5] 各自已经有序，" +
      "目标是把它们合并成一个整体有序的序列。做法是<b>双指针取小</b>：i 指向左段头、j 指向右段头，" +
      "比较两者，谁小就先写进辅助数组 T，然后那个指针右移。<br>" +
      "理论上界：长度 L = 3、R = 3 的两段合并，比较次数最多 <b>L + R − 1 = 5</b> 次 —— " +
      "因为每比较一次就至少有一个元素被最终确定，除了最后一次不会有浪费。",
      { phase: "merge", arr: A.slice(), i: 0, j: MID + 1, k: 0,
        msg1: "① 标准 2-路归并：时间 O(n)，空间 O(n)（需要辅助数组 T）",
        msg1Color: "var(--brand)",
        msg2: "指针：i = 0（左段头）、j = 3（右段头）、k = 0（T 的写入位置）" });

    /* 标准 2-路归并的三个指针：i 指左段头、j 指右段头、k 指 T 里下一个要填的位置（都是下标）；
       cmp = 比较次数（上界是 L + R − 1 = 5）。 */
    var i = 0, j = MID + 1, k = 0, cmp = 0;
    while (i <= MID && j <= n - 1) {
      cmp++;
      var vi = A[i], vj = A[j];
      var takeLeft = (vi <= vj);
      snap("第 " + cmp + " 次比较：左段的 <code>A[" + i + "] = " + vi + "</code> 与右段的 <code>A[" + j + "] = " + vj +
        "</code>，<b>" + (takeLeft ? vi + " 不大于 " + vj + " → 取左段" : vi + " 大于 " + vj + " → 取右段") + "</b>。" +
        (takeLeft ? "相等时优先取左段，这正是归并排序稳定的原因。" : "右段元素更小，先输出它。"),
        { phase: "merge", arr: A.slice(), i: i, j: j, k: k,
          msg1: "比较 " + cmp + " 次（上界 5 次），已输出 " + k + " 个",
          msg2: "比较结果决定谁进 T[" + k + "]" });

      if (takeLeft) { T[k] = vi; i++; } else { T[k] = vj; j++; }
      k++;
      snap((takeLeft ? "把 " + vi + " 写进 <code>T[" + (k - 1) + "]</code>，i 右移。"
                     : "把 " + vj + " 写进 <code>T[" + (k - 1) + "]</code>，j 右移。") +
        "两个有序段各自内部都是递增的，所以只需看<b>段首</b>就够 —— 这正是归并只需要线性时间的原因。",
        { phase: "merge", arr: A.slice(), i: Math.min(i, MID), j: Math.min(j, n - 1), k: k,
          msg1: "T 目前 = [" + T.slice(0, k).join(", ") + (k < n ? ", …" : "") + "]",
          msg2: "已确定 " + k + " / " + n + " 个元素的最终次序" });
    }

    /* tailName = 先取完的是哪一段，只用于文案；剩下的那一段整体照搬进 T，不再比较。 */
    var tailName = (i > MID) ? "右段" : "左段";
    if (i > MID) { while (j <= n - 1) { T[k] = A[j]; j++; k++; } }
    else { while (i <= MID) { T[k] = A[i]; i++; k++; } }

    snap("有一段先取完了，剩下的" + tailName + "里全是较大的元素，而且它<b>本身就是有序的</b>，" +
      "所以直接<b>整段搬进 T</b>，不需要再比较。最终 <b>T = [" + T.join(", ") + "]</b>，" +
      "再把 T 整段写回 A 就完成了合并。全程比较 <b>" + cmp + " 次</b>，" +
      (cmp === 5 ? "正好等于上界 L + R − 1 = 5，一次都没浪费。" : "没有超过上界 L + R − 1 = 5。"),
      { phase: "merge", arr: T.slice(), i: MID, j: n - 1, k: n,
        msg1: "归并结果 A = [" + T.join(", ") + "]（比较 " + cmp + " 次）",
        msg1Color: "var(--ok)",
        msg2: "代价：时间 O(L + R) = O(n)，但辅助数组需要 O(n) 额外空间",
        msg3: "内存紧张的场景（外排序缓冲区、嵌入式）就想要「不用辅助数组」的归并 —— 手摇算法出场" });

    /* ---------- 原地归并：手摇算法（三次反转） ---------- */
    /* rev(arr, l, r) = 把闭区间 [l, r] 就地反转，返回**新数组**（不改原数组）。
       手摇算法就是靠它做三次反转来实现两块交换的。 */
    function rev(arr, l, r) {
      var b = arr.slice();
      while (l < r) { var t = b[l]; b[l] = b[r]; b[r] = t; l++; r--; }
      return b;
    }

    snap("原地归并的思路：归并的结果里有些元素根本不用动，只把「必须互换的两块」换过去就行。<br>" +
      "对 <b>[1, 4, 7 | 2, 3, 9]</b>：首元素 1 小于右段首元素 2，它一定排在最终结果的最前面，<b>不用动</b>；" +
      "末元素 9 大于左段末元素 7，它一定排在最后，<b>也不用动</b>。" +
      "真正需要互换位置的只有两块：<b>左块 [4, 7]</b> 与 <b>右块 [2, 3]</b>。",
      { phase: "inplace", arr: A0.slice(), colors: ["", "--brand", "--brand", "--accent", "--accent", ""],
        rings: {}, hl: [],
        revLabel: "目标：把 [4, 7] 与 [2, 3] 两块互换位置 → [1, 2, 3, 4, 7, 9]",
        revColor: "var(--text)",
        msg1: "② 原地归并（手摇算法）：三次反转实现「块交换」，额外空间 O(1)",
        msg1Color: "var(--brand)",
        msg2: "手摇算法 = reverse 左块 → reverse 右块 → reverse 整体，移动 2·(len1 + len2) 次",
        msg3: "一般情形还要配合「二分定位」找出该换哪两块，并对两个子问题递归，总移动次数 O(n log n)",
        msg4: "好处：辅助空间从 O(n) 降到 O(1)；代价：元素移动次数变多 —— 典型的以时间换空间" });

    /* s1 / s2 / s3 = 三次反转之后各自的数组（每一份都只用于它那一帧，等价于快照）。 */
    var s1 = rev(A0, 1, 2);
    snap("第 1 次反转：把左块 [4, 7] 就地反转 → <b>[7, 4]</b>，数组变成 [" + s1.join(", ") + "]。",
      { phase: "inplace", arr: s1, colors: ["", "--brand", "--brand", "--accent", "--accent", ""],
        rings: (function () { var o = {}; o[1] = "compare"; o[2] = "compare"; return o; })(),
        hl: [1, 2],
        revLabel: "① reverse [4, 7] → [7, 4]",
        msg1: "手摇第 1 步：反转左块（原地两两交换，额外空间 O(1)）",
        msg1Color: "var(--brand)",
        msg2: "现在数组 = [" + s1.join(", ") + "]" });

    var s2 = rev(s1, 3, 4);
    snap("第 2 次反转：把右块 [2, 3] 就地反转 → <b>[3, 2]</b>，数组变成 [" + s2.join(", ") + "]。",
      { phase: "inplace", arr: s2, colors: ["", "--brand", "--brand", "--accent", "--accent", ""],
        rings: (function () { var o = {}; o[3] = "compare"; o[4] = "compare"; return o; })(),
        hl: [3, 4],
        revLabel: "② reverse [2, 3] → [3, 2]",
        msg1: "手摇第 2 步：反转右块",
        msg1Color: "var(--accent)",
        msg2: "现在数组 = [" + s2.join(", ") + "]" });

    var s3 = rev(s2, 1, 4);
    snap("第 3 次反转：把整块 [7, 4, 3, 2] 整体反转 → <b>[2, 3, 4, 7]</b>，数组变成 <b>[" + s3.join(", ") + "]</b> ✅ " +
      "已经整体有序！<br>为什么有效？两次局部反转把两块各自倒了过来，" +
      "整体反转正好把「倒着的右块」和「倒着的左块」接回正序 —— 这就是三反转实现块交换的原理。",
      { phase: "inplace", arr: s3, colors: ["", "--ok", "--ok", "--ok", "--ok", ""],
        rings: (function () { var o = {}; o[1] = "warn"; o[2] = "warn"; o[3] = "warn"; o[4] = "warn"; return o; })(),
        hl: [1, 2, 3, 4],
        revLabel: "③ reverse 整体 [7, 4, 3, 2] → [2, 3, 4, 7]",
        revColor: "var(--ok)",
        msg1: "手摇第 3 步：整体反转 → A = [" + s3.join(", ") + "]，归并完成",
        msg1Color: "var(--ok)",
        msg2: "空间 O(1)（只用一个临时变量做交换），代价是移动了 2 × (2 + 2) = 8 次元素",
        msg3: "本例恰好一次手摇就到位；一般情形需要「二分定位 + 反复手摇」递归进行" });

    /* ---------- k 路归并与败者树 ---------- */
    /* runs1 = k = 4 个归并段（外排序里的 run），每段是一个递增数组；画面上只取它们的段首。 */
    var runs1 = [[1, 5], [2, 6], [3, 7], [4, 8]];
    snap("把 2 路推广到 <b>k 路归并</b>：外排序里内存装不下全部数据，" +
      "我们只能把 k 个有序段（归并段 run）的<b>当前首元素</b>同时拿在内存里，反复取其中最小的输出。" +
      "<b>k 越大，归并趟数 S = ⌈log_k m⌉ 越少，磁盘 I/O 越省</b> —— 这是外排序要用 k 路的唯一理由。<br>" +
      "但天下没有免费的午餐：每输出一个元素，都要做一次「从 k 个段首里挑最小」。",
      { phase: "kway", runs: runs1,
        treeMsg: "k = 4：朴素扫描要 k − 1 = 3 次比较才能选出一个最小值",
        msg1: "k 路归并的每一轮都要「k 选 1」，朴素做法是线性扫描 k 个候选 → 每次 O(k)",
        msg1Color: "var(--brand)",
        msg2: "n 个元素总共 O(nk) 次比较；k = 100 时这部分内部开销会盖过 I/O 带来的收益",
        msg3: "所以需要一个「从 k 个候选里 O(log k) 取最小」的结构 —— 胜者树 / 败者树",
        msg4: "看右上：4 个段首 1、2、3、4，扫描比较 3 次才选出 1；下一个元素又要重新扫 3 次" });

    /* runs2 = 段 1 的段首 1 被取走之后的同一组归并段（它露出了下一个元素 5）。 */
    var runs2 = [[5], [2, 6], [3, 7], [4, 8]];
    snap("换成<b>胜者树</b>：把 4 个段首放到 4 个叶子上，内部结点记下每场比赛的胜者。" +
      "取走最小值（段 1 的 1）之后，只需要<b>沿它走过的路径重赛</b>：" +
      "4 个叶子 → 树高 ⌈log₂4⌉ = <b>2</b>，所以每次更新只要 <b>2</b> 次比较，而不是重新扫描 3 次。" +
      "本例里段 1 输出后露出了它的下一个元素 5，此时全局最小变成段 2 的段首 2。",
      { phase: "kway", runs: runs2,
        treeMsg: "胜者树：树高 ⌈log₂4⌉ = 2 → 每次重赛 2 次比较（线性扫描要 3 次）",
        msg1: "胜者树 / 败者树：把「选最小」从 O(k) 降到 O(log k)",
        msg1Color: "var(--ok)",
        msg2: "败者树是胜者树的改良版：内部结点记「败者」、父亲结点记「胜者」，重赛时少一次访存",
        msg3: "总比较次数 = 建树 (k − 1) + 每次重赛 ⌈log₂k⌉ ≈ (k − 1) + n⌈log₂k⌉ = O(n log k)" });

    snap("把这条线串起来：<b>2-路归并</b>单趟 O(n)（但要 O(n) 辅助空间）→ " +
      "<b>原地归并（手摇）</b>把空间压到 O(1)（代价是更多元素移动）→ " +
      "<b>k 路归并 + 胜者树 / 败者树</b>把「k 选 1」从 O(k) 压到 O(log k)，" +
      "于是外排序可以用很大的 k 来减少磁盘 I/O 的趟数。<br>" +
      "考试里最常考的三句话：<b>归并单趟 O(n)</b>、<b>归并排序总共 O(n log n) 且稳定</b>、" +
      "<b>败者树每次调整 ⌈log₂k⌉ 次比较</b>。",
      { phase: "kway", runs: runs2,
        treeMsg: "下一节 12.6.3 会专门讲胜者树与败者树的结构与重赛过程",
        msg1: "归并这条线的三个方向：更大（k 路，省 I/O）、更省空间（原地手摇）、更快选最小（败者树）",
        msg1Color: "var(--brand)",
        msg2: "归并排序：O(n log n) 时间、O(n) 空间、稳定 —— 这是它的招牌",
        msg2Color: "var(--ok)",
        msg3: "外部排序总 I/O = 2n·⌈log_k m⌉：k 在底数上，所以加大 k 的收益是对数级的",
        msg4: "但 k 受内存限制（k 个输入缓冲区 + 1 个输出缓冲区），这正是败者树要解决的问题",
        msg5: "口诀：归并看趟数、趟数看 k、而 k 选 1 看败者树" });

    new DS.Viz(host, {
      title: "2-路归并 / 原地归并（手摇算法）/ k 路归并与败者树",
      sub: "A = [1, 4, 7 | 2, 3, 9]　标准归并 O(n) 空间 vs 手摇三反转 O(1) 空间",
      build: function () { return { frames: frames }; }
    });
  })();

})();
