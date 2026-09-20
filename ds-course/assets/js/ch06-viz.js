/* ==========================================================================
   ch06-viz.js —— 数组与特殊矩阵压缩存储 · 交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG
   包含四个演示：
     1) viz-row-vs-col      行优先 / 列优先的内存压平过程
     2) viz-symmetric-map   对称矩阵的下标映射与对称性
     3) viz-tridiagonal     三对角矩阵的带状压缩与 k 的计算
     4) viz-sparse-triplet  稀疏矩阵 → 三元组顺序表
   ========================================================================== */
(function () {
  "use strict";

  var SVG = DS.SVG;                             // 全页共用的 SVG 工具集：svg/box/text/label/el/line/path 都在它上面

  /* ---------------- 小工具：自由着色的文本（内联样式可覆盖 .vz-text 的 CSS） ---------------- */
  /* txt 的 opt：{cls 类名, anchor 对齐, fill 填充色, size 字号, weight 字重}，都可不传。 */
  function txt(svg, x, y, str, opt) {
    opt = opt || {};
    var t = SVG.text(x, y, str, opt.cls || "", opt.anchor || "start");
    if (opt.fill) t.style.fill = opt.fill;
    if (opt.size) t.style.fontSize = opt.size;
    if (opt.weight) t.style.fontWeight = opt.weight;
    svg.appendChild(t);
    return t;
  }

  /* 手画箭头的连线：竖直 / 水平两种方向，避免依赖 <marker> 的 id */
  /* (x1,y1) → (x2,y2)，color 是线条+箭头的颜色；dash 传 stroke-dasharray（如 "5 4"），不传就是实线。
     方向自动判断：|x2 − x1| < 1.5 当竖直画，否则当水平画。 */
  function arrow(svg, x1, y1, x2, y2, color, dash) {
    var ln = SVG.line(x1, y1, x2, y2, "");
    ln.style.stroke = color;
    ln.style.strokeWidth = "2";
    if (dash) ln.setAttribute("stroke-dasharray", dash);
    svg.appendChild(ln);
    var head;
    if (Math.abs(x2 - x1) < 1.5) {                       /* 竖直 */
      var dy = y2 > y1 ? -1 : 1;
      head = SVG.path("M" + x2 + "," + y2 + " l-6," + (dy * 10) + " l12,0 z", "", false);
    } else {                                             /* 水平 */
      var dx = x2 > x1 ? -1 : 1;
      head = SVG.path("M" + x2 + "," + y2 + " l" + (dx * 10) + ",-6 l0,12 z", "", false);
    }
    head.style.fill = color;
    head.style.stroke = "none";
    svg.appendChild(head);
  }

  /* ==========================================================================
     1) 行优先 vs 列优先
     ========================================================================== */
  (function rowVsCol() {
    /* 页面容器 #viz-row-vs-col：同一个 A[3][4] 分别按行优先、列优先压平成一维内存带，逐格显示 k 与地址。 */
    var host = document.getElementById("viz-row-vs-col");
    if (!host) return;

    var M = 3, N = 4, L = 4, BASE = 1000;    // M = 行数、N = 列数（矩阵 A[3][4]）；L = 每个元素的字节数；
                                             // BASE = 首地址 LOC(a[0][0])。⚠ 行优先公式乘的是 N（列数），列优先乘的是 M（行数），最容易记混
    var CW = 74, CH = 40, GX = 70, GY = 70;              /* 二维网格 */
    var MW = 64, MH = 46, MX = 48, MY = 244;             /* 一维内存带 */

    /* rowList / colList = 两种「压平顺序」的坐标清单（元素是 [i,j]）：行优先是逐行从左到右，列优先是逐列从上到下。
       它们只是把遍历顺序定下来，真正算出 k 的是推帧脚本里的 k = i*N + j / k = j*M + i。 */
    var rowList = [], colList = [], i, j;
    for (i = 0; i < M; i++) for (j = 0; j < N; j++) rowList.push([i, j]);
    for (j = 0; j < N; j++) for (i = 0; i < M; i++) colList.push([i, j]);

    var frames = [];                               // 本演示的帧数组：全部在 build() 里同步 push 完，DS.Viz 之后才逐帧渲染

    /* pushFrame 的参数：mode = "row" / "col"（决定用哪条 k 公式、以及整体配色）；
       ci / cj = 本帧要高亮成蓝色的二维格子（-1 = 首尾帧，不指任何格子）；
       filled = 此刻已经填好的内存带（下标就是线性下标 k，值是该格放的 [i,j]）；
       k = 本帧的线性下标（-1 = 无）。filled 上还挂了一个自定义属性 filled.cur 用来传「当前格」。 */
    function pushFrame(desc, mode, ci, cj, filled, k) {
      var snapshot = filled.slice();
      snapshot.cur = k;                     /* slice() 不会带上自定义属性，手动补上 */
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 860, H = 452, svg = s.svg(W, H);
          var isRow = (mode === "row");
          var hot = isRow ? "var(--brand)" : "var(--accent)";   // 本帧主题色：行优先蓝、列优先橙，标题/连线/公式统一用它

          txt(svg, 16, 26, isRow ? "① 行优先 Row-Major（C / C++ 采用）"
                                 : "② 列优先 Column-Major（Fortran / MATLAB 采用）",
              { cls: "big", fill: hot });

          /* ---------- 二维网格 ---------- */
          for (var c = 0; c < N; c++)
            txt(svg, GX + c * CW + CW / 2, GY - 10, "j=" + c,
                { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
          for (var r = 0; r < M; r++)
            txt(svg, GX - 12, GY + r * CH + CH / 2 + 4, "i=" + r,
                { cls: "sm", anchor: "end", fill: "var(--text-faint)" });

          for (var rr = 0; rr < M; rr++) {
            for (var cc = 0; cc < N; cc++) {
              var x = GX + cc * CW, y = GY + rr * CH;
              var cls = "";
              if (rr === ci && cc === cj) cls = "active";
              else if (mode === "row" && rr < ci) cls = "done";
              else if (mode === "row" && rr === ci && cc < cj) cls = "done";
              else if (mode === "col" && cc < cj) cls = "done";
              else if (mode === "col" && cc === cj && rr < ci) cls = "done";
              svg.appendChild(SVG.box(x + 2, y + 2, CW - 6, CH - 6, cls, "(" + rr + "," + cc + ")",
                /active|done/.test(cls) ? "on" : ""));
            }
          }

          /* ---------- 一维内存带（注意循环变量用 kk，别把当前线性下标 k 覆盖掉） ---------- */
          for (var kk = 0; kk < M * N; kk++) {
            var mx = MX + kk * MW;
            var cell = snapshot[kk];
            var kcls = cell ? "done" : "ghost";
            if (kk === snapshot.cur) kcls = "active";
            svg.appendChild(SVG.box(mx, MY, MW - 6, MH, kcls,
              cell ? "(" + cell[0] + "," + cell[1] + ")" : "?",
              kcls === "done" || kcls === "active" ? "on" : ""));
            txt(svg, mx + (MW - 6) / 2, MY + MH + 15, "k=" + kk,
                { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
            txt(svg, mx + (MW - 6) / 2, MY + MH + 29, String(BASE + kk * L),
                { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
          }
          txt(svg, MX, MY + MH + 48, "↑ 一维内存带：上面标线性下标 k，下面标对应的内存地址（每格 " + L + " 字节）",
              { cls: "sm", fill: "var(--text-soft)" });

          /* ---------- 连线：二维格子 → 内存格子 ---------- */
          if (ci >= 0 && k >= 0) {
            var fx = GX + cj * CW + CW / 2, fy = GY + ci * CH + CH - 3;
            var tx = MX + k * MW + (MW - 6) / 2, ty = MY - 2;
            arrow(svg, fx, fy, tx, ty, hot, "5 4");
          }

          /* ---------- 说明栏 ---------- */
          var infoY = 366;
          if (mode === "row") {
            txt(svg, 16, infoY, "行优先：先存完第 0 行，再存第 1 行 …… 同一行内从左到右",
                { cls: "sm", fill: "var(--text-soft)" });
            txt(svg, 16, infoY + 22, "线性下标  k = i × n + j = i × " + N + " + j",
                { cls: "sm", fill: "var(--brand)" });
          } else {
            txt(svg, 16, infoY, "列优先：先存完第 0 列，再存第 1 列 …… 同一列内从上到下",
                { cls: "sm", fill: "var(--text-soft)" });
            txt(svg, 16, infoY + 22, "线性下标  k = j × m + i = j × " + M + " + i",
                { cls: "sm", fill: "var(--accent)" });
          }
          if (ci >= 0) {
            var i2 = (mode === "row") ? ("i × " + N + " + j = " + ci + " × " + N + " + " + cj)
                                      : ("j × " + M + " + i = " + cj + " × " + M + " + " + ci);
            txt(svg, 16, infoY + 44,
                "当前 a[" + ci + "][" + cj + "]　→　k = " + i2 + " = " + k +
                "　→　内存偏移 = k × L = " + (k * L) + " 字节　→　地址 = " + (BASE + k * L),
                { cls: "sm", fill: hot });
          } else {
            txt(svg, 16, infoY + 44, "点击「下一步」开始逐个元素压平。", { cls: "sm", fill: "var(--text-faint)" });
          }
          txt(svg, 16, infoY + 66,
              "首地址 LOC(a[0][0]) = " + BASE + "，每个元素 L = " + L + " 字节，共 " + (M * N) + " 个元素。",
              { cls: "sm", fill: "var(--text-faint)" });
          return svg;
        }
      });
    }

    pushFrame("同一个二维数组 <b>A[3][4]</b>，我们要把它「压平」成一条一维内存带。" +
      "压平的顺序有两种约定，先看最常用的<b>行优先</b>：先把第 0 行的 4 个元素从左到右放好，" +
      "再放第 1 行……", "row", -1, -1, [], -1);

    /* 下面是「行优先」的推帧脚本：filled 是被不断写入的活数组（filled[k] = [i,j]），
       每一帧由 pushFrame 立刻拷贝成快照；filled.cur 记录当前正在放的格子。 */
    (function () {
      var filled = [];
      filled.cur = -1;
      rowList.forEach(function (p, idx) {
        var i = p[0], j = p[1], k = i * N + j;
        filled[k] = [i, j];
        filled.cur = k;
        pushFrame("行优先第 " + (idx + 1) + " 步：把二维格子 <b>a[" + i + "][" + j + "]</b> 放到内存带的第 " +
          k + " 格。<br>因为排在它前面的正好是 " + i + " 整行（" + (i * N) + " 个）加本行 " + j +
          " 个，共 " + k + " 个元素，所以 <code>k = i×n + j = " + i + "×" + N + " + " + j + " = " + k +
          "</code>，内存偏移 <code>" + k + "×" + L + " = " + (k * L) + "</code> 字节，地址 = <b>" +
          (BASE + k * L) + "</b>。", "row", i, j, filled, k);
      });
      pushFrame("行优先压平完成。请记住这条内存带的排列：<b>(0,0)(0,1)(0,2)(0,3)(1,0)(1,1)(1,2)(1,3)(2,0)(2,1)(2,2)(2,3)</b>。" +
        "同一行的元素在内存里是挨着的——这就是 C/C++ 里「按行遍历更快」的根源。",
        "row", -1, -1, filled, -1);
    })();

    pushFrame("现在换一种约定：<b>列优先</b>。先把第 0 列的 3 个元素从上到下放好，再放第 1 列……" +
      "注意内存带是重新开始填的，同一个数组、同样的 12 个元素，只是排列顺序变了。",
      "col", -1, -1, [], -1);

    /* 同样的一套脚本，换成「列优先」顺序（k = j*M + i），filled 重新从空开始。 */
    (function () {
      var filled = [];
      filled.cur = -1;
      colList.forEach(function (p, idx) {
        var i = p[0], j = p[1], k = j * M + i;
        filled[k] = [i, j];
        filled.cur = k;
        pushFrame("列优先第 " + (idx + 1) + " 步：a[" + i + "][" + j + "] 放到内存带的第 " + k +
          " 格。<br>排在它前面的是 " + j + " 整列（每列 " + M + " 个）+ 本列 " + i +
          " 个，共 " + k + " 个元素，所以 <code>k = j×m + i = " + j + "×" + M + " + " + i + " = " + k +
          "</code>，地址 = <b>" + (BASE + k * L) + "</b>。", "col", i, j, filled, k);
      });
      pushFrame("列优先压平完成，内存带变成 <b>(0,0)(1,0)(2,0)(0,1)(1,1)(2,1)(0,2)(1,2)(2,2)(0,3)(1,3)(2,3)</b>。<br>" +
        "对比同一个元素 a[1][2]：行优先时 k = 1×4+2 = <b>6</b>，列优先时 k = 2×3+1 = <b>7</b>——" +
        "这就是两种约定真正的差别，也是地址计算题最容易翻车的地方。",
        "col", -1, -1, filled, -1);
    })();

    new DS.Viz(host, {
      title: "行优先 vs 列优先：把二维数组压成一维内存带",
      sub: "A[3][4]，逐格显示 二维下标 → 一维下标 k → 内存偏移",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     2) 对称矩阵的下标映射与对称性
     ========================================================================== */
  (function symmetricMap() {
    /* 页面容器 #viz-symmetric-map：5 阶对称矩阵只存下三角，逐格演示 k = i(i+1)/2 + j 与 (i,j)↔(j,i) 的对称性。 */
    var host = document.getElementById("viz-symmetric-map");
    if (!host) return;

    var N = 5;                                     // 矩阵阶数 n = 5（5×5 方阵）；下三角 + 对角线共 n(n+1)/2 = 15 个元素
    var CW = 64, CH = 42, GX = 60, GY = 80;        /* 矩阵网格 */
    var AW = 64, AH = 30, AX = 500, AY = 80;       /* 一维数组（阶梯状） */

    /* val(i,j) = i×10 + j：纯粹造一个好认的显示值（十位是行号、个位是列号），不是真实数据；调用时一律传 i ≥ j。 */
    function val(i, j) { return i * 10 + j; }      /* i >= j 时的值 */

    /* 下三角（含对角线）按行优先的顺序 */
    /* lower = 下三角按行优先排列的坐标清单（元素 [i,j]，长度 15）。它的顺序恰好与 k = i(i+1)/2 + j 递增一致，
       所以「搬完前 count 个」就等于「sa[0..count−1] 已填好」。 */
    var lower = [], i, j;
    for (i = 0; i < N; i++) for (j = 0; j <= i; j++) lower.push([i, j]);

    var frames = [];                               // 本演示的帧数组：全部在 build() 里同步 push 完，DS.Viz 之后才逐帧渲染

    /* pushFrame 的参数：ci / cj = 本帧访问的格子（-1 = 首尾帧）；k = 该格在 sa 里的下标（-1 = 无）；
       count = 已经存好的元素个数（用来把矩阵里已搬完的格子画绿）；sa = 一维数组内容（按 k 索引）。 */
    function pushFrame(desc, ci, cj, k, count, sa) {
      var snapSA = sa.slice();                     // 快照：sa 是后面还会继续写的活数组，推帧时先拷一份
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 860, H = 452, svg = s.svg(W, H);

          txt(svg, 16, 28, "对称矩阵 A（5 阶）：a[i][j] = a[j][i]，只存下三角（含对角线）",
              { cls: "big", fill: "var(--brand)" });

          /* ---------- 矩阵 ---------- */
          for (var c = 0; c < N; c++)
            txt(svg, GX + c * CW + CW / 2, GY - 10, "j=" + c,
                { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
          for (var r = 0; r < N; r++)
            txt(svg, GX - 10, GY + r * CH + CH / 2 + 4, "i=" + r,
                { cls: "sm", anchor: "end", fill: "var(--text-faint)" });

          for (var rr = 0; rr < N; rr++) {
            for (var cc = 0; cc < N; cc++) {
              var x = GX + cc * CW, y = GY + rr * CH;
              var v = (rr >= cc) ? val(rr, cc) : val(cc, rr);   /* 上三角显示镜像值 */
              var cls = (rr >= cc) ? "" : "dim";
              /* 下三角按行优先的处理次序恰好是 rr(rr+1)/2 + cc，用它判断是否已搬运 */
              if (rr >= cc && (rr * (rr + 1) / 2 + cc) < count) cls = "done";
              if (rr === ci && cc === cj) cls = "active";
              if (ci >= 0 && ci !== cj && rr === cj && cc === ci) cls = "compare";
              svg.appendChild(SVG.box(x + 2, y + 2, CW - 6, CH - 6, cls, v,
                /active|compare|done/.test(cls) ? "on" : ""));
            }
          }

          /* ---------- 一维数组（阶梯状，直观展示 k = i(i+1)/2 + j） ---------- */
          txt(svg, AX - 40, AY - 24, "一维数组 sa[]（长度 n(n+1)/2 = " + (N * (N + 1) / 2) + "）",
              { cls: "sm", fill: "var(--text-soft)" });
          for (var r2 = 0; r2 < N; r2++) {
            var y2 = AY + r2 * (AH + 16);
            txt(svg, AX - 14, y2 + AH / 2 + 4, "i=" + r2,
                { cls: "sm", anchor: "end", fill: "var(--text-faint)" });
            for (var c2 = 0; c2 <= r2; c2++) {
              var kk = r2 * (r2 + 1) / 2 + c2;
              var xx = AX + c2 * AW;
              var filled = snapSA[kk] !== undefined && snapSA[kk] !== null;
              var kcls = filled ? "done" : "ghost";
              if (kk === k) kcls = "active";
              svg.appendChild(SVG.box(xx, y2, AW - 6, AH, kcls,
                filled ? String(snapSA[kk]) : "?", /done|active/.test(kcls) ? "on" : ""));
              txt(svg, xx + (AW - 6) / 2, y2 - 4, "k=" + kk,
                  { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
            }
          }

          /* ---------- 说明 ---------- */
          var ty = GY + N * CH + 34;
          if (ci < 0) {
            txt(svg, 16, ty, "下三角一共 1+2+3+4+5 = 15 个元素，按行优先压进 sa[]。",
                { cls: "sm", fill: "var(--text-soft)" });
            txt(svg, 16, ty + 26, "i ≥ j 时：k = i(i+1)/2 + j　　i < j 时：k = j(j+1)/2 + i",
                { cls: "sm", fill: "var(--brand)" });
          } else {
            txt(svg, 16, ty, "访问 a[" + ci + "][" + cj + "]：这一格的镜像位置是 a[" + cj + "][" + ci + "]。",
                { cls: "sm", fill: "var(--text-soft)" });
            var f = (ci >= cj)
              ? ("k = i(i+1)/2 + j = " + ci + "×" + (ci + 1) + "/2 + " + cj)
              : ("k = j(j+1)/2 + i = " + cj + "×" + (cj + 1) + "/2 + " + ci);
            txt(svg, 16, ty + 24, f + " = " + k + "　⇒　两个位置查到同一个单元 sa[" + k + "] = " + val(Math.max(ci, cj), Math.min(ci, cj)),
                { cls: "sm", fill: "var(--brand)" });
            txt(svg, 16, ty + 48, "已存入 " + count + " / " + (N * (N + 1) / 2) + " 个元素。" +
              (ci === cj ? "（对角线元素 i = j，镜像就是它自己，只存一次）"
                         : "（上三角的元素不单独存储，靠对称性转成下三角来查）"),
              { cls: "sm", fill: "var(--text-faint)" });
          }
          return svg;
        }
      });
    }

    pushFrame("目标：把 5 阶对称矩阵的<b>下三角（含主对角线）</b>按行优先压进一维数组 sa[]。" +
      "下面逐个元素搬运，每一步都会同时标出它的镜像位置，观察两者算出的 k 是否相同。",
      -1, -1, -1, 0, []);

    var sa = [], cnt = 0;                          // sa = 压缩后的一维数组（长度 15，按 k 索引）；cnt = 已经存好的元素个数
    lower.forEach(function (p) {
      var i = p[0], j = p[1];
      var k = (i >= j) ? (i * (i + 1) / 2 + j) : (j * (j + 1) / 2 + i);
      sa[k] = val(Math.max(i, j), Math.min(i, j));
      cnt++;
      pushFrame("处理 <b>a[" + i + "][" + j + "]</b>：<code>k = i(i+1)/2 + j = " + i + "×" + (i + 1) +
        "/2 + " + j + " = " + (i * (i + 1) / 2) + " + " + j + " = " + k + "</code>，" +
        "存入 sa[" + k + "] = " + sa[k] + "。", i, j, k, cnt, sa);

      if (i !== j) {
        pushFrame("现在访问它的镜像 <b>a[" + j + "][" + i + "]</b>（上三角，本来不存）：" +
          "<code>k = j(j+1)/2 + i = " + j + "×" + (j + 1) + "/2 + " + i + " = " + k + "</code>，" +
          "居然算出了<b>同一个 k</b>！<br>这就是对称矩阵压缩存储的全部秘密——" +
          "两个位置共用 sa[" + k + "] 这一个单元，一次存储顶两次读取。", j, i, k, cnt, sa);
      }
    });

    pushFrame("全部完成：sa[0..14] 依次存放 <b>" + sa.join(" ") + "</b>，共 15 个单元，" +
      "而原矩阵有 25 个元素，省掉了 40%。<br>映射函数 <code>k = i(i+1)/2 + j</code> 只含一次乘法，" +
      "因此 <b>O(1)</b> 就能算出任意 (i,j) 的存放位置——对称矩阵压缩后<b>保留了随机存取能力</b>。",
      -1, -1, -1, cnt, sa);

    new DS.Viz(host, {
      title: "对称矩阵的压缩映射", sub: "n = 5，逐格演示 k = i(i+1)/2 + j 与 (i,j)↔(j,i) 的对称性",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     3) 三对角矩阵的带状压缩
     ========================================================================== */
  (function tridiagonal() {
    /* 页面容器 #viz-tridiagonal：6 阶三对角矩阵只存 |i − j| ≤ 1 的三条对角线，逐行演示 k = 2i + j 的来历。 */
    var host = document.getElementById("viz-tridiagonal");
    if (!host) return;

    var N = 6;                                     // 矩阵阶数 n = 6；带内元素共 3n − 2 = 16 个
    var CW = 52, CH = 40, GX = 50, GY = 80;        /* 矩阵网格 */
    var AW = 64, AH = 30, AX = 480, AY = 80;       /* 一维数组（阶梯状） */

    function val(i, j) { return i * 10 + j; }      // 只是好认的显示值（十位 = 行号、个位 = 列号），不是真实数据
    function inBand(i, j) { return Math.abs(i - j) <= 1; }   // (i,j) 是否落在三条对角线带内：带内才存储，带外一律当 0
    /* 第 i 行在 sa 中的起始下标与元素个数 */
    function rowStart(i) { return (i === 0) ? 0 : 3 * i - 1; }
    function rowCount(i) { return (i === 0 || i === N - 1) ? 2 : 3; }

    var total = 3 * N - 2;                         // sa 的长度 = 3n − 2 = 16（首行 2 个 + 中间 n−2 行各 3 个 + 末行 2 个）
    var frames = [];                               // 本演示的帧数组：全部在 build() 里同步 push 完，DS.Viz 之后才逐帧渲染

    /* pushFrame 的参数：ci / cj = 本帧要高亮的矩阵格子（-1 = 首尾帧）；ck = 对应的 sa 下标（-1 = 无）；
       sa = 一维数组内容（按 k 索引）。 */
    function pushFrame(desc, ci, cj, ck, sa) {
      var snap = sa.slice();                       // 快照：sa 是活数组，推帧时先拷一份
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 860, H = 470, svg = s.svg(W, H);

          txt(svg, 16, 28, "三对角矩阵（6 阶）：只有 |i − j| ≤ 1 的元素可能非零，共 3n − 2 = " + total + " 个",
              { cls: "big", fill: "var(--brand)" });

          /* ---------- 矩阵 ---------- */
          for (var c = 0; c < N; c++)
            txt(svg, GX + c * CW + CW / 2, GY - 10, "j=" + c,
                { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
          for (var r = 0; r < N; r++)
            txt(svg, GX - 10, GY + r * CH + CH / 2 + 4, "i=" + r,
                { cls: "sm", anchor: "end", fill: "var(--text-faint)" });

          for (var rr = 0; rr < N; rr++) {
            for (var cc = 0; cc < N; cc++) {
              var x = GX + cc * CW, y = GY + rr * CH;
              var cls = inBand(rr, cc) ? "" : "ghost";
              if (inBand(rr, cc) && rr < ci) cls = "done";
              if (inBand(rr, cc) && rr === ci && cc < cj) cls = "done";
              if (rr === ci && cc === cj) cls = "active";
              svg.appendChild(SVG.box(x + 2, y + 2, CW - 6, CH - 6, cls,
                inBand(rr, cc) ? String(val(rr, cc)) : "0",
                /active|done/.test(cls) ? "on" : ""));
            }
          }
          txt(svg, GX, GY + N * CH + 22, "灰色 = 带外的 0，不存储", { cls: "sm", fill: "var(--text-faint)" });

          /* ---------- 一维数组 ---------- */
          txt(svg, AX - 40, AY - 26, "sa[]（长度 3n − 2 = " + total + "）",
              { cls: "sm", fill: "var(--text-soft)" });
          for (var r2 = 0; r2 < N; r2++) {
            var y2 = AY + r2 * (AH + 18);
            var st = rowStart(r2), cnt = rowCount(r2);
            txt(svg, AX - 14, y2 + AH / 2 + 4, "i=" + r2,
                { cls: "sm", anchor: "end", fill: "var(--text-faint)" });
            for (var t = 0; t < cnt; t++) {
              var k = st + t;
              var xx = AX + t * AW;
              var filled = (snap[k] !== undefined && snap[k] !== null);
              var kcls = filled ? "done" : "ghost";
              if (k === ck) kcls = "active";
              svg.appendChild(SVG.box(xx, y2, AW - 6, AH, kcls,
                filled ? String(snap[k]) : "?", /done|active/.test(kcls) ? "on" : ""));
              txt(svg, xx + (AW - 6) / 2, y2 - 4, "k=" + k,
                  { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
            }
          }

          /* ---------- 说明 ---------- */
          var ty = AY + N * (AH + 18) + 8;
          if (ci < 0) {
            txt(svg, 16, ty, "第 0 行 2 个，中间每行 3 个，最后一行 2 个 ⇒ 2 + 3(n−2) + 2 = 3n − 2。",
                { cls: "sm", fill: "var(--text-soft)" });
            txt(svg, 16, ty + 24, "k = 2i + j（|i − j| ≤ 1）", { cls: "sm", fill: "var(--brand)" });
          } else {
            txt(svg, 16, ty, "把 a[" + ci + "][" + cj + "] = " + val(ci, cj) + " 压进 sa[" + ck + "]：",
                { cls: "sm", fill: "var(--text-soft)" });
            var lead = (ci === 0) ? "0" : ("3×" + ci + " − 1 = " + (3 * ci - 1));
            txt(svg, 16, ty + 24,
                "前 " + ci + " 行共 " + lead + " 个（第 0 行 2 个 + 中间每行 3 个），" +
                "本行从列 " + (ci === 0 ? 0 : ci - 1) + " 开始放，行内偏移 = j − i + 1 = " + (cj - ci + 1) +
                "　⇒　k = " + lead + " + " + (cj - ci + 1) + " = " + ck + "，即 <b>k = 2i + j = " + (2 * ci + cj) + "</b>",
                { cls: "sm", fill: "var(--brand)" });
            txt(svg, 16, ty + 48,
                "带外元素（|i − j| > 1）直接返回 0，既不存储也不查找 —— 这就是压缩后仍保持 O(1) 随机存取的原因。",
                { cls: "sm", fill: "var(--text-faint)" });
          }
          return svg;
        }
      });
    }

    pushFrame("把 6 阶三对角矩阵的三条对角线按行优先压平。注意每一行的元素个数并不相同：" +
      "第 0 行 2 个、中间各行 3 个、最后一行 2 个，所以「前 i 行有多少个」要分情况数。",
      -1, -1, -1, []);

    var sa = [];                                   // 压缩后的一维数组（长度 total = 16，按 k 索引）
    for (var i = 0; i < N; i++) {
      var st = rowStart(i), cnt = rowCount(i);
      for (var t = 0; t < cnt; t++) {
        var j = (i === 0) ? t : (i - 1 + t);   // 行内第 t 个元素对应的列号：第 0 行从 j = 0 起，其余行从 j = i−1 起
        var k = st + t;
        sa[k] = val(i, j);
        pushFrame("第 " + i + " 行：a[" + i + "][" + j + "] 存入 sa[" + k + "]。", i, j, k, sa);
      }
    }

    pushFrame("压平完成，sa = <b>[" + sa.join(", ") + "]</b>，共 " + total + " 个单元（原来要 36 个）。<br>" +
      "统一公式 <code>k = 2i + j</code> 对带内所有元素成立；反过来由 k 求 (i,j) 也不难：" +
      "<code>i = ⌊(k+1)/3⌋，j = k − 2i</code>。压缩存储让 n 阶三对角矩阵的存储量从 O(n²) 降到 O(n)。",
      -1, -1, -1, sa);

    new DS.Viz(host, {
      title: "三对角矩阵的带状压缩", sub: "n = 6，逐行演示 k = 2i + j 的来历",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     4) 稀疏矩阵 → 三元组顺序表
     ========================================================================== */
  (function sparseTriplet() {
    /* 页面容器 #viz-sparse-triplet：按行优先扫一遍稀疏矩阵，非零元依次追加进三元组顺序表 data[]。 */
    var host = document.getElementById("viz-sparse-triplet");
    if (!host) return;

    var MU = 5, NU = 6;                              // 矩阵的行数 MU、列数 NU（5 × 6 = 30 个元素，其中 7 个非零元）
    var CW = 48, CH = 40, GX = 62, GY = 76;          /* 矩阵网格 */
    var TX = 430, TY = 76, RH = 30;                  /* 三元组表 */
    var COLW = [56, 56, 66, 76];                     // 三元组表四列的宽度（序号 / row / col / value），逐列累加就是每列的 x

    /* 稀疏矩阵：0 表示零元素 */
    var A = [
      [0, 3, 0, 0, 7, 0],
      [0, 0, 5, 0, 0, 0],
      [4, 0, 0, 6, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 2, 0, 0, 0, 9]
    ];

    var frames = [];                               // 本演示的帧数组：全部在 build() 里同步 push 完，DS.Viz 之后才逐帧渲染

    /* pushFrame 的参数：ci / cj = 正在扫描的格子（-1 = 首尾帧）；triples = 已收集的三元组 [[row,col,value], …]，
       它的下标就是表里的「序号」（0 基）；第 5 个参数 done（= 已收集个数）传了但 draw 从没用过，实际以 triples.length 为准。 */
    function pushFrame(desc, ci, cj, triples, done) {
      var snap = triples.slice();   // 快照：这里浅拷贝就够 —— 每条三元组 push 进数组后不会再被改写
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 860, H = 452, svg = s.svg(W, H);

          txt(svg, 16, 26, "稀疏矩阵 A（5 × 6 = 30 个元素，只有 7 个非零元）→ 三元组顺序表",
              { cls: "big", fill: "var(--brand)" });

          /* ---------- 矩阵 ---------- */
          for (var c = 0; c < NU; c++)
            txt(svg, GX + c * CW + CW / 2, GY - 10, "j=" + c,
                { cls: "sm", anchor: "middle", fill: "var(--text-faint)" });
          for (var r = 0; r < MU; r++) {
            txt(svg, GX - 10, GY + r * CH + CH / 2 + 4, "i=" + r,
                { cls: "sm", anchor: "end", fill: "var(--text-faint)" });
            for (var c2 = 0; c2 < NU; c2++) {
              var x = GX + c2 * CW, y = GY + r * CH;
              var v = A[r][c2];
              var cls = v === 0 ? "ghost" : "";
              if (r < ci || (r === ci && c2 < cj)) cls = v === 0 ? "ghost" : "done";
              if (r === ci && c2 === cj) cls = "active";
              svg.appendChild(SVG.box(x + 2, y + 2, CW - 6, CH - 6, cls,
                v === 0 ? "0" : String(v), /active|done/.test(cls) ? "on" : ""));
            }
          }
          txt(svg, GX - 10, GY + MU * CH + 22, "扫描顺序：行优先（i 从 0 到 4，每行 j 从 0 到 5）",
              { cls: "sm", fill: "var(--text-faint)" });

          /* ---------- 三元组表 ---------- */
          txt(svg, TX, TY - 12, "三元组顺序表 data[]（按行优先有序）", { cls: "sm", fill: "var(--text-soft)" });
          var head = ["序号", "row", "col", "value"];
          var hx = TX;
          for (var h = 0; h < 4; h++) {
            svg.appendChild(SVG.box(hx, TY, COLW[h] - 4, RH, "done", head[h], "on"));
            hx += COLW[h];
          }
          for (var t = 0; t < 7; t++) {   // 表里固定画 7 行：这个矩阵正好 7 个非零元，还没填到的行画成灰
            var y2 = TY + RH * (t + 1);
            var rec = snap[t];
            var vals = rec ? [String(t), String(rec[0]), String(rec[1]), String(rec[2])] : [String(t), "", "", ""];
            var hx2 = TX;
            for (var q = 0; q < 4; q++) {
              var kcls = rec ? (t === snap.length - 1 ? "active" : "done") : "ghost";
              svg.appendChild(SVG.box(hx2, y2, COLW[q] - 4, RH - 4, kcls, vals[q],
                /done|active/.test(kcls) ? "on" : ""));
              hx2 += COLW[q];
            }
          }

          /* ---------- 说明 ---------- */
          var ty = GY + MU * CH + 52;
          txt(svg, 16, ty, "已存入 " + snap.length + " 个非零元（tu = " + snap.length + "）；" +
            "矩阵共 " + (MU * NU) + " 个元素，稀疏度约 " +
            Math.round(snap.length / (MU * NU) * 100) + "%（真实场景常低于 5%）。",
            { cls: "sm", fill: "var(--text-soft)" });
          txt(svg, 16, ty + 26, "三元组表只存 (行号, 列号, 值)，零元素一个字节都不占。",
            { cls: "sm", fill: "var(--brand)" });
          txt(svg, 16, ty + 50, "按下标随机取值的能力没有了：要查 a[i][j] 只能顺序扫描，最坏 O(tu)。",
            { cls: "sm", fill: "var(--text-faint)" });
          return svg;
        }
      });
    }

    var triples = [];                              // 三元组顺序表：每条是 [行号, 列号, 值]（行优先扫描顺序入表），长度 tu = 7
    pushFrame("把稀疏矩阵转成三元组表：按<b>行优先</b>顺序扫描整个矩阵，" +
      "遇到非零元就追加一条 (row, col, value)，遇到 0 直接跳过。", -1, -1, triples, 0);

    for (var i = 0; i < MU; i++) {
      for (var j = 0; j < NU; j++) {
        var v = A[i][j];
        if (v !== 0) {
          triples.push([i, j, v]);
          pushFrame("扫描到 <b>a[" + i + "][" + j + "] = " + v + " ≠ 0</b> → 追加三元组 " +
            "data[" + (triples.length - 1) + "] = (" + i + ", " + j + ", " + v + ")。",
            i, j, triples, triples.length);
        } else {
          pushFrame("扫描到 a[" + i + "][" + j + "] = 0 → <b>跳过，不存储</b>。",
            i, j, triples, triples.length);
        }
      }
    }

    pushFrame("转换完成：tu = " + triples.length + " 个三元组，" +
      "正好按「行号升序、同行列号升序」排列 —— 这个有序性让后面的转置、加法、乘法都能按行归并着做。<br>" +
      "如果还要频繁按行访问，就在三元组表上再加一个 <code>rpos[]</code> 前缀和数组，" +
      "第 i 行的元素区间立刻变成 O(1) 可定位。", -1, -1, triples, triples.length);

    new DS.Viz(host, {
      title: "稀疏矩阵 → 三元组顺序表", sub: "逐格扫描，非零元存入 (row, col, value)",
      build: function () { return { frames: frames }; }
    });
  })();

})();
