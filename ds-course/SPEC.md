# 《数据结构与算法设计》课件 · 制作规范（SPEC）

> 所有章节页面必须严格遵守本规范，以保证 15 个页面视觉与交互完全统一、可直接离线打开。

## 0. 绝对规则

1. **不要新建 / 修改 `assets/js/course.js`**。它是全站公共脚本，只允许使用其中已有的能力。
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

   脚本会先跑 `ds-course/tools/batch-check.mjs`（十项校验），**不通过就中止、不写历史**；
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
<script>window.DS_PAGE = { id: 'ch00', title: '绪论：数据结构与算法分析' };</script>
<script src="assets/js/course.js" defer></script>
<script src="assets/js/ch00-viz.js" defer></script>   <!-- 无动画的章节删掉这行 -->
<!-- 如需页面专用样式，写在这里（建议 ≤ 60 行） -->
</head>
<body>

<header class="topbar"></header>

<div class="layout">
  <aside class="sidebar toc-auto"></aside>

  <main class="content">

    <div class="doc-head">
      <div class="kicker">第 02 讲</div>
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

### 4.1 打印：**任何内容都不能靠背景色才看得见**

浏览器打印时**默认不画背景色**（Chrome/Edge/Firefox 打印对话框里「背景图形」默认关闭）。
页面右上角有 ⎙「打印 / 导出 PDF」按钮，老师会真的按下去，所以这条是硬要求：

- 代码块在屏幕上是「深底 + 浅色记号」（`--code-bg`），底色一丢就只剩浅色字印在白纸上，
  正文对比度只有 1.3:1，整段代码糊成一片。因此 `course.css` 的 `@media print` 里
  重新定义了**全部** `.tk-*` 记号色，换成白底深字，每个都 ≥ 4.5:1（WCAG AA）。
- 同理，渐变/实色底上的白字（首页大标题、卡片编号）和固定定位的界面零件
  （顶栏、抽屉、右侧把手）在打印时要么换成深字，要么直接隐藏。
- 新增 `.tk-*` 记号类、或调打印配色时，`node tools/print-check.mjs` 会拦住：
  它要求每个记号类都有打印版，且打印块里所有当文字用的颜色对白纸的对比度 ≥ 4.5:1。
- 长代码行在 A4 竖版上会被右边裁掉，所以打印时 `pre` 允许折行
  （宁可折一行，也不要静默丢掉半行代码）。

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
例：总指纹 `1006cf3149af4717af9f6fab1f787e59`。

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
8. **每个数据结构都要有「工程视角」**（硬要求，见第 8 节）。只讲「它在内存里怎么排、操作复杂度是多少」
   会让学生觉得这些结构只是为了考试；必须回答**它在真实的系统里到底出现在哪、为什么选它、代价是什么**。

## 8. 工程视角（Engineering Perspective）写法

> 立这条规矩的起因：课程委托人明确要求「在各种数据结构处给出一些它们常见被用到的工程化场景，
> 包括操作系统、数据库、计算机网络各个领域」。只讲算法本身不满足这个要求。

### 8.1 覆盖范围

**每个有独立数据结构主题的章节都必须有且只有一节「工程视角」**，`h2` 标题里含「工程视角」四个字，
并在本章导读里列出来。当前已设立十三节：

| 讲次 | 小节 | 必须讲到的落点（最低要求） | 正文汉字 |
|---|---|---|---|
| 01 | 1.16 | 内存层次与延迟数量级（L1≈1ns / 主存≈100ns / 磁盘≈10ms）、缓存行与局部性、**大 O 相同 ≠ 实测一样快**、O(n²) 在小 n 上会赢、空间复杂度的工程代价 | 2541 |
| 02 | 2.10 | CPU 缓存 / cache line 与「理论复杂度相同但实测差几倍」、动态数组均摊扩容、内核 free list、**LRU 为什么必须是「哈希表 + 双向链表」** | 4284 |
| 03 | 3.12 | 函数调用栈与栈帧布局、栈溢出（大数组放栈上会崩）、缓冲区溢出攻击与金丝雀 / NX / ASLR、栈式虚拟机 | 4254 |
| 04 | 4.14 | 消息队列的解耦 / 异步 / 削峰**及其代价**（积压、重复、顺序性、lag）、生产者-消费者与有界缓冲区、OS 就绪队列与 IO 电梯、bufferbloat、网卡环形缓冲 | 3919 |
| 05 | 5.7 | grep / 编辑器为什么选 BM 而非 KMP、`LIKE '%x%'` 为何退化成逐行匹配、倒排索引、流式与低字符集场景为何必须用 KMP | 1486 |
| 06 | 6.9 | 行优先 vs 列优先的实测差距、对称矩阵压缩在有限元 / GPU 显存里的意义、三对角与追赶法、**COO 建 / CSR 算 / CSC 按列 / BSR 上 GPU**、SpMV 与 PageRank、稠密 vs 稀疏的临界点 | 5495 |
| 07 | 7.11 | B+ 树「一个结点 = 一个磁盘页」与树高 / 磁盘 I/O、叶子链表与范围查询、文件系统目录树与 inode、并查集 / 赫夫曼的工业落点 | 3670 |
| 08 | 8.10 | 真实图的规模（30 亿用户 vs 8 个顶点）、三种存法的空间账、CSR 与链式前向星的分工、DFS 在编译 / GC 里的落点与**递归爆栈**、BFS 在六度分隔 / 爬虫里的落点、外存与图数据库 | 5042 |
| 09 | 9.9 | 地图导航为什么必须用 A\*（含可跑代码的扩展结点数实测）、OSPF 用 Dijkstra 而 RIP 用 Bellman-Ford、Make/npm 的拓扑排序与循环依赖检测、关键路径法 CPM/PERT | 6311 |
| 10 | 10.8 | 为什么拉链法比开放定址更主流、扩容翻倍与 O(n) 长尾延迟（Redis 渐进式 rehash）、抗哈希碰撞攻击、数据库索引为何用 B+ 树而非哈希、布隆过滤器与一致性哈希 | 8725 |
| 11 | 11.11 | 生产级标准库排序（内省排序 / Timsort / 双轴快排的取舍）、插入排序在小区间上的真实优势、快排最坏退化与**复杂度攻击**、稳定性的生产后果、**外部排序**、堆的真实用途是优先队列、非比较排序的边界 | 7379 |
| 12 | 12.11 | Timsort 的 run 与归并栈、内省排序为什么取 2⌊log₂n⌋ 与 16、pdqsort 与分支预测、多键排序与不稳定的代价、并行与 MapReduce shuffle、外部排序参数、排序在数据库里的地位、「不要排序」的优化 | 6032 |
| 13 | 13.8 | 序列比对（Needleman–Wunsch / Smith–Waterman）、编辑距离与 Viterbi、`git diff` 背后的 LCS、贪心的反例、MapReduce / FFT、SAT 求解器与正则回溯 ReDoS | 5874 |

**篇幅参照第 7 条（不设硬上限）**：上表最后一列是当前实际字数，只作参照。
分配原则是**按该章内容在工程中的使用频率**——排序（11、12）、哈希（10）、矩阵（06）、图（08、09）用得最多，
篇幅就给得最足；绪论（01）是概念章、串匹配（05）落点集中，篇幅可以最小。**不要为了对齐字数而灌水。**

以后新增章节时，如果该章讲的是数据结构本身，**必须一并交付这一节**；
纯练习章（如第 14 讲题单）与速查章（如第 15 讲）不强制。

### 8.2 内容要求

1. 每个落点都要写清三段：**用的是什么结构 → 为什么这里必须用它 → 代价 / 局限是什么**。
   只罗列「XX 也用了链表」不算合格。
2. **必须有一个具体的、可量化的数字或事实**（例如「一次磁盘寻道约 10ms，一次内存访问约 100ns，差 5 个数量级」
   「一个 4KB 页能装约 340 个键，于是 3 层能存约 3900 万行」）。避免「性能更好」这类空话。
3. **至少 1 张静态 SVG 图解**，画的是这个工程场景本身（内存布局、栈帧、树高对比、DP 填表），
   不是把前面的算法图重画一遍。
4. **至少 1 段可编译运行的 C++ 代码**，必须是真实场景的简化实现
   （如 LRU 缓存、页内布局算数、编辑距离），不能是伪代码。
5. **1 张工程选型对比表**（比的是现实维度：缓存友好度、是否适合磁盘、能否范围查询、典型真实系统）。
6. 至少 **2 处跨讲引用**，把工程场景和前面讲的算法串起来（如「这正是第 09 讲的 Kruskal」）。
7. **篇幅不设上限**。原则是「宁可少列几个落点、把每个讲透，也不要罗列一堆名词」，
   但也不要为了凑短而砍掉「代价 / 局限」那一段——把风险讲清楚比控制行数重要。
   校验工具只检查上面第 3～6 条这些**结构性**要求，不管字数。

### 8.3 校验

```bash
node tools/coverage-check.mjs    # 自动核对「哪些章有工程视角节」与各节的最低元素要求
```

该检查以各章 `h2` 标题里的「工程视角」为准，因此**新设这一节会自动被纳入检查**，
漏写会在 `batch-check.mjs` 里直接报错。

## 9. 交付前自检清单

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
- [ ] **有独立数据结构主题的章节，都已交付「工程视角」一节**（第 8 节），
      且该节含静态图解、可编译 C++、工程选型对比表
- [ ] 正文里的「见第 NN 讲」与实际主题一致（`node tools/xref-check.mjs` 通过）
- [ ] README / index.html 里的规模数字与实测一致（`node tools/verify-stats.mjs` 通过）
