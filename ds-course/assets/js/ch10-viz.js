/* ==========================================================================
   ch10-viz.js —— 查找与哈希表 · 交互动画（第 10 讲）
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG
   包含 6 个演示：
     1) viz-seq-search        顺序查找（朴素 / 哨兵 / 有序提前刹车）
     2) viz-binary-search     折半查找（区间收缩 + 判定树同步生成 + ASL 统计）
     3) viz-interpolation     插值查找 vs 折半查找（并排对比）
     4) viz-hash-linear       哈希表线性探测插入 + ASL 统计
     5) viz-hash-chain        链地址法插入与查找
     6) viz-hash-quadratic    平方探测 vs 线性探测（并排对比）
   ========================================================================== */
(function () {
  "use strict";

  var SVG = DS.SVG;

  /* 全篇格子的统一尺寸：格子边长 BOX = 46px、格间距 GAP = 6px、步距 PITCH = 52px。
     数组行、哈希槽都用这套常量排版，改这三个数就能整体缩放。 */
  var BOX = 46, GAP = 6, PITCH = BOX + GAP;   // 单元格宽 / 间距 / 步距

  /* ======================================================================
     通用小工具
     ====================================================================== */

  /* 把数组元素画成一行格子。cellClass(i) 返回该格的样式类 */
  function arrayRow(svg, x0, y, n, valueAt, cellClass, labelAt, subAt) {
    for (var i = 0; i < n; i++) {
      var x = x0 + i * PITCH;
      var cls = cellClass ? cellClass(i) : "";
      svg.appendChild(SVG.box(x, y, BOX, BOX, cls, valueAt(i),
        /active|compare|done|warn/.test(cls) ? "on" : ""));
      svg.appendChild(SVG.label(x + BOX / 2, y + BOX + 16, labelAt ? labelAt(i) : String(i), "middle"));
      if (subAt) {
        var s = subAt(i);
        if (s) svg.appendChild(SVG.label(x + BOX / 2, y + BOX + 30, s, "middle"));
      }
    }
    return x0 + n * PITCH;
  }

  /* 在格子下方画一个指针三角与文字 */
  function drawPtr(svg, cx, y, txt, color) {
    var c = color || "var(--brand)";
    var tri = SVG.path("M" + cx + "," + y + " l-7,-10 l14,0 z", "", false);
    tri.setAttribute("fill", c);
    tri.setAttribute("stroke", "none");
    svg.appendChild(tri);
    var t = SVG.text(cx, y + 15, txt, "vz-label", "middle");
    t.setAttribute("fill", c);
    t.setAttribute("font-weight", "700");
    svg.appendChild(t);
  }

  /* 任意颜色的小方块（用于哈希桶、墓碑），颜色全部来自 CSS 变量 */
  function colorBox(svg, x, y, w, h, fillVar, strokeVar, text, textFillVar) {
    svg.appendChild(SVG.el("rect", {
      x: x, y: y, width: w, height: h, rx: 6,
      fill: fillVar, stroke: strokeVar, "stroke-width": 2
    }));
    if (text !== undefined && text !== null) {
      var t = SVG.text(x + w / 2, y + h / 2 + 5, text, "vz-text", "middle");
      t.setAttribute("fill", textFillVar || "var(--text)");
      t.setAttribute("font-size", "13");
      svg.appendChild(t);
    }
  }

  function statLine(svg, x, y, str, color) {
    var t = SVG.text(x, y, str, "vz-label", "start");
    t.setAttribute("font-size", "12.5");
    if (color) t.setAttribute("fill", color);
    svg.appendChild(t);
  }

  function legend(svg, x, y) {
    var items = [
      ["var(--accent)", "正在比较"],
      ["var(--danger)", "探测失败 / 冲突"],
      ["var(--brand)", "当前关注的元素"],
      ["var(--ok)", "已完成 / 命中"]
    ];
    for (var i = 0; i < items.length; i++) {
      var cx = x + i * 160;
      svg.appendChild(SVG.el("rect", {
        x: cx, y: y - 10, width: 12, height: 12, rx: 3,
        fill: items[i][0], stroke: "var(--border-strong)", "stroke-width": 1
      }));
      var t = SVG.text(cx + 18, y, items[i][1], "vz-label", "start");
      t.setAttribute("font-size", "11.5");
      svg.appendChild(t);
    }
  }

  /* ======================================================================
     1) 顺序查找：朴素 / 哨兵 / 有序提前刹车
     ====================================================================== */
  (function seqSearch() {
    var host = document.getElementById("viz-seq-search");
    if (!host) return;

    var A = [17, 25, 39, 42, 58, 66, 73];        // 有序，值互不相同（便于观察有序表的提前刹车）
    /* ARR = A 的字符串形式，只给 DS.Viz 的副标题用（免得在模板里再拼一次）。 */
    var ARR = A.join(", ");
    /* n = 元素个数（合法下标 0..n-1）。注意它同时也是“失败时的比较次数”。 */
    var n = A.length;
    /* 帧数组：build() 里被同步填满，之后 DS.Viz 才逐帧渲染 —— 所以 draw 里只能读推帧那一刻的快照 */
    var frames = [];

    /* 每一帧：三种扫描同时展示（朴素从前 / 哨兵从后 / 有序表提前刹车） */
    /* 推一帧。st = **该帧的快照**（调用处一律 cp(base) 深拷贝），draw 只读 st.*；
       st.key = 本轮要查找的值；st.plain / st.sen / st.ord = 三种写法各自的状态：
         cur  = 当前扫描到的下标（-1 = 还没开始；哨兵那组从 n 往 0 倒着走，0 是哨兵位）
         cmp  = 本组的比较**次数**（不是下标）
         found= 命中的下标，-1 = 没命中
         done = 本轮是否已经结束；ord.stop = 是否因 a[i] > key 提前刹车 */
    function snap(desc, st) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = Math.max(900, 60 + n * PITCH + 60);
          var svg = s.svg(W, 430);
          var i;

          /* ---------- ① 朴素：从前往后 ---------- */
          svg.appendChild(SVG.text(30, 22, "① 朴素顺序查找（0 基，从前往后）", "vz-label", "start"));
          arrayRow(svg, 90, 36, n, function (k) { return A[k]; },
            function (k) {
              if (st.plain.found === k) return "done";
              if (st.plain.cur === k) return "compare";
              if (st.plain.cur > k && st.plain.cur <= n) return "dim";
              return "";
            },
            function (k) { return String(k); });
          if (st.plain.cur >= 0 && st.plain.cur < n) {
            drawPtr(svg, 90 + st.plain.cur * PITCH + BOX / 2, 34,
              "i = " + st.plain.cur + "　比较 " + A[st.plain.cur] + " 与 " + st.key,
              st.plain.found === st.plain.cur ? "var(--ok)" : "var(--accent)");
          }
          statLine(svg, 90, 118, "朴素的比较次数 = " + st.plain.cmp +
            (st.plain.done ? (st.plain.found >= 0 ? "　→ 成功" : "　→ 失败（比较 n = " + n + " 次）") : ""),
            "var(--text-soft)");
          statLine(svg, 90, 136, "成功 ASL（等概率） = (n+1)/2 = (7+1)/2 = 4　；　失败 ASL = n = 7",
            "var(--text-faint)");

          /* ---------- ② 哨兵：从后往前 ---------- */
          svg.appendChild(SVG.text(30, 178, "② 带哨兵（a[0] 存 key，从后往前扫，循环里没有 i ≥ 1 的判断）",
            "vz-label", "start"));
          var sen = [st.key].concat(A);                 // 下标 0 是哨兵
          arrayRow(svg, 90, 192, n + 1, function (k) { return sen[k]; },
            function (k) {
              if (k === 0) return st.sen.done && st.sen.found < 0 ? "warn" : "active";
              if (st.sen.cur === k && st.sen.found === k) return "done";
              if (st.sen.cur === k) return "compare";
              if (st.sen.cur < k && st.sen.cur >= 0) return "dim";
              return "";
            },
            function (k) { return k === 0 ? "哨兵" : String(k); });
          if (st.sen.cur >= 0) {
            drawPtr(svg, 90 + st.sen.cur * PITCH + BOX / 2, 190,
              "i = " + st.sen.cur, st.sen.found === st.sen.cur ? "var(--ok)" : "var(--accent)");
          }
          statLine(svg, 90, 274, "哨兵的比较次数 = " + st.sen.cmp +
            (st.sen.done ? (st.sen.found > 0 ? "　→ 成功（命中 a[" + st.sen.found + "]）"
              : "　→ 失败（撞上哨兵 a[0]，共 n+1 = " + (n + 1) + " 次）") : ""),
            "var(--text-soft)");
          statLine(svg, 90, 292, "成功 ASL = (n+1)/2 = 4（两种方向一样）　；　失败 ASL = n+1 = 8（多算了一次与哨兵的比较）",
            "var(--text-faint)");

          /* ---------- ③ 有序表：提前刹车 ---------- */
          svg.appendChild(SVG.text(30, 334, "③ 有序表的顺序查找（一旦发现 a[i] > key 就立刻判定失败）",
            "vz-label", "start"));
          arrayRow(svg, 90, 348, n, function (k) { return A[k]; },
            function (k) {
              if (st.ord.found === k) return "done";
              if (st.ord.cur === k) return st.ord.stop ? "warn" : "compare";
              if (st.ord.cur > k && st.ord.cur <= n) return "dim";
              return "";
            },
            function (k) { return String(k); });
          if (st.ord.cur >= 0 && st.ord.cur < n) {
            drawPtr(svg, 90 + st.ord.cur * PITCH + BOX / 2, 346,
              st.ord.stop ? "a[" + st.ord.cur + "] = " + A[st.ord.cur] + " > " + st.key + " → 刹车！"
                : "i = " + st.ord.cur,
              st.ord.stop ? "var(--danger)" : "var(--accent)");
          }
          statLine(svg, 90, 428, "有序表的比较次数 = " + st.ord.cmp +
            (st.ord.done ? (st.ord.found >= 0 ? "　→ 成功" : "　→ 失败，但提前刹车省下了后面的比较") : ""),
            "var(--text-soft)");
          return svg;
        }
      });
    }

    /* ---------- 造帧：一个 key 走完三种算法 ---------- */
    /* run(key)：让**同一个 key** 依次走完朴素 / 哨兵 / 有序表三种写法，每种都推自己的帧。 */
    function run(key) {
      /* base = 三种写法共用的「当前状态」对象，算法过程中被就地改写 ——
         所以每次推帧前都必须 cp(base) 拷一份，否则每一帧都会画出三种写法跑完后的最终状态。 */
      var base = {
        key: key,
        plain: { cur: -1, cmp: 0, found: -1, done: false },
        sen: { cur: n, cmp: 0, found: -1, done: false },
        ord: { cur: -1, cmp: 0, found: -1, done: false, stop: false }
      };
      function cp(o) { return JSON.parse(JSON.stringify(o)); }

      snap("要查找的 key = <b>" + key + "</b>。下面同时演示三种顺序查找的写法，注意它们各自的比较次数。", cp(base));

      /* ① 朴素 */
      for (var i = 0; i < n; i++) {
        base.plain.cur = i; base.plain.cmp++;
        if (A[i] === key) {
          base.plain.found = i; base.plain.done = true;
          snap("① 朴素：比较 a[" + i + "] = " + A[i] + " 与 " + key + "，<b>相等 → 查找成功</b>（共比较 " +
            base.plain.cmp + " 次）。", cp(base));
          break;
        }
        snap("① 朴素：比较 a[" + i + "] = " + A[i] + " 与 " + key + "，不等 → i 右移一格。",
          cp(base));
      }
      if (!base.plain.done) {
        base.plain.cur = n; base.plain.done = true;
        snap("① 朴素：i 越界，扫完全表都没找到 → <b>查找失败，共比较 n = " + n + " 次</b>。", cp(base));
      }

      /* ② 哨兵：从后往前 */
      base.sen.cmp = 0;
      for (var j = n; j >= 0; j--) {
        base.sen.cur = j; base.sen.cmp++;
        if (sen(j) === key) {
          base.sen.found = j; base.sen.done = true;
          snap("② 哨兵：从 i = " + j + " 开始比较，a[" + j + "] = " + sen(j) + " 与 " + key +
            (j === 0 ? " 相等 —— 但 a[0] 是哨兵，说明<b>查找失败</b>（共 " + base.sen.cmp + " 次，含与哨兵的一次）"
              : " 相等 → <b>查找成功</b>（共 " + base.sen.cmp + " 次）"), cp(base));
          break;
        }
        snap("② 哨兵：a[" + j + "] = " + sen(j) + " ≠ " + key + " → i 左移。因为 a[0] 放着 key，" +
          "循环条件只需写 <code>a[i] != key</code>，<b>不必判断 i ≥ 0</b>。", cp(base));
      }

      /* ③ 有序表提前刹车 */
      base.ord.cmp = 0;
      for (var k = 0; k < n; k++) {
        base.ord.cur = k; base.ord.cmp++;
        if (A[k] === key) {
          base.ord.found = k; base.ord.done = true;
          snap("③ 有序表：a[" + k + "] = " + A[k] + " 与 " + key + " 相等 → <b>成功</b>（共 " +
            base.ord.cmp + " 次）。", cp(base));
          break;
        }
        if (A[k] > key) {
          base.ord.stop = true; base.ord.done = true;
          snap("③ 有序表：a[" + k + "] = " + A[k] + " <b>&gt; " + key + "</b>，而表是递增的，" +
            "后面只会更大 → <b>立刻判定失败，提前刹车</b>！只比较了 " + base.ord.cmp +
            " 次，省下了剩下 " + (n - k - 1) + " 个元素的比较。", cp(base));
          break;
        }
        snap("③ 有序表：a[" + k + "] = " + A[k] + " &lt; " + key + "，还没到，继续往右。", cp(base));
      }
      if (!base.ord.done) {
        base.ord.cur = n; base.ord.done = true;
        snap("③ 有序表：走完全表都没找到 → 失败，比较 n = " + n + " 次（key 比表里所有元素都大）。", cp(base));
      }

      snap("小结：</b>同一个 key = " + key + "，朴素的比较次数 <b>" + base.plain.cmp +
        "</b>，哨兵 <b>" + base.sen.cmp + "</b>，有序表提前刹车 <b>" + base.ord.cmp +
        "</b>。三种写法的<b>成功 ASL 都是 (n+1)/2</b>，" +
        "差别在失败的代价：无序表是 n（哨兵 n+1），有序表能降到 n/2 + n/(n+1)。", cp(base));
    }

    /* sen(i) 把「哨兵数组」当 1 基看：i ≥ 1 时是 A[i-1]；i = 0 返回 0（哨兵位本身，
       实际比较时 key 不会等于 0，所以倒序扫描一定会在 j = 0 说完最后一次后自然结束）。 */
    function sen(i) { return i === 0 ? 0 : A[i - 1]; }

    /* 三个 key：一个命中、一个比最小值还小、一个落在中间（失败） */
    run(39);
    run(30);
    run(50);

    new DS.Viz(host, {
      title: "顺序查找的三种写法",
      sub: "数据 [" + ARR + "]，逐格高亮并统计比较次数",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     2) 折半查找：区间收缩 + 判定树同步生成
     ====================================================================== */
  (function binarySearch() {
    var host = document.getElementById("viz-binary-search");
    if (!host) return;

    /* A = 演示数组 10,20,…,110：11 个元素、有序且等差（判定树刚好四层）。 */
    var A = [];
    for (var t = 1; t <= 11; t++) A.push(t * 10);      // 10,20,...,110
    /* N = 元素个数 = 11（合法下标 0..10）。 */
    var N = A.length;
    var frames = [];

    var nodes = [];              // 判定树上已生成的结点 {mid,parent,lr,value,seq}
    /* 约定：nodes 的**数组下标**才是结点编号，parent/left/right 里存的都是这个下标，不是 mid；
       lr = 该结点是父结点的左还是右孩子（"L"/"R"，根为空串）；seq = 它在第几次比较时生成（1 基，未被使用）。 */
    var pruned = {};             // 已被排除的下标 → true
    /* 注意 key 是**数组下标**（0..10），不是元素值。 */
    var externals = [];          // [{parent, lr}]
    /* 外部结点（失败结点，画成小方块）：parent = 挂在哪个结点的孩子上（nodes 的下标），lr = 左 / 右。 */
    /* rootIdx = 判定树根结点在 nodes 里的下标，-1 = 树还是空的。 */
    var rootIdx = -1;
    var posOf = {};              // mid -> {x,y}
    /* seqCounter = 预留的“结点生成序号”计数器：声明了、每轮也重置，但本文件没有真正用到它。 */
    var seqCounter = 0;
    var pathIdx = [];            // 当前路径上的结点下标（nodes 数组下标）

    function rebuildPositions() {
      /* 中序遍历赋值：每个结点画在“子树中序序号”对应的固定 x 上，
         这样先序插入时 x 就已经是最终位置，动画不会乱跳。
         注意外部结点不占中序序号。 */
      var counter = 0;
      posOf = {};
      if (rootIdx < 0) return;
      function dfs(i) {
        if (i < 0) return;
        var nd = nodes[i];
        dfs(nd.left);
        posOf[nd.mid] = { x: 0, y: 0, order: counter++ };
        dfs(nd.right);
      }
      rootIdx = 0;
      dfs(0);
      var total = counter, W = 900, left = 44, right = W - 44;
      var span = total > 1 ? (right - left) / (total - 1) : 0;
      for (var k in posOf) {
        posOf[k].x = total > 1 ? left + span * posOf[k].order : W / 2;
      }
    }

    function depthOf(i) {
      var d = 0, cur = i;
      while (nodes[cur].parent >= 0) { cur = nodes[cur].parent; d++; }
      return d;
    }

    function addNode(mid, parent, lr, seq) {
      nodes.push({ mid: mid, parent: parent, lr: lr, value: A[mid], seq: seq, left: -1, right: -1 });
      var idx = nodes.length - 1;
      if (parent >= 0) {
        if (lr === "L") nodes[parent].left = idx; else nodes[parent].right = idx;
      } else rootIdx = idx;
      rebuildPositions();
      /* 给每个结点算出层号并定位 y */
      for (var i = 0; i < nodes.length; i++) {
        var p = posOf[nodes[i].mid];
        p.y = 62 + depthOf(i) * 78;
      }
      return idx;
    }

    /* 推一帧。low / high = 当前候选区间，是**闭区间** [low, high]（low > high 就表示区间已空、查找失败）；
       mid = 本帧正在比较的元素下标（-1 = 没有）；found = 命中下标（-1 = 未命中）；
       cmp = **累计**比较次数（也就是“第几次比较”）；done = 本轮是否已结束；
       curIdx = 本帧刚落下的结点在 nodes 里的下标（draw 里没用到，保留参数）。 */
    function snap(desc, low, high, mid, found, cmp, done, curIdx) {
      /* nCopy / prunedCopy / posCopy / curPath / extCopy / rootCopy = **该帧的快照**：
         判定树结点、已被排除的下标、结点坐标、当前路径、外部结点、根结点下标。
         这些结构在 build() 期间会不停变，draw 里只能读副本。 */
      var nCopy = nodes.slice();
      var prunedCopy = {};
      for (var kk in pruned) prunedCopy[kk] = true;
      var posCopy = {};
      for (var k2 in posOf) posCopy[k2] = { x: posOf[k2].x, y: posOf[k2].y, order: posOf[k2].order };
      var curPath = pathIdx.slice();
      var extCopy = externals.slice();
      var rootCopy = rootIdx;

      frames.push({
        desc: desc,
        draw: function (s) {
          var H = 62 + 5 * 78 + 90;
          var svg = s.svg(920, H);

          /* ---------- 上：数组区间 ---------- */
          svg.appendChild(SVG.text(30, 20, "a[0..10]（有序）　比较次数 = " + cmp,
            "vz-label", "start"));
          arrayRow(svg, 36, 34, N, function (k) { return A[k]; },
            function (k) {
              if (k === found) return "done";
              if (k === mid) return "compare";
              if (prunedCopy[k] || k < low || k > high) return "dim";
              return "";
            },
            function (k) { return String(k); });

          /* 区间括号 */
          var x1 = 36 + low * PITCH - 3, x2 = 36 + high * PITCH + BOX + 3;
          if (low <= high) {
            svg.appendChild(SVG.el("path", {
              d: "M" + x1 + ",100 L" + x1 + ",110 L" + x2 + ",110 L" + x2 + ",100",
              fill: "none", stroke: "var(--brand)", "stroke-width": 2.4
            }));
            var lt = SVG.text((x1 + x2) / 2, 126, "当前候选区间 [low=" + low + ", high=" + high + "]",
              "vz-label", "middle");
            lt.setAttribute("fill", "var(--brand)");
            lt.setAttribute("font-weight", "700");
            svg.appendChild(lt);
          } else {
            var lt2 = SVG.text(36, 122, "区间为空（low = " + low + " &gt; high = " + high + "）→ 查找失败",
              "vz-label", "start");
            lt2.setAttribute("fill", "var(--danger)");
            lt2.setAttribute("font-weight", "700");
            svg.appendChild(lt2);
          }
          if (mid >= 0 && mid < N) {
            drawPtr(svg, 36 + mid * PITCH + BOX / 2, 32, "mid = " + mid, "var(--accent)");
          }

          /* ---------- 下：判定树 ---------- */
          svg.appendChild(SVG.text(30, 160, "判定树（每比较一次就下降一层；结点内是元素值，结点下列出下标 mid）",
            "vz-label", "start"));
          var top = 196;
          var i;
          /* 先画所有边 */
          for (i = 0; i < nCopy.length; i++) {
            var nd = nCopy[i];
            if (nd.parent < 0) continue;
            var p = posCopy[nCopy[nd.parent].mid], q = posCopy[nd.mid];
            if (!p || !q) continue;
            var dimEdge = false;
            for (var d1 = 0; d1 < curPath.length; d1++) {
              if (curPath[d1] === i) dimEdge = true;
            }
            svg.appendChild(SVG.line(p.x, top + p.y, q.x, top + q.y,
              dimEdge ? "active" : "dim"));
          }
          /* 外部结点（失败结点）：方形 */
          for (i = 0; i < extCopy.length; i++) {
            var e = extCopy[i];
            var pn = nCopy[e.parent];
            if (!pn) continue;
            var pp = posCopy[pn.mid];
            if (!pp) continue;
            var ex = pp.x + (e.lr === "L" ? -26 : 26);
            var ey = top + pp.y + 30;
            svg.appendChild(SVG.el("rect", {
              x: ex - 9, y: ey - 9, width: 18, height: 18, rx: 3,
              fill: "var(--bg-soft)", stroke: "var(--border-strong)", "stroke-width": 1.4
            }));
            svg.appendChild(SVG.line(pp.x, top + pp.y + 19, ex, ey - 9, "dim"));
          }
          /* 再画结点 */
          for (i = 0; i < nCopy.length; i++) {
            var nd2 = nCopy[i];
            var p2 = posCopy[nd2.mid];
            if (!p2) continue;
            var onPath = false, cls = "";
            for (var d2 = 0; d2 < curPath.length; d2++) if (curPath[d2] === i) onPath = true;
            if (nd2.mid === found) cls = "done";
            else if (nd2.mid === mid) cls = "compare";
            else if (onPath) cls = "active";
            else cls = "dim";
            svg.appendChild(SVG.circle(p2.x, top + p2.y, 19, cls, nd2.value,
              /active|compare|done/.test(cls) ? "on" : ""));
            var lb = SVG.text(p2.x, top + p2.y + 34, "[" + nd2.mid + "]", "vz-label", "middle");
            if (nd2.mid === mid) lb.setAttribute("fill", "var(--accent)");
            else if (nd2.mid === found) lb.setAttribute("fill", "var(--ok)");
            svg.appendChild(lb);
          }
          legend(svg, 36, H - 22);
          return svg;
        }
      });
    }

    /* ---------- 造帧：一个 key 的完整折半查找 ---------- */
    /* run(key, isLast)：跑完一个 key 的完整折半查找；isLast = true 时末尾再补一帧 ASL 总结
       （判定树在下一个 key 开始时就被清空，所以总结帧只能加在最后一个 key 后面）。 */
    function run(key, isLast) {
      nodes = []; pruned = {}; externals = []; rootIdx = -1; posOf = {}; seqCounter = 0; pathIdx = [];
      /* 折半查找的核心量：low / high = 闭区间端点（初值 0 与 N-1，空区间时 low = high + 1）；
         cmp = 累计比较次数；found = 命中下标（-1 = 还没命中）。 */
      var low = 0, high = N - 1, cmp = 0, found = -1;
      /* root = 判定树根结点的下标（-1 = 还没建根），只用来判断“这个 mid 该不该当根”。 */
      var root = -1;

      snap("要查找的 key = <b>" + key + "</b>。初始候选区间是整张表 [low = 0, high = 10]，判定树还是空的。",
        low, high, -1, -1, cmp, false, -1);

      while (low <= high) {
        var mid = low + Math.floor((high - low) / 2);       // 防溢出写法
        cmp++;
        var idx;
        if (root < 0) { idx = addNode(mid, -1, "", cmp); root = idx; }
        else {
          /* 找到父结点：路径上最后一个 mid 的结点 */
          var parentIdx = pathIdx.length ? pathIdx[pathIdx.length - 1] : 0;
          var par = nodes[parentIdx];
          var lr = (mid < par.mid) ? "L" : "R";
          idx = addNode(mid, parentIdx, lr, cmp);
          /* 另一侧的分支被剪掉 → 给它挂一个外部结点 */
          externals.push({ parent: idx, lr: lr === "L" ? "R" : "L" });
        }
        pathIdx.push(idx);

        if (A[mid] === key) {
          found = mid;
          snap("第 " + cmp + " 次比较：<code>a[mid] = a[" + mid + "] = " + A[mid] + "</code>，" +
            "<b>恰好等于 key = " + key + " → 查找成功！</b>该结点位于判定树第 " + cmp +
            " 层，所以成功查找的比较次数就是 " + cmp + "。", low, high, mid, found, cmp, true, idx);
          break;
        } else if (A[mid] < key) {
          snap("第 " + cmp + " 次比较：<code>a[mid] = a[" + mid + "] = " + A[mid] + " &lt; " + key +
            "</code>，说明答案只可能在<b>右半区间</b> → 令 <code>low = mid + 1 = " + (mid + 1) + "</code>。" +
            "左半边的 " + (mid - low + 1) + " 个元素连同判定树左侧一起被剪掉。",
            low, high, mid, -1, cmp, false, idx);
          for (var q1 = low; q1 <= mid; q1++) pruned[q1] = true;
          low = mid + 1;
        } else {
          snap("第 " + cmp + " 次比较：<code>a[mid] = a[" + mid + "] = " + A[mid] + " &gt; " + key +
            "</code>，说明答案只可能在<b>左半区间</b> → 令 <code>high = mid - 1 = " + (mid - 1) + "</code>。" +
            "右半边的 " + (high - mid + 1) + " 个元素被剪掉。",
            low, high, mid, -1, cmp, false, idx);
          for (var q2 = mid; q2 <= high; q2++) pruned[q2] = true;
          high = mid - 1;
        }
      }

      if (found < 0) {
        snap("<b>查找失败</b>：区间收缩到 low = " + low + " &gt; high = " + high + "（空区间），" +
          "共比较 " + cmp + " 次，最终停在判定树的一个<b>外部结点（方形）</b>上。" +
          "外部结点只会出现在最后一层或倒数第二层，所以失败比较次数 ≤ ⌈log₂(n+1)⌉ = 4。",
          low, high, -1, -1, cmp, true, -1);
      }

      if (isLast) {
        /* 该 key 走完后，把判定树清空前的最终形态留一帧总结 */
        snap("本题 n = 11，判定树四层的结点数是 <b>1、2、4、4</b>。" +
          "把所有 11 个元素都查一遍，比较次数之和 = 1×1 + 2×2 + 3×4 + 4×4 = <b>33</b>，" +
          "所以 <code>ASL<sub>成功</sub> = 33/11 = 3</code>。它恰好等于 log₂12 − 1 ≈ 2.585 向上取整后的量级。",
          low, high, -1, -1, cmp, false, -1);
      }
    }

    /* 三个 key：命中根 / 命中深层 / 失败 */
    run(60, false);
    run(100, false);
    run(75, true);

    new DS.Viz(host, {
      title: "折半查找与判定树的生成",
      sub: "n = 11，边收缩区间边画出判定树，并统计比较次数",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     3) 插值查找 vs 折半查找
     ====================================================================== */
  (function interpolation() {
    var host = document.getElementById("viz-interpolation");
    if (!host) return;

    /* A = 1,11,…,101：11 个元素的**等差数列**（刻意做成均匀分布，好让插值公式一算就中）。 */
    var A = [];
    for (var t = 1; t <= 11; t++) A.push(1 + 10 * t);     // 1,11,...,101
    /* N = 元素个数 = 11。 */
    var N = A.length;

    /* -------- 折半查找：产出每一轮的快照 -------- */
    /* binaryTrace(key)：先离线跑一遍折半查找，把每一轮的 {low, high, mid, cmp, res} 记成数组返回；
       res = "hit" / "left" / "right" / "miss"。动画只是按顺序播这条轨迹，不再实时算。 */
    function binaryTrace(key) {
      var low = 0, high = N - 1, cmp = 0, tr = [];
      while (low <= high) {
        var mid = low + Math.floor((high - low) / 2);
        cmp++;
        if (A[mid] === key) { tr.push({ low: low, high: high, mid: mid, cmp: cmp, res: "hit" }); break; }
        if (A[mid] < key) { tr.push({ low: low, high: high, mid: mid, cmp: cmp, res: "right" }); low = mid + 1; }
        else { tr.push({ low: low, high: high, mid: mid, cmp: cmp, res: "left" }); high = mid - 1; }
      }
      if (tr.length === 0 || tr[tr.length - 1].res !== "hit")
        tr.push({ low: low, high: high, mid: -1, cmp: cmp, res: "miss" });
      return tr;
    }

    /* -------- 插值查找：产出每一轮的快照 -------- */
    /* interpTrace(key)：插值查找的轨迹，字段同上，只多一种 res = "out"
       （key 落在 [a[low], a[high]] 值域之外，直接判失败）。 */
    function interpTrace(key) {
      var low = 0, high = N - 1, cmp = 0, tr = [];
      while (low <= high) {
        if (key < A[low] || key > A[high]) {
          tr.push({ low: low, high: high, mid: -1, cmp: cmp, res: "out" });
          break;
        }
        if (A[high] === A[low]) {
          cmp++;
          tr.push({ low: low, high: high, mid: low, cmp: cmp, res: A[low] === key ? "hit" : "miss" });
          break;
        }
        var pos = low + Math.floor((key - A[low]) * (high - low) / (A[high] - A[low]));
        if (pos < low) pos = low;
        if (pos > high) pos = high;
        cmp++;
        if (A[pos] === key) { tr.push({ low: low, high: high, mid: pos, cmp: cmp, res: "hit" }); break; }
        if (A[pos] < key) { tr.push({ low: low, high: high, mid: pos, cmp: cmp, res: "right" }); low = pos + 1; }
        else { tr.push({ low: low, high: high, mid: pos, cmp: cmp, res: "left" }); high = pos - 1; }
      }
      if (tr.length === 0 || (tr[tr.length - 1].res !== "hit" && tr[tr.length - 1].res !== "out"
        && tr[tr.length - 1].res !== "miss"))
        tr.push({ low: low, high: high, mid: -1, cmp: cmp, res: "miss" });
      return tr;
    }

    var frames = [];

    /* 推一帧。bi / ii = 上排（折半）和下排（插值）各自播到第几步（轨迹数组下标，0 基）。 */
    function snap(desc, key, bi, ii) {
      /* 两条轨迹在这里重算一遍，并且**在这一刻**把第 bi / ii 步的结果 b、q 存进闭包 ——
         轨迹是每次重算出来的纯数据，之后不会被改写，所以 draw 读 b / q 是安全的（等价于快照）。 */
      var s1 = binaryTrace(key), s2 = interpTrace(key);
      var b = s1[Math.min(bi, s1.length - 1)];
      var q = s2[Math.min(ii, s2.length - 1)];
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(940, 480);

          /* ---- 上：折半查找 ---- */
          svg.appendChild(SVG.text(24, 24, "折半查找：mid = ⌊(low+high)/2⌋（永远取中点）", "vz-label", "start"));
          arrayRow(svg, 30, 40, N, function (k) { return A[k]; },
            function (k) {
              if (b.res === "hit" && k === b.mid) return "done";
              if (k === b.mid) return "compare";
              if (k < b.low || k > b.high) return "dim";
              return "";
            },
            function (k) { return String(k); });
          if (b.mid >= 0) drawPtr(svg, 30 + b.mid * PITCH + BOX / 2, 38, "mid = " + b.mid, "var(--accent)");
          var bTitle = SVG.text(30, 128, b.res === "hit" ? "✔ 命中 a[" + b.mid + "] = " + A[b.mid]
            : (b.mid >= 0 ? "比较 a[" + b.mid + "] = " + A[b.mid] + " 与 key" : "区间为空 → 失败"),
            "vz-label", "start");
          bTitle.setAttribute("font-size", "13");
          bTitle.setAttribute("fill", b.res === "hit" ? "var(--ok)" : "var(--text-soft)");
          svg.appendChild(bTitle);
          statLine(svg, 30, 150, "累计比较次数 = " + b.cmp + "　当前区间 [" + b.low + ", " + b.high + "]", "var(--text-faint)");

          /* ---- 下：插值查找 ---- */
          svg.appendChild(SVG.text(24, 216, "插值查找：mid = low + (key − a[low]) ÷ (a[high] − a[low]) × (high − low)", "vz-label", "start"));
          arrayRow(svg, 30, 232, N, function (k) { return A[k]; },
            function (k) {
              if (q.res === "hit" && k === q.mid) return "done";
              if (k === q.mid) return "compare";
              if (k < q.low || k > q.high) return "dim";
              return "";
            },
            function (k) { return String(k); });
          if (q.mid >= 0) drawPtr(svg, 30 + q.mid * PITCH + BOX / 2, 230,
            "mid = " + q.mid, q.res === "hit" ? "var(--ok)" : "var(--accent)");
          if (q.low <= q.high && q.mid >= 0) {
            statLine(svg, 30, 320, "a[low] = a[" + q.low + "] = " + A[q.low] +
              "　a[high] = a[" + Math.min(q.high, N - 1) + "] = " + A[Math.min(q.high, N - 1)] +
              "　key = " + key, "var(--text-faint)");
            statLine(svg, 30, 340, "比例 = (" + key + " − " + A[q.low] + ") ÷ (" +
              A[Math.min(q.high, N - 1)] + " − " + A[q.low] + ") = " +
              ((key - A[q.low]) / (A[Math.min(q.high, N - 1)] - A[q.low])).toFixed(3) +
              " → mid 落在区间宽度的 " + (((key - A[q.low]) / (A[Math.min(q.high, N - 1)] - A[q.low])) * 100).toFixed(1) + "% 处",
              "var(--brand)");
          }
          var qTitle = SVG.text(30, 372, q.res === "hit" ? "✔ 命中 a[" + q.mid + "] = " + A[q.mid]
            : (q.res === "out" ? "key 超出 [a[low], a[high]] 的值域 → 直接失败"
              : (q.mid >= 0 ? "比较 a[" + q.mid + "] = " + A[q.mid] + " 与 key" : "区间为空 → 失败")),
            "vz-label", "start");
          qTitle.setAttribute("font-size", "13");
          qTitle.setAttribute("fill", q.res === "hit" ? "var(--ok)" : "var(--text-soft)");
          svg.appendChild(qTitle);
          statLine(svg, 30, 394, "累计比较次数 = " + q.cmp + "　当前区间 [" + q.low + ", " + q.high + "]", "var(--text-faint)");

          /* ---- 对比结论 ---- */
          var concl = SVG.text(30, 436,
            "同一组均匀数据：折半已比较 " + b.cmp + " 次，插值已比较 " + q.cmp + " 次",
            "vz-label", "start");
          concl.setAttribute("font-size", "13.5");
          concl.setAttribute("font-weight", "700");
          concl.setAttribute("fill", "var(--brand)");
          svg.appendChild(concl);
          statLine(svg, 30, 458,
            "数据是等差数列（均匀分布）→ 插值公式算出的位置几乎就是答案，所以它比折半快得多；" +
            "若换成 a[i] = 2^i 这种指数分布，分母被巨值撑爆，mid 会一直贴着 low，退化成顺序查找。",
            "var(--text-faint)");
          return svg;
        }
      });
    }

    /* runPair(key)：让折半与插值从同一组数据出发一步一步并排推进（谁先走到轨迹末尾就停在原地）。 */
    function runPair(key) {
      var s1 = binaryTrace(key), s2 = interpTrace(key);
      /* bi / ii = 两条轨迹各自的播放指针（0 基，最大到 length-1）。 */
      var bi = 0, ii = 0;
      snap("要查找的 key = <b>" + key + "</b>。上排是折半查找，下排是插值查找，两者从同一组数据出发。", key, 0, 0);
      while (bi < s1.length - 1 || ii < s2.length - 1) {
        if (bi < s1.length - 1) bi++;
        if (ii < s2.length - 1) ii++;
        var b = s1[bi], q = s2[ii];
        var txt = "";
        if (b.res === "hit") txt += "折半：命中 → 共 " + b.cmp + " 次。　";
        else if (b.mid >= 0) txt += "折半：比较 a[" + b.mid + "] = " + A[b.mid] + "，" +
          (b.res === "right" ? "偏小 → 往右收" : "偏大 → 往左收") + "。　";
        else txt += "折半：区间为空，失败。　";
        if (q.res === "hit") txt += "插值：命中 → 共 " + q.cmp + " 次。";
        else if (q.res === "out") txt += "插值：key 超出值域 → 失败。";
        else if (q.mid >= 0) txt += "插值：按比例算出 mid = " + q.mid + "（a[" + q.mid + "] = " + A[q.mid] + "），" +
          (q.res === "right" ? "偏小 → 往右收" : "偏大 → 往左收") + "。";
        else txt += "插值：区间为空，失败。";
        snap(txt, key, bi, ii);
      }
      var bb = s1[s1.length - 1], qq = s2[s2.length - 1];
      var verdict = (bb.res === "hit" && qq.res === "hit")
        ? ("结论：命中同一个元素，<b>折半用了 " + bb.cmp + " 次，插值只用了 " + qq.cmp + " 次</b>。" +
          (qq.cmp < bb.cmp ? "均匀数据上插值查找优势明显。" : "本例两者相当，换个更靠边的 key 试试。"))
        : "结论：折半 " + bb.cmp + " 次，插值 " + qq.cmp + " 次。";
      snap(verdict, key, s1.length - 1, s2.length - 1);
    }

    runPair(31);      // 均匀数据上插值 1 次命中，折半要 3~4 次
    runPair(91);      // 靠右的位置，插值同样一步到位

    new DS.Viz(host, {
      title: "插值查找 vs 折半查找",
      sub: "同一组等差数据（1,11,…,101），上排折半、下排插值",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     4) 哈希表线性探测插入 + ASL 统计
     ====================================================================== */
  (function hashLinear() {
    var host = document.getElementById("viz-hash-linear");
    if (!host) return;

    /* M = 哈希表长 m = 11：取不大于表长的最大质数 —— 除留余数法 H(k) = k mod m 用质数当模，
       余数分布最均匀（这是教材的标准做法，不是为了好看）。 */
    var M = 11;
    /* KEYS = 依次插入的关键字（顺序固定）。42 故意放在最后：它会一路探测很久，用来暴露堆积。 */
    var KEYS = [22, 41, 53, 46, 30, 13, 1, 67, 42];
    /* table = 哈希表本体，长度 M，null = 空槽（这里不用墓碑，因为只演示插入）。
       它是**唯一的活表**，随时被写；每帧画的是 snapTab 快照。 */
    var table = new Array(M).fill(null);      // null = 空
    var frames = [];
    /* 所有已插入 key 的“成功查找比较次数”总和 = ASL 的分子，随插入递增，推帧时冻结成 aslSnap */
    var cmpSum = 0;                           // 成功查找的比较次数总和
    /* key → 它插入时的比较次数（也就是将来查找它需要的次数）；它的键集合就代表“已插入的 key” */
    var insertCmp = {};                       // 每个 key 插入时的比较次数（= 成功查找比较次数）

    function occupiedCount() {
      var c = 0;
      for (var i = 0; i < M; i++) if (table[i] !== null) c++;
      return c;
    }

    /* 推一帧。key = 正在插入的关键字（null = 没有当前操作）；h = H(key)（-1 = 没有）；
       cursors = 本次已经探测过的槽位序列（画探测箭头用，最后一个就是当前位置）；
       cmp = **本次 key 的**比较次数（不是累计！）；phase = "init"/"probe"/"placed"/"final"，只影响标题文案。 */
    function snap(desc, key, h, cursors, cmp, phase) {
      /* snapTab / cs / usedSnap / doneSnap / aslSnap / cmpEach = **该帧的快照**：
         表内容、探测轨迹、已存元素个数、已插入 key 列表、ASL 分子、比较次数。
         draw 只读这几个值，绝不读活变量 table / cmpSum / insertCmp。 */
      var snapTab = table.slice();
      var cs = cursors.slice();
      /* 关键：ASL 统计也必须在推帧时冻结。
         DS.Viz 会先跑完整个 build() 再逐帧渲染，
         若 draw 直接读活变量（cmpSum / insertCmp / cmpEach），
         每一帧的统计栏都会显示算法结束后的最终值。 */
      var usedSnap = occupiedCount();
      var doneSnap = [];
      for (var d = 0; d < KEYS.length; d++) if (insertCmp[KEYS[d]] !== undefined) doneSnap.push(KEYS[d]);
      var aslSnap = cmpSum;
      var cmpEach = cmp;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(940, 400);
          var i;

          /* 表头信息 */
          var used = usedSnap;
          svg.appendChild(SVG.text(24, 24,
            "哈希表 m = " + M + "，H(k) = k mod " + M + "，线性探测 H_i = (H(k) + i) mod m",
            "vz-label", "start"));
          statLine(svg, 24, 46, "已存元素 n = " + used + "　装填因子 α = n/m = " + used + "/" + M +
            " ≈ " + (used / M).toFixed(2) + "　累计比较次数 = " + cmpEach, "var(--text-faint)");

          /* 当前 key 的公式 */
          if (key !== null && h >= 0) {
            var ft = SVG.text(24, 76, phase === "probe"
              ? "正在插入 key = " + key + "　H(" + key + ") = " + key + " mod " + M + " = " + h
              : (phase === "placed" ? "key = " + key + " 已放入" : "查看最终表"),
              "vz-label", "start");
            ft.setAttribute("font-size", "13.5");
            ft.setAttribute("font-weight", "700");
            ft.setAttribute("fill", phase === "placed" ? "var(--ok)" : "var(--brand)");
            svg.appendChild(ft);
          } else {
            var ft2 = SVG.text(24, 76, "查看最终表：计算成功的 ASL", "vz-label", "start");
            ft2.setAttribute("font-size", "13.5");
            ft2.setAttribute("font-weight", "700");
            ft2.setAttribute("fill", "var(--brand)");
            svg.appendChild(ft2);
          }

          /* 表本体 */
          var y = 100, x0 = 30;
          for (i = 0; i < M; i++) {
            var x = x0 + i * PITCH;
            var isCur = false;
            for (var c = 0; c < cs.length; c++) if (cs[c] === i) isCur = true;
            var cls = isCur ? "compare" : (snapTab[i] !== null ? "" : "dim");
            svg.appendChild(SVG.box(x, y, BOX, BOX, cls,
              snapTab[i] === null ? "—" : snapTab[i], isCur ? "on" : ""));
            svg.appendChild(SVG.label(x + BOX / 2, y + BOX + 16, String(i), "middle"));
          }
          /* 探测箭头 */
          for (var c2 = 0; c2 < cs.length; c2++) {
            drawPtr(svg, x0 + cs[c2] * PITCH + BOX / 2, y - 4,
              "第 " + (c2 + 1) + " 次探测", c2 === cs.length - 1 ? "var(--danger)" : "var(--text-faint)");
          }

          /* 堆积区可视化 */
          var runStart = -1, runLen = 0;
          for (i = 0; i <= M; i++) {
            var occ = i < M && snapTab[i] !== null;
            if (occ) { if (runStart < 0) { runStart = i; runLen = 1; } else runLen++; }
            else if (runStart >= 0) {
              if (runLen >= 2) {
                var rx1 = x0 + runStart * PITCH - 2;
                var rx2 = x0 + (runStart + runLen - 1) * PITCH + BOX + 2;
                var rt = SVG.text((rx1 + rx2) / 2, y + 96,
                  "堆积区：" + runLen + " 个连续占用", "vz-label", "middle");
                rt.setAttribute("fill", runLen >= 4 ? "var(--danger)" : "var(--warn)");
                svg.appendChild(rt);
                svg.appendChild(SVG.el("line", {
                  x1: rx1, y1: y + 82, x2: rx2, y2: y + 82,
                  stroke: runLen >= 4 ? "var(--danger)" : "var(--warn)", "stroke-width": 3
                }));
              }
              runStart = -1; runLen = 0;
            }
          }

          /* 已插入关键字列表 */
          var doneKeys = doneSnap;
          statLine(svg, 24, y + 140, "已插入序列：" + (doneKeys.length ? doneKeys.join(", ") : "（尚无）"),
            "var(--text-soft)");
          if (aslSnap > 0) {
            statLine(svg, 24, y + 162, "成功 ASL（当前）= " + aslSnap + "/" + doneKeys.length + " ≈ " +
              (aslSnap / doneKeys.length).toFixed(3) + "　（成功 ASL 的分母是元素个数 n）", "var(--brand)");
          }

          /* 末尾提示 */
          var t2 = SVG.text(24, 380, "提示：42 插入时会一路探测 9→10→0→1→2→3→4→5，共 8 次比较 —— 这就是堆积的后果。",
            "vz-label", "start");
          t2.setAttribute("fill", "var(--danger)");
          svg.appendChild(t2);
          statLine(svg, 24, 400 - 2, "", "var(--text-faint)");
          return svg;
        }
      });
    }

    /* totalCmp = 所有 key 比较次数的累加器：每插入成功一个就 += cmp，然后赋给 cmpSum。
       两者数值始终相等，它只是中间过渡变量。 */
    var totalCmp = 0;
    snap("初始状态：表长 m = 11 的哈希表全部为空。哈希函数取 H(k) = k mod 11（11 是不大于表长的最大质数）。", null, -1, [], 0, "init");

    for (var ki = 0; ki < KEYS.length; ki++) {
      var key = KEYS[ki];
      var h = ((key % M) + M) % M;
      var cursors = [];
      var cmp = 0;
      var placed = -1;
      snap("开始插入 <b>key = " + key + "</b>。先算 <code>H(" + key + ") = " + key + " mod " + M +
        " = " + h + "</code>，然后从 " + h + " 号位开始线性探测。", key, h, [], 0, "probe");

      for (var i = 0; i < M; i++) {
        var pos = (h + i) % M;
        cursors.push(pos);
        cmp++;
        if (table[pos] === null) {
          table[pos] = key;
          placed = pos;
          insertCmp[key] = cmp;
          totalCmp += cmp;
          cmpSum = totalCmp;
          snap("第 " + cmp + " 次探测：落到 <b>" + pos + " 号位，是空的 → 直接放入 key = " + key +
            "</b>（本次插入共比较 " + cmp + " 次，也就是将来查找它需要的比较次数）。",
            key, h, cursors.slice(), cmp, "placed");
          break;
        }
        snap("第 " + cmp + " 次探测：落到 " + pos + " 号位，已经被 <b>" + table[pos] +
          "</b> 占用了 → <b>冲突！</b>按线性探测规则试下一个位置 (H + " + (i + 1) + ") mod " + M + "。" +
          (i >= 3 ? "　注意探测链已经走了很长，这就是<b>堆积</b>。" : ""),
          key, h, cursors.slice(), cmp, "probe");
      }

      /* 每个 key 之后给一帧“保持现场” */
      snap("key = " + key + " 插入完成，落在 " + placed + " 号位（比较 " + cmp + " 次）。" +
        "当前 α = " + occupiedCount() + "/" + M + " ≈ " + (occupiedCount() / M).toFixed(2) + "。",
        key, h, [], cmp, "placed");
    }

    /* 最终统计帧 */
    /* succTotal = 成功 ASL 的分子（Σ 每个 key 的比较次数）；order = 明细文字（"42→8次" 这种）。 */
    var succTotal = 0, order = [];
    for (var q = 0; q < KEYS.length; q++) {
      succTotal += insertCmp[KEYS[q]];
      order.push(KEYS[q] + "→" + insertCmp[KEYS[q]] + "次");
    }
    snap("全部插入完毕。逐个统计查找成功需要的比较次数：" + order.join("，") +
      "。<b>ASL<sub>成功</sub> = " + succTotal + "/9 ≈ " + (succTotal / 9).toFixed(2) + "</b>。",
      null, -1, [], 0, "final");

    /* 失败 ASL：从每个哈希地址出发探到第一个空槽 */
    /* 失败 ASL：failTotal = 从 0~10 每个地址出发、探到第一个空槽的比较次数之和（分母是**表长 m**）；
       detail = 各起点的次数明细。 */
    var failTotal = 0, detail = [];
    /* liveTab = 最终表的副本：算失败 ASL 时要反复读它，拷一份免得和后面的帧纠缠。 */
    var liveTab = table.slice();
    for (var st = 0; st < M; st++) {
      var c = 0, p2 = st;
      while (true) { c++; if (liveTab[p2] === null) break; p2 = (p2 + 1) % M; if (c > M) break; }
      failTotal += c;
      detail.push(st + ":" + c);
    }
    snap("接着算<b>查找不成功</b>的 ASL：从每一个哈希地址（0~10 共 m = 11 种情形）出发，一路探测到<b>第一个空槽</b>为止。" +
      "各起点的比较次数依次是 " + detail.join("、") + "，合计 " + failTotal +
      "。<b>ASL<sub>不成功</sub> = " + failTotal + "/11 ≈ " + (failTotal / 11).toFixed(2) +
      "</b>（分母是<b>表长 m</b>，不是元素个数 n！）", null, -1, [], 0, "final");

    new DS.Viz(host, {
      title: "哈希表 · 线性探测插入",
      sub: "关键字 22,41,53,46,30,13,1,67,42；m = 11，H(k) = k mod 11",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     5) 链地址法：插入与查找
     ====================================================================== */
  (function hashChain() {
    var host = document.getElementById("viz-hash-chain");
    if (!host) return;

    /* M = 桶数组长度（= 哈希函数里的模数），11 个桶。 */
    var M = 11;
    /* KEYS = 依次插入的关键字；其中 99 会和别的关键字落在同一个桶里，用来演示同义词链。 */
    var KEYS = [99, 1, 23, 14, 55, 68, 11, 37, 46];
    var HEAD = true;                                     // true = 头插
    /* HEAD = true 头插（O(1)，链上顺序与插入顺序相反）；改成 false 就变尾插，要走到链尾 O(链长)。 */
    /* buckets[h] = 桶 h 上的同义词链表（普通数组，下标 0 就是链头）；
       它是活变量、会被插入不断改写，所以每帧画的是 bCopy 快照。 */
    var buckets = [];
    for (var i = 0; i < M; i++) buckets.push([]);
    var frames = [];

    var BX = 40, BW = 66, BH = 26, BY = 64, ROWH = 32;   // 桶数组布局
    /* 桶那一列的排版：每行 66×26，行距 32px，正好把 11 个桶叠下来；CH_* 是链结点圆心之间的水平间距 64px。 */
    var CH_X = BX + BW + 46, CH_W = 54, CH_STEP = 64;    // 链结点布局

    /* 推一帧。curKey = 当前操作的 key（null = 无）；curBucket = 它落入的桶号（null = 无）；
       visited = 已经走过的链结点坐标 [{b: 桶号, j: 链上第几个（0 基）}]；
       phase = "init"/"insert"/"search"/"found"/"miss"/"final"，只影响配色；totalCmp = 本帧显示的比较次数。 */
    function snap(desc, curKey, curBucket, visited, phase, totalCmp) {
      /* bCopy = **该帧的桶快照**：逐桶 slice() 深拷贝。
         build() 跑完时 buckets 已经是全部插完的最终形态，draw 里读它会每帧都画成终态。 */
      var bCopy = [];
      for (var i = 0; i < M; i++) bCopy.push(buckets[i].slice());
      frames.push({
        desc: desc,
        draw: function (s) {
          var maxLen = 1;
          for (var i = 0; i < M; i++) maxLen = Math.max(maxLen, bCopy[i].length);
          var H = BY + M * ROWH + 56;
          var W = Math.max(920, CH_X + maxLen * CH_STEP + 120);
          var svg = s.svg(W, H);

          svg.appendChild(SVG.text(24, 24,
            "链地址法：桶数组（长度 m = " + M + "）+ 每个桶挂一条同义词链表（" + (HEAD ? "头插" : "尾插") + "）",
            "vz-label", "start"));
          var n = 0;
          for (i = 0; i < M; i++) n += bCopy[i].length;
          statLine(svg, 24, 46, "已存元素 n = " + n + "　装填因子 α = n/m = " + n + "/" + M +
            " ≈ " + (n / M).toFixed(2) + "（链地址法的 α 可以 &gt; 1）", "var(--text-faint)");

          for (i = 0; i < M; i++) {
            var y = BY + i * ROWH;
            var isCur = (i === curBucket);
            svg.appendChild(SVG.el("rect", {
              x: BX, y: y, width: BW, height: BH, rx: 5,
              fill: isCur ? "var(--brand-soft)" : "var(--bg-soft)",
              stroke: isCur ? "var(--brand)" : "var(--border-strong)",
              "stroke-width": isCur ? 2.4 : 1.6
            }));
            var bt = SVG.text(BX + BW / 2, y + 18, "桶 " + i, "vz-label", "middle");
            if (isCur) { bt.setAttribute("fill", "var(--brand)"); bt.setAttribute("font-weight", "700"); }
            svg.appendChild(bt);

            /* 链 */
            if (bCopy[i].length === 0) {
              var nt = SVG.text(BX + BW + 16, y + 18, "∧", "vz-label", "start");
              nt.setAttribute("font-size", "14");
              svg.appendChild(nt);
            } else {
              var startY = y + BH / 2;
              svg.appendChild(SVG.line(BX + BW, startY, CH_X - 12, startY, "active", true));
              for (var j = 0; j < bCopy[i].length; j++) {
                var cx = CH_X + j * CH_STEP;
                var hit = false;
                for (var v = 0; v < visited.length; v++) if (visited[v].b === i && visited[v].j === j) hit = true;
                var cls = hit ? (phase === "found" ? "done" : "compare") : "";
                svg.appendChild(SVG.circle(cx + CH_W / 2 - 12, startY, 19, cls, bCopy[i][j],
                  /compare|done/.test(cls) ? "on" : ""));
                if (j < bCopy[i].length - 1)
                  svg.appendChild(SVG.line(cx + CH_W - 12, startY, cx + CH_STEP - 12, startY, "active", true));
              }
              var lastX = CH_X + (bCopy[i].length - 1) * CH_STEP + CH_W - 12;
              var at = SVG.text(lastX + 16, startY + 5, "∧", "vz-label", "start");
              at.setAttribute("font-size", "13");
              svg.appendChild(at);
            }
          }

          /* 说明区 */
          var infoX = CH_X + maxLen * CH_STEP + 40;
          if (infoX + 300 > W) infoX = Math.max(CH_X, W - 320);
          statLine(svg, infoX, BY + 18, curKey === null ? "当前：无操作" : ("当前 key = " + curKey),
            "var(--brand)");
          statLine(svg, infoX, BY + 42, "落入桶 " + (curBucket === null ? "—" : curBucket), "var(--text-soft)");
          statLine(svg, infoX, BY + 66, "比较次数 = " + (totalCmp === undefined ? 0 : totalCmp), "var(--text-soft)");
          statLine(svg, infoX, BY + 96, "要点：", "var(--text-soft)");
          statLine(svg, infoX, BY + 118, "• 头插 O(1)，链上顺序与插入顺序相反", "var(--text-faint)");
          statLine(svg, infoX, BY + 140, "• 删除只需摘结点，不需要墓碑", "var(--text-faint)");
          statLine(svg, infoX, BY + 162, "• 查找失败 = 把整条链走完", "var(--text-faint)");
          statLine(svg, infoX, BY + 184, "• 空桶记为 0 次比较（不是 1 次）", "var(--text-faint)");
          return svg;
        }
      });
    }

    /* ---------- 插入阶段 ---------- */
    snap("初始状态：桶数组 11 个桶全部为空。链地址法把冲突的元素挂到同一条链上，不再「抢占」别人的位置。",
      null, null, [], "init", 0);

    for (var ki = 0; ki < KEYS.length; ki++) {
      var key = KEYS[ki];
      var h = key % M;
      snap("插入 <b>key = " + key + "</b>：<code>H(" + key + ") = " + key + " mod " + M + " = " + h +
        "</code>，定位到桶 " + h + "。", key, h, [], "insert", 0);
      if (HEAD) buckets[h].unshift(key); else buckets[h].push(key);
      snap("把 " + key + " " + (HEAD ? "插到桶 " + h + " 链表的<b>头部</b>（O(1)）" : "接到桶 " + h + " 的尾部") +
        "。桶 " + h + " 现在有 " + buckets[h].length + " 个元素：" + buckets[h].join(" → ") + "。",
        key, h, [], "insert", 1);
    }

    /* ---------- 统计插入后的结果 ---------- */
    /* succTotal = 成功 ASL 的分子：Σ 链长×(链长+1)/2（链上第 k 个元素要比较 k 次）；
       lens = 非空桶的说明文字。 */
    var succTotal = 0, lens = [];
    for (var b = 0; b < M; b++) {
      succTotal += buckets[b].length * (buckets[b].length + 1) / 2;
      if (buckets[b].length) lens.push("桶" + b + "(" + buckets[b].length + "个)");
    }
    snap("插入完成，非空的桶有：" + lens.join("、") + "。链上第 k 个元素查找时需要比较 k 次，" +
      "所以 <b>ASL<sub>成功</sub> = Σ 链长(链长+1)/2 ÷ n = " + succTotal + "/9 ≈ " +
      (succTotal / 9).toFixed(3) + "</b>。", null, null, [], "final", 0);

    /* ---------- 查找阶段 ---------- */
    /* searchTrace(key, label)：演示一次查找 —— 沿桶 H(key) 的链逐个比较并推帧；
       返回值 {ok, cmp} 只用来写描述文字。 */
    function searchTrace(key, label) {
      var h = key % M;
      /* visited = 本次查找已经走过的链结点坐标，每次推帧前 slice() 一份传进去。 */
      var visited = [];
      snap("【查找】" + label + "：key = <b>" + key + "</b> → <code>H(" + key + ") = " + h +
        "</code>，先定位到桶 " + h + "，然后沿链逐个比较。", key, h, [], "search", 0);
      for (var j = 0; j < buckets[h].length; j++) {
        visited.push({ b: h, j: j });
        var hit = (buckets[h][j] === key);
        snap("沿桶 " + h + " 的链走到第 " + (j + 1) + " 个结点：" + buckets[h][j] +
          (hit ? "，<b>与 key 相等 → 查找成功</b>，共比较 " + (j + 1) + " 次。"
            : " ≠ " + key + "，继续沿链往下（已比较 " + (j + 1) + " 次）。"),
          key, h, visited.slice(), hit ? "found" : "search", j + 1);
        if (hit) return { ok: true, cmp: j + 1 };
      }
      snap("桶 " + h + " 的链已经走完（" + buckets[h].length + " 个结点都不等于 " + key +
        "），指针到达 ∧ → <b>查找失败</b>，共比较 " + buckets[h].length +
        " 次。<b>空桶算 0 次比较</b>，这一点和开放定址法不同。", key, h, visited.slice(), "miss",
        buckets[h].length);
      return { ok: false, cmp: buckets[h].length };
    }

    searchTrace(99, "找一个链尾的元素");
    searchTrace(100, "找一个不存在的元素");

    /* ---------- 失败 ASL ---------- */
    /* 失败 ASL：失败 = 把整条链走完，比较次数 = 该桶的链长（空桶算 0 次）；
       det = 各桶链长明细，failTotal = 合计（分母是桶数 m = 11）。 */
    var failTotal = 0, det = [];
    for (var q = 0; q < M; q++) { failTotal += buckets[q].length; det.push(buckets[q].length); }
    snap("最后算<b>查找不成功</b>的 ASL：失败意味着把整条链走完，比较次数 = 该桶的链长；空桶记 0。" +
      "各桶链长依次为 " + det.join("、") + "，合计 " + failTotal +
      "。<b>ASL<sub>不成功</sub> = " + failTotal + "/11 ≈ " + (failTotal / 11).toFixed(3) +
      "</b>（分母是桶数 m = 11）。", null, null, [], "final", 0);

    new DS.Viz(host, {
      title: "哈希表 · 链地址法",
      sub: "关键字 99,1,23,14,55,68,11,37,46；m = 11，头插；含一次查找成功与一次查找失败",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     6) 平方探测 vs 线性探测（并排对比）
     ====================================================================== */
  (function hashQuadratic() {
    var host = document.getElementById("viz-hash-quadratic");
    if (!host) return;

    /* M = 表长 11（同时是两种探测的模数）。 */
    var M = 11;
    /* KEYS = 同一串关键字，两边插入顺序完全一样；前几个故意同余 mod 11，这样两种探测的差别才看得出来。 */
    var KEYS = [47, 7, 29, 11, 16, 92, 22, 8, 3];        // 故意让前几个关键字同余 mod 11

    /* 平方探测的增量序列：0, +1, -1, +4, -4, +9, -9, +16, -16, ... */
    /* delta(i) = 平方探测第 i 步的增量：0, +1, −1, +4, −4, +9, −9 …
       即奇数步取 +k²、偶数步取 −k²（k = ⌊(i+1)/2⌋）；i 是**探测序号**，0 基。 */
    function delta(i) {
      if (i === 0) return 0;
      var k = Math.floor((i + 1) / 2);
      var sq = k * k;
      return (i % 2 === 1) ? sq : -sq;
    }
    /* mod(x) = 把 x 规约到 [0, M)：JS 的 % 遇到负数会返回负数，所以先 +M 再取模。 */
    function mod(x) { return ((x % M) + M) % M; }

    /* tabL / tabQ = 线性探测、平方探测各自的哈希表（长度 M，null = 空槽）；
       两张表都被就地改写，每帧画的是 sL / sQ 快照。 */
    var tabL = new Array(M).fill(null), tabQ = new Array(M).fill(null);
    /* cmpL / cmpQ = key → 它在两边插入时的比较次数（= 成功查找的比较次数）。
       本文件只往里写、没有再读（界面显示用的是下面的 sumL / sumQ），留着是为了对照单个 key。 */
    var cmpL = {}, cmpQ = {};
    /* sumL / sumQ = 两边「成功查找比较次数」的累计和（ASL 分子），随插入递增，推帧时冻结成 sumLSnap / sumQSnap。 */
    var sumL = 0, sumQ = 0;
    var frames = [];

    /* 推一帧。key = 正在插入的关键字（null = 已全部插完）；h = H(key)；
       phL / phQ = 两边**当前探测到第几步**（0 基；-1 = 本帧不强调落点）；i = 正在插第几个关键字（0 基，文案里显示 i+1）。 */
    function snap(desc, key, h, phL, phQ, i) {
      /* sL / sQ / curL / curQ / seenL / seenQ / sumLSnap / sumQSnap = **该帧的快照**：
         两张表的内容、指针落点、已经走过的槽位、两边的累计比较次数（活变量 sumL / sumQ 会被后续插入改写）。 */
      var sL = tabL.slice(), sQ = tabQ.slice();
      var curL = phL >= 0 ? mod(h + phL) : -1;
      var curQ = phQ >= 0 ? mod(h + delta(phQ)) : -1;
      var seenL = [], seenQ = [];
      if (phL >= 0) for (var a = 0; a <= phL; a++) seenL.push(mod(h + a));
      if (phQ >= 0) for (var b = 0; b <= phQ; b++) seenQ.push(mod(h + delta(b)));
      /* 关键：累计比较次数也必须在推帧时冻结。
         DS.Viz 会先跑完整个 build() 再逐帧渲染，
         若 draw 直接读活变量（sumL / sumQ），每一帧都会显示算法结束后的最终累计值。 */
      var sumLSnap = sumL, sumQSnap = sumQ;

      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(940, 420);
          var y1 = 96, y2 = 268, i2;

          svg.appendChild(SVG.text(24, 24,
            "同一串关键字 " + KEYS.join(",") + "，m = 11，H(k) = k mod 11，两种探测方式并排对比",
            "vz-label", "start"));
          statLine(svg, 24, 46, "当前插入第 " + (i + 1) + " 个关键字：" +
            (key === null ? "（已全部插完）" : "key = " + key + "，H(" + key + ") = " + h), "var(--brand)");
          statLine(svg, 24, 68, "提示：11 = 4×2 + 3，是 4j+3 形式的质数，所以平方探测一定能覆盖全表 11 个位置。",
            "var(--text-faint)");

          /* ----- 线性探测 ----- */
          var t1 = SVG.text(24, y1 - 22, "① 线性探测  H_i = (H(k) + i) mod 11　（只往一个方向挤 → 堆积）",
            "vz-label", "start");
          t1.setAttribute("font-weight", "700");
          t1.setAttribute("fill", "var(--danger)");
          svg.appendChild(t1);
          for (i2 = 0; i2 < M; i2++) {
            var x = 30 + i2 * PITCH;
            var isC = (i2 === curL);
            var walked = false;
            for (var w = 0; w < seenL.length; w++) if (seenL[w] === i2) walked = true;
            var cls = isC ? "compare" : (walked ? "warn" : "");
            svg.appendChild(SVG.box(x, y1, BOX, BOX, cls,
              sL[i2] === null ? "—" : sL[i2], (isC || walked) ? "on" : ""));
            svg.appendChild(SVG.label(x + BOX / 2, y1 + BOX + 16, String(i2), "middle"));
          }
          if (curL >= 0) drawPtr(svg, 30 + curL * PITCH + BOX / 2, y1 - 4, "i = " + phL, "var(--accent)");
          statLine(svg, 30, y1 + 96, "已插入的数：" + kv(sL) + "　｜　成功比较次数累计 = " + sumLSnap, "var(--text-soft)");

          /* ----- 平方探测 ----- */
          var t2 = SVG.text(24, y2 - 22, "② 平方探测  H_i = (H(k) ± i²) mod 11　（左右跳着找 → 不堆积）",
            "vz-label", "start");
          t2.setAttribute("font-weight", "700");
          t2.setAttribute("fill", "var(--ok)");
          svg.appendChild(t2);
          for (i2 = 0; i2 < M; i2++) {
            var x2 = 30 + i2 * PITCH;
            var isC2 = (i2 === curQ);
            var walked2 = false;
            for (var w2 = 0; w2 < seenQ.length; w2++) if (seenQ[w2] === i2) walked2 = true;
            var cls2 = isC2 ? "compare" : (walked2 ? "active" : "");
            svg.appendChild(SVG.box(x2, y2, BOX, BOX, cls2,
              sQ[i2] === null ? "—" : sQ[i2], (isC2 || walked2) ? "on" : ""));
            svg.appendChild(SVG.label(x2 + BOX / 2, y2 + BOX + 16, String(i2), "middle"));
          }
          if (curQ >= 0) {
            drawPtr(svg, 30 + curQ * PITCH + BOX / 2, y2 - 4,
              "i = " + phQ + "，d = " + delta(phQ), "var(--accent)");
          }
          statLine(svg, 30, y2 + 96, "已插入的数：" + kv(sQ) + "　｜　成功比较次数累计 = " + sumQSnap, "var(--text-soft)");

          /* 底部对比 */
          var concl = SVG.text(24, 404,
            "堆积对比：线性探测的连续占用块 = " + longestRun(sL) + " 个；平方探测的连续占用块 = " +
            longestRun(sQ) + " 个。",
            "vz-label", "start");
          concl.setAttribute("font-size", "13");
          concl.setAttribute("font-weight", "700");
          concl.setAttribute("fill", "var(--brand)");
          svg.appendChild(concl);
          return svg;
        }
      });
    }

    /* kv(tab) = 把表里非空的数按槽位顺序拼成字符串，只用于底部那行“已插入的数”。 */
    function kv(tab) {
      var r = [];
      for (var i = 0; i < M; i++) if (tab[i] !== null) r.push(tab[i]);
      return r.length ? r.join(",") : "（无）";
    }
    /* longestRun(tab) = 最长「连续占用块」的长度：扫 2M 格是为了处理首尾相接的绕回情况。 */
    function longestRun(tab) {
      var best = 0, cur = 0;
      for (var i = 0; i < 2 * M; i++) {
        if (tab[i % M] !== null) { cur++; best = Math.max(best, Math.min(cur, M)); }
        else cur = 0;
      }
      return best;
    }

    snap("初始状态：两张表都是空的。接下来用同一串关键字同时插入，观察两种探测方式的分道扬镳。",
      null, -1, -1, -1, -1);

    for (var ki = 0; ki < KEYS.length; ki++) {
      var key = KEYS[ki];
      var h = key % M;
      /* phL / phQ = 本轮两种探测各自已经探测了几步（-1 = 还没开始）。 */
      var phL = -1, phQ = -1;

      snap("插入 <b>key = " + key + "</b>：两种方法的起始地址相同，都是 <code>H(" + key + ") = " + key +
        " mod 11 = " + h + "</code>。", key, h, -1, -1, ki);

      /* 线性探测 */
      for (var a = 0; a < M; a++) {
        phL = a;
        var posL = mod(h + a);
        if (tabL[posL] === null) {
          tabL[posL] = key; cmpL[key] = a + 1; sumL += a + 1;
          snap("① 线性探测：第 " + (a + 1) + " 次探测落在 " + posL + " 号位，是空的 → 放入 " + key +
            "（比较 " + (a + 1) + " 次）。", key, h, phL, phQ, ki);
          break;
        }
        snap("① 线性探测：第 " + (a + 1) + " 次探测落在 " + posL + " 号位，被 <b>" + tabL[posL] +
          "</b> 占用 → 冲突，下一个位置是 " + mod(h + a + 1) + " 号。", key, h, phL, phQ, ki);
      }

      /* 平方探测 */
      for (var b = 0; b < M; b++) {
        phQ = b;
        var posQ = mod(h + delta(b));
        if (tabQ[posQ] === null) {
          tabQ[posQ] = key; cmpQ[key] = b + 1; sumQ += b + 1;
          snap("② 平方探测：第 " + (b + 1) + " 次探测用增量 d = " + delta(b) + "，落在 " + posQ +
            " 号位，是空的 → 放入 " + key + "（比较 " + (b + 1) + " 次）。" +
            (b < a ? "　<b>比线性探测少探测了 " + (a - b) + " 次！</b>" : ""), key, h, phL, phQ, ki);
          break;
        }
        snap("② 平方探测：第 " + (b + 1) + " 次探测用增量 d = " + delta(b) + "，落在 " + posQ +
          " 号位，被 <b>" + tabQ[posQ] + "</b> 占用 → 冲突，换个方向继续跳。", key, h, phL, phQ, ki);
      }
    }

    snap("全部插入完毕。对比两边的总比较次数：线性探测 " + sumL + " 次，平方探测 " + sumQ +
      " 次 —— 平方探测明显更少。再看连续占用块：线性 " + longestRun(tabL) + " 个连成一片，平方只有 " +
      longestRun(tabQ) + " 个，<b>这就是平方探测能缓解堆积的直接证据</b>。",
      null, -1, -1, -1, KEYS.length);

    /* 对比失败 ASL */
    /* 失败 ASL 的两个分子：从每个哈希地址出发探到第一个空槽的比较次数之和（分母都是表长 M = 11）。 */
    var failL = 0, failQ = 0;
    for (var st = 0; st < M; st++) {
      var c1 = 0, p1 = st;
      while (true) { c1++; if (tabL[p1] === null) break; p1 = (p1 + 1) % M; if (c1 > M) break; }
      failL += c1;
      var c2 = 0;
      while (true) {
        c2++;
        var pp = mod(st + delta(c2 - 1));
        if (tabQ[pp] === null) break;
        if (c2 > M) break;
      }
      failQ += c2;
    }
    snap("最后对比<b>查找不成功</b>的 ASL（从每个哈希地址出发探到第一个空槽，分母是表长 m = 11）：<br>" +
      "线性探测 = " + failL + "/11 ≈ " + (failL / 11).toFixed(2) + "；　" +
      "平方探测 = " + failQ + "/11 ≈ " + (failQ / 11).toFixed(2) + "。<br>" +
      "注意两者都还没到 α = 1，但线性探测的失败代价已经被堆积推高了不少。",
      null, -1, -1, -1, KEYS.length);

    new DS.Viz(host, {
      title: "平方探测 vs 线性探测",
      sub: "同一串关键字（前 4 个同余于 3 mod 11）在两种探测方式下的落点与堆积",
      build: function () { return { frames: frames }; }
    });
  })();

})();
