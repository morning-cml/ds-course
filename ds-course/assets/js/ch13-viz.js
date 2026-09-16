/* ==========================================================================
   ch12-viz.js —— 算法设计范式与动态规划 · 交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG
   包含 9 个演示：
     1) viz-paradigm-map    六范式选择决策流程
     2) viz-nqueen          N 皇后回溯搜索（冲突标红、回溯退格）
     3) viz-permutation     全排列回溯生成（排列树）
     4) viz-knapsack01      01 背包二维 dp 表逐格填表（含倒序说明）
     5) viz-knapsack-full   完全背包 vs 01 背包的一维数组对比
     6) viz-lis             LIS 的 O(n log n) tails[] 二分更新
     7) viz-lcs             LCS 二维 dp 表填表 + 回溯出公共子序列
     8) viz-stone-merge     区间 DP（石子合并）按区间长度填表
     9) viz-tsp-dp          状压 DP 解 TSP
   ========================================================================== */
(function () {
  "use strict";
  var SVG = DS.SVG;

  /* ======================= 通用小工具 ======================= */

  /* 把数组内容画成一行格子；cell 为 {text, cls} 数组 */
  function row(s, x, y, cw, ch, cells, opt) {
    opt = opt || {};
    var gap = opt.gap === undefined ? 2 : opt.gap;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i] || {};
      s.appendChild(SVG.box(x + i * (cw + gap), y, cw, ch, c.cls || "",
        c.text === undefined ? "" : c.text,
        /active|done|warn|compare/.test(c.cls || "") ? "on" : ""));
    }
  }

  /* 画一个带行/列标题的 DP 表格，返回 svg
     opt = {
       cols: [ '0','1',... ],                 // 列标题
       rowHead: [ '0','1：w=2,v=3', ... ],    // 行标题（可为 null）
       cell: function (i, j) -> {text, cls},  // i 从 0 = 第一行数据
       cw, ch, corner                            // 尺寸
     } */
  function dpTable(s, w, opt) {
    var cw = opt.cw || 40, ch = opt.ch || 26, gap = 2;
    var x0 = opt.x0 || 96, y0 = opt.y0 || 28;
    var cols = opt.cols, rowHead = opt.rowHead || [];
    var svg = s.svg(w, y0 + (rowHead.length + 1) * (ch + gap) + (opt.h || 30));

    /* 列标题 */
    svg.appendChild(SVG.label(x0 - 10, y0 + ch / 2 + 4, opt.corner || "i \\ j", "end"));
    for (var j = 0; j < cols.length; j++) {
      var t = SVG.label(x0 + j * (cw + gap) + cw / 2, y0 + ch / 2 + 4, cols[j], "middle");
      svg.appendChild(t);
    }
    /* 行 */
    for (var i = 0; i < rowHead.length; i++) {
      var y = y0 + (i + 1) * (ch + gap);
      svg.appendChild(SVG.label(x0 - 10, y + ch / 2 + 4, rowHead[i], "end"));
      for (var k = 0; k < cols.length; k++) {
        var c = opt.cell(i, k) || {};
        svg.appendChild(SVG.box(x0 + k * (cw + gap), y, cw, ch, c.cls || "",
          c.text === undefined ? "" : c.text,
          /active|done|warn|compare/.test(c.cls || "") ? "on" : ""));
      }
    }
    return svg;
  }

  /* ==========================================================================
     1) 六范式选择决策流程
     ========================================================================== */
  (function paradigmMap() {
    var host = document.getElementById("viz-paradigm-map");
    if (!host) return;

    /* 每个结点：{id, x, y, w, h, title, sub, cls} */
    var NODES = [
      { id: "start", x: 300, y: 20, w: 220, h: 44, title: "拿到一个问题",
        sub: "解空间有多大？子问题重叠吗？", cls: "active" },
      { id: "small", x: 60, y: 106, w: 200, h: 46, title: "n ≤ 20 且要全部解？",
        sub: "解空间可枚举", cls: "done" },
      { id: "div", x: 300, y: 106, w: 200, h: 46, title: "能拆成独立子问题？",
        sub: "子问题互不重叠", cls: "active" },
      { id: "greedy", x: 540, y: 106, w: 200, h: 46, title: "每步能拍板且可证明？",
        sub: "贪心选择性质", cls: "compare" },
      { id: "back", x: 60, y: 196, w: 200, h: 46, title: "回溯法（DFS + 剪枝）",
        sub: "子集树 2ⁿ / 排列树 n!", cls: "done" },
      { id: "dc", x: 300, y: 196, w: 200, h: 46, title: "分治法",
        sub: "划分 → 解决 → 合并", cls: "active" },
      { id: "gr", x: 540, y: 196, w: 200, h: 46, title: "贪心法",
        sub: "O(n log n)，须证明", cls: "compare" },
      { id: "overlap", x: 60, y: 286, w: 200, h: 46, title: "子问题重叠？",
        sub: "同一状态被反复求解", cls: "warn" },
      { id: "bb", x: 300, y: 286, w: 200, h: 46, title: "分支限界法",
        sub: "BFS + 界剪枝，求最优解", cls: "dim" },
      { id: "dp", x: 60, y: 366, w: 200, h: 46, title: "动态规划",
        sub: "状态 + 转移方程 + 填表", cls: "warn" },
      { id: "brute", x: 300, y: 366, w: 200, h: 46, title: "暴力枚举兜底",
        sub: "先拿部分分，再想优化", cls: "dim" },
      { id: "memo", x: 60, y: 446, w: 200, h: 46, title: "记忆化搜索 → 递推",
        sub: "O(2ⁿ) 降到 O(状态数)", cls: "warn" }
    ];
    var EDGES = [
      ["start", "small", "n 小"], ["start", "div", "想拆"], ["start", "greedy", "想贪"],
      ["small", "back", "要全部解"], ["div", "dc", "不重叠"], ["div", "overlap", "重叠"],
      ["overlap", "dp", "有最优子结构"], ["overlap", "brute", "说不清"],
      ["dp", "memo", "写不出递推"], ["greedy", "gr", "能证明"], ["div", "bb", "只要最优解"]
    ];

    var frames = [];
    function snap(desc, hiNode, hiEdge) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 800, H = 530;
          var svg = s.svg(W, H);
          SVG.defs(svg);

          svg.appendChild(SVG.text(16, 22, "算法设计范式选择流程：从问题出发的四层判断", "vz-text", "start"));

          /* 边 */
          for (var e = 0; e < EDGES.length; e++) {
            var a = null, b = null;
            for (var k = 0; k < NODES.length; k++) {
              if (NODES[k].id === EDGES[e][0]) a = NODES[k];
              if (NODES[k].id === EDGES[e][1]) b = NODES[k];
            }
            var cls = (hiEdge === e) ? "active" : "dim";
            var x1 = a.x + a.w / 2, y1 = a.y + a.h;
            var x2 = b.x + b.w / 2, y2 = b.y;
            var midY = (y1 + y2) / 2;
            svg.appendChild(SVG.path("M" + x1 + "," + y1 + " L" + x1 + "," + midY +
              " L" + x2 + "," + midY + " L" + x2 + "," + (y2 - 3), cls, true));
            if (EDGES[e][2]) {
              var lbl = SVG.label((x1 + x2) / 2, midY - 4, EDGES[e][2], "middle");
              svg.appendChild(lbl);
            }
          }

          /* 结点 */
          for (var n2 = 0; n2 < NODES.length; n2++) {
            var nd = NODES[n2];
            var c2 = nd.cls;
            if (hiNode === nd.id) c2 = "warn";
            svg.appendChild(SVG.box(nd.x, nd.y, nd.w, nd.h, c2, "", ""));
            var t1 = SVG.text(nd.x + nd.w / 2, nd.y + 19, nd.title, "vz-text", "middle");
            t1.setAttribute("font-size", "12.5px");
            if (/active|done|warn|compare/.test(c2)) t1.setAttribute("class", "vz-text on");
            svg.appendChild(t1);
            var t2 = SVG.label(nd.x + nd.w / 2, nd.y + 36, nd.sub, "middle");
            svg.appendChild(t2);
          }

          /* 图例 */
          svg.appendChild(SVG.label(560, 300, "图例", "start"));
          svg.appendChild(SVG.label(560, 322, "蓝 = 分治相关判断", "start"));
          svg.appendChild(SVG.label(560, 342, "绿 = 回溯相关", "start"));
          svg.appendChild(SVG.label(560, 362, "橙 = 贪心相关", "start"));
          svg.appendChild(SVG.label(560, 382, "红 = 当前所在结点", "start"));
          svg.appendChild(SVG.label(560, 412, "一句话总结：", "start"));
          svg.appendChild(SVG.label(560, 432, "回溯 = 暴力 + 剪枝", "start"));
          svg.appendChild(SVG.label(560, 452, "DP = 回溯 + 记忆化 − 冗余", "start"));
          svg.appendChild(SVG.label(560, 472, "贪心 = 每步只留一个状态的 DP", "start"));
          return svg;
        }
      });
    }

    snap("第一步：<b>估计解空间规模</b>。如果 n ≤ 20（能承受 2ⁿ）或 n ≤ 10（能承受 n!），" +
      "而且题目要求输出<b>全部</b>可行解，那就直接用<b>回溯法</b>，把时间花在把代码写对上，" +
      "不要冒险去推一个可能推错的 DP。", "start", -1);
    snap("第二步：如果不能暴力，问自己「<b>这个大问题能不能拆成若干规模更小的同类子问题</b>」。" +
      "如果能拆，再问一句关键的话 —— <b>这些子问题之间重叠吗？</b>" +
      "这是分治与动态规划的分水岭。", "div", 1);
    snap("第三步：如果子问题<b>互不重叠、各自独立</b>（例如归并排序的左半与右半），" +
      "那就是标准的<b>分治法</b>：划分 → 递归求解 → 合并。" +
      "如果只要最优解、且有好的上界/下界函数，也可以考虑<b>分支限界法</b>。", "dc", 4);
    snap("第四步：如果子问题<b>大量重叠</b>（同一个 <code>dp[i][j]</code> 被多条路径反复用到），" +
      "那么分治就会做重复劳动 —— 必须改用<b>动态规划</b>：把重复的状态只算一次，存进表里查。" +
      "<br>判断重叠的方法很简单：<b>把递归树画出来，看有没有两个结点标号相同。</b>", "overlap", 5);
    snap("第五步：DP 的落地方式有两种。<b>记忆化搜索</b>（自顶向下，保留递归 + 加备忘录）" +
      "写起来最接近暴力，只算用得到的状态；<b>递推</b>（自底向上，循环填表）常数更小，" +
      "还能配滚动数组压空间。<br>推荐路径：<b>先用记忆化搜索写出正确版本，再改写成递推优化。</b>", "dp", 6);
    snap("第六步：另一条支线 —— 如果每一步都能选出一个「明显不亏」的局部最优，" +
      "而且你能用<b>交换论证</b>证明它不后悔，那么答案就是<b>贪心法</b>，" +
      "复杂度通常只有一个排序的 <code>O(n log n)</code>。<br>" +
      "<b>但证明不出来就别硬猜</b> —— 0-1 背包、任意面值的找零钱都是贪心翻车的经典案例，" +
      "此时应该退回 DP。", "greedy", 2);
    snap("最后提醒：<b>四个范式不是互斥的，而是可以嵌套的。</b>" +
      "例如「状压 DP」= 状态压缩 + 动态规划；「分支限界」= 回溯 + BFS + 限界函数；" +
      "「记忆化搜索」= 回溯 + DP；「二分答案」= 二分 + 贪心/DP 判定。" +
      "<br>所以真正要练的能力是：<b>看到问题就能说出「它属于哪一类」，然后套对应的模板。</b>", "start", -1);

    new DS.Viz(host, {
      title: "六范式选择决策流程",
      sub: "从问题特征出发，一步步定位到合适的算法范式",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     2) N 皇后 · 回溯搜索全过程
     ========================================================================== */
  (function nqueen() {
    var host = document.getElementById("viz-nqueen");
    if (!host) return;

    var N = 4;
    var frames = [];
    var col = new Array(N + 1).fill(false);
    var dg = new Array(2 * N + 2).fill(false);       // 主对角线 i-j+N
    var udg = new Array(2 * N + 2).fill(false);      // 副对角线 i+j
    var x = new Array(N + 1).fill(0);                // x[i] = 第 i 行皇后所在列
    var solutions = [], nodes = 0;
    var curRow = 1, curCol = 0, conflictList = [];

    function snapshot(desc, hiRow, hiCol, conflictRow, conflictCol, badDiag) {
      var c = col.slice(), d = dg.slice(), u = udg.slice(), xx = x.slice();
      var sols = solutions.slice();
      frames.push({
        desc: desc,
        draw: function (s) {
          var CW = 54, X0 = 74, Y0 = 34;
          var W = X0 + N * CW + 330;
          var H = Y0 + N * CW + 74;
          var svg = s.svg(W, H);

          /* 棋盘 */
          for (var i = 1; i <= N; i++) {
            for (var j = 1; j <= N; j++) {
              var px = X0 + (j - 1) * CW, py = Y0 + (i - 1) * CW;
              var cls = "";
              if (hiRow === i && hiCol === j) cls = "active";
              if (conflictRow === i && conflictCol === j) cls = "warn";
              if (xx[i] === j && cls === "") cls = "done";
              svg.appendChild(SVG.box(px + 1, py + 1, CW - 2, CW - 2, cls, ""));
              if (xx[i] === j) {
                var t = SVG.text(px + CW / 2, py + CW / 2 + 7, "Q", "vz-text on", "middle");
                t.setAttribute("font-size", "20");
                t.setAttribute("font-weight", "700");
                svg.appendChild(t);
              }
              /* 冲突原因标记 */
              if (conflictRow === i && conflictCol === j && badDiag) {
                svg.appendChild(SVG.label(px + CW / 2, py + CW / 2 + 4, "✗", "middle"));
              }
            }
          }
          /* 行列号 */
          for (var k = 1; k <= N; k++) {
            svg.appendChild(SVG.label(X0 + (k - 1) * CW + CW / 2, Y0 - 8, "列" + k, "middle"));
            svg.appendChild(SVG.label(X0 - 10, Y0 + (k - 1) * CW + CW / 2 + 4, "行" + k, "end"));
          }

          /* 右侧状态面板 */
          var SX = X0 + N * CW + 22;
          svg.appendChild(SVG.text(SX, Y0 + 4, "递归状态", "vz-text", "start"));
          svg.appendChild(SVG.label(SX, Y0 + 24, "当前递归深度 i = " + Math.min(curRow, N + 1) +
            "　已访问结点 = " + nodes, "start"));

          svg.appendChild(SVG.label(SX, Y0 + 52, "x[1.." + N + "]（每行皇后所在列）", "start"));
          var xc = [];
          for (var q = 1; q <= N; q++) xc.push({ text: xx[q] === 0 ? "·" : xx[q], cls: xx[q] ? "done" : "dim" });
          row(svg, SX, Y0 + 62, 30, 26, xc);

          svg.appendChild(SVG.label(SX, Y0 + 112, "col[j] 列占用", "start"));
          var cc = [];
          for (var q2 = 1; q2 <= N; q2++) cc.push({ text: c[q2] ? "1" : "0", cls: c[q2] ? "compare" : "" });
          row(svg, SX, Y0 + 122, 30, 24, cc);

          svg.appendChild(SVG.label(SX, Y0 + 168, "dg[i-j+N] 主对角线占用（偏移 N=" + N + "）", "start"));
          var dc = [];
          for (var q3 = 1; q3 <= 2 * N - 1; q3++) dc.push({ text: d[q3] ? "1" : "0", cls: d[q3] ? "compare" : "" });
          row(svg, SX, Y0 + 178, 26, 22, dc);

          svg.appendChild(SVG.label(SX, Y0 + 220, "udg[i+j] 副对角线占用", "start"));
          var uc = [];
          for (var q4 = 2; q4 <= 2 * N; q4++) uc.push({ text: u[q4] ? "1" : "0", cls: u[q4] ? "compare" : "" });
          row(svg, SX, Y0 + 230, 26, 22, uc);

          svg.appendChild(SVG.label(SX, Y0 + 272, "已找到的解：" + sols.length + " 个", "start"));
          for (var z = 0; z < sols.length && z < 4; z++) {
            svg.appendChild(SVG.label(SX, Y0 + 292 + z * 18, "(" + sols[z].slice(1).join(", ") + ")", "start"));
          }
          return svg;
        }
      });
    }

    function occupiedStr(aq, from) {
      var r = [];
      for (var i = from; i < aq.length; i++) if (aq[i]) r.push(i);
      return r.length ? r.join(" ") : "（空）";
    }

    snapshot("回溯法求解 <b>" + N + " 皇后</b>：棋盘 " + N + "×" + N + "，要求任意两个皇后<b>不同行、不同列、不同对角线</b>。" +
      "策略是<b>按行放置</b>：第 i 行选一个列号 x[i]，逐行递归下去。先看初始状态——三个布尔数组全为 0。", 0, 0, 0, 0, false);

    function dfs(i) {
      nodes++;
      curRow = i; curCol = 0;
      if (i > N) {
        solutions.push(x.slice());
        snapshot("<b>找到一个解！</b>x = (" + x.slice(1).join(", ") + ") —— " +
          "每行一个皇后，且两两不同列、不同对角线。加入解集后<b>回溯</b>，继续搜索其他分支。", 0, 0, 0, 0, false);
        return;
      }
      for (var j = 1; j <= N; j++) {
        curRow = i; curCol = j;
        var cBad = col[j], dBad = dg[i - j + N], uBad = udg[i + j];
        if (cBad || dBad || uBad) {
          var why = [];
          if (cBad) why.push("第 " + j + " 列已被占用");
          if (dBad) why.push("主对角线 i−j+" + N + " = " + (i - j + N) + " 已被占用");
          if (uBad) why.push("副对角线 i+j = " + (i + j) + " 已被占用");
          snapshot("<b>冲突！</b>尝试在第 " + i + " 行第 " + j + " 列放皇后，但 " + why.join("；") +
            "。<br>约束函数返回 false → <b>剪掉这个分支</b>，直接试下一列（不需要再往下一行递归）。" +
            "<br><span style='color:var(--danger)'>红色格就是被拒绝的位置</span>，累计访问结点 " + nodes + " 个。",
            i, j, i, j, true);
          continue;
        }
        /* 合法：做选择 */
        x[i] = j; col[j] = dg[i - j + N] = udg[i + j] = true;
        snapshot("第 " + i + " 行第 " + j + " 列<b>可以放置</b>（列、两条对角线都没被占用）。" +
          "① 做选择：x[" + i + "] = " + j + "，并把 col[" + j + "]、dg[" + (i - j + N) + "]、udg[" + (i + j) + "] 都置为 1；" +
          "② 递归到第 " + (i + 1) + " 行。<br>当前已放置：" + occupiedStr(x.slice(1), 0),
          i, j, 0, 0, false);
        dfs(i + 1);
        /* 撤销选择 */
        col[j] = dg[i - j + N] = udg[i + j] = false;
        x[i] = 0;
        curRow = i; curCol = j;
        snapshot("<b>回溯：</b>第 " + i + " 行第 " + j + " 列的分支已经搜完（无论成功还是失败），" +
          "③ 撤销选择 —— 把 col[" + j + "]、dg[" + (i - j + N) + "]、udg[" + (i + j) + "] 恢复为 0，x[" + i + "] 清空，" +
          "然后换下一个列号继续试。<br>这就是「<b>做选择 → 递归 → 撤销选择</b>」的完整闭环。",
          i, j, 0, 0, false);
      }
    }

    dfs(1);

    snapshot("<b>搜索结束。</b>" + N + " 皇后共有 <b>" + solutions.length + " 个解</b>（互为左右镜像），" +
      "整个搜索过程只访问了 " + nodes + " 个结点。<br>对比一下：不加任何剪枝的话，" +
      "解空间树的结点总数是 1+" + N + "+" + (N * N) + "+…+" + Math.pow(N, N) + " = " +
      (function () { var t = 0, p = 1; for (var k = 0; k <= N; k++) { t += p; p *= N; } return t; })() +
      " 个 —— 剪枝把搜索量砍掉了绝大多数。<br>但要注意：<b>剪枝不改变最坏复杂度</b>，" +
      "回溯法求 N 皇后的最坏复杂度仍然是 <b>O(n!)</b> 量级。", 0, 0, 0, 0, false);

    new DS.Viz(host, {
      title: N + " 皇后 · 回溯搜索全过程",
      sub: "棋盘 " + N + "×" + N + "　按行放置 + O(1) 冲突判定",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     2) 全排列 · 排列树回溯生成
     ========================================================================== */
  (function permutation() {
    var host = document.getElementById("viz-permutation");
    if (!host) return;

    var A = [1, 2, 3];
    var n = A.length;
    var used = new Array(n).fill(false);
    var cur = [];
    var results = [];
    var frames = [];
    var nodes = 0;
    var curLevel = 0, curTry = -1, tried = [];

    function snap(desc, level, tryIdx, tryList) {
      var uu = used.slice(), cu = cur.slice(), rs = results.slice();
      var tr = tryList ? tryList.slice() : [];
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 880, H = 330;
          var svg = s.svg(W, H);

          /* 顶部：原始数组 */
          svg.appendChild(SVG.label(16, 24, "原数组 A", "start"));
          row(svg, 80, 8, 40, 30, A.map(function (v) { return { text: v }; }));

          /* 排列树：三层 */
          var levelX = [90, 260, 430];
          for (var L = 0; L < n; L++) {
            svg.appendChild(SVG.label(levelX[L] + 60, 70, "第 " + (L + 1) + " 层（选第 " + (L + 1) + " 位）", "middle"));
          }
          /* 连线：3 层 → 用一个抽象的树来表示"已做的选择序列" */
          svg.appendChild(SVG.line(levelX[0] + 60, 92, levelX[1] + 60, 92, "dim"));
          svg.appendChild(SVG.line(levelX[1] + 60, 92, levelX[2] + 60, 92, "dim"));

          for (var L2 = 0; L2 < n; L2++) {
            var y = 100;
            var cells = [];
            for (var k = 0; k < n; k++) {
              var cls = "";
              if (L2 < cu.length) {
                cls = (cu[L2] === A[k]) ? "done" : "dim";
              } else if (L2 === level && k === tryIdx) {
                cls = "compare";
              } else if (uu[k]) {
                cls = "dim";
              }
              cells.push({ text: A[k], cls: cls });
            }
            row(svg, levelX[L2], y, 40, 30, cells);
            if (L2 === level) {
              var tri = SVG.path("M" + (levelX[L2] + 60) + "," + (y + 44) + " l-7,-10 l14,0 z", "", false);
              tri.setAttribute("fill", "var(--accent)");
              tri.setAttribute("stroke", "none");
              svg.appendChild(tri);
              svg.appendChild(SVG.label(levelX[L2] + 60, y + 62, "当前层", "middle"));
            }
          }

          /* 已生成的部分排列 */
          svg.appendChild(SVG.label(16, 200, "当前部分排列 cur", "start"));
          var cc = [];
          for (var q = 0; q < n; q++) cc.push({ text: q < cu.length ? cu[q] : "·", cls: q < cu.length ? "done" : "dim" });
          row(svg, 170, 184, 40, 30, cc);

          /* used 数组 */
          svg.appendChild(SVG.label(16, 244, "used[]（已使用标记）", "start"));
          var uc = [];
          for (var q2 = 0; q2 < n; q2++) uc.push({ text: uu[q2] ? "1" : "0", cls: uu[q2] ? "compare" : "" });
          row(svg, 170, 228, 40, 30, uc);
          for (var q3 = 0; q3 < n; q3++) {
            svg.appendChild(SVG.label(190 + q3 * 42, 274, "A[" + q3 + "]=" + A[q3], "middle"));
          }

          /* 已生成的排列 */
          svg.appendChild(SVG.label(400, 200, "已生成的全排列（共 " + rs.length + " / 6 个）", "start"));
          for (var r = 0; r < rs.length; r++) {
            var col = r % 3, rw = Math.floor(r / 3);
            svg.appendChild(SVG.box(400 + col * 92, 210 + rw * 40, 82, 30, "done", rs[r].join(" "), "on"));
          }

          /* 统计 */
          svg.appendChild(SVG.label(16, 306, "递归结点数 = " + nodes + "　（n! = 6 个叶子；交换法与选择法结点数相同）", "start"));
          svg.appendChild(SVG.label(400, 306, tr.length ? "本层尝试过的选择：" + tr.join(" → ") : "", "start"));
          return svg;
        }
      });
    }

    snap("目标：生成 {1, 2, 3} 的<b>全部 " + n + "! = 6 个排列</b>。这里用<b>选择法</b>（配 used 数组）：" +
      "每一层从未使用的元素里挑一个，放在当前位；放完第 n 位就得到一个完整排列。", 0, -1, []);

    function dfs(level) {
      nodes++;
      curLevel = level;
      if (level === n) {
        results.push(cur.slice());
        snap("<b>得到一个完整排列：</b>" + cur.join(" ") + "（第 " + results.length + " 个）。" +
          "此时递归到达第 n+1 层 —— 也就是排列树的一个<b>叶子</b>。记录答案后回溯。", level, -1, []);
        return;
      }
      var triedHere = [];
      for (var i = 0; i < n; i++) {
        if (used[i]) continue;
        triedHere.push(A[i]);
        curTry = i;
        snap("第 " + (level + 1) + " 位尝试放入 A[" + i + "] = " + A[i] + "（used[" + i + "] = false，还没被用过）。" +
          "① 做选择：used[" + i + "] = true，cur 追加 " + A[i] + "；② 递归到下一层。", level, i, triedHere);
        used[i] = true;
        cur.push(A[i]);
        dfs(level + 1);
        cur.pop();
        used[i] = false;
        snap("③ <b>撤销选择</b>：从 cur 中弹出 " + A[i] + "，把 used[" + i + "] 改回 false —— " +
          "这样别的分支才能再次使用这个元素。<br>本题已经尝试过的选择：" + triedHere.join(" → ") +
          "；本层一共要试 " + (n - level) + " 个还没用过的元素。", level, i, triedHere);
      }
    }

    dfs(0);

    snap("全部 " + results.length + " 个排列生成完毕，顺序正好是<b>字典序</b>（因为我们按 A 的下标从小到大尝试）。" +
      "<br>另一种写法是<b>交换法</b>：<code>swap(a[t], a[i])</code> 之后再 <code>swap</code> 回来，" +
      "不需要 used 数组，但输出顺序不是字典序。<br>两种写法访问的结点数都是 " + nodes +
      " 个 —— 因为它本来就是同一棵排列树。", 0, -1, []);

    new DS.Viz(host, {
      title: "全排列 · 排列树回溯生成",
      sub: "A = {1,2,3}　选择法（used 数组）",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     3) 01 背包 · 二维 dp 表逐格填表
     ========================================================================== */
  (function knapsack01() {
    var host = document.getElementById("viz-knapsack01");
    if (!host) return;

    var n = 4, V = 8;
    var w = [0, 2, 3, 4, 5];
    var v = [0, 3, 4, 5, 6];

    /* 先算出完整的二维 dp 表（正确值） */
    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Array(V + 1).fill(0));
    for (var i2 = 1; i2 <= n; i2++)
      for (var j2 = 0; j2 <= V; j2++) {
        dp[i2][j2] = dp[i2 - 1][j2];
        if (j2 >= w[i2]) dp[i2][j2] = Math.max(dp[i2][j2], dp[i2 - 1][j2 - w[i2]] + v[i2]);
      }

    var frames = [];
    var cols = [];
    for (var c = 0; c <= V; c++) cols.push(String(c));
    var rowHead = ["i=0 无物品"];
    for (var r = 1; r <= n; r++) rowHead.push("i=" + r + " (w=" + w[r] + ",v=" + v[r] + ")");

    /* 每帧只显示"已经算到"的格子 */
    function snap(desc, uptoRow, uptoCol, hiRow, hiCol, srcRow, srcCol, extra) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 900;
          var svg = dpTable(s, W, {
            cols: cols, rowHead: rowHead, x0: 130, y0: 34, cw: 40, ch: 26, h: 120,
            corner: "i \\ j",
            cell: function (ri, cj) {
              /* ri 是数据行下标：0 对应 i=0 */
              var ii = ri;
              if (ii === 0) {
                if (cj > uptoCol || uptoRow < 0) return { text: "", cls: "dim" };
                return { text: "0", cls: "dim" };
              }
              if (ii > uptoRow || (ii === uptoRow && cj > uptoCol)) return { text: "", cls: "dim" };
              var cls = "";
              var val = dp[ii][cj];
              if (ii === hiRow && cj === hiCol) cls = "active";
              if (ii === srcRow && cj === srcCol) cls = "done";
              return { text: String(val), cls: cls };
            }
          });
          /* 右侧说明 */
          var SX = 130 + (V + 1) * 42 + 18;
          svg.appendChild(SVG.text(SX, 46, "01 背包 · 一维滚动数组", "vz-text", "start"));
          svg.appendChild(SVG.label(SX, 68, "for i = 1..n", "start"));
          svg.appendChild(SVG.label(SX, 86, "  for j = V down to w[i]", "start"));
          svg.appendChild(SVG.label(SX, 104, "    dp[j] = max(dp[j], dp[j-w]+v)", "start"));
          svg.appendChild(SVG.label(SX, 132, "容量必须【倒序】！因为 dp[j-w[i]]", "start"));
          svg.appendChild(SVG.label(SX, 150, "必须还是上一层 i-1 的旧值。", "start"));
          svg.appendChild(SVG.label(SX, 178, "绿色 = 转移来源（上一层）", "start"));
          svg.appendChild(SVG.label(SX, 196, "蓝色 = 当前正在填的格子", "start"));
          if (extra) {
            svg.appendChild(SVG.label(SX, 228, extra[0], "start"));
            svg.appendChild(SVG.label(SX, 246, extra[1] || "", "start"));
          }
          return svg;
        }
      });
    }

    snap("01 背包的 dp 表：行 = 前 i 件物品，列 = 容量 j。<b>dp[i][j] = 只考虑前 i 件、容量 j 时的最大价值</b>。" +
      "物品：①(2,3)　②(3,4)　③(4,5)　④(5,6)，容量 V = 8。<br>" +
      "第 0 行表示「一件都不选」，所以全是 0 —— 这就是<b>边界</b>。", -1, -1, -1, -1, -1, -1);

    for (var i3 = 1; i3 <= n; i3++) {
      for (var j3 = 0; j3 <= V; j3++) {
        var noTake = dp[i3 - 1][j3];
        var take = (j3 >= w[i3]) ? dp[i3 - 1][j3 - w[i3]] + v[i3] : -1;
        var chosen = (take > noTake) ? "选" : "不选";
        var desc;
        if (j3 < w[i3]) {
          desc = "填 <b>dp[" + i3 + "][" + j3 + "]</b>：容量 " + j3 + " &lt; w[" + i3 + "] = " + w[i3] +
            "，第 " + i3 + " 件<b>装不下</b>，只能不选 → dp[" + i3 + "][" + j3 + "] = dp[" + (i3 - 1) + "][" + j3 + "] = <b>" +
            dp[i3][j3] + "</b>。";
        } else {
          desc = "填 <b>dp[" + i3 + "][" + j3 + "]</b>：① 不选第 " + i3 + " 件 → dp[" + (i3 - 1) + "][" + j3 + "] = " + noTake +
            "；② 选第 " + i3 + " 件 → dp[" + (i3 - 1) + "][" + (j3 - w[i3]) + "] + " + v[i3] + " = " + take +
            "。<br>取较大者 → <b>" + dp[i3][j3] + "</b>（" + chosen + "第 " + i3 + " 件）。";
        }
        snap(desc, i3, j3, i3, j3, i3 - 1, j3 >= w[i3] ? j3 - w[i3] : j3,
          ["当前物品 i=" + i3 + "（w=" + w[i3] + ", v=" + v[i3] + "）", "当前容量 j=" + j3]);
      }
    }

    snap("<b>全部填完，答案 = dp[" + n + "][" + V + "] = " + dp[n][V] + "</b>。" +
      "最优方案：物品②(3,4) + 物品④(5,6)，总重 3+5=8 恰好装满，总价值 4+6=10。<br>" +
      "还原方案的方法：从 dp[n][V] 往回走 —— 若 <b>dp[i][j] == dp[i-1][j-w[i]] + v[i]</b>，" +
      "说明第 i 件被选了，于是令 j -= w[i] 并继续考察 i-1；否则说明没选。<br>" +
      "空间优化：由于 dp[i][*] 只依赖 dp[i-1][*]，可以把二维压成一维，" +
      "但<b>容量必须倒序枚举</b>，否则 dp[j-w[i]] 会用到本轮已更新的新值，语义就变成了完全背包。",
      n, V, n, V, n - 1, V - w[n], ["答案 dp[4][8] = 10", "试试把循环方向改成正序会发生什么"]);

    new DS.Viz(host, {
      title: "01 背包 · dp 表逐格填表",
      sub: "物品 ①(2,3) ②(3,4) ③(4,5) ④(5,6)　V = 8",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     4) 完全背包 vs 01 背包 · 一维数组循环方向对比
     ========================================================================== */
  (function knapsackFull() {
    var host = document.getElementById("viz-knapsack-full");
    if (!host) return;

    var V = 8;
    var w = [0, 2, 3, 4, 5];
    var v = [0, 3, 4, 5, 6];
    var n = 4;

    var frames = [];

    /* 一维数组状态：f01（倒序）与 fFull（正序），都从全 0 开始 */
    var f01 = new Array(V + 1).fill(0);
    var fFull = new Array(V + 1).fill(0);
    var cur01 = [-1, -1], curFull = [-1, -1];

    function mk(desc, item, j01, jFull, note) {
      var a = f01.slice(), b = fFull.slice();
      var c01 = cur01.slice(), cFull = curFull.slice();
      var it = item;
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 900, H = 300;
          var svg = s.svg(W, H);
          var CW = 62, GAP = 6;

          svg.appendChild(SVG.text(16, 24, "同一组物品、同一个容量范围，只差一个循环方向",
            "vz-text", "start"));
          svg.appendChild(SVG.label(16, 44, "物品：" + [1, 2, 3, 4].map(function (k) {
            return "(" + w[k] + "," + v[k] + ")";
          }).join("  ") + "　当前处理第 " + Math.max(it, 0) + " 件", "start"));

          /* 01 背包（倒序） */
          svg.appendChild(SVG.text(16, 84, "01 背包（每件最多一次）　容量【倒序】j = 8 → 2",
            "vz-text", "start"));
          var cells1 = [];
          for (var j = 0; j <= V; j++) {
            var cls = "";
            if (j === c01[0]) cls = "compare";
            if (j === c01[1]) cls = "done";
            cells1.push({ text: String(a[j]), cls: cls });
          }
          row(svg, 16, 94, CW, 30, cells1);
          for (var j2 = 0; j2 <= V; j2++)
            svg.appendChild(SVG.label(16 + j2 * (CW + GAP) + CW / 2, 140, "j=" + j2, "middle"));

          /* 完全背包（正序） */
          svg.appendChild(SVG.text(16, 186, "完全背包（每件无限件）　容量【正序】j = 2 → 8",
            "vz-text", "start"));
          var cells2 = [];
          for (var k = 0; k <= V; k++) {
            var cls2 = "";
            if (k === cFull[0]) cls2 = "compare";
            if (k === cFull[1]) cls2 = "done";
            cells2.push({ text: String(b[k]), cls: cls2 });
          }
          row(svg, 16, 196, CW, 30, cells2);
          for (var k2 = 0; k2 <= V; k2++)
            svg.appendChild(SVG.label(16 + k2 * (CW + GAP) + CW / 2, 242, "j=" + k2, "middle"));

          /* 说明 */
          svg.appendChild(SVG.label(16, 276, note || "", "start"));
          svg.appendChild(SVG.label(16, 294,
            "橙色 = 本轮正在更新的位置　绿色 = 它读取的 dp[j-w[i]] 位置（两边颜色含义相同，但读到的「新旧」不同）",
            "start"));
          return svg;
        }
      });
    }

    mk("先看两个数组的初值：都是全 0，表示「一件物品都没考虑时，任何容量的价值都是 0」。" +
      "接下来从第 1 件物品 (w=2, v=3) 开始，左边按倒序更新、右边按正序更新，请对比最终结果。",
      0, -1, -1, "初始状态：f01 = fFull = [0,0,0,0,0,0,0,0,0]");

    for (var i = 1; i <= n; i++) {
      mk("处理第 " + i + " 件物品 (w=" + w[i] + ", v=" + v[i] + ")。" +
        "两个数组用的是完全相同的转移式 <code>f[j] = max(f[j], f[j-" + w[i] + "] + " + v[i] + ")</code>，" +
        "唯一区别是 j 的枚举方向。", i, -1, -1,
        "开始处理物品 " + i + "：两侧的 f 数组现在完全相同");

      /* 倒序：01 背包 */
      for (var j = V; j >= w[i]; j--) {
        var old = f01[j - w[i]];
        var nv = Math.max(f01[j], old + v[i]);
        var changed = nv !== f01[j];
        f01[j] = nv;
        cur01 = [j, j - w[i]];
        mk("① <b>01 背包倒序</b>：算 f[" + j + "] = max(f[" + j + "]=" + (changed ? nv : f01[j]) +
          ", f[" + (j - w[i]) + "]+" + v[i] + "=" + (old + v[i]) + ") = <b>" + nv + "</b>。" +
          "读到的 f[" + (j - w[i]) + "] = " + old + " 是<b>上一层的旧值</b>（因为下标更小的位置本轮还没轮到），" +
          "所以第 " + i + " 件物品只会被用一次 ✓",
          i, j, -1, changed ? "本次更新让 f[" + j + "] 从 " + (nv === old + v[i] ? f01[j] : nv) + " 变为 " + nv : "本次 f[" + j + "] 不变");
      }

      /* 正序：完全背包 */
      for (var jj = w[i]; jj <= V; jj++) {
        var old2 = fFull[jj - w[i]];
        var nv2 = Math.max(fFull[jj], old2 + v[i]);
        fFull[jj] = nv2;
        curFull = [jj, jj - w[i]];
        mk("② <b>完全背包正序</b>：算 f[" + jj + "] = max(f[" + jj + "], f[" + (jj - w[i]) + "]+" + v[i] +
          ") = <b>" + nv2 + "</b>。读到的 f[" + (jj - w[i]) + "] = " + old2 +
          " 是<b>本层刚更新过的新值</b>（正序时下标更小的位置已经算完了），" +
          "于是相当于「第 " + i + " 件物品可以再选一次」→ 无限件 ✓",
          i, -1, jj, "注意：右边读到的新值可能已经包含了一件物品 " + i);
      }

      mk("第 " + i + " 件处理完毕。左边（01）与右边（完全）的数值开始出现差异 —— " +
        "差异的根源就是<b>「读到的是旧值还是新值」</b>。",
        i, -1, -1, "此时 f01[8] = " + f01[8] + "，fFull[8] = " + fFull[8]);
    }

    mk("<b>结论：</b>01 背包最终最优值 = <b>" + f01[V] + "</b>（容量倒序），" +
      "完全背包最终最优值 = <b>" + fFull[V] + "</b>（容量正序）。" +
      "<br>完全背包的 " + fFull[V] + " 来自「四件物品 ①(w=2,v=3)」，总重 8 恰好装满；" +
      "01 背包只能是「②+④」= 4+6 = 10。<br>" +
      "再强调一遍：<b>01 背包容量必须倒序，完全背包容量必须正序，只差一个循环方向，语义天差地别。</b>" +
      "如果 01 背包写成正序，答案会偏大（本例会变成 " + (function () {
        var f = new Array(V + 1).fill(0);
        for (var q = 1; q <= n; q++) for (var p = w[q]; p <= V; p++) f[p] = Math.max(f[p], f[p - w[q]] + v[q]);
        return f[V];
      })() + "，即完全背包的答案）。",
      n, -1, -1, "01 背包 = " + f01[V] + "　完全背包 = " + fFull[V]);

    new DS.Viz(host, {
      title: "01 背包 vs 完全背包 · 循环方向对比",
      sub: "倒序 = 用旧值（每件一次）　正序 = 用新值（每件无限）",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     5) LIS · O(n log n) 的 tails[] 二分更新
     ========================================================================== */
  (function lis() {
    var host = document.getElementById("viz-lis");
    if (!host) return;

    var A = [10, 9, 2, 5, 3, 7, 101, 18];
    var n = A.length;
    var tails = [];
    var frames = [];

    function snap(desc, curIdx, lo, hi, mid, action) {
      var tt = tails.slice(), ci = curIdx, l = lo, h = hi, m = mid, ac = action;
      var arr = A.slice();
      frames.push({
        desc: desc,
        draw: function (s) {
          var CW = 46, GAP = 4;
          var W = 60 + n * (CW + GAP) + 20, H = 250;
          var svg = s.svg(W, H);

          /* 原数组 */
          svg.appendChild(SVG.label(14, 34, "A", "start"));
          var cells = [];
          for (var i = 0; i < n; i++) {
            var cls = "";
            if (i < ci) cls = "dim";
            if (i === ci) cls = "active";
            cells.push({ text: arr[i], cls: cls });
          }
          row(svg, 40, 18, CW, 30, cells);
          for (var i2 = 0; i2 < n; i2++)
            svg.appendChild(SVG.label(40 + i2 * (CW + GAP) + CW / 2, 62, String(i2), "middle"));

          /* tails 数组：长度 n 的槽位 */
          svg.appendChild(SVG.label(14, 122, "tails", "start"));
          var tc = [];
          for (var k = 0; k < n; k++) {
            var cls2 = "dim";
            if (k < tt.length) cls2 = "done";
            if (l >= 0 && k >= l && k <= h && k < tt.length) cls2 = "compare";
            if (k === m) cls2 = "active";
            tc.push({ text: k < tt.length ? tt[k] : "·", cls: cls2 });
          }
          row(svg, 40, 106, CW, 30, tc);
          for (var k2 = 0; k2 < n; k2++)
            svg.appendChild(SVG.label(40 + k2 * (CW + GAP) + CW / 2, 150, "len=" + (k2 + 1), "middle"));

          /* 二分指针 */
          if (l >= 0 && h >= 0) {
            svg.appendChild(SVG.line(40 + l * (CW + GAP) + CW / 2, 172, 40 + h * (CW + GAP) + CW / 2, 172,
              "active", true));
            svg.appendChild(SVG.label(40 + l * (CW + GAP) + CW / 2 - 8, 190, "L", "middle"));
            svg.appendChild(SVG.label(40 + h * (CW + GAP) + CW / 2 + 8, 190, "R", "middle"));
          }
          if (m >= 0) {
            var tri = SVG.path("M" + (40 + m * (CW + GAP) + CW / 2) + ",188 l-7,-10 l14,0 z", "", false);
            tri.setAttribute("fill", "var(--accent)");
            tri.setAttribute("stroke", "none");
            svg.appendChild(tri);
            svg.appendChild(SVG.label(40 + m * (CW + GAP) + CW / 2, 204, "mid=" + m, "middle"));
          }

          svg.appendChild(SVG.label(14, 226, "当前 LIS 长度 = " + tt.length +
            "　　" + (ac || ""), "start"));
          svg.appendChild(SVG.label(14, 244,
            "tails[len-1] 的含义：所有长度为 len 的上升子序列中，结尾元素的最小值", "start"));
          return svg;
        }
      });
    }

    snap("LIS 的 <b>O(n log n)</b> 解法。核心是维护数组 <b>tails</b>，其中 " +
      "<code>tails[len-1]</code> = 「所有长度为 len 的上升子序列中，<b>结尾元素的最小值</b>」。" +
      "<br>这个数组一定是<b>严格递增</b>的 —— 所以可以在它上面二分。" +
      "目标是求 A = [" + A.join(", ") + "] 的最长上升子序列长度。", 0, -1, -1, -1, "初始 tails 为空");

    for (var i = 0; i < n; i++) {
      var x = A[i];
      snap("处理 A[" + i + "] = " + x + "：要在 tails 里找<b>第一个 ≥ " + x + "</b> 的位置。" +
        "现在 tails = [" + tails.join(", ") + "]，开始二分。", i, -1, -1, -1, "准备二分");

      var lo = 0, hi = tails.length;      /* [lo, hi) 区间 */
      while (lo < hi) {
        var mid = Math.floor((lo + hi) / 2);
        snap("二分：区间 [" + lo + ", " + hi + ")，mid = " + mid + "，tails[" + mid + "] = " + tails[mid] +
          (tails[mid] < x ? " &lt; " + x + " → 答案在右半，L = mid + 1 = " + (mid + 1)
            : " ≥ " + x + " → mid 可能就是答案，R = mid = " + mid),
          i, lo, hi - 1, mid, "比较 tails[" + mid + "] 与 " + x);
        if (tails[mid] < x) lo = mid + 1; else hi = mid;
      }

      if (lo === tails.length) {
        tails.push(x);
        snap("tails 里所有元素都 &lt; " + x + "（二分区间收缩到末尾），说明 " + x +
          " 可以接在<b>最长的</b>上升子序列后面 → 追加到 tails 末尾，LIS 长度 +1，变成 " + tails.length + "。",
          i, -1, -1, -1, "tails = [" + tails.join(", ") + "]");
      } else {
        var oldV = tails[lo];
        tails[lo] = x;
        snap("二分结束，第一个 ≥ " + x + " 的位置是下标 " + lo + "（原值 " + oldV + "）。" +
          "把 tails[" + lo + "] 替换成 " + x + " —— 注意<b>长度没变</b>，" +
          "但「长度为 " + (lo + 1) + " 的上升子序列的最小结尾」变小了，" +
          "意味着后面更容易接上新的元素（更有潜力）。",
          i, -1, -1, -1, "tails = [" + tails.join(", ") + "]");
      }
    }

    snap("<b>LIS 长度 = " + tails.length + "</b>，最终的 tails = [" + tails.join(", ") + "]。" +
      "<br>每一步要么追加（长度 +1），要么替换（长度不变），所以总时间 = n 次二分 = <b>O(n log n)</b>，" +
      "空间 O(n)。<br>⚠️ 注意：<b>tails 不是任何一个具体的 LIS</b>！它只是各长度的「最小结尾值」。" +
      "本例恰好 [2, 3, 7, 18] 是 A 的一个上升子序列，但这只是巧合。" +
      "要输出具体方案，必须用 O(n²) 的 DP 额外记录前驱下标。", -1, -1, -1, -1,
      "答案 = " + tails.length);

    new DS.Viz(host, {
      title: "LIS · O(n log n) 的 tails 数组与二分",
      sub: "A = [" + A.join(", ") + "]",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     6) LCS · 二维 dp 表填表 + 回溯出公共子序列
     ========================================================================== */
  (function lcs() {
    var host = document.getElementById("viz-lcs");
    if (!host) return;

    var SA = "ABCBDAB", SB = "BDCABA";
    var n = SA.length, m = SB.length;

    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (var i2 = 1; i2 <= n; i2++)
      for (var j2 = 1; j2 <= m; j2++) {
        if (SA[i2 - 1] === SB[j2 - 1]) dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;
        else dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);
      }

    var frames = [];
    var cols = [""];
    for (var c = 0; c < m; c++) cols.push(SB[c]);
    cols[0] = "j=0";
    var rowHead = ["i=0 (空串)"];
    for (var r = 0; r < n; r++) rowHead.push(SA[r]);

    /* upto: 已填到哪一格；pathMode: 是否已进入回溯阶段 */
    function snap(desc, uptoRow, uptoCol, hiR, hiC, srcR, srcC, pathCells, lcsText) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 120 + (m + 1) * 46 + 250;
          var svg = dpTable(s, W, {
            cols: cols, rowHead: rowHead, x0: 110, y0: 36, cw: 44, ch: 28, h: 150,
            corner: "i \\ j",
            cell: function (ri, cj) {
              if (ri > uptoRow || (ri === uptoRow && cj > uptoCol)) return { text: "", cls: "dim" };
              var cls = "";
              if (ri === hiR && cj === hiC) cls = "active";
              if (ri === srcR && cj === srcC) cls = "done";
              if (pathCells && pathCells.some(function (p) { return p[0] === ri && p[1] === cj; }))
                cls = "compare";
              return { text: String(dp[ri][cj]), cls: cls };
            }
          });
          /* 顶部标出两个串 */
          svg.appendChild(SVG.label(16, 22, "A = \"" + SA + "\"　B = \"" + SB + "\"", "start"));

          var SX = 110 + (m + 1) * 46 + 16;
          svg.appendChild(SVG.text(SX, 50, "LCS 转移方程", "vz-text", "start"));
          svg.appendChild(SVG.label(SX, 74, "A[i]==B[j] → 左上角 + 1", "start"));
          svg.appendChild(SVG.label(SX, 92, "A[i]!=B[j] → max(上, 左)", "start"));
          svg.appendChild(SVG.label(SX, 122, "绿色 = 转移来源", "start"));
          svg.appendChild(SVG.label(SX, 140, "蓝色 = 当前格子", "start"));
          svg.appendChild(SVG.label(SX, 158, "橙色 = 回溯路径", "start"));
          svg.appendChild(SVG.label(SX, 192, "已还原的 LCS：（从后往前）", "start"));
          svg.appendChild(SVG.label(SX, 212, lcsText || "—", "start"));
          return svg;
        }
      });
    }

    snap("LCS 的 dp 表：<b>dp[i][j] = A 的前 i 个字符与 B 的前 j 个字符的最长公共子序列长度</b>。" +
      "第 0 行、第 0 列都是 0（空串与任何串的 LCS 长度为 0），这是<b>边界</b>。" +
      "注意「子序列」不要求连续，所以 A = \"" + SA + "\"、B = \"" + SB + "\"。", -1, -1, -1, -1, -1, -1, null, "");

    for (var i3 = 1; i3 <= n; i3++) {
      for (var j3 = 1; j3 <= m; j3++) {
        var d;
        if (SA[i3 - 1] === SB[j3 - 1]) {
          d = "字符相同（A[" + i3 + "] = B[" + j3 + "] = '" + SA[i3 - 1] + "'）→ <b>dp[" + i3 + "][" + j3 +
            "] = dp[" + (i3 - 1) + "][" + (j3 - 1) + "] + 1 = " + dp[i3][j3] + "</b>，" +
            "来源是<b>左上角</b>（绿色格）。";
        } else {
          d = "字符不同（'" + SA[i3 - 1] + "' ≠ '" + SB[j3 - 1] + "'）→ 取上方 dp[" + (i3 - 1) + "][" + j3 + "] = " +
            dp[i3 - 1][j3] + " 与左方 dp[" + i3 + "][" + (j3 - 1) + "] = " + dp[i3][j3 - 1] +
            " 的较大值 → <b>dp[" + i3 + "][" + j3 + "] = " + dp[i3][j3] + "</b>。";
        }
        snap(d, i3, j3, i3, j3,
          i3 - 1, SA[i3 - 1] === SB[j3 - 1] ? j3 - 1 : (dp[i3 - 1][j3] >= dp[i3][j3 - 1] ? j3 : -1),
          null, "");
      }
    }

    snap("<b>填表完成，LCS 长度 = dp[" + n + "][" + m + "] = " + dp[n][m] + "</b>。" +
      "接下来做<b>回溯</b>：从右下角 dp[" + n + "][" + m + "] 出发往回走 ——" +
      "<br>① 若 A[i] == B[j]，这个字符属于 LCS，记下它，然后往<b>左上角</b>走（i--, j--）；" +
      "<br>② 若不等，比较上、左两格，往<b>值较大的方向</b>走（相等时习惯往上方走）；" +
      "<br>③ 走到 i = 0 或 j = 0 结束。因为我们是倒着走的，最后要把结果<b>反转</b>。",
      n, m, n, m, -1, -1, null, "");

    /* 回溯 */
    var pi = n, pj = m, path = [], chars = [];
    while (pi > 0 && pj > 0) {
      path.push([pi, pj]);
      if (SA[pi - 1] === SB[pj - 1]) {
        chars.push(SA[pi - 1]);
        snap("回溯：A[" + pi + "] = B[" + pj + "] = '" + SA[pi - 1] + "' <b>相等</b> → 这个字符属于 LCS。" +
          "当前已收集（倒序）：<b>" + chars.join("") + "</b>。往左上角走：i = " + (pi - 1) + ", j = " + (pj - 1) + "。",
          n, m, pi, pj, pi - 1, pj - 1, path.slice(), chars.join(""));
        pi--; pj--;
      } else if (dp[pi - 1][pj] >= dp[pi][pj - 1]) {
        snap("回溯：A[" + pi + "] = '" + SA[pi - 1] + "' ≠ B[" + pj + "] = '" + SB[pj - 1] + "'，" +
          "且上方 dp[" + (pi - 1) + "][" + pj + "] = " + dp[pi - 1][pj] + " ≥ 左方 dp[" + pi + "][" + (pj - 1) +
          "] = " + dp[pi][pj - 1] + " → 往<b>上方</b>走（i 减 1）。",
          n, m, pi, pj, pi - 1, pj, path.slice(), chars.join(""));
        pi--;
      } else {
        snap("回溯：A[" + pi + "] = '" + SA[pi - 1] + "' ≠ B[" + pj + "] = '" + SB[pj - 1] + "'，" +
          "且左方 dp[" + pi + "][" + (pj - 1) + "] = " + dp[pi][pj - 1] + " &gt; 上方 dp[" + (pi - 1) + "][" + pj +
          "] = " + dp[pi - 1][pj] + " → 往<b>左方</b>走（j 减 1）。",
          n, m, pi, pj, pi, pj - 1, path.slice(), chars.join(""));
        pj--;
      }
    }

    snap("<b>回溯结束。</b>收集到的字符是 " + chars.join("") + "，反转后得到一条最长公共子序列：<b>" +
      chars.slice().reverse().join("") + "</b>（长度 " + dp[n][m] + "）。" +
      "<br>注意 LCS 可能<b>不止一条</b> —— 本例中 \"BCBA\"、\"BDAB\"、\"BCAB\" 都是长度 4 的公共子序列。" +
      "上面的走路规则（不等时优先往上方）只是决定了优先输出哪一条。<br>" +
      "复杂度：时间 O(nm) = O(" + (n * m) + ")，空间 O(nm)（可用滚动数组压到 O(min(n,m))，但那样就无法还原方案了）。",
      n, m, -1, -1, -1, -1, path.slice(), chars.slice().reverse().join(""));

    new DS.Viz(host, {
      title: "LCS · dp 表填表与路径还原",
      sub: "A = \"" + SA + "\"　B = \"" + SB + "\"",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     7) 区间 DP · 石子合并（按区间长度从小到大填表）
     ========================================================================== */
  (function stoneMerge() {
    var host = document.getElementById("viz-stone-merge");
    if (!host) return;

    var a = [4, 1, 3, 2];
    var n = a.length;
    var pre = [0];
    for (var t = 0; t < n; t++) pre.push(pre[t] + a[t]);
    function sum(l, r) { return pre[r] - pre[l - 1]; }

    var INF = 1e9;
    var f = [];
    for (var i = 0; i <= n + 1; i++) f.push(new Array(n + 2).fill(0));
    var done = [];                     /* done[i][j] 标记该区间是否已算完 */
    for (var i2 = 0; i2 <= n + 1; i2++) done.push(new Array(n + 2).fill(false));
    for (var k = 1; k <= n; k++) { f[k][k] = 0; done[k][k] = true; }

    var frames = [];
    var cols = [];
    for (var c = 0; c <= n; c++) cols.push(c === 0 ? "j=0" : ("j=" + c));
    var rowHead = ["i=0"];
    for (var r = 1; r <= n; r++) rowHead.push("i=" + r + " (" + a[r - 1] + ")");

    function snap(desc, hiI, hiJ, src1, src2, curLen) {
      var ff = f.map(function (row) { return row.slice(); });
      var dd = done.map(function (row) { return row.slice(); });
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 110 + (n + 1) * 52 + 300;
          var svg = dpTable(s, W, {
            cols: cols, rowHead: rowHead, x0: 110, y0: 34, cw: 50, ch: 30, h: 170,
            corner: "i \\ j",
            cell: function (ri, cj) {
              if (ri === 0 || cj === 0) return { text: "—", cls: "dim" };
              if (cj < ri) return { text: "—", cls: "dim" };
              if (!dd[ri][cj]) return { text: "", cls: "dim" };
              var cls = "";
              if (ri === hiI && cj === hiJ) cls = "active";
              if (src1 && ri === src1[0] && cj === src1[1]) cls = "done";
              if (src2 && ri === src2[0] && cj === src2[1]) cls = "compare";
              return { text: String(ff[ri][cj]), cls: cls };
            }
          });
          svg.appendChild(SVG.label(16, 22, "石子序列 a = [" + a.join(", ") + "]　前缀和 pre = [" +
            pre.join(", ") + "]", "start"));

          var SX = 110 + (n + 1) * 52 + 16;
          svg.appendChild(SVG.text(SX, 48, "区间 DP 三重循环" + (curLen ? "（当前 len=" + curLen + "）" : ""),
            "vz-text", "start"));
          svg.appendChild(SVG.label(SX, 72, "for len = 2..n", "start"));
          svg.appendChild(SVG.label(SX, 90, "  for i = 1..n-len+1", "start"));
          svg.appendChild(SVG.label(SX, 108, "    j = i+len-1", "start"));
          svg.appendChild(SVG.label(SX, 126, "    for k = i..j-1", "start"));
          svg.appendChild(SVG.label(SX, 144, "      f[i][j] = min(f[i][k]+f[k+1][j])", "start"));
          svg.appendChild(SVG.label(SX, 162, "    f[i][j] += sum(i..j)", "start"));
          svg.appendChild(SVG.label(SX, 192, "顺序不能换：必须先短区间后长区间", "start"));
          svg.appendChild(SVG.label(SX, 210, "绿色 = 左半 f[i][k]，橙色 = 右半 f[k+1][j]", "start"));
          svg.appendChild(SVG.label(SX, 236, "环形版本：把数组复制一份接到后面（断环成链），", "start"));
          svg.appendChild(SVG.label(SX, 254, "再在所有长度为 n 的区间里取最优。", "start"));
          return svg;
        }
      });
    }

    snap("石子合并（区间 DP）：<b>f[i][j] = 把第 i 堆到第 j 堆合并成一堆的最小代价</b>。" +
      "最后一次合并必然把区间分成 [i,k] 与 [k+1,j]，代价还要加上整个区间的石子总数 sum(i..j)。" +
      "<br>转移：<code>f[i][j] = min over k ( f[i][k] + f[k+1][j] ) + sum(i..j)</code>，" +
      "边界 <code>f[i][i] = 0</code>。<br><b>遍历顺序：区间长度 len 从 2 到 n 递增</b> —— " +
      "因为算长区间时要用到短区间的结果。下图对角线上的 0 就是 len = 1 的初始状态。",
      -1, -1, null, null, 0);

    for (var len = 2; len <= n; len++) {
      for (var i3 = 1; i3 + len - 1 <= n; i3++) {
        var j3 = i3 + len - 1;
        f[i3][j3] = INF;
        var best = INF, bestK = -1;
        for (var kk = i3; kk < j3; kk++) {
          var cand = f[i3][kk] + f[kk + 1][j3];
          snap("算 <b>f[" + i3 + "][" + j3 + "]</b>（区间长度 len = " + len + "，对应石子 " +
            a.slice(i3 - 1, j3).join("+") + " = " + sum(i3, j3) + "）。枚举切分点 k = " + kk + "：" +
            "左半 f[" + i3 + "][" + kk + "] = " + f[i3][kk] + "，右半 f[" + (kk + 1) + "][" + j3 + "] = " +
            f[kk + 1][j3] + "，两者之和 = " + cand + "；再加上本区间的总和 " + sum(i3, j3) +
            " → 候选值 = " + (cand + sum(i3, j3)) + "。",
            i3, j3, [i3, kk], [kk + 1, j3], len);
          if (cand < best) { best = cand; bestK = kk; }
        }
        f[i3][j3] = best + sum(i3, j3);
        done[i3][j3] = true;
        snap("<b>f[" + i3 + "][" + j3 + "] = " + best + " + " + sum(i3, j3) + " = " + f[i3][j3] + "</b>，" +
          "最优切分点 k = " + bestK + "（即在第 " + bestK + " 堆和第 " + (bestK + 1) + " 堆之间分开）。" +
          "<br>这个格子依赖的所有短区间都已经算好了 —— 这正是「按长度递增」遍历顺序的价值。",
          i3, j3, [i3, bestK], [bestK + 1, j3], len);
      }
    }

    snap("<b>答案 f[1][" + n + "] = " + f[1][n] + "</b> —— 把 " + n + " 堆石子合并成一堆的最小总代价。" +
      "<br>最优方案：先合并 " + a[0] + "+" + a[1] + " = " + (a[0] + a[1]) + "（代价 " + (a[0] + a[1]) + "），" +
      "再合并 " + a[2] + "+" + a[3] + " = " + (a[2] + a[3]) + "（代价 " + (a[2] + a[3]) + "），" +
      "最后把两堆 " + (a[0] + a[1]) + " 与 " + (a[2] + a[3]) + " 合并（代价 " + (a[0] + a[1] + a[2] + a[3]) +
      "），总代价 = " + ((a[0] + a[1]) + (a[2] + a[3]) + (a[0] + a[1] + a[2] + a[3])) + "。<br>" +
      "复杂度：状态数 O(n²)，每个状态枚举 O(n) 个切分点 → <b>O(n³)</b>。<br>" +
      "如果是<b>环形</b>石子合并（首尾相邻），只需把数组复制一份接到后面（长度变 2n），" +
      "然后在 f[1][n]、f[2][n+1]、…、f[n][2n-1] 中取最小值即可。",
      1, n, [1, 2], [3, 4], 0);

    new DS.Viz(host, {
      title: "石子合并 · 区间 DP 填表顺序",
      sub: "a = [" + a.join(", ") + "]　按区间长度从小到大",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     8) 状压 DP · TSP
     ========================================================================== */
  (function tspDp() {
    var host = document.getElementById("viz-tsp-dp");
    if (!host) return;

    var n = 4;
    var dist = [
      [0, 10, 15, 20],
      [10, 0, 35, 25],
      [15, 35, 0, 30],
      [20, 25, 30, 0]
    ];
    var FULL = (1 << n) - 1;
    var INF = 1e9;

    /* 先算出每个状态的最终值，动画只负责"按顺序展示转移" */
    var dp = [], pre = [];
    for (var i = 0; i < (1 << n); i++) {
      dp.push(new Array(n).fill(INF));
      pre.push(new Array(n).fill(-1));
    }
    dp[1][0] = 0;

    var frames = [];
    var shown = {};                 /* 状态是否已经确定 */

    function maskStr(mask) {
      var s = "";
      for (var b = n - 1; b >= 0; b--) s += ((mask >> b) & 1) ? "1" : "0";
      return s;
    }
    function maskSet(mask) {
      var r = [];
      for (var b = 0; b < n; b++) if ((mask >> b) & 1) r.push(b);
      return "{" + r.join(",") + "}";
    }

    function snap(desc, curMask, curI, nMask, nJ, cand, isNew, order) {
      var d = dp.map(function (row) { return row.slice(); });
      var cm = curMask, ci = curI, nm = nMask, nj = nJ, cd = cand, isnew = isNew;
      var ord = (order || []).slice();
      frames.push({
        desc: desc,
        draw: function (s) {
          var rows = ord.slice();
          if (rows.indexOf(cm) < 0) rows.push(cm);
          if (nm >= 0 && rows.indexOf(nm) < 0) rows.push(nm);
          rows.sort(function (p, q) { return p - q; });
          var H = 240 + rows.length * 30 + 40;
          var W = 940;
          var svg = s.svg(W, H);

          svg.appendChild(SVG.text(16, 22, "dp[mask][i] = 已访问集合 mask、当前在城市 i 的最小路程",
            "vz-text", "start"));

          /* 距离矩阵 */
          svg.appendChild(SVG.label(16, 52, "距离矩阵 dist", "start"));
          for (var j = 0; j < n; j++)
            svg.appendChild(SVG.label(112 + j * 46 + 20, 52, "→" + j, "middle"));
          for (var a = 0; a < n; a++) {
            svg.appendChild(SVG.label(104, 76 + a * 30 + 16, "城市" + a, "end"));
            for (var b = 0; b < n; b++) {
              var cls = "";
              if (a === ci && b === nj) cls = "compare";
              if (a === ci && b === ci) cls = "dim";
              svg.appendChild(SVG.box(112 + b * 46, 76 + a * 30, 40, 26, cls, String(dist[a][b]),
                /compare/.test(cls) ? "on" : ""));
            }
          }

          /* 当前状态 */
          svg.appendChild(SVG.text(340, 52, "当前状态", "vz-text", "start"));
          svg.appendChild(SVG.label(340, 76, "mask = " + cm + " = " + maskStr(cm) + "₂ = " + maskSet(cm), "start"));
          svg.appendChild(SVG.label(340, 94, "i = 城市 " + ci + "　dp 值 = " + (d[cm] ? d[cm][ci] : "-"), "start"));
          if (nm >= 0) {
            svg.appendChild(SVG.label(340, 118, "要加入城市 j = " + nj + "（不在 mask 中）", "start"));
            svg.appendChild(SVG.label(340, 136, "新 mask = " + nm + " = " + maskStr(nm) + "₂ = " + maskSet(nm), "start"));
            svg.appendChild(SVG.label(340, 154, "候选值 = dp[" + cm + "][" + ci + "] + dist[" + ci + "][" + nj +
              "] = " + (d[cm][ci] + dist[ci][nj]) + (cd !== undefined ? " = " + cd : ""), "start"));
            svg.appendChild(SVG.label(340, 172, "这是本帧正在执行的转移", "start"));
          }

          /* 状态表 */
          svg.appendChild(SVG.text(16, 216, "dp[mask][i] 状态表（已确定的状态按 mask 递增列出；— 表示 +∞ 不可达）",
            "vz-text", "start"));
          var y = 232;
          for (var z = 0; z < rows.length; z++) {
            var m = rows[z];
            svg.appendChild(SVG.label(16, y + 18, maskStr(m) + "₂", "start"));
            svg.appendChild(SVG.label(72, y + 18, "mask=" + m, "start"));
            for (var q = 0; q < n; q++) {
              var v = d[m][q];
              var cls2 = "";
              if (m === cm && q === ci) cls2 = "active";
              if (m === nm && q === nj) cls2 = isnew ? "warn" : "compare";
              svg.appendChild(SVG.box(150 + q * 62, y, 56, 26, cls2,
                v >= INF ? "—" : String(v), /active|warn|compare/.test(cls2) ? "on" : ""));
            }
            svg.appendChild(SVG.label(410, y + 18, "已访问 " + maskSet(m) +
              "　城市编号 0.." + (n - 1), "start"));
            y += 30;
          }

          var BY = 236;
          svg.appendChild(SVG.text(620, BY, "转移方程", "vz-text", "start"));
          svg.appendChild(SVG.label(620, BY + 20, "dp[mask|(1<<j)][j]", "start"));
          svg.appendChild(SVG.label(620, BY + 38, "  = min(自身, dp[mask][i] + dist[i][j])", "start"));
          svg.appendChild(SVG.label(620, BY + 64, "要求：j ∉ mask，i ∈ mask", "start"));
          svg.appendChild(SVG.label(620, BY + 90, "答案 = min over i of", "start"));
          svg.appendChild(SVG.label(620, BY + 108, "  dp[1111][i] + dist[i][0]", "start"));
          svg.appendChild(SVG.label(620, BY + 134, "复杂度 O(2^n · n^2) = " + ((1 << n) * n * n), "start"));
          svg.appendChild(SVG.label(620, BY + 160, "已确定的状态数：" + ord.length + " / " + ((1 << n) - 1), "start"));
          return svg;
        }
      });
    }

    var order = [1];
    snap("状压 DP 解 TSP（4 个城市）。用整数 <b>mask 的二进制位</b>表示「已访问的城市集合」：" +
      "第 j 位为 1 表示城市 j 已经访问过。<br>状态 <code>dp[mask][i]</code> = 已访问集合为 mask、" +
      "当前停在城市 i 时的最小路程。初始化 <b>dp[1][0] = 0</b>（只访问了城市 0，就在城市 0），其余为 +∞。",
      1, 0, -1, -1, undefined, false, order);
    shown[1] = true;

    for (var mask = 1; mask <= FULL; mask++) {
      for (var i = 0; i < n; i++) {
        if (dp[mask][i] >= INF) continue;
        if (!((mask >> i) & 1)) continue;
        for (var j = 0; j < n; j++) {
          if ((mask >> j) & 1) continue;
          var nmask = mask | (1 << j);
          var nd = dp[mask][i] + dist[i][j];
          var isNew = nd < dp[nmask][j];
          snap("<b>转移：</b>从状态 (mask=" + mask + "=" + maskStr(mask) + "₂, i=" + i + ") 出发，" +
            "加入还没访问的城市 " + j + "（dist[" + i + "][" + j + "] = " + dist[i][j] + "）。" +
            "<br>候选值 = " + dp[mask][i] + " + " + dist[i][j] + " = " + nd + "；" +
            "原有 dp[" + nmask + "][" + j + "] = " + (dp[nmask][j] >= INF ? "+∞" : dp[nmask][j]) + " → " +
            (isNew ? "<b>更新！</b>新状态 dp[" + nmask + "][" + j + "] = " + nd : "不更新（原有值更小）") +
            "。<br>注意 mask 只会变大（<code>mask | (1&lt;&lt;j) &gt; mask</code>），所以按 mask 递增遍历时，" +
            "子状态一定已经算好了。",
            mask, i, nmask, j, nd, isNew, order);
          if (isNew) { dp[nmask][j] = nd; pre[nmask][j] = i; }
          if (isNew) { shown[nmask] = true; if (order.indexOf(nmask) < 0) order.push(nmask); }
        }
      }
    }

    var ans = INF, last = -1;
    for (var q2 = 0; q2 < n; q2++)
      if (dp[FULL][q2] + dist[q2][0] < ans) { ans = dp[FULL][q2] + dist[q2][0]; last = q2; }

    /* 还原路径 */
    var path = [], mm = FULL, cc = last;
    while (cc !== -1) {
      path.push(cc);
      var p = pre[mm][cc];
      mm ^= (1 << cc);
      cc = p;
    }
    path.reverse();

    snap("<b>全部状态算完。</b>最后一步要回到起点城市 0：答案 = min over i of ( dp[1111][i] + dist[i][0] ) = <b>" +
      ans + "</b>。<br>还原出的最优路径是 <b>0 → " + path.filter(function (z) { return z !== 0; }).join(" → ") +
      " → 0</b>，总路程 " + ans + "。<br>复杂度分析：状态数 2⁴ × 4 = " + ((1 << n) * n) +
      "，每个状态最多枚举 " + n + " 个后继城市 → 运算量约 " + ((1 << n) * n * n) + " 次。" +
      "<br>对比暴力枚举排列：4 个城市只需 (4−1)! = 6 条回路，但 20 个城市就是 19! ≈ 1.2×10¹⁷ —— " +
      "而状压 DP 只要 2²⁰ × 20 ≈ 2×10⁷。这就是状态压缩的威力。",
      FULL, last, -1, -1, undefined, false, order);

    new DS.Viz(host, {
      title: "状压 DP · 旅行商问题 TSP",
      sub: "4 个城市　dp[mask][i] 逐帧转移",
      build: function () { return { frames: frames }; }
    });
  })();

})();
