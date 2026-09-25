# 《数据结构与算法设计》课件 · 制作规范（SPEC）

> 所有章节页面必须严格遵守本规范，以保证 15 个页面视觉与交互完全统一、可直接离线打开。

## 0. 绝对规则

1. **写章节时不要去改 `assets/js/course.js`**，只用其中已有的能力（`DS.Viz` / `DS.SVG` 等）。
   它是全站 16 个页面共用的引擎，改一处影响全站：只有修公共 bug（例如导航抽屉、代码高亮）才动它，
   改完必须跑 `node tools/dom-sim.mjs` 与 `node tools/frame-check.mjs --fingerprint`（改前改后指纹一致）。
   `assets/css/course.css` 是**公共样式的唯一来源**：动画需要新的状态类时，**加进 course.css**，
   **不要在各章页面里用 `<style>` 打补丁**。
   > 为什么立这条（2026-09 的事故）：早期 `.vz-box.warn / .dim` 没进 course.css，
   > 于是 ch02/ch03/ch04/ch06/ch11 各自在页内补了一份，而 ch05/ch07/ch08/ch09/ch10/ch12/ch13
   > 没补 —— 结果这些章的「冲突/交换」红色高亮、`dim` 淡出**完全不生效**，
   > 且 `textCls="on"` 的白字落在浅色底上导致整格文字看不见。页内补丁是单点修复，
   > 必然漏；公共样式才是唯一正确的落点。
2. 每个章节页面放在根目录，文件名与下表完全一致；每章的动画脚本放 `assets/js/<chapter-id>.js`。
3. 所有代码示例必须是 **C++**（C++11/14 可编译），禁止伪代码充当实现（讲思路时可以用文字或注释，但每章至少给完整可运行实现）。
4. 页面必须能**纯离线双击打开**：不允许 CDN、不允许外链 JS/CSS/图片、不允许 `fetch`。所有图形用**内联 SVG** 或 Canvas 现场绘制。
5. 所有动画必须**真实可交互**：能单步前进/后退、能自动播放、能显示当前步骤说明。禁止放一张静态图就宣称是动画。
6. 中文排版，专业术语中英对照（如「时间复杂度 time complexity」）。
7. **每一次正确的修改都要「提交 + 推送」留存记录**（2026-09 起立的规矩）。
   改完并通过校验后立即执行：

   ```powershell
   cd ..                      # 回到仓库根（家教/）
   .\git-commit.ps1 "说明这次改了什么" -Push
   ```

   脚本会先跑 `ds-course/tools/batch-check.mjs`（十一项校验），**不通过就中止、不写历史**；
   通过后提交、打 `vNNNN` 标签、并推到 GitHub。
   这样每一次修改在远端都有对应版本，随时可以按标签回退。
   **不要只提交不推送**——本地提交在误删目录时救不回来。

## 1. 文件与 ID 对照表

> **命名约定（重要）**：文件名编号、讲次编号、`DS_PAGE.id` 三者**必须一致**
> （`ch07-tree.html` → 第 07 讲 → `id: 'ch07'`）。
> 早期版本曾用 0 基编号（`ch00` = 第 01 讲），现已全部纠正为从 `ch01` 起，请勿改回。

| 页面文件 | `DS_PAGE.id` | 讲次 | 动画脚本 |
|---|---|---|---|
| `index.html` | `index` | 总览 | — |
| `ch01-intro.html` | `ch01` | 01 绪论：数据结构与算法分析 | — |
| `ch02-linear-list.html` | `ch02` | 02 线性表：顺序表与链表 | `assets/js/ch02-viz.js` |
| `ch03-stack.html` | `ch03` | 03 栈及其经典应用 | `assets/js/ch03-viz.js` |
| `ch04-queue.html` | `ch04` | 04 队列及其应用 | `assets/js/ch04-viz.js` |
| `ch05-string-kmp-bm.html` | `ch05` | 05 串：KMP 与 BM 模式匹配 | `assets/js/ch05-viz.js` |
| `ch06-array-matrix.html` | `ch06` | 06 数组与特殊矩阵压缩存储 | `assets/js/ch06-viz.js` |
| `ch07-tree.html` | `ch07` | 07 树与二叉树 | `assets/js/ch07-viz.js` |
| `ch08-graph-basic.html` | `ch08` | 08 图：术语与存储结构 | `assets/js/ch08-viz.js` |
| `ch09-graph-algo.html` | `ch09` | 09 图论算法：生成树与最短路径 | `assets/js/ch09-viz.js` |
| `ch10-search-hash.html` | `ch10` | 10 查找与哈希表 | `assets/js/ch10-viz.js` |
| `ch11-sort-basic.html` | `ch11` | 11 八大排序算法图解（上） | `assets/js/ch11-viz.js` |
| `ch12-sort-advanced.html` | `ch12` | 12 排序体系与下界分析（下） | `assets/js/ch12-viz.js` |
| `ch13-paradigm-dp.html` | `ch13` | 13 算法设计范式与动态规划 | `assets/js/ch13-viz.js` |
| `ch14-luogu.html` | `ch14` | 14 洛谷题单：例题与作业 | — |
| `ch15-review.html` | `ch15` | 15 综合自测与速查手册 | — |

### 批量改名/替换的注意事项（教训）

1. **绝对不要用会静默覆盖的接口批量改名**（`fs.renameSync`、`mv` 等）。链式改名
   （`ch01→ch02`、`ch02→ch03`…）会互相覆盖、成批丢文件。安全做法：先检测目标是否存在，
   存在就中止；或先把全部文件复制到临时目录、在副本上改名，最后整体替换。
2. 改名后必须同步四处：各页 `DS_PAGE.id`、`<script src>` 引用、`course.js` 的 `PAGES` 注册表、
   `tools/check.mjs` 的页面清单。
3. 全文替换「第 NN 讲」时注意两种口径：**页头讲次**要写本页自己的编号，
   **正文交叉引用**（"见第 07 讲"）指别的页面——不要一起 ±1。
4. 改完立刻跑 `node tools/batch-check.mjs`（结构 + 导航 + 动画逐帧 + **帧状态** + C++ 编译 + 需求覆盖 + 交叉引用）。

## 2. 页面骨架模板（照抄，只改标注处）

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>01 绪论：数据结构与算法分析 · 数据结构与算法设计</title>
<link rel="stylesheet" href="assets/css/course.css">
<script>window.DS_PAGE = { id: 'ch01', title: '绪论：数据结构与算法分析' };</script>
<script src="assets/js/course.js" defer></script>
<script src="assets/js/ch01-viz.js" defer></script>   <!-- 无动画的章节删掉这行 -->
<!-- 如需页面专用样式，写在这里（建议 ≤ 60 行） -->
</head>
<body>

<header class="topbar"></header>

<div class="layout">
  <aside class="sidebar toc-auto"></aside>

  <main class="content">

    <div class="doc-head">
      <div class="kicker">第 01 讲</div>
      <h1>绪论：数据结构与算法分析</h1>
      <p class="lede">一句话说明本章解决什么问题、学完能做什么。</p>
      <div class="meta">
        <span>预计 90 分钟</span>
        <span>前置：C++ 基础语法</span>
        <span>关键词：逻辑结构 · 物理结构 · 大 O</span>
      </div>
    </div>

    <div class="note">本章导读：3~6 条要点列表。</div>

    <h2 id="s1">1.1 小节标题</h2>
    ...正文...

    <div class="pager">
      <a class="prev" href="上一章.html"><span class="dir">← 上一讲</span><span class="ttl">…</span></a>
      <a class="next" href="下一章.html"><span class="dir">下一讲 →</span><span class="ttl">…</span></a>
    </div>

  </main>
</div>

</body>
</html>
```

要点：
- `<header class="topbar">` 与 `<aside class="sidebar toc-auto">` **保持空标签**，`course.js` 会自动填充顶栏与目录。
- 所有 `h2`/`h3` 必须带 `id`（如 `id="s1"`、`id="kmp-next"`），否则本页目录生成不了。
- 首尾必须有 `.pager` 上一讲/下一讲链接，文件名用第 1 节表格里的真实文件名。

## 3. 代码块写法（必须用这种，才能自动高亮 + 复制）

```html
<pre data-lang="cpp" data-file="singly_list.cpp">// 这里直接写 C++ 代码，注意转义：& → &amp;  &lt; → &lt;  &gt; → &gt;
struct Node { int val; Node* next; };
</pre>
```

- 只有确实需要 HTML 转义的字符才转义（`<`、`>`、`&`）。代码里 `#include <iostream>` 必须写成 `#include &lt;iostream&gt;`。
- 短的、无关紧要的片段可用行内 `<code>`。

## 4. 可用 CSS 组件（class 清单）

| 用途 | 写法 |
|---|---|
| 卡片 | `<div class="card">…</div>`，`<div class="grid c2">` / `c3` / `c4` 内可并排 |
| 提示块 | `<div class="note">`，变体：`note tip`（绿）/`note warn`（黄）/`note danger`（红）/`note exam`（紫，考点）。内含 `<span class="note-title">标题</span>` |
| 标签 | `<span class="tag">默认</span>`、`tag b`（蓝）`tag o`（橙）`tag g`（绿）`tag r`（红）`tag p`（紫） |
| 表格 | `<div class="table-wrap"><table>…</table></div>`，紧凑版加 `class="compact"`；单元格上色用 `c-ok` / `c-warn` / `c-bad` |
| 公式 | `<div class="formula">…</div>`（可用 `class="formula center"`）；需要上标时用 `<div class="formula" data-math="T(n)=O(n^2)"></div>` |
| 术语表 | `<dl class="def"><dt>术语</dt><dd>解释</dd>…</dl>` |
| 折叠 | `<details class="fold"><summary>标题</summary><div class="fold-body">…</div></details>`（**答案、题解、扩展阅读一律折叠**） |
| 静态图解 | `<div class="figure"><svg …>…</svg><figcaption>图 x-y　说明</figcaption></div>` |
| 静态分步图 | 容器加 `data-steps`，里面放多个 `<svg>`，脚本会自动生成「上一步/下一步」按钮 |
| 代码 | 见第 3 节 |
| 分页器 | 见第 2 节 |

### 4.1 代码配色：**分成「浅色 / 深色 / 打印」三套，而且不许靠背景色**

代码块的颜色**全部走设计令牌**（`--code-bg` / `--code-text` / `--code-head-*` / `--tk-*`），
`course.css` 第 1 节里按主题各定义一套，`@media print` 再覆盖一套：

| 场合 | 代码块 | 记号色 |
|---|---|---|
| 浅色主题（屏幕） | 浅底 `#f7f9fc` | 深字，全部 ≥ 4.5:1 |
| 深色主题（屏幕） | 深底 `#0a0f16` | 浅字，全部 ≥ 4.5:1 |
| 打印 / 导出 PDF | 白底 | 深字，全部 ≥ 4.5:1 |

这里沉淀了两次真实事故，都是「代码看不清」，原因却完全不同：

- **事故一（打印）**：浏览器打印时**默认不画背景色**（Chrome/Edge/Firefox 的打印对话框里
  「背景图形」默认关闭）。当年代码块是「深底 + 浅色记号」，底色一丢，剩下的就是印在白纸上的
  浅色字，对比度只有 1.3:1。所以打印必须整块换成白底深字。
  另外，**渐变/实色底上的白字**（首页大标题、卡片编号）和**固定定位的界面零件**
  （顶栏、抽屉、右侧把手）在打印时要么换成深字、要么直接隐藏，否则就是白纸上的白字。
- **事故二（屏幕）**：`course.js` 生成的代码块是 `<pre><code>…</code></pre>`，而第 2 节给
  **行内代码**写了一条 `code { background: var(--bg-soft); … }`，它同样命中了这个 `<code>`。
  行内元素按行盒绘制背景，于是**每一行代码背后都多出一个浅色小方块**，记号色落在浅框上就又糊了。
  修法是 `.code-block pre code { background: transparent; border: none; padding: 0; color: inherit; }`
  —— **在代码块里彻底关掉行内代码那套样式**。

另外两条经验：

- 注释**不要加 `font-style: italic`**。中文没有真正的斜体字形，浏览器是倾斜合成的，
  13px 的中文被斜切以后笔画发虚，比对比度更伤可读性。
- 长代码行在 A4 竖版上会被右边裁掉（全站约 2% 的行比纸宽），所以打印时 `pre` 允许折行
  （宁可折一行，也不要静默丢掉半行代码）。

`node tools/print-check.mjs` 是这四条的守门人：它要求每个 `--tk-*` 令牌在打印块里都重新定义，
打印块里所有当文字用的颜色对白纸 ≥ 4.5:1，**两套屏幕主题各自的**记号色对各自底色也 ≥ 4.5:1，
并检查靠背景反白的界面零件都已在打印时隐藏。新增记号色令牌时必须三套都补齐。

## 5. 可视化引擎 `DS.Viz` 用法（重点）

### 5.1 最常用写法：每一帧完全重画（推荐，最不容易出错）

在章节脚本 `assets/js/chNN-viz.js` 里：

```js
(function () {
  "use strict";
  var SVG = DS.SVG;

  /* ============ 演示 1：冒泡排序 ============ */
  (function bubble() {
    var host = document.getElementById('viz-bubble');
    if (!host) return;                                   // 页面上没有这个容器就跳过

    var A0 = [5, 2, 9, 1, 7, 3];
    var frames = [];
    var A = A0.slice(), n = A.length;

    function snap(desc, marks) {                          // marks: {i:'compare', j:'active', ...}
      frames.push({
        desc: desc,
        draw: function (s) {
          var W = 60 + n * 62, svg = s.svg(W, 110);
          for (var k = 0; k < n; k++) {
            var cls = (marks && marks[k]) || '';
            var x = 30 + k * 62;
            svg.appendChild(s.box(x, 30, 52, 44, cls, A[k], /active|done|warn|compare/.test(cls) ? 'on' : ''));
            svg.appendChild(s.label(x + 26, 96, '[' + k + ']', 'middle'));
          }
          return svg;
        }
      });
    }

    snap('初始序列', {});
    for (var i = 0; i < n - 1; i++) {
      for (var j = 0; j < n - 1 - i; j++) {
        snap('比较 A[' + j + ']=' + A[j] + ' 与 A[' + (j+1) + ']=' + A[j+1], (function(j){var m={};m[j]='compare';m[j+1]='compare';return m;})(j));
        if (A[j] > A[j + 1]) {
          var t = A[j]; A[j] = A[j + 1]; A[j + 1] = t;
          var m2 = {}; m2[j] = 'warn'; m2[j + 1] = 'warn';
          snap('A[' + j + '] &gt; A[' + (j+1) + ']，交换', m2);
        }
      }
      var mm = {}; for (var q = n - 1 - i; q < n; q++) mm[q] = 'done';
      snap('第 ' + (i + 1) + ' 轮结束，A[' + (n-1-i) + '] 就位', mm);
    }
    var mAll = {}; for (var z = 0; z < n; z++) mAll[z] = 'done';
    snap('排序完成', mAll);

    new DS.Viz(host, { title: '冒泡排序', sub: '相邻比较、逆序交换', build: function () { return { frames: frames }; } });
  })();

  /* …更多演示… */
})();
```

### 5.2 也可以边算边推帧

```js
new DS.Viz(document.getElementById('viz-x'), {
  title: '…', sub: '…',
  build: function (ctx) {                 // ctx.frame(f) 推入一帧
    ctx.frame({ desc: '第一步…', draw: function (s) { return s.svg(10,10); } });
  }
});
```

### 5.3 `DS.Viz` 会提供的 UI

标题栏、画布 `.viz-stage`、步骤说明栏（`desc` 支持 HTML）、进度条、按钮组（播放 / 上一步 / 下一步 / 重来 / 末帧 / 速度滑杆）。
**不要自己再写按钮。**

### 5.4 帧对象的字段

| 字段 | 说明 |
|---|---|
| `desc` | 该步骤的中文说明，支持 HTML（例如 `<b>`、`<code>`） |
| `draw(s)` | 函数，参数 `s` 即 `DS.SVG`，返回一个 `svg` 元素（推荐） |
| `svg` | 也可直接给一个预先构造好的 `<svg>` 元素（会被克隆） |

### 5.5 `DS.SVG` 工具速查

```js
SVG.svg(w, h)                          // 创建 <svg>，自动响应式
SVG.box(x, y, w, h, cls, text, textCls)    // 圆角矩形（数组单元 / 表格格）
SVG.circle(cx, cy, r, cls, text, textCls)  // 圆（链表结点 / 树结点 / 图的顶点）
SVG.text(x, y, str, cls, anchor)       // 文本，anchor: 'start'|'middle'|'end'
SVG.label(x, y, str, anchor)           // 小号灰色下标标签
SVG.line(x1,y1,x2,y2, cls, arrow)      // 直线，arrow=true 加箭头
SVG.path('M0,0 L10,10', cls, arrow)    // 路径（曲线、折线）
SVG.defs(svg)                          // 用到箭头时，先调用它注册 marker
SVG.el(name, attrs, text)              // 万能方法，创建任意 SVG 元素
```

**样式类（写到 `cls` 参数里，可组合，用空格分隔）：**
`vz-box` / `vz-node` 基础外观；叠加状态类 → `active`（蓝，当前处理）、`compare`（橙，正在比较）、`done`（绿，已完成）、`warn`（红，冲突 / 交换）、`dim`（淡出，已排除）。
边 / 箭头：`vz-edge` 叠加 `active` / `done` / `dim` / `compare` / `warn` / `danger` / `ghost`。

**状态类清单（全部在 `course.css` 里，直接用，不要在页面里重复定义）：**

| 元素 | 可用状态类 |
|---|---|
| `vz-box` | `active` `compare` `done` `warn` `dim` `ghost` `ok` `dash` `pivot` `hole` |
| `vz-node` | `active` `compare` `done` `warn` `dim` |
| `vz-edge` | `active` `done` `dim` `compare` `warn` `danger` `ghost` |
| `vz-text` | `on` `sm` `lg` `big` `brand` `ok` `bad` `soft` `faint` `dim` |
| 其它 | `vz-bucket`（分桶框）、`vz-dot`（链表指针域的小圆点） |

**文字颜色（最容易踩的坑）：**

- `vz-node` 的状态底色是**实色**（`var(--brand)` / `var(--ok)` …）→ 传 `textCls="on"` 得到白字，正确。
- `vz-box` 的状态底色是 **`*-soft` 浅色**（浅色主题下接近白）→ 白色文字会**整格看不见**。
  `course.css` 已用 `.vz-box + .vz-text.on { fill: var(--text); }` 兜住这种情况：
  跟在 box 后面的文字自动改用正文色，跟在 circle 后面的仍是白字。
  所以照 SPEC 示例写 `textCls="on"` 即可，**两种底色都安全，不需要页面再打补丁**。


### 5.6 静态 SVG 的写法

直接内联，用 CSS 变量上色即可自动适配深色主题：

```html
<svg viewBox="0 0 600 200" width="600" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="40" width="70" height="46" rx="6" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="1.6"/>
  <text x="55" y="68" text-anchor="middle" fill="var(--text)" font-size="14" font-family="Consolas, monospace">12</text>
</svg>
```

**规则：** 颜色只用 `var(--panel)`、`var(--panel-2)`、`var(--bg-soft)`、`var(--text)`、`var(--text-soft)`、`var(--text-faint)`、`var(--border)`、`var(--border-strong)`、`var(--brand)`、`var(--brand-soft)`、`var(--ok)`、`var(--ok-soft)`、`var(--warn)`、`var(--warn-soft)`、`var(--danger)`、`var(--danger-soft)`、`var(--accent)`、`var(--accent-soft)`、`var(--purple)`。**不要写死 `#333` 这类颜色**，否则深色主题下会看不清。

### 5.7 推帧必须「深拷贝快照」（最容易写出的一类 bug）

`DS.Viz` 构造器是**先同步跑完** `opts.build()`（整个算法执行完、把所有帧 push 进 `frames`），
**之后**才 `go(0)` 渲染第 0 帧。所以：

> **`frame.draw` 里绝对不要直接读算法过程中会被改写的变量。**
> 读到的将是算法**结束后**的值 —— 每一帧都画最终态，第 0 帧写着「初始化」却显示完成图。

正确写法（在推帧那一刻把状态拷进闭包）：

```js
function snapshot(desc, opt) {
  opt = opt || {};
  var snap = {                       // ← 关键：此刻深拷贝
    inT: inT.slice(),
    low: low.slice(),
    mst: mst.map(function (e) { return e.slice(); }),
    total: total
  };
  frames.push({
    desc: desc,
    draw: function (s) {
      /* 只读 snap.*，绝不读 inT / low / mst / total */
      ...
    }
  });
}
```

拷贝方式：数组 `x.slice()`；二维数组 `x.map(function (r) { return r.slice(); })`；
对象 `JSON.parse(JSON.stringify(x))`；数字 / 字符串 / 布尔直接存进快照对象。
`opt` 这类**每次调用新建**的参数对象不用拷。

自检：`node tools/frame-check.mjs`（会按「相邻帧画面文本是否变化」的比例揪出冻结的动画）；
必要时用 `node tools/frame-check.mjs --dump viz-xxx chNN-viz.js` 把某帧真正画出来的文字打出来，
逐字对照它的 `desc`。

**只改注释 / 做重构时的验证办法**：`node tools/frame-check.mjs --fingerprint` 会把
「81 个动画每一帧真正画出来的内容（文字 + 颜色类）」算成一个总指纹。改动前后各跑一次，
**指纹一致就证明渲染行为一点没变**（改注释、改文案排版、抽函数都适用）。
指纹随课件内容变化，**不要抄进文档**，每次改动前现场跑一遍、当场比对。

## 6. 容器 ID 命名约定

- 交互动画容器：`<div id="viz-xxx"></div>`，脚本里 `document.getElementById('viz-xxx')`，取不到就 `return`（保证脚本可复用、不报错）。
- 页面**必须**为脚本里每一个 `viz-` 容器都写好对应 id 的 div，顺序与讲解顺序一致，容器前要有引导文字（例如「下面动图演示 next 数组的推导过程」）。

## 7. 内容质量要求

1. **有逻辑的章节顺序**：概念 → 存储结构（配图）→ 基本操作（配动画）→ 复杂度分析 → 典型应用 → C++ 完整实现 → 易错点 / 考点。
2. **每个复杂算法都要有**：
   - 一句话本质概括；
   - 手推示例（用具体小数据一步步算，配静态 SVG 分步图或动画）；
   - 可交互动画；
   - 完整 C++ 代码（含 `#include`、`main` 测试或清晰调用示例）；
   - 复杂度表格 + 易错点。
3. **必须包含对比例表**：把同类结构/算法放在一张表里比维度（时间、空间、稳定性、适用场景）。
4. **易错点用 `note danger` / `note warn`**，考点用 `note exam`。
5. 每章正文建议 **8000 字以上**、**15 个以上** `h2/h3` 小节、**3 个以上**交互动画（除非该章确实无算法，则至少 6 张静态图解），**10 段以上** C++ 代码。
6. 中文讲解要口语化、可读，避免整段教科书腔；多用「为什么」「坑在哪」的提问式引导。
7. 严禁编造洛谷题号。不确定题号时，写「洛谷：搜索关键字 xxx」或在 `note warn` 中标注「题号请以洛谷站内搜索为准」。
8. **不设「工程视角」小节，各章末尾也不放自测题**（2026-09-26 起整体删除，不要再加回来）。
   综合自测集中放在第 15 讲的模拟自测卷；各章末尾保留小结、易错点、考点与配套编程练习。

## 8. 交付前自检清单

- [ ] 文件放在了正确路径，文件名与第 1 节表格一致
- [ ] `<head>` 中的 `DS_PAGE.id` 正确，`course.js` 用 `defer` 引入
- [ ] 所有 `h2`/`h3` 都有唯一 `id`
- [ ] 页面里出现的每个 `viz-xxx` 容器都在 JS 里有对应实现；JS 里每个实现也都能在页面找到容器
- [ ] 代码块用 `<pre data-lang="cpp" data-file="...">`，HTML 特殊字符已转义
- [ ] 没有外链资源
- [ ] `.pager` 的上一讲 / 下一讲链接指向真实存在的文件
- [ ] 动画能播放、能单步、desc 描述与画面一致
- [ ] **动画的每一帧都画「当时」的状态，而不是算法跑完后的最终态**（`node tools/frame-check.mjs` 通过）
- [ ] **用到的 `vz-*` 状态类都在 `course.css` 里有定义**（`node tools/vz-check.mjs` 通过；
      动画的类名是拼字符串产生的，静态查不出来，必须跑这个工具）
- [ ] 深色主题下所有自绘图形仍然清晰（颜色全部用 CSS 变量）
- [ ] **打印 / 导出 PDF 后内容仍然看得清**：不能有「靠背景色反白」的文字
      （`node tools/print-check.mjs` 通过，见第 4.1 节）
- [ ] JS 无语法错误（`node --check assets/js/chNN-viz.js` 通过）
- [ ] 正文里的「见第 NN 讲」与实际主题一致（`node tools/xref-check.mjs` 通过）
- [ ] README / index.html 里的规模数字与实测一致（`node tools/verify-stats.mjs` 通过）
- [ ] **能原样上线到静态托管**：路径大小写与磁盘一致、没有以 `/` 开头的绝对路径、
      有 `index.html`（`node tools/deploy-check.mjs` 通过）。
      本机是 Windows（不区分大小写），这几个问题在本地完全看不出来，一上线就是 404
