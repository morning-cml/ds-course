/* ==========================================================================
   ch10-viz.js —— 第 11 讲《八大排序算法图解（上）》· 交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG

   统一写法：每个算法都先跑一遍「可视化的状态机」，在真实算法的循环里调用
   snap(desc, marks) 把当前数组状态与高亮标记推成一帧，最后交给
   new DS.Viz(host, {title, sub, build(){ return {frames}; }}) 播放。
   这样动画与算法严格同步，不会出现「图与描述不符」。
   ========================================================================== */
(function () {
  "use strict";
  var SVG = DS.SVG;

  var BOX = 46, GAP = 8, PITCH = BOX + GAP, X0 = 40;

  /* ---------------- 通用小工具 ---------------- */

  /* 底色是 *-soft 的半透明色，文字用正文色最清楚（深浅主题都成立） */
  function onCls(cls) { return /active|done|warn|compare|pivot/.test(cls) ? "on" : ""; }

  /* 画一行数组格子：clsFn(i) 返回状态类名 */
  function cells(s, x0, y, arr, clsFn, box, pitch) {
    box = box || BOX;
    pitch = pitch || (box + 8);
    for (var i = 0; i < arr.length; i++) {
      var c = (clsFn ? clsFn(i) : "") || "";
      s.appendChild(SVG.box(x0 + i * pitch, y, box, box, c, arr[i], onCls(c)));
      s.appendChild(SVG.label(x0 + i * pitch + box / 2, y + box + 15, String(i), "middle"));
    }
  }

  /* 用 CSS 变量上色的格子（用于希尔排序的分组着色） */
  function colorCell(s, x, y, w, h, color, text) {
    var g = SVG.el("g");
    g.appendChild(SVG.el("rect", {
      x: x, y: y, width: w, height: h, rx: 6,
      fill: "var(" + color + "-soft)", stroke: "var(" + color + ")", "stroke-width": 2
    }));
    if (text !== undefined && text !== null) {
      g.appendChild(SVG.el("text", {
        x: x + w / 2, y: y + h / 2 + 5, "text-anchor": "middle", "class": "vz-text"
      }, String(text)));
    }
    return g;
  }

  /* 指针三角 + 文字（文字在三角<b>上方</b>，用于标注数组行上方的 i / j / min 等） */
  function ptr(s, cx, y, txt, color) {
    var c = color || "var(--brand)";
    var tri = SVG.path("M" + cx + "," + y + " l-7,-10 l14,0 z", "", false);
    tri.setAttribute("fill", c);
    tri.setAttribute("stroke", "none");
    s.appendChild(tri);
    var t = SVG.label(cx, y - 14, txt, "middle");
    t.setAttribute("fill", c);
    t.setAttribute("font-weight", "700");
    s.appendChild(t);
  }

  /* 指针三角 + 文字（文字在三角下方） */
  function ptrDown(s, cx, y, txt, color) {
    var c = color || "var(--brand)";
    var tri = SVG.path("M" + cx + "," + y + " l-7,-10 l14,0 z", "", false);
    tri.setAttribute("fill", c);
    tri.setAttribute("stroke", "none");
    s.appendChild(tri);
    var t = SVG.label(cx, y + 16, txt, "middle");
    t.setAttribute("fill", c);
    t.setAttribute("font-weight", "700");
    s.appendChild(t);
  }

  /* 小号灰色信息行 */
  function note(s, x, y, str) { s.appendChild(SVG.label(x, y, str, "start")); }

  /* 生成 marks：marksFrom(n, fn) */
  function marksFrom(n, fn) {
    var m = {};
    for (var i = 0; i < n; i++) {
      var v = fn(i);
      if (v) m[i] = v;
    }
    return m;
  }

  /* 尾部已就位区间 [from, n-1] 全部标绿 */
  function tailDone(n, from) {
    return marksFrom(n, function (i) { return i >= from ? "done" : ""; });
  }

  /* ==========================================================================
     演示 1：冒泡排序 —— 相邻比较、逆序交换、每轮冒一个最大值到末尾
     并演示「本趟无交换 → 提前结束」的优化标志 swapped
     ========================================================================== */
  (function bubbleViz() {
    var host = document.getElementById("viz-bubble");
    if (!host) return;

    var A0 = [5, 2, 9, 1, 7, 3, 8, 4, 6, 0];
    var A = A0.slice(), n = A.length;
    var frames = [], cmp = 0, swp = 0, round = 0, swapped = false, limit = n - 1;
    var W = 80 + n * PITCH, H = 200;

    function snap(desc, marks, extra) {
      var sa = A.slice(), r = round, c = cmp, w = swp, sw = swapped, lim = limit;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 8, 16, "轮次 " + r + "　比较 " + c + " 次　交换 " + w +
            " 次　本趟交换标记 swapped = " + (sw ? "true" : "false"));
          cells(svg, X0, 48, sa, function (i) { return marks[i] || ""; });
          if (lim < n - 1) {
            note(svg, X0 + (lim + 1) * PITCH, 48 + BOX + 32,
              "↑ 已就位（有序）区间 [" + (lim + 1) + ", " + (n - 1) + "]");
          }
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    snap("初始序列 <b>A = [" + A0.join(", ") + "]</b>，目标升序。" +
      "冒泡排序每一轮从左到右扫描未排序区间，<b>比较相邻两个元素，逆序就交换</b>，" +
      "于是一轮下来最大的元素会像气泡一样浮到区间末尾。", {}, null);

    for (var r = 0; r < n - 1; r++) {
      round = r + 1;
      swapped = false;
      limit = n - 1 - r;
      snap("第 " + round + " 轮开始：未排序区间是 <b>[0, " + limit + "]</b>，" +
        "本轮目标是把其中最大的元素「冒」到下标 " + limit + " 上。先把 swapped 置为 false。",
        tailDone(n, limit + 1), null);

      for (var j = 0; j < limit; j++) {
        var lv = A[j], rv = A[j + 1];
        cmp++;
        var m1 = tailDone(n, limit + 1);
        m1[j] = "compare"; m1[j + 1] = "compare";
        snap("比较相邻的 <code>A[" + j + "] = " + lv + "</code> 与 <code>A[" + (j + 1) + "] = " + rv +
          "</code>。", m1, (function (jj) {
            return function (svg) {
              ptr(svg, X0 + jj * PITCH + BOX / 2, 44, "j=" + jj, "var(--accent)");
              ptr(svg, X0 + (jj + 1) * PITCH + BOX / 2, 44, "j+1=" + (jj + 1), "var(--accent)");
            };
          })(j));

        if (lv > rv) {
          A[j] = rv; A[j + 1] = lv;
          swp++; swapped = true;
          var m2 = tailDone(n, limit + 1);
          m2[j] = "warn"; m2[j + 1] = "warn";
          snap("<b>" + lv + " 大于 " + rv + "</b>，属于逆序 → 交换这两个元素，" +
            "较大的 " + lv + " 往右走一格。累计交换 " + swp + " 次。", m2, null);
        } else {
          snap("<b>" + lv + " ≤ " + rv + "</b>，已经有序 → 不交换，两个指针同时右移。", m1, null);
        }
      }

      var mEnd = tailDone(n, limit);
      snap("第 " + round + " 轮扫描结束：本趟一共交换了 " + (swapped ? "若干" : "0") +
        " 次，<b>A[" + limit + "] = " + A[limit] + "</b> 已经是未排序区间的最大值，" +
        "它的最终位置就此确定，下一轮不必再参与比较。", mEnd, null);

      if (!swapped) {
        snap("<b>提前结束！</b>本趟（第 " + round + " 轮）从头到尾<b>没有发生任何交换</b>，" +
          "说明整个序列已经有序，后面几轮纯属浪费 —— 这就是冒泡排序最重要的优化：" +
          "用一个 <code>swapped</code> 标志位把最好情况从 O(n²) 降到 <b>O(n)</b>。",
          tailDone(n, 0), null);
        break;
      }
    }

    snap("排序完成：<b>A = [" + A.join(", ") + "]</b>。" +
      "全程比较 " + cmp + " 次、交换 " + swp + " 次。" +
      "本例中 0 一开始在最后一个位置，每一轮只能往前挪一格，所以 swapped 始终为真、" +
      "没有触发提前结束；若把输入换成接近有序的 <code>[2,1,4,3,6,5,8,7,9]</code>，" +
      "第 2 轮就会因为「本趟无交换」而立刻收工。", tailDone(n, 0), null);

    new DS.Viz(host, {
      title: "冒泡排序",
      sub: "A = [" + A0.join(", ") + "]　相邻比较、逆序交换、无交换即提前结束",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 2：简单选择排序 —— 每轮从未排序区间里挑最小值，与区间首位交换
     ========================================================================== */
  (function selectionViz() {
    var host = document.getElementById("viz-selection");
    if (!host) return;

    var A0 = [5, 2, 9, 1, 7, 3, 8, 4, 6, 0];
    var A = A0.slice(), n = A.length;
    var frames = [], cmp = 0, swp = 0, round = 0;
    var W = 80 + n * PITCH, H = 200;

    function snap(desc, marks, extra) {
      var sa = A.slice(), r = round, c = cmp, w = swp;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 8, 16, "轮次 " + r + "　比较 " + c + " 次　交换 " + w +
            " 次（交换次数上限 n−1 = " + (n - 1) + "）");
          cells(svg, X0, 48, sa, function (i) { return marks[i] || ""; });
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    snap("初始序列 <b>A = [" + A0.join(", ") + "]</b>。" +
      "选择排序的思路非常朴素：<b>每一轮从未排序区间里挑出最小的元素，和区间第一个位置交换</b>。" +
      "它和冒泡的区别是：冒泡边走边换，选择排序<b>先看完再换一次</b>。", {}, null);

    for (var r = 0; r < n - 1; r++) {
      round = r + 1;
      var head = marksFrom(n, function (i) { return i < r ? "done" : ""; });
      head[r] = "active";
      snap("第 " + round + " 轮：未排序区间是 <b>[" + r + ", " + (n - 1) + "]</b>。" +
        "先假设 A[" + r + "] = " + A[r] + " 就是最小值，记最小值下标 <code>minIdx = " + r + "</code>。",
        head, null);

      var minIdx = r;
      for (var j = r + 1; j < n; j++) {
        cmp++;
        var m1 = marksFrom(n, function (i) { return i < r ? "done" : ""; });
        m1[minIdx] = "active";
        m1[j] = "compare";
        snap("比较 <code>A[" + j + "] = " + A[j] + "</code> 与当前最小值 <code>A[" + minIdx + "] = " +
          A[minIdx] + "</code>。", m1, (function (jj, mv) {
            return function (svg) {
              ptr(svg, X0 + jj * PITCH + BOX / 2, 44, "j=" + jj, "var(--accent)");
              ptr(svg, X0 + mv * PITCH + BOX / 2, 44, "min", "var(--brand)");
            };
          })(j, minIdx));

        if (A[j] < A[minIdx]) {
          var oldIdx = minIdx, oldVal = A[minIdx];
          minIdx = j;
          var m2 = marksFrom(n, function (i) { return i < r ? "done" : ""; });
          m2[minIdx] = "warn";
          snap("<b>A[" + j + "] = " + A[j] + " 小于原最小值 A[" + oldIdx + "] = " + oldVal + "</b>，" +
            "更小！更新最小值下标 <code>minIdx = " + j + "</code>。" +
            "注意这里<b>只记下标，不动数组</b>。", m2, null);
        }
      }

      var mFind = marksFrom(n, function (i) { return i < r ? "done" : ""; });
      mFind[minIdx] = "active"; mFind[r] = "compare";
      snap("本轮扫描完毕，未排序区间的最小值是 <code>A[" + minIdx + "] = " + A[minIdx] +
        "</code>。接下来把它和区间第一个位置 A[" + r + "] 交换。", mFind, null);

      if (minIdx !== r) {
        var t = A[r]; A[r] = A[minIdx]; A[minIdx] = t;
        swp++;
        var m3 = marksFrom(n, function (i) { return i < r ? "done" : ""; });
        m3[r] = "warn"; m3[minIdx] = "warn";
        snap("交换 <code>A[" + r + "]</code> 与 <code>A[" + minIdx + "]</code>：" +
          "最小值 " + A[r] + " 来到下标 " + r + "，" + A[minIdx] + " 被换到下标 " + minIdx + "。" +
          "一轮<b>最多只交换一次</b>，这是选择排序最值钱的性质。", m3, null);
      } else {
        snap("最小值本来就在 A[" + r + "] 上，<b>不需要交换</b>——" +
          "这也说明「交换次数最多 n−1 次」是一个上界，实际往往更少。", mFind, null);
      }

      var mDone = marksFrom(n, function (i) { return i <= r ? "done" : ""; });
      snap("A[" + r + "] = " + A[r] + " 就位，有序区扩大到 <b>[0, " + r + "]</b>。" +
        "下一轮只需要在 [" + (r + 1) + ", " + (n - 1) + "] 里继续找最小值。", mDone, null);
    }

    snap("排序完成：<b>A = [" + A.join(", ") + "]</b>。全程比较 " + cmp +
      " 次、交换 " + swp + " 次。<br>请注意：无论数据是否已经有序，选择排序的比较次数<b>永远是 n(n−1)/2</b>，" +
      "因为每一轮都必须老老实实把未排序区间扫一遍才能确定最小值。", tailDone(n, 0), null);

    new DS.Viz(host, {
      title: "简单选择排序",
      sub: "A = [" + A0.join(", ") + "]　每轮选最小、只交换一次",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 3：直接插入排序 —— 把第 i 个元素插入前面已经有序的部分
     ========================================================================== */
  (function insertionViz() {
    var host = document.getElementById("viz-insertion");
    if (!host) return;

    var A0 = [5, 2, 9, 1, 7, 3, 8, 4, 6, 0];
    var A = A0.slice(), n = A.length;
    var frames = [], cmp = 0, mv = 0, i = 0;
    var W = 80 + n * PITCH, H = 216;

    function snap(desc, marks, key, hole, extra) {
      var sa = A.slice(), ii = i, c = cmp, m = mv;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 8, 16, "待插入位置 i = " + ii + "　比较 " + c + " 次　移动 " + m +
            " 次　有序区 = [0, " + Math.max(ii - 1, 0) + "]");
          cells(svg, X0, 52, sa, function (k) { return marks[k] || ""; });
          if (key !== null && key !== undefined) {
            svg.appendChild(SVG.label(X0 - 26, 66, "key", "end"));
            svg.appendChild(colorCell(svg, X0 - 24, 40, BOX, BOX, "--purple", key));
            svg.appendChild(SVG.label(X0 + 4, 132, "↑ 暂存待插入元素 key = " + key, "start"));
          }
          if (hole !== null && hole !== undefined && hole >= 0 && hole < n) {
            svg.appendChild(SVG.el("rect", {
              x: X0 + hole * PITCH, y: 52, width: BOX, height: BOX, rx: 6,
              "class": "vz-box hole"
            }));
          }
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    snap("初始状态：把 <b>A[0]</b> 单独看成已经有序的区间，剩下的 A[1.." + (n - 1) +
      "] 逐个往里面插。插入排序的核心动作只有两个：<b>比较</b>与<b>右移</b>。", 
      marksFrom(n, function (k) { return k === 0 ? "done" : ""; }), null, -1, null);

    for (i = 1; i < n; i++) {
      var key = A[i];
      var mHead = marksFrom(n, function (k) { return k < i ? "done" : ""; });
      mHead[i] = "pivot";
      snap("第 " + i + " 步：取出 <code>key = A[" + i + "] = " + key + "</code> 暂存起来，" +
        "下标 " + i + " 的位置就空出来了（图中虚线框）。" +
        "前面 <b>A[0.." + (i - 1) + "] 已经是有序区</b>。", mHead, key, -1, null);

      var j = i - 1;
      while (true) {
        if (j < 0) {
          snap("j 已经越过下标 0，说明 <b>key = " + key + " 比有序区里所有元素都小</b>，" +
            "它应该插到最前面（下标 0）。", mHead, key, 0, null);
          break;
        }
        cmp++;
        var mCmp = marksFrom(n, function (k) { return k < i ? "done" : ""; });
        mCmp[j] = "compare";
        snap("比较有序区里的 <code>A[" + j + "] = " + A[j] + "</code> 与 <code>key = " + key + "</code>。",
          mCmp, key, j + 1, (function (jj) {
            return function (svg) { ptr(svg, X0 + jj * PITCH + BOX / 2, 50, "j=" + jj, "var(--accent)"); };
          })(j));

        if (A[j] > key) {
          A[j + 1] = A[j];
          mv++;
          var mShift = marksFrom(n, function (k) { return k < i ? "done" : ""; });
          mShift[j] = "warn"; mShift[j + 1] = "warn";
          snap("<b>A[" + j + "] = " + A[j] + " 大于 key = " + key + "</b> → 这个元素必须给 key 让位，" +
            "<b>整体右移一格</b>（A[" + j + "] → A[" + (j + 1) + "]）。这是插入排序的主要时间开销，" +
            "累计移动 " + mv + " 次。", mShift, key, j, null);
          j--;
        } else {
          snap("<b>A[" + j + "] = " + A[j] + " ≤ key = " + key + "</b> → 位置找到了，" +
            "key 应该插在 A[" + (j + 1) + "]。停止右移。", mCmp, key, j + 1, null);
          break;
        }
      }

      A[j + 1] = key;
      var mPut = marksFrom(n, function (k) { return k <= i ? "done" : ""; });
      mPut[j + 1] = "warn";
      snap("把 key = " + key + " 写入 <code>A[" + (j + 1) + "]</code>。" +
        "此时 A[0.." + i + "] 重新变得有序。", mPut, null, -1, null);

      var mGrow = marksFrom(n, function (k) { return k <= i ? "done" : ""; });
      snap("有序区扩大为 <b>A[0.." + i + "] = [" + A.slice(0, i + 1).join(", ") + "]</b>，" +
        "待处理元素还剩 " + (n - 1 - i) + " 个。", mGrow, null, -1, null);
    }

    snap("排序完成：<b>A = [" + A.join(", ") + "]</b>。全程比较 " + cmp +
      " 次、移动 " + mv + " 次。<br>对比一下：数据完全逆序时比较与移动都是 n(n−1)/2 次（最坏 O(n²)）；" +
      "而数据已经基本有序时，每个元素几乎只比较一次就停下，总代价接近 <b>O(n)</b>。", tailDone(n, 0), null, -1, null);

    new DS.Viz(host, {
      title: "直接插入排序",
      sub: "A = [" + A0.join(", ") + "]　取出 key、右移让位、落位",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 4：希尔排序 —— 缩小增量，先分组做插入排序，最后 gap = 1 收尾
     ========================================================================== */
  (function shellViz() {
    var host = document.getElementById("viz-shell");
    if (!host) return;

    var A0 = [8, 9, 1, 7, 2, 3, 5, 4, 6, 0];
    var A = A0.slice(), n = A.length;
    var gaps = [5, 2, 1];
    var frames = [], cmp = 0, mv = 0, gap = 0, round = 0;
    var W = 80 + n * PITCH, H = 250;
    var COLORS = ["--brand", "--accent", "--ok", "--purple", "--danger", "--warn"];

    function snap(desc, marks, extra) {
      var sa = A.slice(), g = gap, r = round, c = cmp, m = mv;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 8, 16, "第 " + r + " 趟　当前增量 gap = " + g + "　比较 " + c +
            " 次　移动 " + m + " 次　共 " + (n - g) + " 个元素需要处理");
          for (var k = 0; k < n; k++) {
            var cls = (marks && marks[k]) || "";
            var col = g > 0 ? COLORS[k % g % COLORS.length] : "--brand";
            var x = X0 + k * PITCH;
            if (/warn|compare|done|active/.test(cls)) {
              svg.appendChild(SVG.box(x, 48, BOX, BOX, cls, sa[k], onCls(cls)));
            } else {
              svg.appendChild(colorCell(svg, x, 48, BOX, BOX, col, sa[k]));
            }
            svg.appendChild(SVG.label(x + BOX / 2, 48 + BOX + 15, String(k), "middle"));
            svg.appendChild(SVG.label(x + BOX / 2, 48 + BOX + 30, "组" + (k % (g || 1)), "middle"));
          }
          note(svg, X0, H - 26, "颜色相同的格子属于同一组（下标对 gap 取模相同），组内做直接插入排序");
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    snap("初始序列 <b>A = [" + A0.join(", ") + "]</b>。" +
      "希尔排序（Shell Sort）又叫<b>缩小增量排序</b>：先取一个较大的增量 gap，" +
      "把下标相差 gap 的元素分成一组，<b>组内先做直接插入排序</b>；" +
      "然后不断缩小 gap，最后 gap = 1 时就是对整个序列做一次插入排序。" +
      "<br>为什么要这么折腾？因为插入排序在<b>基本有序</b>时极快，" +
      "而前面几趟大 gap 的排序正是为了让序列「大致有序」，给最后一趟铺路。",
      {}, null);

    for (var gi = 0; gi < gaps.length; gi++) {
      gap = gaps[gi];
      round = gi + 1;
      snap("<b>第 " + round + " 趟：gap = " + gap + "</b>。" +
        "此时序列被分成 " + gap + " 组：第 t 组 = { A[t], A[t+" + gap + "], A[t+" + (2 * gap) + "], … }。" +
        "把每组看成一个小数组，各自做直接插入排序。" +
        "注意：元素跨度大，一次移动就能跳过很长的距离，可能一次性消除大量逆序对。", {}, null);

      for (var i = gap; i < n; i++) {
        var key = A[i];
        var mHead = {};
        mHead[i] = "pivot";
        snap("处理 <code>A[" + i + "] = " + key + "</code>：它属于<b>第 " + (i % gap) +
          " 组</b>（同组下标为 " + i + ", " + (i - gap) + ", " + (i - 2 * gap) + ", …）。" +
          "把它暂存为 key，准备在组内往前插。", mHead, (function (ii, g) {
            return function (svg) {
              ptr(svg, X0 + ii * PITCH + BOX / 2, 44, "i=" + ii, "var(--purple)");
            };
          })(i, gap));

        var j = i - gap;
        while (true) {
          if (j < 0) {
            snap("j < 0：key = " + key + " 是这一组里最小的元素，直接放到组内第一个位置（下标 " +
              (j + gap) + "）。", mHead, null);
            break;
          }
          cmp++;
          var mCmp = {}; mCmp[j] = "compare"; mCmp[i] = "pivot";
          snap("组内比较：<code>A[" + j + "] = " + A[j] + "</code>（同组前一个元素）与 <code>key = " +
            key + "</code>。", mCmp, null);

          if (A[j] > key) {
            A[j + gap] = A[j];
            mv++;
            var mSh = {}; mSh[j] = "warn"; mSh[j + gap] = "warn";
            snap("<b>" + A[j] + " 大于 " + key + "</b> → 同组内右移 <b>gap = " + gap +
              "</b> 格（A[" + j + "] → A[" + (j + gap) + "]）。" +
              "这正是一次「跨越大步」的移动，是希尔排序比插入排序快的关键。", mSh, null);
            j -= gap;
          } else {
            snap("<b>" + A[j] + " ≤ " + key + "</b> → 位置确定，key 应插在 A[" + (j + gap) + "]。",
              mCmp, null);
            break;
          }
        }
        A[j + gap] = key;
        var mPut = {}; mPut[j + gap] = "done";
        snap("把 key = " + key + " 写回 <code>A[" + (j + gap) + "]</code>，" +
          "第 " + (i % gap) + " 组到目前为止已经有序。", mPut, null);
      }

      if (gap > 1) {
        snap("<b>gap = " + gap + " 这一趟结束</b>，序列变成 <b>[" + A.join(", ") + "]</b>。" +
          "和原始序列比一比：大的元素已经大致跑到后面、小的跑到前面，" +
          "整个序列比之前「更有序」了 —— 这就是为最后一趟 gap = 1 做的准备。", {}, null);
      } else {
        snap("<b>gap = 1 这一趟结束，排序完成：A = [" + A.join(", ") + "]</b>。" +
          "全程比较 " + cmp + " 次、移动 " + mv + " 次。<br>" +
          "如果一开始就用 gap = 1（也就是纯插入排序），本例需要多得多的移动次数；" +
          "希尔排序用「先粗调、再细调」换来了明显的加速。", tailDone(n, 0), null);
      }
    }

    new DS.Viz(host, {
      title: "希尔排序（缩小增量）",
      sub: "A = [" + A0.join(", ") + "]　增量序列 " + gaps.join(" → "),
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 5：堆排序 —— 数组 + 完全二叉树双视图
     建堆阶段：从最后一个非叶结点 ⌊n/2⌋−1 往前，逐个 sift down
     排序阶段：堆顶与末尾交换 → 堆规模减一 → 新的堆顶下沉
     ========================================================================== */
  (function heapViz() {
    var host = document.getElementById("viz-heap");
    if (!host) return;

    var A0 = [5, 2, 9, 1, 7, 3, 8, 4, 6, 0];
    var A = A0.slice(), n = A.length;
    var frames = [], cmp = 0, swp = 0, size = n, phase = "建堆阶段";
    var W = 860, H = 442, XA = 200, BA = 40, PA = 46, TREE_Y = 176, TREE_GAP = 74;

    /* 把数组画成一棵完全二叉树：结点上标值，右下角标数组下标 */
    function heapTree(s, arr, sz, marks, x0, w0, y0, gapY) {
      var levels = [], idx = 0, d = 0;
      while (idx < arr.length) {
        var cnt = Math.pow(2, d), lv = [];
        for (var k = 0; k < cnt && idx < arr.length; k++, idx++) lv.push(idx);
        levels.push(lv);
        d++;
      }
      var R = 19, pos = {};
      for (var dd = 0; dd < levels.length; dd++) {
        var span = w0 / (levels[dd].length + 1);
        for (var i = 0; i < levels[dd].length; i++) {
          pos[levels[dd][i]] = { x: x0 + span * (i + 1), y: y0 + dd * gapY };
        }
      }
      for (var v = 1; v < arr.length; v++) {
        var par = Math.floor((v - 1) / 2);
        if (!pos[par] || !pos[v]) continue;
        s.appendChild(SVG.line(pos[par].x, pos[par].y + R, pos[v].x, pos[v].y - R,
          v < sz ? "done" : "dim"));
      }
      for (var v2 = 0; v2 < arr.length; v2++) {
        var cls = (marks && marks[v2]) || "";
        if (v2 >= sz) cls = cls ? cls + " dim" : "dim";
        s.appendChild(SVG.circle(pos[v2].x, pos[v2].y, R, cls, arr[v2], onCls(cls)));
        s.appendChild(SVG.label(pos[v2].x + R + 1, pos[v2].y - R + 4, String(v2), "start"));
      }
    }

    function snap(desc, marks, extra) {
      var sa = A.slice(), sz = size, ph = phase, c = cmp, w = swp;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 6, 16, ph + "　堆的有效规模 size = " + sz + "　比较 " + c + " 次　交换 " + w + " 次");
          cells(svg, XA, 34, sa, function (i) {
            return (marks && marks[i]) || (i >= sz ? "done" : "");
          }, BA, PA);
          note(svg, XA, 34 + BA + 32, "数组视图：下标 i 的左孩子 2i+1、右孩子 2i+2、父结点 ⌊(i−1)/2⌋");
          heapTree(svg, sa, sz, marks, 0, W, TREE_Y, TREE_GAP);
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    /* 下沉：把 p 处的元素一路往下换到合适的位置 */
    function siftDown(p, sz) {
      while (true) {
        var l = 2 * p + 1, r = 2 * p + 2;
        if (l >= sz) {
          snap("结点 A[" + p + "] = " + A[p] + " <b>是叶子</b>（2×" + p + "+1 = " + l +
            " 已经超出堆的范围），没有孩子可比，下沉结束。", oneMark(p, "active"), null);
          return;
        }
        var bigger = l;
        if (r < sz) {
          cmp++;
          var mc = {}; mc[p] = "active"; mc[l] = "compare"; mc[r] = "compare";
          snap("先比较 A[" + p + "] 的两个孩子：<b>左孩子 A[" + l + "] = " + A[l] + "</b>、" +
            "<b>右孩子 A[" + r + "] = " + A[r] + "</b>，挑出较大的那个准备上浮。", mc, null);
          if (A[r] > A[l]) bigger = r;
        } else {
          var mo = {}; mo[p] = "active"; mo[l] = "compare";
          snap("A[" + p + "] 只有左孩子 A[" + l + "] = " + A[l] + "（右孩子下标 " + r +
            " 已越界），它就是唯一候选。", mo, null);
        }
        cmp++;
        if (A[bigger] > A[p]) {
          var mm = {}; mm[p] = "warn"; mm[bigger] = "warn";
          snap("再比较父结点 A[" + p + "] = " + A[p] + " 与较大的孩子 A[" + bigger + "] = " + A[bigger] +
            "：<b>孩子更大</b>，不满足大根堆性质 → 交换，让父结点下沉一层。", mm, null);
          var t = A[p]; A[p] = A[bigger]; A[bigger] = t; swp++;
          snap("交换完成：" + A[p] + " 升到下标 " + p + "，" + A[bigger] + " 落到下标 " + bigger +
            "。交换之后可能又破坏了下一层的大根堆性质，所以指针继续往下走。", oneMark(bigger, "active"), null);
          p = bigger;
        } else {
          var ms = {}; ms[p] = "active"; ms[bigger] = "compare";
          snap("再比较父结点 A[" + p + "] = " + A[p] + " 与较大的孩子 A[" + bigger + "] = " + A[bigger] +
            "：<b>父结点不小于孩子</b>，大根堆性质成立，下沉结束。", ms, null);
          return;
        }
      }
    }
    function oneMark(i, cls) { var m = {}; m[i] = cls; return m; }

    phase = "建堆阶段";
    snap("初始数组 <b>A = [" + A0.join(", ") + "]</b>。堆排序第一步是<b>建堆</b>：" +
      "把数组当成一棵完全二叉树（下标 i 的左孩子是 2i+1，右孩子是 2i+2），" +
      "然后自底向上把它整形成<b>大根堆</b> —— 每个父结点都不小于它的孩子，" +
      "于是堆顶 A[0] 就是整个序列的最大值。", {}, null);

    snap("从哪里开始？从<b>最后一个非叶结点</b>开始，它的下标是 <b>⌊n/2⌋ − 1 = " +
      (Math.floor(n / 2) - 1) + "</b>。因为下标 ≥ ⌊n/2⌋ 的结点全是叶子，叶子本身就是一个合法的堆。" +
      "然后<b>从后往前</b>对每个结点做「下沉 sift down」——这样处理到某个结点时，" +
      "它的左右子树一定已经是堆了，下沉才有意义。", {}, null);

    for (var b = Math.floor(n / 2) - 1; b >= 0; b--) {
      snap("<b>对结点 A[" + b + "] = " + A[b] + " 执行下沉</b>（它的左右子树都已经是合法的大根堆）。",
        oneMark(b, "active"), null);
      siftDown(b, n);
    }

    snap("建堆完成！此时 <b>A[0] = " + A[0] + " 就是全局最大值</b>，整棵树处处满足" +
      "「父结点 ≥ 孩子」。注意建堆只花了 O(n) 的时间（证明见正文 11.6.3）。", oneMark(0, "done"), null);

    phase = "排序阶段";
    for (var end = n - 1; end >= 1; end--) {
      var m1 = {}; m1[0] = "warn"; m1[end] = "warn";
      snap("<b>把堆顶与堆的最后一个元素交换</b>：A[0] = " + A[0] + "（当前最大值）↔ A[" + end + "] = " +
        A[end] + "。交换后最大值就落到了下标 " + end + " —— 那就是它的最终位置。", m1, null);
      var t = A[0]; A[0] = A[end]; A[end] = t; swp++;
      size = end;
      snap("交换完成，<b>堆的有效规模减一：size = " + size + "</b>，从下标 " + end +
        " 往后是已排序区，不再属于堆（树中被淡化）。此刻堆顶 A[0] = " + A[0] +
        " 是原来末尾的小元素，八成破坏了堆性质，需要再下沉一次。",
        oneMark(0, "active"), null);
      siftDown(0, size);
      snap("堆重新调整完毕，<b>A[" + end + "] = " + A[end] + " 就位</b>，已排序区扩大到 [" + end + ", " +
        (n - 1) + "]。", oneMark(end, "done"), null);
    }

    snap("排序完成：<b>A = [" + A.join(", ") + "]</b>。<br>堆排序 = <b>O(n) 建堆</b> + " +
      "<b>n−1 次「交换堆顶 + 下沉」</b>，每次下沉 O(log n)，所以总时间 <b>O(n log n)</b>，" +
      "而且<b>原地</b>（只用 O(1) 辅助空间）、最坏情况也是 O(n log n)，不会像快排那样退化。" +
      "代价是常数较大、而且对 CPU 缓存不友好（元素跳跃访问），另外它<b>不稳定</b>。",
      tailDone(n, 0), null);

    new DS.Viz(host, {
      title: "堆排序（数组 + 完全二叉树）",
      sub: "A = [" + A0.join(", ") + "]　先自底向上建大根堆，再反复「换顶 → 缩堆 → 下沉」",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 6 / 7：归并排序（递归版）与「归并求逆序对」
     共用同一个状态机，countInv = true 时额外统计逆序对
     ========================================================================== */
  function buildMergeFrames(A0, countInv) {
    var A = A0.slice(), n = A.length;
    var T = new Array(n);
    for (var z = 0; z < n; z++) T[z] = null;
    var frames = [], cmp = 0, writes = 0, inv = 0;
    var path = [];
    var W = 780, XP = 140, P = 50, B = 42;

    function snap(desc, marks, tmarks, extra) {
      var sa = A.slice(), st = T.slice(), ps = [], c = cmp, wr = writes, iv = inv;
      for (var q = 0; q < path.length; q++) ps.push({ l: path[q].l, r: path[q].r, d: path[q].d });
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, 330);
          note(svg, 8, 14, "比较 " + c + " 次　写入临时数组 " + wr + " 次" +
            (countInv ? "　累计逆序对 " + iv + " 个" : ""));
          /* 上方：当前递归路径上每一层的区间，用短横线表示 */
          for (var q2 = 0; q2 < ps.length; q2++) {
            var e = ps[q2], y = 30 + e.d * 13;
            var x1 = XP + e.l * P, wd = (e.r - e.l + 1) * P - GAP;
            var cur = (q2 === ps.length - 1);
            svg.appendChild(SVG.el("rect", {
              x: x1, y: y, width: Math.max(8, wd), height: 9, rx: 4,
              fill: cur ? "var(--brand)" : "var(--border-strong)", opacity: cur ? 0.95 : 0.6
            }));
            note(svg, 8, y + 9, "第 " + e.d + " 层 [" + e.l + ", " + e.r + "]");
          }
          if (!ps.length) note(svg, 8, 39, "（还没有进入任何递归区间）");
          /* 数组 A */
          svg.appendChild(SVG.label(XP - 14, 137, "A", "end"));
          cells(svg, XP, 116, sa, function (i) { return (marks && marks[i]) || ""; }, B, P);
          /* 临时数组 T */
          svg.appendChild(SVG.label(XP - 14, 227, "T", "end"));
          cells(svg, XP, 206, st.map(function (v) {
            return (v === null || v === undefined) ? "·" : v;
          }), function (i) {
            var v = st[i];
            return (tmarks && tmarks[i]) || (v === null || v === undefined ? "dim" : "done");
          }, B, P);
          for (var t2 = 0; t2 < n; t2++) {
            if (st[t2] === null || st[t2] === undefined) {
              svg.appendChild(SVG.el("rect", {
                x: XP + t2 * P, y: 206, width: B, height: B, rx: 6, "class": "vz-box hole"
              }));
            }
          }
          note(svg, 8, 288, "临时数组 T 只用来暂存合并结果；合并完一段就整段写回 A。" +
            (countInv ? "逆序对的统计就藏在「取右段元素」的那一步里。" : ""));
          note(svg, 8, 308, "上方短横线 = 当前递归路径上的区间划分，颜色越深表示正在处理的区间越靠内层。");
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    function runMarks(l, mid, r, i, j) {
      var m = {};
      for (var q = l; q <= r; q++) {
        if (q <= mid) m[q] = q < i ? "dim" : "active";
        else m[q] = q < j ? "dim" : "compare";
      }
      return m;
    }
    function doneMarks(l, r) {
      var m = {};
      for (var q = l; q <= r; q++) m[q] = "done";
      return m;
    }
    function tFill(l, k) {
      var m = {};
      for (var q = l; q < k; q++) m[q] = "done";
      if (k < n) m[k] = "compare";
      return m;
    }

    function merge(l, mid, r) {
      var i = l, j = mid + 1, k = l;
      snap("开始<b>合并</b>两个相邻的有序段：左段 [" + l + ", " + mid + "] 与右段 [" + (mid + 1) + ", " + r +
        "]。规则是「<b>双指针取小</b>」：i 指向左段头、j 指向右段头，谁小就先取谁，依次放进临时数组 T。",
        runMarks(l, mid, r, i, j), tFill(l, k), (function (ii, jj, kk) {
          return function (svg) {
            ptr(svg, XP + ii * P + B / 2, 114, "i=" + ii, "var(--brand)");
            ptr(svg, XP + jj * P + B / 2, 114, "j=" + jj, "var(--accent)");
            ptr(svg, XP + kk * P + B / 2, 204, "k=" + kk, "var(--purple)");
          };
        })(i, j, k));

      while (i <= mid && j <= r) {
        cmp++;
        var mk = runMarks(l, mid, r, i, j);
        var tk = tFill(l, k);
        var vi = A[i], vj = A[j];
        var dec = (vi <= vj);
        snap("比较左段的 <code>A[" + i + "] = " + vi + "</code> 与右段的 <code>A[" + j + "] = " + vj +
          "</code>。", mk, tk, (function (ii, jj, kk) {
            return function (svg) {
              ptr(svg, XP + ii * P + B / 2, 114, "i=" + ii, "var(--brand)");
              ptr(svg, XP + jj * P + B / 2, 114, "j=" + jj, "var(--accent)");
              ptr(svg, XP + kk * P + B / 2, 204, "k=" + kk, "var(--purple)");
            };
          })(i, j, k));

        if (dec) {
          T[k] = vi; writes++;
          snap("<b>" + vi + " ≤ " + vj + "</b> → 取<b>左段</b>的 " + vi + " 放进 T[" + k + "]，然后 i++、k++。" +
            "<br>请特别注意：<b>相等时优先取左段</b>，这保证了原来在左边的元素合并后依然在左边 —— " +
            "这就是归并排序<b>稳定</b>的根本原因。", runMarks(l, mid, r, i + 1, j), tFill(l, k + 1), null);
          i++; k++;
        } else {
          var gained = mid - i + 1;
          inv += gained;
          T[k] = vj; writes++;
          snap("<b>" + vi + " 大于 " + vj + "</b> → 取<b>右段</b>的 " + vj + " 放进 T[" + k + "]，然后 j++、k++。" +
            (countInv ? "<br><b>逆序对在这里被抓到：</b>既然 A[" + i + "] = " + vi + " 已经大于 A[" + j + "] = " +
              vj + "，而左段本身是递增的，那么左段从下标 " + i + " 到 " + mid + " 的所有 " + gained +
              " 个元素都大于 " + vj + "，它们各自与 " + vj + " 构成一个逆序对。" +
              "一次性累加 <b>" + gained + "</b> 个，累计 <b>" + inv + "</b> 个。" : ""),
            runMarks(l, mid, r, i, j + 1), tFill(l, k + 1), null);
          j++; k++;
        }
      }

      while (i <= mid) {
        T[k] = A[i]; writes++;
        snap("右段已经取完，左段还剩 A[" + i + "] = " + A[i] + " 等元素。它们本来就是有序的，" +
          "<b>整段搬进 T</b> 即可，不需要再比较。", runMarks(l, mid, r, i + 1, j), tFill(l, k + 1), null);
        i++; k++;
      }
      while (j <= r) {
        T[k] = A[j]; writes++;
        snap("左段已经取完，右段还剩 A[" + j + "] = " + A[j] + " 等元素，<b>整段搬进 T</b>。",
          runMarks(l, mid, r, i, j + 1), tFill(l, k + 1), null);
        j++; k++;
      }

      for (var t3 = l; t3 <= r; t3++) A[t3] = T[t3];
      snap("<b>把 T[" + l + ".." + r + "] 整段写回原数组 A</b>，区间 [" + l + ", " + r +
        "] 现在整体有序：[" + A.slice(l, r + 1).join(", ") + "]。", doneMarks(l, r), {}, null);
    }

    function msort(l, r, d) {
      path.push({ l: l, r: r, d: d });
      snap("<b>递归进入区间 [" + l + ", " + r + "]</b>，共有 " + (r - l + 1) + " 个元素。",
        (function (ll, rr) { var m = {}; for (var q = ll; q <= rr; q++) m[q] = "active"; return m; })(l, r),
        {}, null);
      if (l >= r) {
        snap("区间里只剩 1 个元素 → <b>天然有序，这就是递归的终止条件</b>，直接返回上一层。",
          (function (ll) { var m = {}; m[ll] = "done"; return m; })(l), {}, null);
        path.pop();
        return;
      }
      var mid = (l + r) >> 1;
      snap("把 [" + l + ", " + r + "] 从中间切开：左半 <b>[" + l + ", " + mid + "]</b>，" +
        "右半 <b>[" + (mid + 1) + ", " + r + "]</b>。分治三步走 —— <b>分</b>（切开）、" +
        "<b>治</b>（左右分别递归排好）、<b>合</b>（merge 成一个有序段）。",
        (function (ll, rr, mm) {
          var m = {};
          for (var q = ll; q <= mm; q++) m[q] = "active";
          for (var q2 = mm + 1; q2 <= rr; q2++) m[q2] = "compare";
          return m;
        })(l, r, mid), {}, null);
      msort(l, mid, d + 1);
      msort(mid + 1, r, d + 1);
      merge(l, mid, r);
      path.pop();
    }

    snap("初始序列 <b>A = [" + A0.join(", ") + "]</b>。" +
      "归并排序（merge sort）是最典型的<b>分治</b>算法：" +
      "把序列一分为二、各自排好、再合并。合并两个有序段只需要线性时间，" +
      "而递归深度是 log n，所以总时间稳定在 <b>O(n log n)</b>。" +
      (countInv ? "<br>下面我们顺便解决一个经典问题：<b>统计逆序对</b>。" : ""), {}, {}, null);

    msort(0, n - 1, 0);

    snap("排序完成：<b>A = [" + A.join(", ") + "]</b>。全程比较 " + cmp + " 次、写入临时数组 " +
      writes + " 次。" +
      (countInv ? "<br>序列 <b>[" + A0.join(", ") + "]</b> 的逆序对总数 = <b>" + inv +
        "</b> 个。整个统计过程完全寄生在归并排序里，没有额外增加复杂度，仍然是 <b>O(n log n)</b>，" +
        "而暴力双重循环需要 O(n²)。" : ""), doneMarks(0, n - 1), {}, null);

    return { frames: frames, cmp: cmp, writes: writes, inv: inv };
  }

  (function mergeViz() {
    var host = document.getElementById("viz-merge");
    if (!host) return;
    var A0 = [5, 2, 9, 1, 7, 3, 8, 4, 6, 0];
    var res = buildMergeFrames(A0, false);
    new DS.Viz(host, {
      title: "归并排序（二路归并 · 递归版）",
      sub: "A = [" + A0.join(", ") + "]　上方短横线 = 递归区间划分，A / T 两行 = 双指针合并",
      build: function () { return { frames: res.frames }; }
    });
  })();

  (function inversionViz() {
    var host = document.getElementById("viz-inversion");
    if (!host) return;
    var A0 = [5, 2, 9, 1, 7, 3, 8, 4, 6, 0];
    var res = buildMergeFrames(A0, true);
    new DS.Viz(host, {
      title: "用归并排序统计逆序对",
      sub: "A = [" + A0.join(", ") + "]　每取一个右段元素，就一次性收获 (mid − i + 1) 个逆序对",
      build: function () { return { frames: res.frames }; }
    });
  })();

  /* ==========================================================================
     演示 8：快速排序 —— 挖坑法划分 + 递归区间可视化
     ========================================================================== */
  (function quickViz() {
    var host = document.getElementById("viz-quick");
    if (!host) return;

    var A0 = [5, 2, 9, 1, 7, 3, 8, 4, 6, 0, 11, 10];
    var A = A0.slice(), n = A.length;
    var frames = [], cmp = 0, mv = 0, depthMax = 0;
    var W = 720, XP = 44, P = 50, B = 42;
    var path = [];

    /* marks: 单元格状态；hole: 坑的下标（画虚线框）；pivot: 基准值 */
    function snap(desc, marks, hole, pivot, extra) {
      var sa = A.slice(), ps = [], c = cmp, m = mv, dm = depthMax;
      for (var q = 0; q < path.length; q++) ps.push({ l: path[q].l, r: path[q].r, d: path[q].d });
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, 330);
          note(svg, 8, 14, "比较 " + c + " 次　移动（填坑） " + m + " 次　当前递归深度 " + ps.length +
            "（历史最大 " + dm + "）");
          for (var q2 = 0; q2 < ps.length; q2++) {
            var e = ps[q2], y = 30 + e.d * 13;
            var x1 = XP + e.l * P, wd = (e.r - e.l + 1) * P - GAP;
            var cur = (q2 === ps.length - 1);
            svg.appendChild(SVG.el("rect", {
              x: x1, y: y, width: Math.max(8, wd), height: 9, rx: 4,
              fill: cur ? "var(--brand)" : "var(--border-strong)", opacity: cur ? 0.95 : 0.6
            }));
            note(svg, 8, y + 9, "第 " + e.d + " 层 [" + e.l + ", " + e.r + "]");
          }
          cells(svg, XP, 116, sa, function (i) { return (marks && marks[i]) || ""; }, B, P);
          if (hole !== null && hole !== undefined && hole >= 0 && hole < n) {
            svg.appendChild(SVG.el("rect", {
              x: XP + hole * P, y: 116, width: B, height: B, rx: 6, "class": "vz-box hole"
            }));
          }
          if (pivot !== null && pivot !== undefined) {
            svg.appendChild(SVG.label(XP - 34, 130, "基准", "end"));
            svg.appendChild(colorCell(svg, XP - 32, 116, B, B, "--purple", pivot));
            note(svg, 8, 200, "紫色方块 = 本轮基准 pivot = " + pivot + "（已暂存，等待归位）");
          }
          note(svg, 8, 250, "蓝色 = 左段未处理，橙色 = 右段未处理，虚线框 = 待填的「坑」，红色 = 刚刚移动的元素。");
          note(svg, 8, 270, "划分目标：一趟结束后，基准左边的元素全部 ≤ 基准，右边的元素全部 ≥ 基准。");
          note(svg, 8, 292, "上方短横线 = 递归调用栈里各层的待排序区间，最深的一层正在处理。");
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    function partition(l, r, d) {
      path.push({ l: l, r: r, d: d });
      if (path.length > depthMax) depthMax = path.length;
      var pivot = A[l];
      var i = l, j = r, hole = l;
      var mStart = {};
      for (var q = l; q <= r; q++) mStart[q] = "active";
      mStart[hole] = "dim";
      snap("对区间 <b>[" + l + ", " + r + "]</b> 做一次划分（partition）。" +
        "取区间第一个元素 <b>A[" + l + "] = " + pivot + " 作为基准 pivot</b>，" +
        "先把它暂存到一边 —— 于是下标 " + l + " 就空出一个「坑」（图中虚线框）。",
        mStart, hole, pivot, null);

      snap("现在让两个指针<b>相向而行</b>：<code>j</code> 从右端往左找「比基准小」的元素，" +
        "<code>i</code> 从左端往右找「比基准大」的元素，找到就填进对方的坑里。" +
        "循环的条件是 <code>i 小于 j</code>，一旦相遇就说明本趟划分结束。",
        mStart, hole, pivot, null);

      while (i < j) {
        /* 右指针从右往左找「比 pivot 小」的元素 */
        while (true) {
          if (i >= j) break;
          cmp++;
          var vj = A[j];
          if (vj >= pivot) {
            var m1 = {}; m1[j] = "compare";
            m1[i] = "active";
            snap("右指针 j 从右往左扫，找<b>比基准小</b>的元素：<code>A[" + j + "] = " + vj +
              "</code> ≥ pivot = " + pivot + "，它本来就该在右边，不动，j 左移一格。",
              m1, hole, pivot, pointer(i, j, "j--", "var(--accent)"));
            j--;
          } else {
            var m2 = {}; m2[j] = "warn";
            snap("找到了！<code>A[" + j + "] = " + vj + "</code> 小于 pivot = " + pivot +
              "，它应该被搬到左边去 → <b>填进左边的坑 A[" + i + "]</b>。",
              m2, hole, pivot, pointer(i, j, "A[j] < pivot", "var(--danger)"));
            break;
          }
        }
        if (i < j) {
          A[i] = A[j]; mv++; hole = j;
          var m3 = {}; m3[i] = "warn"; m3[j] = "warn";
          snap("<b>填坑：</b>A[" + i + "] ← " + A[i] + "（原来的 A[" + j + "]）。" +
            "现在下标 " + i + " 被填好了，<b>坑转移到了下标 " + j + "</b>。i 右移。",
            m3, hole, pivot, pointer(i, j, "i++", "var(--brand)"));
          i++;
        }

        /* 左指针从左往右找「比 pivot 大」的元素 */
        while (true) {
          if (i >= j) break;
          cmp++;
          var vi = A[i];
          if (vi <= pivot) {
            var m4 = {}; m4[i] = "compare"; m4[j] = "active";
            snap("左指针 i 从左往右扫，找<b>比基准大</b>的元素：<code>A[" + i + "] = " + vi +
              "</code> ≤ pivot = " + pivot + "，它本来就该在左边，不动，i 右移一格。",
              m4, hole, pivot, pointer(i, j, "i++", "var(--brand)"));
            i++;
          } else {
            var m5 = {}; m5[i] = "warn";
            snap("找到了！<code>A[" + i + "] = " + vi + "</code> 大于 pivot = " + pivot +
              "，它应该被搬到右边去 → <b>填进右边的坑 A[" + j + "]</b>。",
              m5, hole, pivot, pointer(i, j, "A[i] > pivot", "var(--danger)"));
            break;
          }
        }
        if (i < j) {
          A[j] = A[i]; mv++; hole = i;
          var m6 = {}; m6[i] = "warn"; m6[j] = "warn";
          snap("<b>填坑：</b>A[" + j + "] ← " + A[j] + "（原来的 A[" + i + "]）。" +
            "坑转移到了下标 " + i + "，j 左移。", m6, hole, pivot, pointer(i, j, "j--", "var(--accent)"));
          j--;
        }
      }

      snap("<b>i 与 j 相遇在下标 " + i + " 了</b>（循环条件 i 小于 j 不再成立），本趟扫描结束。" +
        "巧合吗？不是：坑总是停在「刚被搬走元素」的那一侧，两指针相遇时坑恰好就在相遇点上。" +
        "把暂存的基准 pivot = " + pivot + " 填进这个最后的坑。",
        mStart, i, pivot, pointer(i, j, "相遇", "var(--purple)"));

      A[i] = pivot; hole = -1;
      var mEnd = {}; mEnd[i] = "pivot";
      for (var q2 = l; q2 < i; q2++) if (mEnd[q2] === undefined) mEnd[q2] = "done";
      snap("<b>基准归位！</b>一趟划分结束：<b>基准左边（下标 " + l + ".." + (i - 1) + "）全部 ≤ " + pivot +
        "，右边（下标 " + (i + 1) + ".." + r + "）全部 ≥ " + pivot + "</b>。" +
        "也就是说，<b>基准的最终位置已经确定了</b>，它不用再参与后面的排序，" +
        "接下来只要分别递归处理左右两个子区间即可。", mEnd, hole, null, null);
      path.pop();
      return i;
    }

    function pointer(i, j, txt, color) {
      return function (svg) {
        ptr(svg, XP + i * P + B / 2, 114, "i=" + i, "var(--brand)");
        ptr(svg, XP + j * P + B / 2, 114, "j=" + j, "var(--accent)");
        svg.appendChild(SVG.label(XP + (i + j) / 2 * P + B / 2, 162, "← " + txt + " →", "middle"));
      };
    }

    function qsort(l, r, d) {
      if (l > r) return;
      if (l === r) {
        snap("区间 [" + l + ", " + l + "] 只剩一个元素，<b>天然有序</b>，递归到底了。",
          (function (ll) { var m = {}; m[ll] = "done"; return m; })(l), -1, null, null);
        return;
      }
      snap("递归处理区间 <b>[" + l + ", " + r + "]</b>（深度 " + d + "）：先划分，再分别递归左右两半。",
        (function (ll, rr) {
          var m = {};
          for (var q = ll; q <= rr; q++) m[q] = "active";
          return m;
        })(l, r), -1, null, null);
      var p = partition(l, r, d);
      qsort(l, p - 1, d + 1);
      qsort(p + 1, r, d + 1);
      snap("区间 [" + l + ", " + r + "] 的左右两半都排好了，整体有序，返回上一层。",
        (function (ll, rr) {
          var m = {};
          for (var q = ll; q <= rr; q++) m[q] = "done";
          return m;
        })(l, r), -1, null, null);
    }

    snap("初始序列 <b>A = [" + A0.join(", ") + "]</b>。" +
      "快速排序同样是分治，但它和归并排序<b>刚好相反</b>：归并是「先切分、排好再合并」，" +
      "快排是「<b>先划分、让基准一步到位，再分别处理两边</b>」，而且不需要额外的合并步骤，" +
      "所有工作都在原地完成。", {}, -1, null, null);

    qsort(0, n - 1, 0);

    snap("排序完成：<b>A = [" + A.join(", ") + "]</b>。全程比较 " + cmp + " 次、填坑移动 " + mv +
      " 次。<br>快排的实测速度通常是所有 O(n log n) 比较排序里最快的：<b>常数小、内层循环极简单、" +
      "划分过程顺序扫描所以对缓存友好</b>。但它有两个必须提防的坑：<b>基准选得不好会退化成 O(n²)</b>、" +
      "以及<b>不稳定</b>。", doneMarks(), -1, null, null);

    function doneMarks() {
      var m = {};
      for (var q = 0; q < n; q++) m[q] = "done";
      return m;
    }

    new DS.Viz(host, {
      title: "快速排序（挖坑法划分）",
      sub: "A = [" + A0.join(", ") + "]　基准 + 左右指针 + 递归区间一屏看清",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 9：基数排序 —— LSD，按个位 / 十位 / 百位分配与收集
     ========================================================================== */
  (function radixViz() {
    var host = document.getElementById("viz-radix");
    if (!host) return;

    var A0 = [170, 45, 75, 90, 802, 24, 2, 66];
    var A = A0.slice(), n = A.length;
    var frames = [], pass = 0, moves = 0;
    var W = 880, H = 484;
    var SX = 24, SB = 40, SP = 46, SEQ_Y = 30;
    var BX = 24, BW = 76, BSTEP = 84, BY = 130, BH = 26, BSLOT = 26, BHMAX = 8;
    var OUT_Y = 386;

    function snap(desc, buckets, out, curIdx, extra) {
      var sa = A.slice(), bk = buckets.map(function (b) { return b.slice(); }), ot = out.slice();
      var ps = pass, mv = moves, ci = curIdx;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W, H);
          note(svg, 6, 14, "第 " + ps + " 轮　按第 " + ps + " 位分配与收集　累计搬运元素 " + mv +
            " 次　（LSD：从最低位开始）");
          /* 当前序列 */
          svg.appendChild(SVG.label(SX - 12, SEQ_Y + 26, "序列", "end"));
          cells(svg, SX, SEQ_Y, sa, function (i) {
            return ci === i ? "compare" : "";
          }, SB, SP);
          /* 桶区 */
          for (var b = 0; b < 10; b++) {
            var x = BX + b * BSTEP;
            svg.appendChild(SVG.el("rect", {
              x: x, y: BY, width: BW, height: BSLOT * BHMAX + 8, rx: 8, "class": "vz-bucket"
            }));
            svg.appendChild(SVG.label(x + BW / 2, BY - 8, "bucket[" + b + "]", "middle"));
            for (var t = 0; t < bk[b].length; t++) {
              var cls = (ci !== null && ci !== undefined && ci >= 0 && t === bk[b].length - 1) ? "warn" : "done";
              svg.appendChild(SVG.box(x + 4, BY + 4 + t * BSLOT, BW - 8, BSLOT - 4, cls, bk[b][t],
                onCls(cls)));
            }
            svg.appendChild(SVG.label(x + BW / 2, BY + BSLOT * BHMAX + 22, "共 " + bk[b].length + " 个", "middle"));
          }
          /* 收集结果 */
          svg.appendChild(SVG.label(SX - 12, OUT_Y + 26, "结果", "end"));
          for (var q = 0; q < n; q++) {
            var v = ot[q];
            var cls2 = (v === null || v === undefined) ? "dim" : "done";
            svg.appendChild(SVG.box(SX + q * SP, OUT_Y, SB, SB, cls2,
              (v === null || v === undefined) ? "·" : v, onCls(cls2)));
            svg.appendChild(SVG.label(SX + q * SP + SB / 2, OUT_Y + SB + 15, String(q), "middle"));
          }
          note(svg, 6, 466, "分配（distribute）：按当前位的数字把元素丢进对应的桶；" +
            "收集（collect）：从 bucket[0] 到 bucket[9] 依次把桶里的元素接回序列。");
          if (extra) extra(svg);
          return svg;
        }
      });
    }

    function emptyOut() {
      var o = [];
      for (var q = 0; q < n; q++) o.push(null);
      return o;
    }
    function emptyBuckets() {
      var b = [];
      for (var q = 0; q < 10; q++) b.push([]);
      return b;
    }

    snap("初始序列 <b>A = [" + A0.join(", ") + "]</b>。" +
      "基数排序（radix sort）不看元素之间的大小关系，而是<b>按「位」来排队</b>：" +
      "每一轮取出一个数位，把这个数<b>分配</b>到 0~9 号桶里，" +
      "再按桶号从小到大的顺序<b>收集</b>回序列。这里采用 <b>LSD（最低位优先）</b>：" +
      "从个位开始，再做十位、百位。", emptyBuckets(), emptyOut(), -1, null);

    var places = [{ p: 1, name: "个位" }, { p: 10, name: "十位" }, { p: 100, name: "百位" }];
    for (var pi = 0; pi < places.length; pi++) {
      var p = places[pi].p, nm = places[pi].name;
      pass = pi + 1;
      var buckets = emptyBuckets(), out = emptyOut();
      snap("<b>第 " + pass + " 轮：按「" + nm + "」分配。</b>" +
        "当前序列是 [" + A.join(", ") + "]，准备 10 个空桶 bucket[0..9]。" +
        "每个元素将被送进「它这一位数字」对应的桶。", buckets, out, -1, null);

      for (var i = 0; i < n; i++) {
        var d = Math.floor(A[i] / p) % 10;
        buckets[d].push(A[i]);
        moves++;
        snap("取出 <code>A[" + i + "] = " + A[i] + "</code>，" +
          "它的<b>" + nm + "数字是 " + d + "</b>（" + A[i] + " ÷ " + p + " 取整再 mod 10）" +
          " → 放进 <b>bucket[" + d + "]</b>。", buckets, out, i, null);
      }

      snap("分配完成。请留意每个桶内部的顺序：<b>元素是按在原序列中出现的先后次序排进桶里的</b>，" +
        "收集时也必须按这个次序取出（先进先出）。这一点是基数排序能成立的前提 —— " +
        "下一轮要用到本轮排好的相对顺序。", buckets, out, -1, null);

      var k = 0;
      for (var b2 = 0; b2 < 10; b2++) {
        if (buckets[b2].length === 0) {
          snap("bucket[" + b2 + "] 是空的，没有元素需要收集，跳过。", buckets, out, -1, null);
          continue;
        }
        snap("现在处理 <b>bucket[" + b2 + "]</b>：里面按顺序有 " + buckets[b2].length +
          " 个元素 [" + buckets[b2].join(", ") + "]，把它们依次接回结果序列。", buckets, out, -1, null);
        for (var t = 0; t < buckets[b2].length; t++) {
          out[k] = buckets[b2][t];
          moves++;
          snap("取出 bucket[" + b2 + "] 的第 " + (t + 1) + " 个元素 <b>" + buckets[b2][t] +
            "</b>，接到结果序列的下标 " + k + " 上。", buckets, out, -1, null);
          k++;
        }
      }

      A = out.slice();
      snap("<b>第 " + pass + " 轮收集完成，序列变成 [" + A.join(", ") + "]</b>。" +
        "可以发现：经过「" + nm + "」这一轮之后，序列<b>已经按最后 " + pass + " 位有序</b>了 —— " +
        "低位有序是高位的「地基」，这正是必须从最低位开始（LSD）的原因。",
        emptyBuckets(), out, -1, null);
    }

    snap("三轮全部结束，排序完成：<b>A = [" + A.join(", ") + "]</b>。" +
      "基数排序全程<b>没有任何一次元素之间的比较</b>：时间开销 = d 轮 × (n 次分配 + n 次收集)，" +
      "即 <b>O(d(n + r))</b>，其中 d 是最大位数、r 是基数（这里 r = 10）；" +
      "空间上需要 r 个桶，即 <b>O(n + r)</b>。", emptyBuckets(), A.slice(), -1, null);

    new DS.Viz(host, {
      title: "基数排序（LSD：个位 → 十位 → 百位）",
      sub: "A = [" + A0.join(", ") + "]　10 个桶的分配与收集全过程",
      build: function () { return { frames: frames }; }
    });
  })();

})();
