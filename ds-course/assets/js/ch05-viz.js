/* ==========================================================================
   ch05-viz.js —— 串：KMP 与 BM 模式匹配 · 交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG
   ========================================================================== */
(function () {
  "use strict";
  var SVG = DS.SVG;                             // 全页共用的 SVG 工具集：svg/box/text/label/el/line/path 都在它上面

  var BOX = 44, GAP = 6, PITCH = BOX + GAP;     // 单元格宽度 / 间距 / 步距

  /* ---------------- 通用绘制：把一串字符画成带下标的格子 ---------------- */
  /* drawRow 的 opts：cls(i, abs) 返回格子类名（i 是本串 0 基下标，abs = start + i 是要印在格子下方的绝对下标）；
     label 画在整行左侧；start 是「本串第一个字符对应的绝对下标」（模式串滑动时靠它把下标印成主串坐标）；
     x0 是第一个格子的 x（默认 46，模式串滑动时传 46 - start*PITCH 就能整体左移）。
     返回值 = 本行右端的 x，方便接着往后画。 */
  function drawRow(svg, y, chars, opts) {
    opts = opts || {};
    var clsFn = opts.cls || function () { return ""; };
    var label = opts.label;
    var start = opts.start || 0;
    var x0 = opts.x0 === undefined ? 46 : opts.x0;
    if (label) svg.appendChild(SVG.label(x0 - 12, y + 28, label, "end"));
    for (var i = 0; i < chars.length; i++) {
      var x = x0 + i * PITCH;
      var c = clsFn(i, start + i);
      svg.appendChild(SVG.box(x, y, BOX, BOX, c, chars[i],
        /active|done|warn|compare/.test(c) ? "on" : ""));
      svg.appendChild(SVG.label(x + BOX / 2, y + BOX + 17, String(start + i), "middle"));
    }
    return x0 + chars.length * PITCH;
  }

  /* 在某个格子下方/上方画一个指针三角与文字 */
  /* cx / y 是三角的顶点（三角朝下，画在 y 上方 10px），txt = 指针名，color 缺省品牌蓝；返回值为空。 */
  function drawPtr(svg, cx, y, txt, color) {
    var c = color || "var(--brand)";
    var tri = SVG.path("M" + cx + "," + y + " l-7,-10 l14,0 z", "", false);
    tri.setAttribute("fill", c);
    tri.setAttribute("stroke", "none");
    svg.appendChild(tri);
    var t = SVG.text(cx, y + 16, txt, "vz-label", "middle");
    t.setAttribute("fill", c);
    t.setAttribute("font-weight", "700");
    svg.appendChild(t);
  }

  /* 匹配成功后（或整个模式串已匹配）的位移：看主串中紧接模式串右边的那一个字符 */
  /* 参数：align = 模式串左端对齐的主串下标，last = 坏字符表；返回值 = 应该右移的格数
     （模式串已经贴到主串末尾时直接返回 m，让它整段滑出去，外层 while 自然结束）。 */
  function shiftAfterMatch(S, P, align, last) {
    var n = S.length, m = P.length;
    if (align + m >= n) return m;
    var c = S[align + m];
    return last[c] === undefined ? m : m - last[c];
  }

  /* ==========================================================================
     1) 朴素（BF）模式匹配动画
     ========================================================================== */
  (function naiveMatch() {
    /* 页面容器 #viz-brute：朴素（BF）模式匹配，主串指针会回溯，最坏 O(n×m)。 */
    var host = document.getElementById("viz-brute");
    if (!host) return;

    var S = "ABABABCABABABCABA", P = "ABABCABA";   // 主串与模式串：故意选重复度高的串，好逼出朴素匹配的最坏情况
    var n = S.length, m = P.length;                // n = 主串长度、m = 模式串长度（也是各自的下标上界 + 1）
    var frames = [];                               // 本演示的帧数组：全部在 build() 里同步 push 完，DS.Viz 之后才逐帧渲染

    /* snap 的三个定位参数：mi = 本轮模式串左端对齐的主串下标（-1 = 结论帧，不画对齐）；
       mj = 当前比到模式串的第几位（-1 = 整串已经匹配完）；matched = 本轮已经匹配成功的字符个数。 */
    function snap(desc, mi, mj, matched) {
      /* 状态栏要印「到目前为止比较了多少次」，必须在此刻快照。
         （原先印的是一个从未被赋值、恒为 0 的 shift，所以每一帧都写「累计比较次数 = 0」。） */
      var cmpSnap = cmp;
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(880, 190);
          drawRow(svg, 24, S.split(""), {
            label: "S",
            cls: function (k, abs) {
              if (mi >= 0 && abs >= mi && abs < mi + matched) return "done";
              if (abs === mi + matched) return "warn";
              return abs === mi ? "active" : "";
            }
          });
          drawRow(svg, 108, P.split(""), {
            label: "P",
            start: mi,
            x0: 46 - mi * PITCH,
            cls: function (k) {
              if (mj >= 0 && k < matched) return "done";
              if (k === matched) return "warn";
              return "";
            }
          });
          if (mi >= 0) {
            drawPtr(svg, 46 + (mi + matched) * PITCH + BOX / 2, 96, "i", "var(--brand)");
            svg.appendChild(SVG.label(46, 176, "主串位置 i = " + (mi + matched) + "　模式串位置 j = " + matched +
              "　起始对齐位置 = " + mi + "　累计比较次数 = " + cmpSnap, "start"));
          }
          return svg;
        }
      });
    }

    /* 计数器必须在第一个 snap 之前初始化 —— snap 里会立刻读 cmp 做快照，
       声明写在后面的话第 0 帧会印出 undefined。 */
    var pos = 0, cmp = 0;          // pos = 本轮对齐起点（每次失配 +1，就是「会回溯」的那个下标）；cmp = 累计字符比较次数

    snap("初始状态：模式串 P 左端与主串 S 的第 0 位对齐。i 和 j 都指向各自串的起点。", 0, 0, 0);
    outer:
    while (pos <= S.length - P.length) {   // 最后一个合法对齐位置是 n − m（再往右模式串就放不下了）
      var k = 0;
      while (k < P.length) {
        cmp++;
        if (S[pos + k] === P[k]) {
          snap("比较 S[" + (pos + k) + "] = '" + S[pos + k] + "' 与 P[" + k + "] = '" + P[k] + "'，相等 → 继续向右。",
            pos, k, k);
          k++;
        } else {
          snap("<b>失配！</b>S[" + (pos + k) + "] = '" + S[pos + k] + "' 与 P[" + k + "] = '" + P[k] +
            "' 不相等。朴素做法：i 退回本轮起点 + 1，j 归零，整体右移一格重来。", pos, k, k);
          pos++;
          continue outer;
        }
      }
      snap("<b>匹配成功！</b>模式串在主串中的起始下标为 " + pos + "。", pos, -1, P.length);
      break;
    }
    snap("结论：朴素匹配最坏情况下每个起点都要比到模式串末尾，时间复杂度 <b>O(n×m)</b>，共比较 " +
      cmp + " 次。问题出在——主串指针 i 发生了<b>回溯</b>，已经比较过的信息被浪费了。", -1, -1, 0);

    new DS.Viz(host, { title: "朴素模式匹配（BF）", sub: "主串指针会回溯，O(n×m)", build: function () { return { frames: frames }; } });
  })();

  /* ==========================================================================
     2) next 数组手推动画（前缀函数 π，0 基）
     ========================================================================== */
  (function nextArray() {
    /* 页面容器 #viz-next：手推 next（π）数组，看前后缀积木怎么一块块搭起来、失配时怎么回退。 */
    var host = document.getElementById("viz-next");
    if (!host) return;

    var P = "ABABAA";                 // 演示用模式串：前缀重复度高，π 的「继承→回退→加一」看得最清楚
    var n = P.length;                 // 模式串长度（= π 数组长度），合法下标 0..n−1
    /* π 数组（0 基）：π[i] = P[0..i]（前 i+1 个字符）的最长相等真前后缀的「长度」，不是下标。
       注意这套约定与另一种教材里「1 基、值从 −1 开始的 next 数组」不是一回事。 */
    var pi = new Array(n).fill(-1);   /* -1 = 还没算出来（画面上显示为 ?） */
    pi[0] = 0;                        /* π[0] = 0：单个字符没有真前后缀 */
    var frames = [];                  // 本演示的帧数组：全部在 build() 里同步 push 完，DS.Viz 之后才逐帧渲染
    var steps = 0;                    // 声明后从未被读写（历史遗留）：所有步数都写在 desc 文字里，绘制完全不依赖它

    /* 核心：一个"前缀机器" S，它保存的是 -1, -1, 0, 0, 1, 2 ...
       S[j] = 长度 j 的子串 P[0..j-1] 的最长相等真前后缀长度 */
    /* snap 的三个定位参数：cur = 正在求的 π 下标（-1 = 首帧/收尾帧，不高亮任何位置）；
       base = 后缀窗口在 P 里的起始下标（-1 = 本帧不画前后缀对比）；matched = 当前已匹配的前后缀长度
       （可能为 0：这时 base 仍有效，画面上只高亮「下一个要比的字符」而不画两块积木）。 */
    function snap(desc, cur, base, matched) {
      /* 关键：把「这一帧要画的 π 数组」在此刻深拷贝下来。
         DS.Viz 会先同步跑完整个 build()、之后才逐帧渲染，
         若 draw 直接读活的 pi，画出来的永远是算法结束后的最终 π
         （第 0 帧 desc 写着"目标…"，画面却已经是算完的 π）。 */
      var piSnap = pi.slice();
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 46 + n * PITCH + 20, H = 330;
          var svg = s.svg(W, H);

          /* 第一行：模式串，标出「已求出 π 的前缀」 */
          drawRow(svg, 20, P.split(""), {
            label: "P",
            cls: function (k) {
              if (cur >= 0 && k === cur) return "active";
              if (base >= 0 && k === base + matched) return "compare";
              if (base >= 0 && k < base) return "dim";
              if (base >= 0 && k >= base && k < base + matched) return "done";
              return "";
            }
          });

          if (base >= 0 && matched >= 0) {
            /* 第二行：正在比较的前缀 */
            var y2 = 118;
            svg.appendChild(SVG.label(32, y2 + 16, "前缀", "end"));
            for (var t = 0; t < matched; t++) {
              svg.appendChild(SVG.box(46 + t * PITCH, y2, BOX, BOX, "done", P[t], "on"));
            }
            /* 第三行：正在比较的后缀 */
            var y3 = 196;
            svg.appendChild(SVG.label(32, y3 + 16, "后缀", "end"));
            for (var u = 0; u < matched; u++) {
              svg.appendChild(SVG.box(46 + (base + u) * PITCH, y3, BOX, BOX, "compare", P[base + u],
                /active|done|warn|compare/.test("compare") ? "on" : ""));
            }
            /* 连线示意：前后缀逐字符相等 */
            for (var v = 0; v < matched; v++) {
              svg.appendChild(SVG.line(46 + v * PITCH + BOX / 2, y2 + BOX + 2,
                46 + (base + v) * PITCH + BOX / 2, y3 - 4, "done"));
            }
            svg.appendChild(SVG.label(46, 250,
              "已匹配长度 len = " + matched + "　→　π[" + cur + "] 至少是 " + matched, "start"));
          }

          /* 第四行：π / next 数组 */
          var y4 = 268;
          svg.appendChild(SVG.label(32, y4 + 16, "π[]", "end"));
          for (var q = 0; q < n; q++) {
            var val = piSnap[q];
            var cls2 = (q === cur) ? "active" : (val >= 0 ? "done" : "");
            svg.appendChild(SVG.box(46 + q * PITCH, y4, BOX, BOX, cls2,
              val < 0 ? "?" : String(val), /active|done/.test(cls2) ? "on" : ""));
            svg.appendChild(SVG.label(46 + q * PITCH + BOX / 2, y4 + BOX + 17, String(q), "middle"));
          }
          return svg;
        }
      });
    }

    snap("目标：对模式串 P = \"" + P + "\" 求出每一个前缀的最长相等真前后缀长度 π[i]。" +
      "<br>π[i] 的含义：子串 P[0..i]（前 i+1 个字符）中，<b>既是前缀又是后缀</b>的最长真子串的长度。" +
      "「真」表示不包含自身。下面用两块积木（前缀对后缀）逐位搭出来。", 0, -1, -1);

    /* 用 KMP 自身的思想递推求 π，并逐步记录 */
    for (var i = 1; i < n; i++) {
      var len = pi[i - 1];        // 候选前后缀长度：先继承 π[i−1]，失败时按 π[len−1] 回退（是长度，不是下标；同时充当下一个要比的 P 下标 P[len]）
      snap("求 π[" + i + "]：先继承 π[" + (i - 1) + "] = " + len +
        "，认为前缀已经搭好了 " + len + " 个字符，现在试第 " + (len + 1) + " 个位置 P[" + len + "] 能否对上 P[" + i + "]。",
        i, i - len, len);

      while (len > 0 && P[i] !== P[len]) {
        snap("P[" + i + "] = '" + P[i] + "' 与 P[" + len + "] = '" + P[len] + "' 不相等，" +
          "于是<b>回退</b>：能用的最长前缀要缩短为 π[" + (len - 1) + "] = " + pi[len - 1] +
          "。这一步正是 KMP「不重复比较」的精髓——<b>不是从 0 重新比，而是跳到更短的前缀</b>。",
          i, i - pi[len - 1], pi[len - 1]);
        len = pi[len - 1];
      }

      if (P[i] === P[len]) {
        len++;
        snap("P[" + i + "] = '" + P[i] + "' 与 P[" + len + "] 的前一位对齐字符相等 → 前后缀长度加一，π[" + i + "] = " + len + "。", i, i - len + 1, len);
      } else {
        snap("len 已经退到 0，仍然对不上 → π[" + i + "] = 0，说明这一段没有任何相等真前后缀。", i, -1, -1);
      }
      pi[i] = len;
      snap("记录：<b>π[" + i + "] = " + pi[i] + "</b>。" +
        (pi[i] > 0 ? "即 P[0.." + i + "] 的最长相等真前后缀是 \"" + P.slice(0, pi[i]) + "\"。" : ""),
        /* 后缀窗口的起点：长度为 π[i] 的后缀是 P[i-π[i]+1 .. i]，
           所以起点是 i-π[i]+1（此前写成 i-π[i]，整整早了一格，画出来的后缀是错的）。 */
        i, pi[i] > 0 ? i - pi[i] + 1 : -1, pi[i]);
    }

    snap("全部求完：π = [" + pi.join(", ") + "]。<br>观察结果可以验证：π 的值只会「一次增加 1」，" +
      "而回退时是跳到 π[len-1]，整个求 next 的过程是 <b>O(m)</b>（均摊分析：len 每次至多加 1，共加 m 次，所以最多减 m 次）。",
      -1, -1, -1);

    new DS.Viz(host, {
      title: "next（π）数组手推过程", sub: "P = \"" + P + "\"　逐步搭出最长相等真前后缀",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     3) KMP 匹配动画（含 j 的回退）
     ========================================================================== */
  (function kmpMatch() {
    /* 页面容器 #viz-kmp：KMP 匹配全过程，重点是失配时只回退 j（主串指针 i 永不回溯）。 */
    var host = document.getElementById("viz-kmp");
    if (!host) return;

    var S = "ABABABCABABABCABA";      // 主串（与演示 1 的朴素匹配用的是同一对串，方便对照）
    var P = "ABABCABA";               // 模式串
    var n = S.length, m = P.length;   // n = 主串长度、m = 模式串长度

    /* 先算 pi */
    /* 用同一条 O(m) 递推把 π 数组算出来：l 是当前候选前后缀长度（和演示 2 里的 len 同义），
       下面匹配时 j 的每次回退都查这张表。 */
    var pi = new Array(m).fill(0);
    for (var i = 1; i < m; i++) {
      var l = pi[i - 1];
      while (l > 0 && P[i] !== P[l]) l = pi[l - 1];
      if (P[i] === P[l]) l++;
      pi[i] = l;
    }

    var frames = [], cmp = 0, moves = 0;   // cmp = 累计比较次数，moves = j 的回退次数；两者只印在文字里，但必须在推帧时快照（见下）

    /* 画布：主串一行（固定不动），模式串一行（滑动），并把 j 的跳动画出来 */
    var OFFSET = 90;   // 模式串左端对应的"主串下标 0"的 x 坐标
    /* snap 的位置参数：si = 主串指针 i（要高亮的那一格）；pj = 模式串指针 j（-1 = 整串已匹配，画面上按 0 处理）；
       sFrom = 第 4 个参数，传了但 draw 从没用过（S 行的绿色段其实由 pFrom 和 pj 决定）；
       pFrom = 模式串左端对齐到主串的哪个下标；hiP / hiS = 模式串 / 主串里要标红（失配处）的下标（-1 = 不标）。 */
    function snap(desc, si, pj, sFrom, pFrom, hiP, hiS) {
      /* 关键：累计比较次数 cmp 与 j 回退次数 moves 是算法过程中被改写的活变量，
         推帧时先存进快照，否则每一帧印出来的都是算法结束后的最终次数。 */
      var cmpSnap = cmp, movesSnap = moves;
      frames.push({
        desc: desc,
        draw: function (s) {
          var H = 250;
          var W = OFFSET + n * PITCH + 30;
          var svg = s.svg(W, H);

          /* 主串 */
          svg.appendChild(SVG.label(OFFSET - 12, 44, "S", "end"));
          for (var k = 0; k < n; k++) {
            var cls = "";
            if (k < si) cls = "dim";
            if (k >= pFrom && k < pFrom + (pj >= 0 ? pj : 0)) cls = "done";
            if (k === hiS) cls = "warn";
            if (k === si) cls = "active";
            svg.appendChild(SVG.box(OFFSET + k * PITCH, 24, BOX, BOX, cls, S[k],
              /active|done|warn/.test(cls) ? "on" : ""));
            svg.appendChild(SVG.label(OFFSET + k * PITCH + BOX / 2, 24 + BOX + 17, String(k), "middle"));
          }
          /* 模式串：滑动到 pFrom 位置 */
          svg.appendChild(SVG.label(OFFSET - 12, 148, "P", "end"));
          for (var t = 0; t < m; t++) {
            var cls2 = "";
            if (t < pj) cls2 = "done";
            if (t === pj) cls2 = "compare";
            if (t === hiP) cls2 = "warn";
            svg.appendChild(SVG.box(OFFSET + (pFrom + t) * PITCH, 128, BOX, BOX, cls2, P[t],
              /active|done|warn|compare/.test(cls2) ? "on" : ""));
            svg.appendChild(SVG.label(OFFSET + (pFrom + t) * PITCH + BOX / 2, 128 + BOX + 17, String(t), "middle"));
          }
          /* 对齐虚线 */
          for (var q = 0; q < Math.max(pj, 0); q++) {
            svg.appendChild(SVG.line(OFFSET + (pFrom + q) * PITCH + BOX / 2, 128,
              OFFSET + (pFrom + q) * PITCH + BOX / 2, 24 + BOX, "dim"));
          }
          drawPtr(svg, OFFSET + si * PITCH + BOX / 2, 21, "i=" + si, "var(--brand)");
          drawPtr(svg, OFFSET + (pFrom + Math.max(pj, 0)) * PITCH + BOX / 2, 125, "j=" + Math.max(pj, 0), "var(--accent)");
          svg.appendChild(SVG.label(OFFSET, 216,
            "模式串起始对齐位 = " + pFrom + "　已匹配 " + Math.max(pj, 0) + " 个字符　累计比较 " + cmpSnap + " 次　j 回退次数 " + movesSnap, "start"));
          svg.appendChild(SVG.label(OFFSET, 238, "π = [" + pi.join(", ") + "]", "start"));
          return svg;
        }
      });
    }

    snap("KMP 的核心约定：<b>主串指针 i 永不回溯</b>。i 从左到右只走一遍；" +
      "失配时只把模式串的 j 回退到 π[j-1]，也就是「把已经匹配的那一段的<b>最长相等前后缀</b>重新对齐」。", 0, 0, 0, 0, -1, -1);

    var si = 0, pj = 0, pFrom = 0;   // 活状态：si = 主串指针 i（单调不减，永不回溯）；pj = 模式串指针 j；
                                     // pFrom = 模式串左端对齐的主串下标（= si − pj，每次跳转后重算，只用于绘制）；三者都会被就地改写
    while (si < n && pj < m) {
      cmp++;
      if (S[si] === P[pj]) {
        snap("S[" + si + "] = '" + S[si] + "' 与 P[" + pj + "] = '" + P[pj] + "' 相等 → i 和 j 同时右移。",
          si, pj, si, pFrom, -1, -1);
        si++; pj++;
        if (pj > 0) { /* 更新对齐位置 */ }   // 空语句块：真正的对齐更新是紧跟着的下一行 pFrom = si - pj;
        pFrom = si - pj;
      } else {
        if (pj === 0) {
          snap("S[" + si + "] = '" + S[si] + "' 与 P[0] = '" + P[0] + "' 不相等，且 j = 0 已无处可退 → 主串整体右移一格，i 继续前进。",
            si, 0, si, pFrom, -1, si);
          si++;
          pFrom = si;
        } else {
          var old = pj;              // 回退前的 j：文字里要写「j 从 old 退到 pj」，也是标红的位置
          pj = pi[pj - 1];
          moves++;
          var newFrom = si - pj;     // 回退后新的对齐位置 = i − j：已经匹配的 pj 个字符原地不动，模式串整体右滑
          snap("<b>失配！</b>S[" + si + "] = '" + S[si] + "' ≠ P[" + pj + "] = '" + P[old] + "'。" +
            "j 从 " + old + " 回退到 π[" + (old - 1) + "] = <b>" + pj + "</b>；" +
            "模式串整体右滑 " + (old - pj) + " 格，对齐到主串下标 " + newFrom + "。" +
            "<br>注意 i = " + si + " <b>没有动</b>——主串中刚比较过的 " + pj + " 个字符（\"" + P.slice(0, pj) + "\"）" +
            "已经确认能匹配，不需要再比。",
            si, pj, si, newFrom, old, si);
          pFrom = newFrom;
        }
      }
    }

    if (pj === m) {
      snap("<b>匹配成功！</b>模式串出现在主串下标 " + (si - m) + " 处。全程比较 " + cmp +
        " 次，j 回退 " + moves + " 次；主串指针 i 从 0 走到 " + si + "，从未后退。", si >= n ? n - 1 : si, m - 1, si - m, si - m, -1, -1);
    } else {
      snap("主串扫描完毕仍未匹配，返回 -1。", n - 1, pj, si - pj, pFrom, -1, -1);
    }
    snap("复杂度：求 next 为 O(m)，匹配过程 i 单调不减（O(n)），合计 <b>O(n + m)</b>；" +
      "额外空间 O(m)。相比之下朴素算法的 O(n×m) 就败在「i 回溯」这一步。", 0, 0, 0, 0, -1, -1);

    new DS.Viz(host, {
      title: "KMP 匹配全过程", sub: "S = \"" + S + "\"　P = \"" + P + "\"",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     4) BM 坏字符规则动画
     ========================================================================== */
  (function bmBadChar() {
    /* 页面容器 #viz-bm-bad：BM 坏字符规则，从右往左比较、让坏字符对齐它在 P 中最后出现的位置。 */
    var host = document.getElementById("viz-bm-bad");
    if (!host) return;

    var S = "HERE IS A SIMPLE EXAMPLE", P = "EXAMPLE";   // 主串与模式串（经典 BM 例子，含空格）
    var n = S.length, m = P.length;                      // n = 主串长度、m = 模式串长度
    var frames = [], shiftCount = 0;                     // shiftCount = 模式串累计右移的次数，只在收尾那句文字里用（不参与绘制）

    /* 坏字符表：字符 → 该字符在模式串中最后出现的下标 */
    /* 键是字符、值是「最后一次出现的下标」（0 基）；P 里没有的字符查出来是 undefined，用的时候按 −1 处理。 */
    var last = {};
    for (var k = 0; k < m; k++) last[P[k]] = k;

    /* snap 的参数：align = 模式串左端对齐的主串下标；j = 当前比较的模式串下标（从 m−1 往左走，-1 = 整串匹配）；
       bad = 造成失配的坏字符（"" = 本帧没有失配）；rightMost = 坏字符在 P 中最后出现的下标（−1 / undefined = 不在 P 里）。 */
    function snap(desc, align, j, bad, rightMost) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var CW = 24;                          // 每格宽度
          var W = 60 + n * CW, H = 210;
          var svg = s.svg(W, H);
          /* 主串，每格 24px 窄格 */
          for (var t = 0; t < n; t++) {
            var cls = "";
            if (t === align + j) cls = "warn";
            else if (t >= align && t < align + m && j >= 0 && t < align + j) cls = "done";
            svg.appendChild(SVG.box(30 + t * CW, 20, CW - 2, 34, cls, S[t],
              /done|warn/.test(cls) ? "on" : ""));
            svg.appendChild(SVG.label(30 + t * CW + CW / 2 - 1, 68, String(t), "middle"));
          }
          /* 模式串 */
          for (var u = 0; u < m; u++) {
            var cls2 = "";
            if (u === j) cls2 = "warn";
            else if (j >= 0 && u < j) cls2 = "done";
            svg.appendChild(SVG.box(30 + (align + u) * CW, 92, CW - 2, 34, cls2, P[u],
              /done|warn/.test(cls2) ? "on" : ""));
            svg.appendChild(SVG.label(30 + (align + u) * CW + CW / 2 - 1, 140, String(u), "middle"));
          }
          if (j >= 0) {
            drawPtr(svg, 30 + (align + j) * CW + CW / 2 - 1, 88, "j=" + j, "var(--danger)");
            if (rightMost !== undefined && rightMost >= 0) {
              svg.appendChild(SVG.line(30 + (align + j) * CW + CW / 2 - 1, 150,
                30 + (align + rightMost) * CW + CW / 2 - 1, 150, "active", true));
              svg.appendChild(SVG.label(30 + align * CW, 178,
                "坏字符 '" + bad + "' 在模式串中最后出现在下标 " + rightMost + "，右移量 = j - " + rightMost + " = " + (j - rightMost), "start"));
            } else {
              svg.appendChild(SVG.label(30 + align * CW, 178,
                "坏字符 '" + bad + "' 没有出现在模式串中，整段模式串可以跳过 → 右移 j+1 = " + (j + 1), "start"));
            }
          }
          return svg;
        }
      });
    }

    var align = 0;                 // 模式串左端对齐的主串下标（0 基）；BM 只维护它，「当前 i」是隐式的 align + j
    snap("BM 算法从右往左比较。初始时模式串 P = \"" + P + "\" 左端对齐主串下标 0，比较从 P 的最后一个字符开始。", 0, m - 1, "", -1);

    while (align + m - 1 < n) {    // 循环条件：模式串的末字符（对齐到主串下标 align+m−1）还在主串范围内
      var j = m - 1;               // 每轮都从模式串最右端开始比（这就是 BM 的「从右往左」）
      while (j >= 0 && P[j] === S[align + j]) {
        snap("从右往左：S[" + (align + j) + "] = '" + S[align + j] + "' 与 P[" + j + "] = '" + P[j] + "' 相等，继续往左比。", align, j, "", -1);
        j--;
      }
      if (j < 0) {
        snap("<b>完全匹配！</b>模式串出现在主串下标 " + align + " 处。", align, -1, "", -1);
        align += shiftAfterMatch(S, P, align, last);
        continue;
      }
      var bad = S[align + j];      // 坏字符：主串中跟 P[j] 对不上的那个字符
      var rm = last[bad] === undefined ? -1 : last[bad];   // rm（rightmost）= 坏字符在 P 中最后出现的下标，−1 = P 里没有
      var move = j - rm;           // 坏字符规则给出的右移量：把坏字符对到它最后出现的位置上
      if (move <= 0) move = 1;      /* 防止死循环：坏字符在 j 右侧时必须至少移动 1 */
      snap("<b>失配：</b>S[" + (align + j) + "] = '" + bad + "' ≠ P[" + j + "] = '" + P[j] + "'。" +
        "这个 '" + bad + "' 就是<b>坏字符</b>。查坏字符表：" +
        (rm < 0 ? "它不在模式串中 → 可以把模式串直接滑过这个位置。"
                : "它在模式串中最后出现在下标 " + rm + " → 把模式串右滑 " + move + " 格，让两者对齐。") +
        "<br>右移量 = max(1, j - " + rm + ") = " + move, align, j, bad, rm);
      align += move;
      shiftCount++;
      snap("滑动后模式串左端对齐主串下标 " + align + "，再次从最右端开始比较。", align, m - 1, "", -1);
    }

    snap("主串扫描结束。整个过程中模式串一共只滑动了 " + shiftCount + " 次——" +
      "而且每次比较都可能<strong>一次跳过多个字符</strong>，这就是 BM 在英文文本上明显快于 KMP 的原因。<br>" +
      "但请注意一个坑：只看坏字符规则，可能出现「右移量为负」的情况（坏字符在模式串中的最后位置在 j 右边），" +
      "此时必须补上<b>好后缀规则</b>取两者较大值，否则会漏配。", 0, m - 1, "", -1);

    new DS.Viz(host, {
      title: "BM 算法 · 坏字符规则", sub: "从右往左比较，坏字符对齐", build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     5) BM 好后缀规则 + 完整滑动演示
     ========================================================================== */
  (function bmGoodSuffix() {
    /* 页面容器 #viz-bm-good：BM 好后缀规则，以及「坏字符 + 好后缀取较大值」的完整滑动演示。 */
    var host = document.getElementById("viz-bm-good");
    if (!host) return;

    var S = "ABABABCABABABCABA", P = "ABABCABA";   // 主串与模式串（和 KMP 演示同一对，便于对比两种算法的位移）
    var n = S.length, m = P.length;                // n = 主串长度、m = 模式串长度
    var frames = [];                               // 本演示的帧数组：全部在 build() 里同步 push 完，DS.Viz 之后才逐帧渲染

    /* 好后缀规则的位移量：
       设已在 j 处失配，则好后缀是 suffix = P[j+1 .. m-1]。
       把模式串整体右移 s 格后，suffix 的新起点是 (j+1-s)。
       要求：新位置上与 suffix 等长的一段必须逐字符等于 suffix，
       并且不能与 suffix 自身原位重叠（否则等于没动）。取满足条件的最小正 s。 */
    function goodSuffixShift(P, j) {
      var m = P.length;
      var suffix = P.slice(j + 1);          // 好后缀
      if (suffix.length === 0) return 1;    // 没有好后缀，交给坏字符规则
      for (var s = 1; s <= m - 1; s++) {
        var start = j + 1 - s;              // suffix 右移 s 后的新起点
        if (start < 0) break;               // 已经移出模式串左端
        var ok = true;
        for (var t = 0; t < suffix.length; t++) {
          var pi = start + t;     // ⚠ 这个 pi 只是「P 的下标」临时量，和演示 2 / 3 里那个 π 数组毫无关系
          if (pi >= m || pi >= start + s) { ok = false; break; }  // 不能与原位重叠
          if (P[pi] !== suffix[t]) { ok = false; break; }
        }
        if (ok) return s;
      }
      /* 兜底：好后缀的某个后缀若正好是模式串的前缀，则可滑到该前缀对齐 */
      for (var len = suffix.length - 1; len > 0; len--) {   // len = 好后缀某个后缀的长度（1..len-1），从长到短试
        if (P.slice(0, len) === suffix.slice(suffix.length - len)) {
          return j + 1 + (suffix.length - len);
        }
      }
      return j + 1;                         // 只能滑到失配位置之后
    }

    /* snap 的参数：align = 模式串左端对齐的主串下标；j = 失配位置（-1 = 完整匹配）；shift = 好后缀规则给出的位移，
       不传（undefined）就表示这一帧不画位移箭头。 */
    function snap(desc, align, j, shift) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var CW = 24;
          var W = 60 + n * CW, H = 224;
          var svg = s.svg(W, H);
          for (var t = 0; t < n; t++) {
            var cls = "";
            if (t === align + j) cls = "warn";
            else if (j >= 0 && t > align + j && t < align + m) cls = "done";
            svg.appendChild(SVG.box(30 + t * CW, 20, CW - 2, 34, cls, S[t], /done|warn/.test(cls) ? "on" : ""));
            svg.appendChild(SVG.label(30 + t * CW + CW / 2 - 1, 68, String(t), "middle"));
          }
          for (var u = 0; u < m; u++) {
            var cls2 = (u === j) ? "warn" : (j >= 0 && u > j ? "done" : "");
            svg.appendChild(SVG.box(30 + (align + u) * CW, 92, CW - 2, 34, cls2, P[u], /done|warn/.test(cls2) ? "on" : ""));
            svg.appendChild(SVG.label(30 + (align + u) * CW + CW / 2 - 1, 140, String(u), "middle"));
          }
          if (j >= 0 && j + 1 < m) {
            svg.appendChild(SVG.label(30 + align * CW, 180,
              "已匹配的好后缀 = \"" + P.slice(j + 1) + "\"（主串中同样存在这一段）", "start"));
            if (shift !== undefined) {
              svg.appendChild(SVG.line(30 + (align + j + 1) * CW, 150, 30 + (align + j + 1 + shift) * CW, 150, "active", true));
              svg.appendChild(SVG.label(30 + align * CW, 202,
                "好后缀规则给出的右移量 = " + shift + "（让好后缀与它在模式串中上一次出现的位置对齐）", "start"));
            }
          }
          return svg;
        }
      });
    }

    /* 演示：典型的好后缀生效场景 —— 尾部已匹配一大段，但坏字符规则几乎帮不上忙 */
    var align = 0, guard = 0;      // align 同上（模式串左端对齐的主串下标）；guard 是轮数护栏：最多 20 轮，防边界情况死循环
    var last2 = {};                // 又建了一份坏字符表（名字带 2 是为了跟演示 4 的 last 区分开）
    for (var z = 0; z < m; z++) last2[P[z]] = z;
    snap("依然从右往左比较。这一次我们关注：当<b>尾部若干字符已经匹配</b>、只有前面失配时，能滑多远？" +
      "（下文用 P = \"" + P + "\" 演示，它含有重复的尾串，好后缀规则的价值最明显。）", 0, m - 1, undefined);
    while (align <= n - m && guard++ < 20) {
      var j = m - 1;
      while (j >= 0 && P[j] === S[align + j]) j--;
      var suffixLen = m - 1 - j;   // 已匹配的好后缀长度：好后缀是 P[j+1 .. m−1]，所以长度 = m − 1 − j
      if (j < 0) {
        snap("完整匹配于下标 " + align + "。", align, -1, undefined);
        align += shiftAfterMatch(S, P, align, last2);
        continue;
      }
      var gs = goodSuffixShift(P, j);   // 好后缀规则算出的位移（≥ 1）
      var bad = S[align + j];
      var rm2 = last2[bad] === undefined ? -1 : last2[bad];   // 坏字符在 P 中最后出现的下标（含义同演示 4 的 rm）
      var bc = j - rm2; if (bc <= 0) bc = 1;                  // 坏字符规则的位移，同样要 max(1, …) 兜底防止原地打转
      if (suffixLen > 0) {
        snap("失配于 P[" + j + "] = '" + P[j] + "'。此刻尾部 <b>" + suffixLen + " 个字符</b>已经匹配成功，" +
          "它们构成「好后缀」\"" + P.slice(j + 1) + "\"。", align, j, gs);
        snap("两条规则分别算位移：<br>① <b>坏字符规则</b>：坏字符 '" + bad + "' 在模式串中最后出现在下标 " +
          (rm2 < 0 ? "（不存在）" : rm2) + " → 位移 " + bc + "；<br>" +
          "② <b>好后缀规则</b>：在模式串中寻找好后缀 \"" + P.slice(j + 1) + "\" 的上一次出现（或它某个后缀等于模式串前缀）→ 位移 <b>" + gs + "</b>。<br>" +
          "取较大值 max(" + bc + ", " + gs + ") = <b>" + Math.max(bc, gs) + "</b> 格。", align, j, gs);
        align += Math.max(bc, gs);
      } else {
        snap("最后一位就失配，没有好后缀可用，只能依靠坏字符规则位移 " + bc + " 格。", align, j, undefined);
        align += bc;
      }
      if (align > n - m) break;
      snap("滑动到对齐位置 " + align + "，再次从最右端开始比较。", align, m - 1, undefined);
    }

    snap("小结：好后缀规则保证<b>位移量永不小于 1</b>，并补上了坏字符规则可能给出负位移的漏洞；" +
      "两条规则取最大值，让 BM 平均只需约 O(n/m) 次比较，实际工程中（如 grep、文本编辑器）远快于 KMP。", 0, m - 1, undefined);

    new DS.Viz(host, {
      title: "BM 算法 · 好后缀规则", sub: "S = \"" + S + "\"　P = \"" + P + "\"", build: function () { return { frames: frames }; }
    });
  })();

})();
