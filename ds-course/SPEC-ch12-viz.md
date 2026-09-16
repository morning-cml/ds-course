# ch12-viz.js 重做规格（第 12 讲 排序体系与下界分析）

> 背景：本文件在一次性改名事故中丢失，从会话记录还原后引号损坏、语法无法通过，
> 因此决定按下面的规格**重新生成**。页面 `ch12-sort-advanced.html` 与其余 11 个动画脚本都完好，
> **只重做这一个文件**，不要改动任何其它文件。

## 一、交付物（只此一个文件）

`C:\Users\test\Desktop\家教\ds-course\assets\js\ch12-viz.js`

- 纯 `(function(){ "use strict"; ... })();` 结构，不依赖任何外部库
- 依赖 `assets/js/course.js` 暴露的 `DS.Viz` 与 `DS.SVG`
- **JS 文件里只能写真正的 `<`，不能写 `&lt;` 这类 HTML 实体**
- UTF-8 编码，中文文本正常（不要出现乱码）

## 二、必须实现的 8 个动画（容器 id 必须**逐字一致**）

页面里已经放好了这 8 个 `<div id="...">` 容器，脚本必须为每一个都建立 `DS.Viz`。
每个演示的开头都要写 `var host = document.getElementById('...'); if (!host) return;`

| # | 容器 id | 主题 | 演示内容要求 | 原帧数（供参考） |
|---|---|---|---|---|
| 1 | `viz-decision-tree` | 3 元素决策树 | 逐帧搭出一棵比较决策树：内部结点 = 一次比较，叶子 = 一种输出排列；实时显示「已放下叶子数 / 6」「树高 h」「2^h 是否 ≥ n!」，最后指出 2²=4 < 3!=6 ≤ 2³=8，所以至少 3 次比较 | 22 |
| 2 | `viz-counting` | 计数排序三步 | ① 统计频次 → ② 求前缀和 → ③ **倒序**放置（要能看出倒序才稳定）；用带下标的标签（3a/3b、4a/4b）显式展示相同关键字的相对顺序被保持 | 23 |
| 3 | `viz-bucket` | 桶排序 | 数据按区间落入若干桶 → 每个桶内做插入排序 → 依次收集；显示每个桶的内容与桶内比较次数 | 29 |
| 4 | `viz-cocktail` | 鸡尾酒排序 vs 冒泡 | 同一组数据 `[2,3,4,5,6,7,8,1]` **上下并排**跑两种算法，实时对比「趟数 / 比较次数 / 交换次数」，直观看出双向扫描只需 2 趟而普通冒泡要 7 趟 | 42 |
| 5 | `viz-comb` | 梳排序 | gap 从 n 开始每次除以 1.3 递减，显示当前 gap、本轮是否发生交换，直到 gap=1 退化为冒泡收尾 | 44 |
| 6 | `viz-tournament` | 锦标赛排序 | 用完全二叉树画胜者树：第一轮 n−1 次比较选出冠军，之后每次「重赛」只需 log n 次；显示比较次数对比 | 39 |
| 7 | `viz-introsort` | 内省排序 | 流程图式演示：快速排序递归 → 深度超过 2·log₂n 时切换堆排序 → 小区间（长度 ≤ 16）改用插入排序；显示当前处于哪种模式、递归深度 | 23 |
| 8 | `viz-merge-two` | 多路归并 / 败者树 | 演示 k 路归并：从 k 个有序段中反复取最小；并说明败者树如何把「选最小」从 O(k) 降到 O(log k)（可用胜者树演示，注意在正文里说明） | 16 |

## 三、必须遵守的动画写法（与其它 11 个脚本保持一致）

```js
(function () {
  "use strict";
  var SVG = DS.SVG;

  (function decisionTree() {
    var host = document.getElementById('viz-decision-tree');
    if (!host) return;

    var frames = [];
    function snap(desc, state) {          // 在真实算法循环里推帧，保证图与描述同步
      frames.push({
        desc: desc,
        draw: function (s) {
          var svg = s.svg(880, 420);      // 返回 svg 元素
          // 用 s.box / s.circle / s.text / s.label / s.line / s.path 画图
          return svg;
        }
      });
    }
    snap("第一步……", {});
    /* ……真实算法循环，每步调用 snap …… */

    new DS.Viz(host, {
      title: "3 元素决策树",
      sub: "叶子数 6、树高 3 → 2^h ≥ n!",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ……其余 7 个同理…… */
})();
```

要素说明：

- `DS.SVG` 可用方法：`svg(w,h)`、`box(x,y,w,h,cls,text,textCls)`、`circle(cx,cy,r,cls,text,textCls)`、
  `text(x,y,str,cls,anchor)`、`label(x,y,str,anchor)`、`line(x1,y1,x2,y2,cls,arrow)`、`path(d,cls,arrow)`、`el(name,attrs,text)`。
- 状态类名（写到 `cls` 参数里）：`active`（蓝·当前）、`compare`（橙·比较中）、`done`（绿·已完成）、
  `warn`（红·冲突/交换）、`dim`（淡出·已排除）。底色为实色时给文本传 `textCls="on"`（白字）。
- **不要自己写按钮**，`DS.Viz` 自带「播放 / 上一步 / 下一步 / 重来 / 末帧 / 速度」。
- 每帧的 `desc` 必须是通顺的中文，讲清「这一步在比较谁、改动了什么、当前处于第几轮」，
  可用 `<b>`、`<code>` 标签强调。**不允许留空描述**。
- 帧数控制在 15~120 之间。
- SVG 里的颜色**只能用 CSS 变量**（`var(--panel)`、`var(--text)`、`var(--brand)`、`var(--ok)`、
  `var(--warn)`、`var(--danger)`、`var(--accent)`、`var(--border)` 等），保证深色主题可读。
- 画布宽度建议 ≤ 900（超出会有横向滚动条），高度按内容给足，避免元素重叠。

## 四、内容口径（务必与正文一致，不要写错）

- 比较排序的**下界**：决策树有 n! 个叶子，高度 h 必须满足 `2^h ≥ n!`，故 `h ≥ ⌈log₂(n!)⌉ = Ω(n log n)`。
- 3 个元素：`3! = 6`，`2² = 4 < 6 ≤ 8 = 2³`，所以最坏需要 **3** 次比较。
- 计数排序要**稳定**，因此第三步必须**倒序**扫描原数组放置。
- 鸡尾酒排序（双向冒泡）对 `[2,3,4,5,6,7,8,1]`：普通冒泡需要 **7** 趟，鸡尾酒只需 **2** 趟。
- 梳排序的 gap 收缩比例取 **1.3**。
- 锦标赛排序第一轮 **n−1** 次比较选出最小值，之后每次重赛 **log₂n** 次。
- 内省排序（Introsort）：快排为主，递归深度超过 `2·log₂n` 转堆排序，区间长度 ≤ 16 用插入排序。

## 五、交付前必须自检（两条命令都要通过）

```bash
node --check assets/js/ch12-viz.js        # 语法必须通过
node tools/dom-sim.mjs ch12-sort-advanced.html
```

第二条会真实执行页面脚本并**把每一帧都渲染一遍**，期望输出形如：

```
✓ ch12-sort-advanced.html  脚本 3个  动画 8/8  帧 NN（失败 0，无描述 0，画布为空 0）
```

即：**动画 8/8**、**失败 0**、**无描述 0**、**画布为空 0**。

再跑一次总检查确认没有波及其它文件：

```bash
node tools/check.mjs ch12-sort-advanced.html
```
