/* ==========================================================================
   ch07-viz.js —— 第 07 讲 树与二叉树 · 交互动画
   依赖：assets/js/course.js 暴露的 DS.Viz / DS.SVG

   本文件包含 9 个独立演示（每个都先 getElementById 取容器，取不到就跳过）：
     1) viz-preorder       先序遍历（根左右）
     2) viz-inorder        中序遍历（左根右）
     3) viz-postorder      后序遍历（左右根）
     4) viz-levelorder     层序遍历（队列 BFS）
     5) viz-tree-rebuild   由「先序 + 中序」逐帧还原二叉树
     6) viz-huffman-build  赫夫曼树构造（每次合并两个最小权值，实时更新 WPL）
     7) viz-huffman-code   赫夫曼编码表生成（沿树左 0 右 1）+ 与等长编码对比
     8) viz-dsu            并查集 union / find（含路径压缩）
     9) viz-tree-to-binary 树 → 二叉树（左孩子右兄弟）的转换过程
   ========================================================================== */
(function () {
  "use strict";
  var SVG = DS.SVG;                             // 全页共用的 SVG 工具集：svg/box/text/label/el/line/path 都在它上面

  /* 下面两个是本文件 9 个演示共用的排版常量（单位 px）：R = 结点圆的半径（局部的 R-2 / R-3 都是它的小改款）；
     GAPX = 相邻「中序槽位」的水平间距，layout() 用它给结点分 x 坐标，值太小树会挤在一起。 */
  var R = 20;          // 结点半径
  var GAPX = 46;       // 相邻「中序位置」的水平间距

  /* ======================================================================
     一、通用绘图工具
     ====================================================================== */

  /* 画一段文字（可加粗 / 指定 class） */
  function put(s, x, y, str, anchor, cls, weight) {
    var t = SVG.text(x, y, str, cls || "", anchor || "start");
    if (weight) t.setAttribute("font-weight", weight);
    return t;
  }

  /* 浅拷贝一个「名字 → 标记」的对象。
     DS.Viz 会先同步跑完整个 build()、之后才逐帧渲染，所以推帧时必须给
     done / codes 这类被算法逐步改写的活对象留一份快照，draw 只读快照。 */
  function cloneFlags(o) {
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
    return r;
  }

  /* ----------------------------------------------------------------------
     二叉树布局：先按「中序」给每个结点分配一个水平槽位（保证任意两棵子树
     的槽位区间不相交），再让父结点落在左右孩子的中点上。
     返回 { map, order, depth }：map[名字] = {x, y, d}
     ---------------------------------------------------------------------- */
  function layout(root, gapX, gapY) {
    gapX = gapX || GAPX; gapY = gapY || 74;
    var map = {}, order = [], depth = 0, next = 0;

    (function walk(nd, d) {
      if (!nd) return;
      depth = Math.max(depth, d);
      walk(nd.left, d + 1);
      map[nd.name] = { x: 1 + gapX * next, y: 52 + d * gapY, d: d };
      order.push(nd.name); next++;
      walk(nd.right, d + 1);
    })(root, 0);

    /* 返回值补充：order 是结点的中序名字序列（第 k 个结点就占第 k 个水平槽位），depth 是最深层号（0 基，根 = 0）。 */
    return { map: map, order: order, depth: depth };
  }

  /* ----------------------------------------------------------------------
     画一棵二叉树
       W   : 画布宽度
       st  : { active, done:{}, warn:{}, cmp:{}, dim:{} }
       opt : { gapX, gapY, title, edgeLabel(childName,parentName,k), showSub }
     ---------------------------------------------------------------------- */
  function drawTree(s, W, root, st, opt) {
    /* st 的补充：active 是结点名字符串（null = 不高亮任何结点）；done / warn / cmp / dim 是「名字 → true」的对象。
       同一个结点若被多个表命中，按 active > warn > cmp > done > dim 的先后取色（见下面 nodes() 的 if 链）。 */
    opt = opt || {}; st = st || {};
    var gx = opt.gapX || GAPX, gy = opt.gapY || 74;
    var L = layout(root, gx, gy);
    var H = (L.depth + 1) * gy + 60;
    var svg = s.svg(W, H);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    /* 让整棵树在画布上居中：算出实际内容宽度后补左边的空隙 */
    var pad = Math.max(40, (W - (L.order.length - 1) * gx) / 2);
    var done = st.done || {}, warn = st.warn || {}, cmp = st.cmp || {}, dim = st.dim || {};

    (function edges(nd) {
      if (!nd) return;
      var a = L.map[nd.name];
      [nd.left, nd.right].forEach(function (c, k) {
        if (!c) return;
        var b = L.map[c.name];
        var cls = done[c.name] ? "done" : (c.name === st.active ? "active" : "");
        svg.appendChild(SVG.line(a.x + pad, a.y + R, b.x + pad, b.y - R, cls));
        if (typeof opt.edgeLabel === "function") {
          var lab = opt.edgeLabel(c.name, nd.name, k);
          if (lab) {
            svg.appendChild(put(s, (a.x + b.x) / 2 + pad + (k === 0 ? -13 : 13),
              (a.y + b.y) / 2 + 5, lab, "middle", "vz-label", "700"));
          }
        }
        edges(c);
      });
    })(root);

    (function nodes(nd) {
      if (!nd) return;
      var p = L.map[nd.name], cls = "";
      if (nd.name === st.active) cls = "active";
      else if (warn[nd.name]) cls = "warn";
      else if (cmp[nd.name]) cls = "compare";
      else if (done[nd.name]) cls = "done";
      else if (dim[nd.name]) cls = "dim";
      svg.appendChild(SVG.circle(p.x + pad, p.y, R, cls, nd.name,
        /active|done|warn|compare/.test(cls) ? "on" : ""));
      if (opt.showSub !== false && nd.sub !== undefined && nd.sub !== null) {
        svg.appendChild(put(s, p.x + pad + R - 4, p.y - R + 3, String(nd.sub), "middle",
          "vz-label", "700"));
      }
      nodes(nd.left); nodes(nd.right);
    })(root);

    if (opt.title) svg.appendChild(put(s, 12, 20, opt.title, "start", "vz-label", "700"));
    return svg;
  }

  /* 结果显示条：把「已经输出」的序列画成一排小格子 */
  /* full = 完整序列（决定画几个格子），got = 已经输出的那一段：前 got.length 个格子填绿并写上字符。 */
  function drawSeq(s, svg, x, y, size, full, got, label) {
    svg.appendChild(SVG.label(x - 10, y + size * 0.68, label, "end"));
    for (var i = 0; i < full.length; i++) {
      var ok = i < got.length;
      svg.appendChild(SVG.box(x + i * (size + 4), y, size, size, ok ? "done" : "",
        ok ? got[i] : "", ok ? "on" : ""));
    }
  }

  /* 队列：左端是队首 */
  /* items = 队列里的名字数组（items[0] 是队首，画成蓝色；后面的按顺序往右排），空队列时画一个灰色的「空」。 */
  function drawQueue(s, svg, x, y, items, size, label) {
    svg.appendChild(SVG.label(x, y - 8, label, "start"));
    if (!items.length) {
      svg.appendChild(SVG.box(x, y, 56, size, "dim", "空", ""));
      return;
    }
    for (var i = 0; i < items.length; i++) {
      var cls = i === 0 ? "active" : "";
      svg.appendChild(SVG.box(x + i * (size + 4), y, size, size, cls, items[i], cls ? "on" : ""));
    }
    svg.appendChild(put(s, x, y + size + 14, "↑ 队首（下一个出队）", "start", "vz-label"));
  }

  /* 栈：items[0] 在栈底，最后一项在栈顶 */
  /* yBottom = 栈底那条基准线的 y（格子从下往上长）；栈顶那格画成蓝色，其余绿色。 */
  function drawStack(s, svg, x, yBottom, items, size, label) {
    svg.appendChild(SVG.label(x, yBottom - size * 5 - 14, label, "start"));
    if (!items.length) {
      svg.appendChild(SVG.box(x, yBottom - size, 56, size, "dim", "空", ""));
      return;
    }
    for (var k = 0; k < items.length; k++) {
      var yy = yBottom - (k + 1) * (size + 4);
      var cls = k === items.length - 1 ? "active" : "done";
      svg.appendChild(SVG.box(x, yy, size + 16, size, cls, items[k], "on"));
    }
    svg.appendChild(put(s, x - 12, yBottom - size * 0.4, "栈顶 →", "end", "vz-label"));
  }

  /* ======================================================================
     二、主角树（图 7-9）：A( B( D, E( G, · ) ), C( ·, F ) )
     ====================================================================== */
  /* 每次调用都返回一棵全新的主角树对象，9 个演示各用各的，互不干扰。 */
  function heroTree() {
    return {
      name: 'A',
      left: {
        name: 'B',
        left: { name: 'D', left: null, right: null },
        right: { name: 'E', left: { name: 'G', left: null, right: null }, right: null }
      },
      right: { name: 'C', left: null, right: { name: 'F', left: null, right: null } }
    };
  }
  var HERO_LEVEL = 'ABCDEFG';   // 主角树的层序（= 7 个结点），结果序列条按它的字符数画格子

  /* ======================================================================
     三、前序 / 中序 / 后序遍历（用显式栈模拟递归，逐帧展开）
     ====================================================================== */
  var ORDER = { pre: 'DLR', in: 'LDR', post: 'LRD' };   // 三种次序的缩写：D = 访问根、L = 左子树、R = 右子树；recSteps 按它决定谁先谁后
  var KIND = { pre: '先序', in: '中序', post: '后序' };   // 缩写 → 中文名（标题与描述文字里用）

  /* 把递归过程展开成步骤序列：
     {type:'call'|'visit'|'ret', name, stack:[自底向上的名字数组]} */
  function recSteps(root, kind) {
    var steps = [], stack = [];
    (function walk(nd) {
      if (!nd) return;
      stack.push(nd.name);
      steps.push({ type: 'call', name: nd.name, stack: stack.slice() });
      var seq = ORDER[kind];
      for (var i = 0; i < 3; i++) {
        var part = seq.charAt(i);
        if (part === 'D') steps.push({ type: 'visit', name: nd.name, stack: stack.slice() });
        else if (part === 'L') { if (nd.left) walk(nd.left); }
        else { if (nd.right) walk(nd.right); }
      }
      stack.pop();
      steps.push({ type: 'ret', name: nd.name, stack: stack.slice() });
    })(root);
    return steps;
  }

  /* 这个函数被 3 个容器复用：#viz-preorder（先序）、#viz-inorder（中序）、#viz-postorder（后序）。 */
  function makeTraversalViz(host, kind) {
    if (!host) return;

    var root = heroTree();
    var steps = recSteps(root, kind);
    var frames = [], done = {}, visited = [];   // done = 「名字 → true」的已输出标记（画绿）；visited = 已输出的名字序列（按访问先后）
    var W = 900, PW = 196;                      // W = 总画布宽，PW = 右侧信息栏宽度（左边 W − PW 留给树）

    /* one() 的入参：stack = 本帧的递归栈快照（栈底在前），active = 要高亮成蓝色的结点名（null = 无），
       doneSnap / visitedSnap = 本帧的「已输出」标记与结果序列快照。 */
    /* done / visited 都是遍历过程中被逐步改写的活变量，
       这里只接收「该帧的快照」，画面上才不会一上来就是走完的最终结果。 */
    function one(s, stack, active, doneSnap, visitedSnap) {
      var svg = drawTree(s, W - PW, root, { active: active, done: doneSnap },
        { gapX: 44, gapY: 68, title: KIND[kind] + '遍历（' + ORDER[kind] + '）· 绿色 = 已输出' });
      var H = parseInt(svg.getAttribute("height"), 10) || 400;
      if (H < 460) { H = 460; svg.setAttribute("height", H); svg.setAttribute("viewBox", "0 0 " + (W - PW) + " " + H); }
      svg.appendChild(SVG.line(W - PW - 14, 6, W - PW - 14, H - 6, "dim"));
      drawStack(s, svg, W - PW + 18, 356, stack, 26, "递归调用栈（底 → 顶）");
      drawSeq(s, svg, 62, H - 92, 30, HERO_LEVEL.split(''), visitedSnap, '结果序列');
      return svg;
    }

    steps.forEach(function (stp) {
      if (stp.type === 'call') {
        var callDone = cloneFlags(done), callVisited = visited.slice();
        frames.push({
          desc: '进入结点 <b>' + stp.name + '</b>：' + KIND[kind] + '遍历的次序是 <code>' +
            ORDER[kind] + '</code>' + meaning() + '。先把 ' + stp.name +
            ' 压入递归栈（相当于「记住回来以后还要干什么」）。',
          draw: function (s) { return one(s, stp.stack, stp.name, callDone, callVisited); }
        });
      } else if (stp.type === 'visit') {
        visited = visited.concat([stp.name]);
        done[stp.name] = true;      // 「访问」= 追加进结果序列 + 标记已输出；这两个活变量每帧都要先快照
        var visitDone = cloneFlags(done), visitVisited = visited.slice();
        frames.push({
          desc: '★ <b>访问结点 ' + stp.name + '</b>——它是' + KIND[kind] +
            '序列的第 ' + visited.length + ' 个元素。所谓「访问」就是把它追加到结果序列里。',
          draw: function (s) { return one(s, stp.stack, stp.name, visitDone, visitVisited); }
        });
      } else {
        var retDone = cloneFlags(done), retVisited = visited.slice();
        frames.push({
          desc: '结点 ' + stp.name + ' 的子树已经全部处理完，从递归栈中弹出，函数返回上一层。',
          draw: function (s) { return one(s, stp.stack, null, retDone, retVisited); }
        });
      }
    });

    frames.push({
      desc: '<b>' + KIND[kind] + '遍历完成！</b>序列是 <code>' + visited.join('') +
        '</code>。<br>每个结点恰好被访问一次，时间 <b>O(n)</b>；额外空间是递归栈的深度，' +
        '即树高 O(h)，最坏（斜树）退化为 O(n)。',
      draw: function (s) { return one(s, [], null, cloneFlags(done), visited.slice()); }
    });

    function meaning() {            // 本遍历次序的口诀文字（根左右 / 左根右 / 左右根），拼进 desc 用
      return kind === 'pre' ? '（根 → 左 → 右）'
        : kind === 'in' ? '（左 → 根 → 右）' : '（左 → 右 → 根）';
    }

    new DS.Viz(host, {
      title: KIND[kind] + '遍历 · ' + ORDER[kind],
      sub: '主角树 A(B(D,E(G)),C(F))，共 ' + steps.length + ' 步',
      build: function () { return { frames: frames }; }
    });
  }

  /* 每个遍历演示一个独立容器；容器不存在时直接跳过，保证脚本可复用 */
  (function () {
    var h = document.getElementById('viz-preorder');
    if (h) makeTraversalViz(h, 'pre');
  })();
  (function () {
    var h = document.getElementById('viz-inorder');
    if (h) makeTraversalViz(h, 'in');
  })();
  (function () {
    var h = document.getElementById('viz-postorder');
    if (h) makeTraversalViz(h, 'post');
  })();

  /* ======================================================================
     四、层序遍历（队列驱动）
     ====================================================================== */
  /* 页面容器 #viz-levelorder：层序遍历，队列 FIFO 保证「同层先于下一层」。 */
  (function levelOrder() {
    var host = document.getElementById('viz-levelorder');
    if (!host) return;

    var root = heroTree();
    var frames = [], q = [root], done = {}, visited = [], guard = 0;   // q = 队列（存结点对象本身，q[0] 是队首）；
    // done = 已访问标记（画绿）；visited = 已访问的名字序列；guard = 轮数护栏（最多 40 轮，防意外死循环）
    var W = 900, PW = 196;                      // W = 总画布宽，PW = 右侧信息栏宽度

    function snap(desc, active) {
      var names = q.map(function (n) { return n.name; });
      var got = visited.slice();
      /* done 是「出队即访问」时被改写的活对象，必须在这里快照，
         否则每一帧画出来的都是全部结点已访问（全绿）的最终状态。 */
      var doneSnap = cloneFlags(done);
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = drawTree(s, W - PW, root, { active: active, done: doneSnap },
            { gapX: 44, gapY: 68, title: '层序遍历 · 出队即访问，访问即把两个孩子入队' });
          var H = parseInt(svg.getAttribute("height"), 10) || 400;
          if (H < 460) { H = 460; svg.setAttribute("height", H); svg.setAttribute("viewBox", "0 0 " + (W - PW) + " " + H); }
          svg.appendChild(SVG.line(W - PW - 14, 6, W - PW - 14, H - 6, "dim"));
          drawQueue(s, svg, W - PW + 16, 44, names, 30, "队列（先进先出）");
          drawSeq(s, svg, 62, H - 92, 30, HERO_LEVEL.split(''), got, '结果序列');
          return svg;
        }
      });
    }

    snap('层序遍历<b>不使用递归</b>，而是借助一个<b>队列</b>。初始时只有根结点 <b>A</b> 入队。', null);

    while (q.length && guard++ < 40) {
      var p = q.shift();            // 出队（q[0] 是队首）；「出队即访问」—— 这就是层序的次序保证
      visited.push(p.name); done[p.name] = true;
      var added = [];               // 本轮新入队的孩子名字（只用于文字）
      if (p.left) { q.push(p.left); added.push(p.left.name); }
      if (p.right) { q.push(p.right); added.push(p.right.name); }
      snap('<b>' + p.name + ' 出队并访问</b>：它是队首，也就是「当前层里最靠左的未访问结点」。' +
        (added.length ? '把它的孩子 <b>' + added.join('、') + '</b> 依次入队。'
          : '它是叶子，没有孩子需要入队。') +
        '队列里现在还剩 ' + q.length + ' 个结点。', p.name);
    }

    snap('<b>层序遍历完成！</b>序列是 <code>' + visited.join('') + '</code>，' +
      '恰好是「从上到下、从左到右」。<br>队列保证了「同一层的结点一定先于下一层的结点出队」，' +
      '这就是 BFS（广度优先搜索）的通用骨架——第 08 讲的图 BFS 用的是同一个循环。', null);

    new DS.Viz(host, {
      title: '层序遍历 · 队列（BFS）',
      sub: '根入队 → 循环：出队访问 + 孩子入队',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     五、由「先序 + 中序」逐帧还原二叉树
     ====================================================================== */
  /* 页面容器 #viz-tree-rebuild：由「先序 + 中序」逐帧还原二叉树。 */
  (function rebuild() {
    var host = document.getElementById('viz-tree-rebuild');
    if (!host) return;

    var PRE = 'ABDECFG'.split(''), IN = 'DBEAFCG'.split('');   // 先序、中序序列（字符数组）；算法只读它们，从不改写
    var posOf = {};                 // 字符 → 它在中序里的下标（哈希表）：把「在中序里找根」从 O(n) 降到 O(1)
    IN.forEach(function (c, i) { posOf[c] = i; });

    var built = {}, rsteps = [], nullCnt = 0;   // built = 已经建好的结点表（名字 → 结点对象，结点之间用 left/right 互指，
                                                // 画图时直接拿 built['A'] 当整棵树的入口）；
                                                // rsteps = 预先算好的步骤序列（每步记下本步的区间、根、挂到谁身上）；
                                                // nullCnt = 空区间的个数（最后那句文字用）

    function mk(name) {             // 取或新建一个结点对象：同名结点只会建一次，built 里不会有重复
      if (!built[name]) built[name] = { name: name, left: null, right: null };
      return built[name];
    }

    /* dfs 的参数：pl..pr 是先序闭区间、il..ir 是中序闭区间（下标都含两端）；
       parent / side 表示「这棵子树要挂到 parent 的哪一边」（'L' / 'R'，根那层两个都是 null）；
       depth 只往下传、函数体里从没读过（历史遗留）。 */
    (function dfs(pl, pr, il, ir, parent, side, depth) {
      if (pl > pr || il > ir) {
        nullCnt++;
        rsteps.push({ type: 'null', parent: parent, side: side });
        return;
      }
      var rv = PRE[pl], k = posOf[rv], leftLen = k - il;
      rsteps.push({
        type: 'root', root: rv, pl: pl, pr: pr, il: il, ir: ir, k: k,
        leftLen: leftLen, parent: parent, side: side
      });
      var node = mk(rv);
      if (parent) {
        if (side === 'L') mk(parent).left = node; else mk(parent).right = node;
      }
      dfs(pl + 1, pl + leftLen, il, k - 1, rv, 'L', depth + 1);
      dfs(pl + leftLen + 1, pr, k + 1, ir, rv, 'R', depth + 1);
    })(0, PRE.length - 1, 0, IN.length - 1, null, null, 0);

    var frames = [], W = 900, H = 500;   // 画布尺寸固定：上半是 PRE / IN 两行序列，下半是已经建出来的树

    /* seqRow 的参数：arr = 序列数组；lo / hi = 本帧要橙色高亮的区间（闭区间，lo > hi 表示空区间 → 整行画灰）；
       hit = 额外单独标一个下标（颜色由 hitCls 给，传 -1 / -2 表示不标）。 */
    function seqRow(s, svg, x, y, name, arr, lo, hi, hit, hitCls) {
      svg.appendChild(SVG.label(x - 12, y + 22, name, "end"));
      for (var i = 0; i < arr.length; i++) {
        var cls = "";
        if (i === hit) cls = hitCls;
        else if (lo <= hi && i >= lo && i <= hi) cls = "compare";
        else if (lo > hi) cls = "dim";
        svg.appendChild(SVG.box(x + i * 34, y, 30, 30, cls, arr[i],
          /active|warn|compare|done/.test(cls) ? "on" : ""));
        svg.appendChild(SVG.label(x + i * 34 + 15, y + 44, String(i), "middle"));
      }
    }

    /* one() 每帧重画整张画布：st = 本帧对应的 rsteps 记录（null = 收尾帧，不画区间信息）；
       last = true 时画收尾统计（建了多少结点、遇到多少空区间）。 */
    function one(s, st, last) {
      var svg = s.svg(W, H);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.appendChild(put(s, 12, 20, '先序 PRE：根在最前　|　中序 IN：根把序列劈成左右两半',
        "start", "vz-label", "700"));

      seqRow(s, svg, 62, 30, 'PRE', PRE, st ? st.pl : -1, st ? st.pr : -1,
        st ? st.pl : -1, 'active');
      seqRow(s, svg, 62, 94, 'IN', IN, st ? st.il : -1, st ? st.ir : -1,
        st ? st.k : -2, 'warn');

      svg.appendChild(SVG.line(12, 172, W - 12, 172, "dim"));
      svg.appendChild(put(s, 12, 192, '已经还原出来的二叉树（绿色 = 已建好，虚线空位 = 尚未处理）',
        "start", "vz-label", "700"));

      if (!Object.keys(built).length) {
        svg.appendChild(put(s, 62, 250, '（还没开始建树）', "start", "vz-label"));
        return svg;
      }

      var L = layout(built['A'], 58, 56);   // 直接拿 built['A'] 当整棵树的入口：A 一定是第一步就建好的根
      var pad = Math.max(60, (W - (L.order.length - 1) * 58) / 2);
      Object.keys(built).forEach(function (nm) {
        var nd = built[nm], p = L.map[nm];
        ['left', 'right'].forEach(function (k) {
          var c = nd[k];
          if (!c) return;
          var q = L.map[c.name];
          svg.appendChild(SVG.line(p.x + pad, p.y + R - 3, q.x + pad, q.y - R + 3,
            (st && st.root === c.name) ? "active" : "done"));
        });
      });
      Object.keys(built).forEach(function (nm) {
        var p = L.map[nm];
        svg.appendChild(SVG.circle(p.x + pad, p.y, R - 2,
          (st && st.root === nm) ? "active" : "done", nm, "on"));
      });

      /* 递归栈（还没处理完的区间） */
      if (st) {
        svg.appendChild(put(s, 12, H - 16, '当前根的候选 = 先序区间 [' + st.pl + '..' + st.pr +
          '] 的第一个元素　→　处理结点 ' + st.root + '；中序区间 [' + st.il + '..' + st.ir +
          ']，根在下标 ' + st.k + '，左子树 ' + st.leftLen + ' 个结点。', "start", "vz-label"));
      } else if (last) {
        svg.appendChild(put(s, 12, H - 16, '共建立 ' + Object.keys(built).length +
          ' 个结点，遇到 ' + nullCnt + ' 个空区间（对应 nullptr）。', "start", "vz-label"));
      }
      return svg;
    }

    rsteps.forEach(function (st) {
      if (st.type === 'null') {
        frames.push({
          desc: '先序区间为空（' + (st.side === 'L' ? '左' : '右') +
            '子树没有结点），这条分支直接返回 <code>nullptr</code>，作为上一层 ' +
            st.parent + ' 的空孩子。',
          draw: function (s) { return one(s, st, false); }
        });
        return;
      }
      var Ln = st.leftLen, Rn = (st.ir - st.il) - st.leftLen;
      frames.push({
        desc: '① <b>定位根</b>：先序区间 [' + st.pl + '..' + st.pr + '] 的第一个元素是 <b>' +
          st.root + '</b>，所以它就是当前子树的根。<br>' +
          '② <b>划分区间</b>：在<b>中序</b>里找到 ' + st.root + '，位于下标 ' + st.k +
          '，于是左子树拿到 ' + Ln + ' 个结点、右子树拿到 ' + Rn + ' 个结点。<br>' +
          '③ <b>递归</b>：左子树 → 先序 [' + (st.pl + 1) + '..' + (st.pl + Ln) +
          '] + 中序 [' + st.il + '..' + (st.k - 1) + ']；右子树 → 先序 [' +
          (st.pl + Ln + 1) + '..' + st.pr + '] + 中序 [' + (st.k + 1) + '..' + st.ir + ']。',
        draw: function (s) { return one(s, st, false); }
      });
    });

    frames.push({
      desc: '<b>还原完成！</b>重建出的二叉树层序是 <code>ABCDEFG</code>，' +
        '与图 7-9 的主角树完全一致。<br>每个结点只处理一次，用哈希表把「在中序里找根」' +
        '从 O(n) 降到 O(1)，所以总时间 <b>O(n)</b>、空间 O(n)。',
      draw: function (s) { return one(s, null, true); }
    });

    new DS.Viz(host, {
      title: '由「先序 + 中序」还原二叉树',
      sub: 'PRE = ABDECFG　IN = DBEAFCG',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     六、赫夫曼树构造（逐帧合并 + 实时 WPL）
     ====================================================================== */
  /* 页面容器 #viz-huffman-build：赫夫曼树构造，每步合并两个最小权值的树，并实时累计 WPL。 */
  (function huffmanBuild() {
    var host = document.getElementById('viz-huffman-build');
    if (!host) return;

    var CH = ['a', 'b', 'c', 'd', 'e', 'f'];          // 6 个字符
    var W0 = [2, 3, 4, 7, 8, 9];                      // 它们各自的权值（频率）；改 CH / W0 这两行就换一组数据
    var TOTAL = 0; W0.forEach(function (x) { TOTAL += x; });   // 叶子权值之和 = 33（= 最终根权值，也是校验用的常数）

    /* 森林里直接放【结点对象】，结点用 left / right 直接引用子结点。
       （不要用「名字 -> 坐标」的查表，中间状态最容易查不到而报 undefined） */
    /* 每个结点的字段：{ w 权值, ch 字符（合并出来的内部结点是空串）, left, right }。 */
    var forest = [];
    CH.forEach(function (c, i) {
      forest.push({ w: W0[i], ch: c, left: null, right: null });
    });

    var frames = [], wpl = 0;   // wpl = 累计 WPL（= 所有合并出的新结点权值之和）；它是活变量，每帧由 snap 按值存下来

    /* ------------------------------------------------------------------
       给一棵树算坐标：按【中序】顺序给每个结点分配一个水平槽位。
       因为一棵子树的结点在中序里一定是连续的一段，所以父结点必然落在
       自己两个孩子之间，画出来的树不会重叠、也不需要查表。
       返回的 Map 以【结点对象本身】为键，中间状态绝不会查不到。
       ------------------------------------------------------------------ */
    function layoutHuff(root, gapX, gapY) {
      var map = new Map(), list = [], next = 0, maxD = 0;
      (function walk(nd, d) {
        if (!nd) return;
        maxD = Math.max(maxD, d);
        walk(nd.left, d + 1);
        map.set(nd, { x: gapX * next, y: 42 + d * gapY });
        list.push(nd);
        next++;
        walk(nd.right, d + 1);
      })(root, 0);
      /* 返回 { map, list, width, minX, maxD }：list 是中序结点数组，width = 内容宽度（这棵小树占多宽），
         minX = 最左结点的 x（平移到目标区间时用），maxD = 最大层号（0 基）。 */
      var xs = list.map(function (nd) { return map.get(nd).x; });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      return { map: map, list: list, width: maxX - minX + gapX, minX: minX, maxD: maxD };
    }

    /* 把整片森林画成一排小树。trees 是**该帧的**森林快照，不是活变量 forest */
    function drawForest(s, W, footer, trees) {
      /* laid[k] = 第 k 棵小树的排版结果 { root 树根, L 布局, w 它在画布上占的宽度, d 它的层数 }。 */
      var laid = trees.map(function (root) {
        var L = layoutHuff(root, 36, 58);
        return { root: root, L: L, w: Math.max(70, L.width + 16), d: L.maxD };
      });
      var totalW = laid.reduce(function (a, o) { return a + o.w + 26; }, 24);
      var maxD = 0; laid.forEach(function (o) { maxD = Math.max(maxD, o.d); });
      var H = 56 + maxD * 58 + 132;
      var CW = Math.max(W, totalW + 20);
      var svg = s.svg(CW, H);
      svg.setAttribute("viewBox", "0 0 " + CW + " " + H);

      var x = 22;
      laid.forEach(function (o) {
        var L = o.L, p0 = o.root;
        /* 把整棵树平移到 [x, x + o.w) 区间内并居中 */
        var shift = x + (o.w - (L.width)) / 2 - L.minX;
        var at = function (nd) {
          var p = L.map.get(nd);
          return { x: p.x + shift, y: p.y };
        };
        /* 先画边 */
        L.list.forEach(function (nd) {
          [nd.left, nd.right].forEach(function (c) {
            if (!c) return;
            var a = at(nd), b = at(c);
            svg.appendChild(SVG.line(a.x, a.y + R - 6, b.x, b.y - R + 6,
              c.ch ? "" : "done"));
          });
        });
        /* 再画结点 */
        L.list.forEach(function (nd) {
          var p = at(nd);
          var leaf = !nd.left && !nd.right;
          svg.appendChild(SVG.circle(p.x, p.y, R - 3, leaf ? "compare" : "done",
            String(nd.w), leaf ? "" : "on"));
          if (leaf) {
            svg.appendChild(put(s, p.x, p.y + R + 15, nd.ch, "middle", "vz-label", "700"));
          }
        });
        /* 每棵树下面标一个权值，方便看"根" */
        svg.appendChild(put(s, x + o.w / 2, H - 58, '根 ' + p0.w, "middle", "vz-label", "700"));
        x += o.w + 26;
      });

      svg.appendChild(put(s, 16, H - 32, footer, "start", "vz-label", "700"));
      return svg;
    }

    function snap(desc) {
      var cnt = forest.length, acc = wpl;   // 按值存下这两个数字：此刻森林里还有几棵树、累计 WPL 是多少
      /* 关键：森林是「每合并一次就整片重建」的活变量（forest = forest.filter(...)），
         推帧时把这一帧的森林深拷贝下来，draw 只读快照，
         否则每帧画出来的都是只剩一棵树的最终森林。 */
      var forestSnap = JSON.parse(JSON.stringify(forest));
      frames.push({
        desc: desc,
        draw: function (s) {
          return drawForest(s, 852, '森林中当前有 ' + cnt + ' 棵树　|　累计 WPL = ' + acc +
            '　|　所有叶子权值之和 = ' + TOTAL, forestSnap);
        }
      });
    }

    /* 取权值最小的两棵树；权值相同时先取先建立的，保证演示可复现 */
    function twoMin() {
      var idx = forest.map(function (t, i) { return i; });
      idx.sort(function (i, j) {
        if (forest[i].w !== forest[j].w) return forest[i].w - forest[j].w;
        return i - j;
      });
      return [forest[idx[0]], forest[idx[1]]];
    }

    function weights() {            // 当前森林各棵树根权值、升序拼成的一行文字（只用于描述）
      return forest.map(function (t) { return t.w; }).sort(function (a, b) { return a - b; })
        .join(', ');
    }

    snap('初始状态：6 个权值 <b>2, 3, 4, 7, 8, 9</b> 各自成为一棵只有一个根结点的树，' +
      '组成一个森林（6 棵树）。赫夫曼算法的规则只有一句话：<b>每次取出权值最小的两棵树，合并成一棵新树。</b>' +
      '累计 WPL 从 0 开始。');

    var step = 0;                   // 合并轮次（1 基），6 个字符一共要合并 5 轮
    while (forest.length > 1) {
      step++;
      var pair = twoMin(), a = pair[0], b = pair[1];   // ⚠ a / b 是「两棵树的结点对象」，不是权值；取权值要写 a.w
      snap('第 ' + step + ' 步 · 挑选：当前森林的根权值是 { ' + weights() +
        ' }，其中最小的两个是 <b>' + a.w + '</b> 和 <b>' + b.w + '</b>。');

      var nn = { w: a.w + b.w, ch: '', left: a, right: b };   // 新合并出的内部结点：权值 = 两个子根之和；ch 为空表示它不是叶子
      forest = forest.filter(function (t) { return t !== a && t !== b; });   // 整片森林重建（摘掉 a、b，放回 nn），不是原地改
      forest.push(nn);
      wpl += a.w + b.w;             // WPL 的增加量正好等于新结点的权值（所有叶子整体下移一层的代价）

      snap('第 ' + step + ' 步 · 合并：新建一个根结点，权值 = ' + a.w + ' + ' + b.w + ' = <b>' +
        (a.w + b.w) + '</b>，把 ' + a.w + ' 作为左子树、' + b.w + ' 作为右子树，放回森林。<br>' +
        '这一步让所有被合并的叶子<b>整体下移一层</b>，代价是它们的权值之和——' +
        '所以 <b>WPL 增加 ' + (a.w + b.w) + '，累计 WPL = ' + wpl + '</b>。' +
        '（这就是「WPL = 所有合并出的新结点权值之和」这条速算技巧的来历。）');
    }

    snap('<b>构造完成！</b>森林里只剩一棵树，根权值恰好等于所有叶子权值之和 ' + TOTAL + '。<br>' +
      '最终 <b>WPL = ' + wpl + '</b>，与「内部结点权值之和 5 + 9 + 15 + 18 + 33 = ' + wpl +
      '」完全一致。<br>请自己验算一遍：各叶子深度是 a=4, b=4, c=3, d=2, e=2, f=2，于是 ' +
      '2×4 + 3×4 + 4×3 + 7×2 + 8×2 + 9×2 = ' + wpl + ' ✓');

    new DS.Viz(host, {
      title: '赫夫曼树构造 · 每次合并最小的两个',
      sub: '权值 {2, 3, 4, 7, 8, 9}，共需 5 次合并',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     七、赫夫曼编码表生成 + 与等长编码对比
     ====================================================================== */
  /* 页面容器 #viz-huffman-code：沿赫夫曼树左 0 右 1 生成编码表，并与 3 位等长编码比总位数。 */
  (function huffmanCode() {
    var host = document.getElementById('viz-huffman-code');
    if (!host) return;

    /* 与 7.8.4 节完全一致的赫夫曼树：合并序列 2+3=5 → 4+5=9 → 7+8=15 → 9+9=18 → 15+18=33 */
    function N(name, w, ch, l, r) {   // 结点工厂：name 是唯一标识（内部结点叫 m5 / m9a…），ch 只有叶子才有
      return { name: name, w: w, ch: ch || '', left: l || null, right: r || null };
    }
    /* 手工照上面的合并序列搭好的树：n2..n9 是 6 个叶子，m5 / m9a / m15 / m18 / m33 是合并出的内部结点。 */
    var n2 = N('a', 2, 'a'), n3 = N('b', 3, 'b'), n4 = N('c', 4, 'c');
    var n7 = N('d', 7, 'd'), n8 = N('e', 8, 'e'), n9 = N('f', 9, 'f');
    var m5 = N('m5', 5, '', n2, n3);
    var m9a = N('m9a', 9, '', n4, m5);
    var m15 = N('m15', 15, '', n7, n8);
    var m18 = N('m18', 18, '', n9, m9a);
    var ROOT = N('m33', 33, '', m15, m18);

    var WEIGHT = { a: 2, b: 3, c: 4, d: 7, e: 8, f: 9 };   // 字符 → 频率（编码表第二列显示的就是它）
    var TOTALW = 33, FIXED = 3;      /* 6 个字符 → ⌈log2 6⌉ = 3 位等长编码 */
    // ↑ TOTALW（全文总字符数）与 FIXED（等长码长）声明后没被引用：最后那帧的 80 / 99 是直接写死的数字
    var CHARS = ['a', 'b', 'c', 'd', 'e', 'f'];            // 编码表里六行的显示顺序

    /* 深度优先走一遍：每次「到达结点 / 转向右分支 / 到达叶子」都产生一步 */
    /* trace 的元素有两种：到达叶子是 { leaf, code }；在内部结点处是 { at, code, dir }
       （dir 0 = 准备往左走，1 = 左子树走完、改往右走）。 */
    var trace = [];
    (function dfs(node, code) {
      if (!node) return;
      if (!node.left && !node.right) {
        trace.push({ leaf: node, code: code });
        return;
      }
      trace.push({ at: node, code: code, dir: 0 });
      dfs(node.left, code + '0');
      trace.push({ at: node, code: code, dir: 1 });
      dfs(node.right, code + '1');
    })(ROOT, '');

    var frames = [], codes = {}, doneLeaves = {}, W = 900, H = 470;   // codes = 字符 → 编码（逐步写满）；
    // doneLeaves = 结点名 → true（这个叶子是否已确定编码）；两者都是活对象，每帧必须快照

    /* st 是本帧的路径状态；leaves 是**本帧的**「已确定编码的叶子」快照 */
    /* st 有两种形态：走在内部结点时是 { at, dir(0 左 / 1 右), code 当前前缀 }；到达叶子时是 { code, leafName, leafCh }。 */
    function drawHuff(s, w, st, leaves) {
      st = st || {};
      var L = layout(ROOT, 58, 62);
      var Hh = (L.depth + 1) * 62 + 46;
      var svg = s.svg(w, Hh);
      svg.setAttribute("viewBox", "0 0 " + w + " " + Hh);
      var pad = Math.max(30, (w - (L.order.length - 1) * 58) / 2);

      (function edges(node) {
        var p = L.map[node.name];
        [[node.left, '0'], [node.right, '1']].forEach(function (pr) {
          if (!pr[0]) return;
          var q = L.map[pr[0].name];
          var cls = (st.at && st.at.name === node.name && st.dir === (pr[1] === '0' ? 0 : 1))
            ? "active" : "";
          svg.appendChild(SVG.line(p.x + pad, p.y + R, q.x + pad, q.y - R, cls));
          svg.appendChild(put(s, (p.x + q.x) / 2 + pad + (pr[1] === '0' ? -14 : 14),
            (p.y + q.y) / 2 + 5, pr[1], "middle", "vz-label", "700"));
        });
        if (node.left) edges(node.left);
        if (node.right) edges(node.right);
      })(ROOT);

      (function drawN(node) {
        var p = L.map[node.name], cls = "";
        if (st.at && st.at.name === node.name) cls = "active";
        else if (st.leafName === node.name) cls = "warn";
        else if (!node.left && !node.right && leaves[node.name]) cls = "done";
        svg.appendChild(SVG.circle(p.x + pad, p.y, R - 2, cls,
          node.ch ? node.ch : String(node.w), /active|warn|done/.test(cls) ? "on" : ""));
        if (node.ch) {
          svg.appendChild(put(s, p.x + pad + R + 3, p.y - R + 4, String(node.w),
            "start", "vz-label", "700"));
        }
        if (node.left) drawN(node.left);
        if (node.right) drawN(node.right);
      })(ROOT);

      var shown = (st.code === undefined || st.code === '') ? 'ε（空前缀）' : st.code;
      svg.appendChild(put(s, 10, 18, '当前路径前缀 = ' + shown +
        (st.leafName ? '　→　到达叶子 ' + st.leafCh + '，编码确定为 ' + st.code : ''),
        "start", "vz-label", "700"));
      return svg;
    }

    /* codeMap 是**本帧的**编码表快照（codes 是逐步写满的活对象，不能直接读） */
    /* 参数：hilite = 本帧要标橙的字符（null = 不标），codeMap = 本帧的编码表快照（某个字符还没编码就画 ?）。 */
    function drawTable(s, svg, x, y, hilite, codeMap) {
      var head = ['字符', '频率', '编码', '码长'];
      head.forEach(function (cell, j) {
        svg.appendChild(SVG.box(x + j * 74, y, 70, 24, "active", cell, "on"));
      });
      CHARS.forEach(function (c, i) {
        var code = codeMap[c];
        var cls = (hilite === c) ? "compare" : (code ? "done" : "");
        var on = /compare|done/.test(cls) ? "on" : "";
        svg.appendChild(SVG.box(x, y + (i + 1) * 26, 70, 24, cls, c, on));
        svg.appendChild(SVG.box(x + 74, y + (i + 1) * 26, 70, 24, cls, String(WEIGHT[c]), on));
        svg.appendChild(SVG.box(x + 148, y + (i + 1) * 26, 70, 24, cls, code || '?', on));
        svg.appendChild(SVG.box(x + 222, y + (i + 1) * 26, 70, 24, cls,
          code ? String(code.length) : '?', on));
      });
    }

    /* 本演示专用的小封装：build(s, svg) 里自己建真正的画布并返回；
       开头那个 s.svg(1, 1) 只是被丢弃的占位参数（历史遗留），画面上用的是 build 的返回值。 */
    function frame(desc, build) {
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(1, 1);
          return build(s, svg);
        }
      });
    }

    frame('赫夫曼树已经建好（合并过程见上一个演示）。现在给每个结点的<b>左分支标 0、右分支标 1</b>，' +
      '然后从根一路走到叶子，路径上的 0/1 序列就是该字符的编码。<br>' +
      '关键结论：<b>字符只放在叶子上，所以任何一个编码都不可能是另一个编码的前缀</b>——' +
      '这就是「前缀编码」的来源，也是它能被唯一译码的原因。', function (s) {
        var svg = s.svg(W, H);
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        svg.appendChild(drawHuff(s, 556, {}, {}));
        svg.appendChild(put(s, 578, 26, '编码表（逐步生成）', "start", "vz-label", "700"));
        drawTable(s, svg, 578, 40, null, {});
        return svg;
      });

    trace.forEach(function (t) {
      var desc, st;
      if (t.leaf) {
        codes[t.leaf.ch] = t.code;
        doneLeaves[t.leaf.name] = true;
        st = { code: t.code, leafName: t.leaf.name, leafCh: t.leaf.ch };
        desc = '走到叶子 <b>' + t.leaf.ch + '</b>（频率 ' + t.leaf.w + '）：这条路径上的标号依次是 <code>' +
          t.code + '</code>，所以 <b>' + t.leaf.ch + ' = ' + t.code + '</b>，码长 ' + t.code.length +
          '，贡献 ' + t.leaf.w + '×' + t.code.length + ' = ' + (t.leaf.w * t.code.length) + ' 位。';
      } else {
        st = { at: t.at, dir: t.dir, code: t.code };
        desc = '在内部结点（权值 ' + t.at.w + '）处，当前路径前缀是 <code>' + (t.code || '空') +
          '</code>。' + (t.dir === 0 ? '沿<b>左</b>分支向下走，前缀追加一个 <b>0</b>。'
            : '左子树已处理完，回到这个结点，改走<b>右</b>分支，前缀追加一个 <b>1</b>。');
      }
      var snapshot = st;            // st 是这一轮新建的对象，不会再被改写，所以直接存引用即可，不用拷贝
      /* 关键：codes / doneLeaves 是逐步写满的活对象，推帧时各留一份快照，
         否则第 0 帧的编码表就已经是全部字符的最终编码了。 */
      var codesSnap = cloneFlags(codes), leavesSnap = cloneFlags(doneLeaves);
      frame(desc, function (s) {
        var svg = s.svg(W, H);
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        svg.appendChild(drawHuff(s, 556, snapshot, leavesSnap));
        svg.appendChild(put(s, 578, 26, '编码表（绿色 = 已确定）', "start", "vz-label", "700"));
        drawTable(s, svg, 578, 40, snapshot.leafCh || null, codesSnap);
        return svg;
      });
    });

    frame('<b>赫夫曼编码表生成完毕。</b>总位数 = WPL = 2×4 + 3×4 + 4×3 + 7×2 + 8×2 + 9×2 = <b>80</b> 位。<br>' +
      '<b>与等长编码对比</b>：6 个字符至少需要 ⌈log<sub>2</sub> 6⌉ = <b>3</b> 位，' +
      '全文共 33 个字符 → 33 × 3 = <b>99</b> 位。赫夫曼编码节省 <b>19 位（约 19.2%）</b>。<br>' +
      '文本里字符频率越悬殊，赫夫曼编码的优势越大——这正是 zip / gzip / JPEG / MP3 都在用它的原因。',
      function (s) {
        var svg = s.svg(W, H);
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        svg.appendChild(drawHuff(s, 556, {}, cloneFlags(doneLeaves)));
        svg.appendChild(put(s, 578, 26, '最终编码表', "start", "vz-label", "700"));
        drawTable(s, svg, 578, 40, null, cloneFlags(codes));
        var y0 = 250;
        svg.appendChild(put(s, 578, y0, '总位数对比（越短越好）', "start", "vz-label", "700"));
        svg.appendChild(SVG.box(578, y0 + 12, 160, 26, "done", "赫夫曼 80 位", "on"));
        svg.appendChild(SVG.box(578 + 170, y0 + 12, 160, 26, "warn", "等长 99 位", "on"));
        svg.appendChild(put(s, 578, y0 + 64, '平均码长 = 80 / 33 ≈ 2.42 位/字符（等长为 3 位）',
          "start", "vz-label", "700"));
        svg.appendChild(put(s, 578, y0 + 86, '压缩到原来的 80/99 ≈ 80.8%',
          "start", "vz-label", "700"));
        svg.appendChild(put(s, 578, y0 + 120, '前缀性质验证：{1110, 1111, 110, 00, 01, 10}',
          "start", "vz-label"));
        svg.appendChild(put(s, 578, y0 + 138, '两两互不为前缀 → 译码唯一，不会歧义',
          "start", "vz-label"));
        svg.appendChild(put(s, 578, y0 + 172, 'WPL = Σ内部结点 = 5+9+15+18+33 = 80 ✓',
          "start", "vz-label"));
        return svg;
      });

    new DS.Viz(host, {
      title: '赫夫曼编码 · 沿树左 0 右 1',
      sub: '与 ⌈log₂6⌉ = 3 位等长编码比较总位数',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     八、并查集：union / find（含路径压缩）
     ====================================================================== */
  /* 页面容器 #viz-dsu：并查集 union / find（双亲表示法 + 按秩合并 + 路径压缩）。 */
  (function dsu() {
    var host = document.getElementById('viz-dsu');
    if (!host) return;

    var N = 8;                      // 元素个数，编号 0..7
    var par = [], rnk = [];         // par[i] = i 的双亲下标（par[i] === i 表示 i 是根）；rnk[i] = 秩，只有根结点这一项有意义
    for (var i = 0; i < N; i++) { par.push(i); rnk.push(0); }
    var sets = N, frames = [];      // sets = 当前集合（树）的个数：初始 8 个，每次成功 union 减 1
    var W = 900, H = 430;

    function rootOf(x) {            // 沿双亲指针走到根（g < 40 只是防死循环的护栏）
      var g = 0;
      while (par[x] !== x && g++ < 40) x = par[x];
      return x;
    }
    function depthOf(x) {           // 结点 x 到根的步数 = 它在树里的层号（0 基）
      var d = 0, g = 0;
      while (par[x] !== x && g++ < 40) { x = par[x]; d++; }
      return d;
    }

    /* st 是本帧的高亮状态；parSnap / setsSnap 是**本帧的** parent 数组与集合个数快照。
       parent 数组被 union / 路径压缩逐步改写，draw 直接读活的 par 只会画出最终形态。 */
    function makeDraw(st, parSnap, setsSnap) {
      /* st 的字段（都是本帧的高亮指令）：active 蓝色结点；path 查找路径（路径上的结点橙、边蓝）；
         warn 红色结点；changed 本步被改动的 parent 数组元素；newEdge 本步新加那条边的子结点；pathText 左上角那行字。 */
      /* 快照版的找根 / 求深度：只读这一帧的 parent 数组，不碰活变量 */
      function rootIn(x) {
        var g = 0;
        while (parSnap[x] !== x && g++ < 40) x = parSnap[x];
        return x;
      }
      function depthIn(x) {
        var d = 0, g = 0;
        while (parSnap[x] !== x && g++ < 40) { x = parSnap[x]; d++; }
        return d;
      }
      return function (s) {
        var svg = s.svg(W, H);
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        var TOP = 62, PX = 78, PY = 54;

        /* 按集合分组，从左到右排布 */
        var seen = {}, groups = [];
        for (var i = 0; i < N; i++) {
          var r = rootIn(i);
          if (seen[r]) continue;
          seen[r] = true;
          var mem = [];
          for (var k = 0; k < N; k++) if (rootIn(k) === r) mem.push(k);
          groups.push({ root: r, members: mem });
        }
        groups.sort(function (a, b) { return a.root - b.root; });

        var pos = {}, x0 = 46;
        groups.forEach(function (g) {
          var maxD = 0;
          g.members.forEach(function (a) { maxD = Math.max(maxD, depthIn(a)); });
          for (var d = 0; d <= maxD; d++) {
            var lv = g.members.filter(function (a) { return depthIn(a) === d; });
            lv.sort(function (a, b) { return a - b; });
            lv.forEach(function (a, j) {
              pos[a] = { x: x0 + j * PX + 40, y: TOP + d * PY };
            });
          }
          x0 += Math.max(1, g.members.length) * PX + 24;
          if (groups.indexOf(g) < groups.length - 1) {
            svg.appendChild(SVG.line(x0 - 22, 34, x0 - 22, TOP + 3 * PY + 20, "dim"));
          }
        });

        if (st.pathText) svg.appendChild(put(s, 14, 22, st.pathText, "start", "vz-label", "700"));

        /* 边 */
        for (var v = 0; v < N; v++) {
          if (parSnap[v] === v || !pos[v] || !pos[parSnap[v]]) continue;
          var a = pos[v], b = pos[parSnap[v]];
          var onPath = st.path && st.path.indexOf(v) >= 0 && st.path.indexOf(parSnap[v]) >= 0;
          var cls = onPath ? "active" : (st.newEdge === v ? "done" : "");
          svg.appendChild(SVG.line(a.x, a.y + R - 6, b.x, b.y - R + 6, cls));
        }
        /* 结点 */
        for (var u = 0; u < N; u++) {
          var p = pos[u];
          if (!p) continue;
          var cls2 = "";
          if (st.active === u) cls2 = "active";
          else if (st.path && st.path.indexOf(u) >= 0) cls2 = "compare";
          else if (st.warn && st.warn.indexOf(u) >= 0) cls2 = "warn";
          svg.appendChild(SVG.circle(p.x, p.y, R - 2, cls2, u,
            /active|compare|warn/.test(cls2) ? "on" : ""));
          if (parSnap[u] === u) svg.appendChild(put(s, p.x, p.y - R - 3, "根", "middle", "vz-label", "700"));
        }

        /* 双亲数组 */
        var ay = 300;
        svg.appendChild(put(s, 46, ay - 20,
          'parent[] 数组（双亲表示法：parent[i] = i 表示 i 是它所在集合的根）',
          "start", "vz-label", "700"));
        for (var q = 0; q < N; q++) {
          var cx = 60 + q * 82;
          var changed = st.changed && st.changed.indexOf(q) >= 0;
          var ccl = changed ? "warn" : (parSnap[q] === q ? "compare" : "");
          svg.appendChild(SVG.label(cx + 25, ay - 6, String(q), "middle"));
          svg.appendChild(SVG.box(cx, ay, 50, 30, ccl, String(parSnap[q]),
            /warn|compare/.test(ccl) ? "on" : ""));
        }
        svg.appendChild(put(s, 60, ay + 62, '当前集合个数 = ' + setsSnap +
          '　|　橙色 = 本步被改动的元素　|　结点上方的「根」表示它是集合代表元',
          "start", "vz-label"));
        return svg;
      };
    }

    function snap(desc, st) {
      /* 关键：推帧时把这一帧的 parent 数组与集合个数深拷贝/存值下来 */
      var parSnap = par.slice(), setsSnap = sets;
      frames.push({ desc: desc, draw: makeDraw(st || {}, parSnap, setsSnap) });
    }

    function doUnion(x, y) {
      var rx = rootOf(x), ry = rootOf(y);   // 两个元素所在集合的根；rx === ry 说明本来就是同一个集合
      if (rx === ry) {
        snap('<code>union(' + x + ', ' + y + ')</code>：<code>find(' + x + ') = ' + rx +
          '</code>、<code>find(' + y + ') = ' + ry + '</code>，<b>两个根相同</b>，' +
          '说明它们本来就在同一个集合里，什么都不用做。（在 Kruskal 里，这一步就代表「这条边会成环，跳过」。）',
          { warn: [x, y], active: rx });
        return;
      }
      var big = rnk[rx] < rnk[ry] ? ry : rx;   // 按秩合并：big = 秩大的那个根（留下当新根）；秩相等时约定 rx 当根
      var small = (big === rx) ? ry : rx;      // small = 要被挂到 big 下面的根
      var changed = [small];                   // 本步 parent 数组被改动的下标（画面上用橙框标出）
      par[small] = big;
      if (rnk[big] === rnk[small]) { rnk[big]++; changed.push(big); }   // 只有秩相等时新根的秩才 +1
      sets--;                                  // 成功合并一次，集合个数减一
      snap('合并 <b>' + x + '</b> 与 <b>' + y + '</b> 所在的集合：<code>find(' + x + ') = ' +
        rx + '</code>（秩 ' + rnk[rx] + '）、<code>find(' + y + ') = ' + ry + '</code>（秩 ' +
        rnk[ry] + '）。<br><b>按秩合并</b>：把秩小的根 <b>' + small + '</b> 挂到秩大的根 <b>' +
        big + '</b> 下面，即 <code>parent[' + small + '] = ' + big +
        '</code>，这样树高不会无谓增长。<b>集合个数变成 ' + sets + '</b>。',
        { warn: [small], active: big, changed: changed, newEdge: small });
    }

    function doFind(x) {
      var path = [x], cur = x;      // path = 从 x 一路到根的结点序列（从下往上，含两端）；cur = 当前走到的结点
      while (par[cur] !== cur) { cur = par[cur]; path.push(cur); }
      snap('<code>find(' + x + ')</code> 第 1 阶段 · 找根：沿着双亲指针一路向上。' +
        '路径是 <b>' + path.join(' → ') + '</b>，终点（根）是 <b>' + cur + '</b>。<br>' +
        '判断两个元素是否属于同一集合，只需要比较它们的根是否相同。',
        { active: x, path: path.slice(), warn: [cur], pathText: 'find 路径：' + path.join(' → ') });

      var changed = [];             // 本步被路径压缩改掉双亲的结点（不含根自己）
      for (var i = 0; i < path.length - 1; i++) {
        if (par[path[i]] !== cur) { par[path[i]] = cur; changed.push(path[i]); }
      }
      if (changed.length) {
        snap('<code>find(' + x + ')</code> 第 2 阶段 · <b>路径压缩</b>：把路径上<b>除根以外</b>的结点（' +
          changed.join('、') + '）的双亲直接改成根 <b>' + cur +
          '</b>。下次再查这些结点，一步就能到根，树被「压扁」成星形。<br>' +
          '注意：压缩之后 <code>parent[i]</code> 不再表示原来那棵树里的父子关系，' +
          '只表示「i 属于以 ' + cur + ' 为代表的集合」——所以并查集只能回答「是否同集合」。',
          { active: cur, warn: changed, changed: changed, path: path.slice() });
      } else {
        snap('<code>find(' + x + ')</code>：路径上除了根本身，其它结点已经直接指向根了，无需压缩。',
          { active: cur, path: path.slice() });
      }
    }

    snap('初始状态：8 个元素各自成为一个集合，<code>parent[i] = i</code>，' +
      '每个结点都是一棵只有根的树 → 森林里共 <b>8</b> 棵树。<br>' +
      '并查集用<b>双亲表示法的森林</b>表示「集合的集合」：每棵树是一个集合，树根是代表元。', {});

    /* 脚本化的操作序列：'u' = union(后两个参数)，'f' = find(第二个参数)；改这张表就换一套演示流程。 */
    [['u', 0, 1], ['u', 2, 3], ['u', 1, 3], ['u', 4, 5], ['u', 6, 7],
     ['f', 3], ['u', 5, 7], ['f', 3], ['f', 7]].forEach(function (op) {
      if (op[0] === 'u') doUnion(op[1], op[2]); else doFind(op[1]);
    });

    snap('<b>演示结束。</b>请对照画面上的 parent 数组核对最终有两个集合：' +
      '{0,1,2,3}（根 0）、{4,5,6,7}（根 4）——最后一次 <code>union(5, 7)</code> 把 ' +
      '{4,5} 与 {6,7} 也合并了。<br>' +
      '复杂度：<b>只做按秩合并</b>或<b>只做路径压缩</b>时，单次操作是 O(log n)；' +
      '<b>两者同时使用</b>时均摊复杂度降到 <b>O(α(n))</b>——α 是反阿克曼函数，' +
      '在 n &lt; 10<sup>80</sup> 时 α(n) ≤ 4，<b>实际就是常数</b>。' +
      '这正是 Kruskal 最小生成树算法能跑得飞快的原因（第 09 讲）。', {});

    new DS.Viz(host, {
      title: '并查集 · union / find（含路径压缩）',
      sub: '双亲表示法 + 按秩合并，均摊 O(α(n))',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     九、树 → 二叉树（左孩子右兄弟）转换
     ====================================================================== */
  /* 页面容器 #viz-tree-to-binary：普通树 → 二叉树（左孩子右兄弟），加线 → 抹线 → 旋转。 */
  (function treeToBinary() {
    var host = document.getElementById('viz-tree-to-binary');
    if (!host) return;

    /* 原树：A(B(E,F), C, D(G))，与 7.7.1 节的图一致 */
    /* 注意这里是「普通树」的表示法：孩子放在 children 数组里（可以有任意多个），不是二叉树的 left / right。 */
    var T = {
      name: 'A', children: [
        { name: 'B', children: [{ name: 'E', children: [] }, { name: 'F', children: [] }] },
        { name: 'C', children: [] },
        { name: 'D', children: [{ name: 'G', children: [] }] }
      ]
    };
    var all = [], kids = {}, pname = {};   // all = 所有结点对象（先序顺序）；kids = 名字 → 孩子数组（就是 nd.children）；
                                           // pname = 名字 → 父亲名字（根 A 没有这一项）
    (function collect(nd, p) {
      all.push(nd); kids[nd.name] = nd.children;
      if (p) pname[nd.name] = p.name;
      nd.children.forEach(function (c) { collect(c, nd); });
    })(T, null);

    /* ---------- 原树布局：叶子顺序占位，父结点居中于首尾孩子之间 ---------- */
    function layGeneral(root, gx, gy) {
      var map = {}, order = [], next = 0, dep = 0;
      (function w(n, d) {
        dep = Math.max(dep, d);
        if (!n.children.length) {
          map[n.name] = { x: 40 + gx * next, y: 56 + d * gy, d: d };
          order.push(n.name); next++;
          return;
        }
        n.children.forEach(function (c) { w(c, d + 1); });
        var f = map[n.children[0].name], l = map[n.children[n.children.length - 1].name];
        map[n.name] = { x: (f.x + l.x) / 2, y: 56 + d * gy, d: d };
      })(root, 0);
      return { map: map, order: order, depth: dep };
    }

    /* ---------- 二叉树布局：左孩子下移一层，右兄弟留在同一层 ---------- */
    var binRoot = { name: 'A', left: null, right: null }, bIdx = { A: binRoot };   // bIdx = 名字 → 二叉树里对应的那个结点（先登记，好让孩子挂上来）
    (function buildBin(nd) {
      var p = bIdx[nd.name], prev = null;   // p = 当前结点在二叉树里的那个结点；prev = 上一个兄弟（它的 right 要指向下一个兄弟）
      nd.children.forEach(function (c, i) {
        var node = { name: c.name, left: null, right: null };
        bIdx[c.name] = node;
        if (i === 0) p.left = node; else prev.right = node;
        prev = node;
        buildBin(c);
      });
    })(T);

    function layBinary(gx, gy) {
      var map = {}, rows = [];
      (function asg(nd, d) {
        if (!rows[d]) rows[d] = [];
        rows[d].push(nd.name);
        if (nd.left) asg(nd.left, d + 1);
        if (nd.right) asg(nd.right, d);
      })(binRoot, 0);
      rows.forEach(function (row, d) {
        row.forEach(function (nm, i) { map[nm] = { x: gx * i, y: 56 + d * gy, d: d }; });
      });
      return { map: map, rows: rows };
    }

    /* ---------- 左图：原树（可叠加兄弟虚线与"已抹掉"的淡色边） ---------- */
    var linkAll = {};               // 兄弟虚线开关表：名字 → true 表示「它到下一个兄弟」这条虚线要画（初始全开）
    all.forEach(function (nd) { nd.children.forEach(function (c) { linkAll[c.name] = true; }); });
    var hideAll = {};               // 抹线表：除长子外的孩子名字 → true（第 2 步「抹线」时这些父子边画成淡色）
    all.forEach(function (nd) { nd.children.forEach(function (c, i) { if (i > 0) hideAll[c.name] = true; }); });

    /* 左图（原树）：link = 兄弟虚线开关表，hide = 抹线表（true 的父子边画淡），hl = 要高亮成蓝色的结点名表。 */
    function drawGeneral(s, W, H, link, hide, title, hl) {
      hl = hl || {};
      var L = layGeneral(T, 56, 62);
      var svg = s.svg(W, H);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      /* 兄弟虚线 */
      all.forEach(function (nd) {
        for (var i = 0; i + 1 < nd.children.length; i++) {
          var a = nd.children[i].name, b = nd.children[i + 1].name;
          if (!link[a]) continue;
          var pa = L.map[a], pb = L.map[b];
          svg.appendChild(SVG.line(pa.x + R - 3, pa.y, pb.x - R + 3, pb.y, "active"));
        }
      });
      /* 父子实线 */
      all.forEach(function (nd) {
        nd.children.forEach(function (c, i) {
          var pa = L.map[nd.name], pb = L.map[c.name];
          var cls = hide[c.name] ? "dim" : (i === 0 ? "" : "dim");
          if (hl[c.name]) cls = "active";
          svg.appendChild(SVG.line(pa.x, pa.y + R - 4, pb.x, pb.y - R + 4, cls));
        });
      });
      /* 结点 */
      all.forEach(function (nd) {
        var p = L.map[nd.name];
        var leaf = kids[nd.name].length === 0;
        svg.appendChild(SVG.circle(p.x, p.y, R - 2, leaf ? "" : "compare", nd.name,
          leaf ? "" : "on"));
      });
      svg.appendChild(put(s, 10, 20, title, "start", "vz-label", "700"));
      return svg;
    }

    /* 右图（二叉树）：hl = 要高亮成红色的结点名表；左指针边画蓝、右指针边画绿。 */
    function drawBinary(s, W, H, title, hl) {
      hl = hl || {};
      var L = layBinary(112, 60);
      var svg = s.svg(W, H);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var off = 60;
      (function edges(nd) {
        [[nd.left, 'L'], [nd.right, 'R']].forEach(function (pr) {
          if (!pr[0]) return;
          var a = L.map[nd.name], b = L.map[pr[0].name];
          var cls = hl[pr[0].name] ? "warn" : (pr[1] === 'L' ? "active" : "done");
          svg.appendChild(SVG.line(a.x + off, a.y + R - 4, b.x + off, b.y - R + 4, cls));
          edges(pr[0]);
        });
      })(binRoot);
      (function drawN(nd) {
        var p = L.map[nd.name];
        var cls = hl[nd.name] ? "warn" : "done";
        svg.appendChild(SVG.circle(p.x + off, p.y, R - 2, cls, nd.name, "on"));
        if (nd.left) drawN(nd.left);
        if (nd.right) drawN(nd.right);
      })(binRoot);
      svg.appendChild(put(s, 10, 20, title, "start", "vz-label", "700"));
      svg.appendChild(put(s, 10, H - 14,
        '实线斜边 = 左指针（第一个孩子）　虚线横边 = 右指针（下一个兄弟）', "start", "vz-label"));
      return svg;
    }

    var frames = [];
    var W1 = 430, W2 = 450, HH = 400;   // W1 = 左图（原树）宽度、W2 = 右图（二叉树）宽度、HH = 两图共用的高度

    /* 帧 1：原树 */
    frames.push({
      desc: '转换前：一棵普通树 <b>A(B(E,F), C, D(G))</b>。A 有 3 个孩子 B、C、D；' +
        'B 有 2 个孩子 E、F；D 有 1 个孩子 G。<br>' +
        '转换规则只有两条：<b>①「第一个孩子」当作左孩子；②「下一个兄弟」当作右孩子。</b>' +
        '下面分三步完成：加线 → 抹线 → 旋转。',
      draw: function (s) {
        var svg = s.svg(W1 + W2, HH);
        svg.setAttribute("viewBox", "0 0 " + (W1 + W2) + " " + HH);
        svg.appendChild(drawGeneral(s, W1, HH, {}, {}, '① 原树'));
        return svg;
      }
    });

    /* 帧 2：加兄弟虚线 */
    frames.push({
      desc: '<b>第 1 步 · 加线</b>：在同一双亲的<b>相邻兄弟</b>之间加一条虚线。' +
        '于是 A 的孩子链 B–C–D 连上了，B 的孩子链 E–F 也连上了。<br>' +
        '这些虚线将来会变成二叉树的<b>右指针</b>——所以「右指针」在语义上表示「我的下一个兄弟」。',
      draw: function (s) {
        var svg = s.svg(W1 + W2, HH);
        svg.setAttribute("viewBox", "0 0 " + (W1 + W2) + " " + HH);
        svg.appendChild(drawGeneral(s, W1, HH, linkAll, {}, '① 原树：兄弟之间加好虚线'));
        return svg;
      }
    });

    /* 帧 3：抹线 */
    frames.push({
      desc: '<b>第 2 步 · 抹线</b>：对每个结点，只保留它与<b>第一个孩子</b>的连线，' +
        '与其它孩子的连线全部抹掉（图中变成淡色）。<br>' +
        'A 只连 B（长子），A–C、A–D 被抹掉；B 只连 E，B–F 被抹掉。<br>' +
        '<b>注意 C、D 并没有脱离这棵树</b>——它们通过虚线挂在 B 的右边，' +
        '将来就是 B 的「右孩子」和「右孩子的右孩子」。',
      draw: function (s) {
        var svg = s.svg(W1 + W2, HH);
        svg.setAttribute("viewBox", "0 0 " + (W1 + W2) + " " + HH);
        svg.appendChild(drawGeneral(s, W1, HH, linkAll, hideAll, '① 原树：只留长子连线（淡色 = 已抹掉）'));
        return svg;
      }
    });

    /* 帧 4：旋转成二叉树 */
    frames.push({
      desc: '<b>第 3 步 · 旋转成型</b>：把虚线「兄弟边」拉平，整棵树就变成了一棵标准二叉树。' +
        '对照左右两图看：<br>' +
        '<b>A</b> 的左孩子是 B（长子），B 的右孩子是 C、C 的右孩子是 D（兄弟链）；<br>' +
        '<b>B</b> 的左孩子是 E，E 的右孩子是 F；<b>D</b> 的左孩子是 G。<br>' +
        '关键规律：<b>二叉树中「沿右指针一直走到底」得到的，就是原树里的全部兄弟（含自己）。</b>',
      draw: function (s) {
        var svg = s.svg(W1 + W2, HH);
        svg.setAttribute("viewBox", "0 0 " + (W1 + W2) + " " + HH);
        svg.appendChild(drawGeneral(s, W1, HH, linkAll, hideAll, '① 原树'));
        var g = drawBinary(s, W2, HH, '② 二叉树（左孩子右兄弟）', {});
        g.setAttribute("x", W1);
        svg.appendChild(g);
        return svg;
      }
    });

    /* 帧 5..：逐个结点讲解对应关系 */
    /* 要核对的 (父结点, 第一个孩子) 清单；第二个元素是 null 表示该结点是叶子（只讲它在二叉树里的身份）。 */
    [['A', 'B'], ['B', 'E'], ['C', null], ['D', 'G'], ['E', 'F']].forEach(function (pr) {
      var parent = pr[0], firstKid = pr[1];
      var desc;
      if (firstKid) {
        desc = '核对结点 <b>' + parent + '</b>：它的孩子是 ' +
          kids[parent].map(function (c) { return c.name; }).join('、') +
          '，其中<b>第一个孩子 ' + firstKid + '</b> 成了 ' + parent +
          ' 的左孩子；其余孩子通过<b>右指针链</b>串在 ' + firstKid + ' 右边（因为它们是兄弟）。';
      } else {
        desc = '核对结点 <b>' + parent + '</b>：它是叶结点。作为原树里的' +
          (pname[parent] ? '「' + pname[parent] + ' 的第 ' + (kids[pname[parent]].map(function (c) { return c.name; }).indexOf(parent) + 1) + ' 个孩子」' : '结点') +
          '，它在二叉树里的身份由<b>右指针</b>决定：若它有下一个兄弟，就挂在那个兄弟的左边。';
      }
      var hl = {}; hl[parent] = true;   // 只高亮当前正在核对的这个结点（左右两图同时标出）
      var showKid = firstKid;           // 声明后没被用过（历史遗留）：真正用到的是上面的 hl
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(W1 + W2, HH);
          svg.setAttribute("viewBox", "0 0 " + (W1 + W2) + " " + HH);
          svg.appendChild(drawGeneral(s, W1, HH, linkAll, hideAll, '① 原树', hl));
          var g = drawBinary(s, W2, HH, '② 二叉树（左孩子右兄弟）', hl);
          g.setAttribute("x", W1);
          svg.appendChild(g);
          return svg;
        }
      });
    });

    frames.push({
      desc: '<b>转换完成。</b>回到 7.7.2 节那两条必背结论，现在你可以自己验证了：<br>' +
        '原树的<b>前序</b>是 <code>ABEFCDG</code>，二叉树的前序也是 <code>ABEFCDG</code> ✓；<br>' +
        '原树的<b>后序</b>是 <code>EFBGCDA</code>，二叉树的<b>中序</b>也是 <code>EFBGCDA</code> ✓。<br>' +
        '原因：树的后序是「先走完所有孩子，再访问根」，而在二叉树里所有孩子挂在<b>左子树的右链</b>上，' +
        '中序恰好也是「走完整个左子树，再访问根」，两者一致。',
      draw: function (s) {
        var svg = s.svg(W1 + W2, HH);
        svg.setAttribute("viewBox", "0 0 " + (W1 + W2) + " " + HH);
        svg.appendChild(drawGeneral(s, W1, HH, linkAll, hideAll, '① 原树'));
        var g = drawBinary(s, W2, HH, '② 二叉树（左孩子右兄弟）', {});
        g.setAttribute("x", W1);
        svg.appendChild(g);
        svg.appendChild(put(s, 10, HH - 34,
          '树的前序 = 二叉树的前序 = ABEFCDG', "start", "vz-label", "700"));
        svg.appendChild(put(s, 10, HH - 16,
          '树的后序 = 二叉树的中序 = EFBGCDA', "start", "vz-label", "700"));
        return svg;
      }
    });

    new DS.Viz(host, {
      title: '树 → 二叉树 · 左孩子右兄弟',
      sub: '加线 → 抹线 → 旋转；A(B(E,F), C, D(G))',
      build: function () { return { frames: frames }; }
    });
  })();

})();
