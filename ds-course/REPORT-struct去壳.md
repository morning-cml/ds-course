# struct 去壳精修 —— 改写与验证报告

范围：`ch04-queue.html`、`ch06-array-matrix.html`、`ch05-string-kmp-bm.html`、
`ch08-graph-basic.html`、`ch15-review.html`、`ch13-paradigm-dp.html` 共 13 个代码块。
严格按 `SPEC-struct去壳清单.md` 执行，清单里标"保留"的（custom_hash / Mat / WinnerTree /
RunInfo / DSU / MinHeap / 各种 Node）与其它章节文件一律未动。

---

## 一、改了哪几段、各改成什么

### ch04-queue.html（7 段，本轮重点）

| data-file | 原来 | 改成 |
|---|---|---|
| `seq_queue_naive.cpp` | `struct SeqQueue` + 6 个成员函数 | 全局 `int q[MaxSize]; int front, rear;` + `initQueue/queueEmpty/queueLength/queueFull/enQueue/deQueue/getHead` |
| `circular_queue_scheme1.cpp` | `struct CircularQueue1` | 全局数组 + `front/rear` + 自由函数，判满 `(rear+1)%MaxSize==front`（注释里逐条对比三方案） |
| `circular_queue_scheme2.cpp` | `struct CircularQueue2` | 全局数组 + `int sz` + 自由函数，判满 `sz == MaxSize` |
| `circular_queue_scheme3.cpp` | `struct CircularQueue3` | 全局数组 + `int tag` + 自由函数，判满 `front==rear && tag==1` |
| `link_queue_bug.cpp` | `struct BuggyQueue` + `popBuggy()` | 全局 `head/tail` + 自由函数，**故意留的 bug 原样保留** |
| `link_queue_single_elem.cpp` | `struct LinkQueue` + `popV1/popV2` | 全局 `head/tail/cnt` + 自由函数，**两版对比完整保留** |
| `q3_answer.cpp` | `struct LinkQueue` | 全局 `head/tail` + 自由函数 |

三处关键教学点都写进了注释：

* **三种判满方案的区别**：`circular_queue_scheme1/2/3.cpp` 的文件头注释各写了一段
  「与另外两种方案的区别」，落到"`front == rear` 同时可能是空也可能是满，三种方案就是给这个
  歧义补上不同的信息（留一格 / 记个数 / 记上一次动作）"这句根子上；方案一还额外说明
  "下标取模与判满方案无关，三种都必须写"。
* **单元素出队的两版对比**：`popV1`（`if (tail == p) tail = head;`，先判断 p 是不是队尾）
  与 `popV2`（`if (head->next == nullptr) tail = head;`，先摘链再判空）都保留，
  连"少一次比较？其实一样"的原始点评也保留。
* **`link_queue_bug.cpp` 的 bug 保持是错的**：`popBuggy()` 里仍然只有 `head = head->next;`
  再 `delete p;`，并在原位置留着 `// 漏了：if (head == nullptr) tail = nullptr;`，
  另加一行 `★★ 这里的 bug 是故意留下的教学反例，请勿"顺手修好"`。运行结果依旧是
  「head == nullptr ? 是 / tail == nullptr ? 否」。

命名：统一用竞赛的 `head/tail`（= 教材 `front/rear`，页面里本来就有这张对照表，
且同页已有的 `link_queue.cpp` / `link_queue_no_head.cpp` / `circular_queue.cpp` 都是这个风格），
每段头部都补了一行 `【命名对照】` 注释；正文里 4.4.3 标题、4.4.3 起因段、易错点 4-4 三条铁律、
"动手改一改"框都同步做了微调（如 `QueueFull()` → `queueFull()`、`data[8] = x` → `q[8] = x`、
`Length()` → `queueLength()`），并保留教材叫法作为对照。

### ch06-array-matrix.html（4 段）

`sparse_triplet_transpose.cpp` / `sparse_fast_transpose.cpp` / `sparse_rpos_add.cpp` /
`sparse_multiply.cpp`：`struct SparseMatrix`（只有一个 `push`）全部去壳，改成
`Triple t[MAXT]` 之类的全局三元组数组 + `mu/nu/tu` 计数器 + 自由函数
（`pushTriple`、`printMatrix`、`buildRpos`、`naiveTranspose`、`fastTranspose`、`addMatrix`、`multiply`）。
**`struct Triple` 保留**（结点型，描述"一个非零元长什么样"，与 ch06 后面 OLNode/CSR 的写法一致）。
加法段为了让 A/B/C 三张表同框，写成三组全局数组（`ta/tb/tc` + `rposA/rposB/rposC` +
`pushA/pushB/pushC`），比原来用指针在"某个矩阵"上折腾更贴初学者。

### ch05-string-kmp-bm.html（1 段）—— 判断后决定去壳

`bm.cpp`：原 `struct BM` 里只有 `string P; int m; vector<int> badChar, goodSuffix;`
加一个既做预处理又调 `search` 的成员函数 `build()`，**没有独立的查询逻辑装在对象里**
（`search` 其实也只是一趟扫描 + 查两张表）。按清单第 45 行的判断口径，改成
全局 `string P; int m; int badChar[256]; int goodSuffix[100];` +
`buildBadChar()` / `buildGoodSuffix()` / `buildBM()` / `bmSearch(S)`，
表长由 vector 换成 `MAXT/256` 定长数组，算法逐行照搬（好后缀的两级兜底逻辑一字未改）。

### ch08-graph-basic.html（1 段）

`graph_handshake.cpp`：`struct Graph`（`n/edges/deg` + `addEdge/sumDeg`）→
链式前向星全局数组 `head[MAXN], to[MAXM], nxt[MAXM]` + `eu[]/ev[]`（存边的两个端点）
+ `deg[]` + `n, etot` + 自由函数 `initGraph(n)/addEdge(u,v)/sumDeg()`。
与 8.4.4 节、第 09 讲 `graph_base.cpp` 同一套模板（`memset(head,-1,...)`、头插三行）。
度数、`Σdeg`、`possible()` 输出与原版逐字节一致。

### ch15-review.html（1 段）

`template_graph.cpp`：`struct Graph` 去壳成与 ch08 完全一致的链式前向星全局数组
（`head[MAXN], to[MAXM], nxt[MAXM], w[MAXM], etot` + `initGraph/addEdge`），
`dijkstraHeap` 从 `const Graph&` 改成直接用全局数组遍历（`G.head[u]` → `head[u]`）。
`DSU` / `MinHeap` / `custom_hash` 这三个真正的模板按清单保留，未动。

### ch13-paradigm-dp.html（1 段）—— 判断后决定去壳

`closest_pair.cpp`：`struct P` 只有两个 double、无成员函数（审计工具本就没把它列红），
但 `solve` 是分治主函数、dist 是工具函数，符合清单第 48 行的判断口径，故改成
全局 `Point p[MAXN]; int n;` + 自由函数 `dist(a,b)`、`solve(l,r)`，
`struct P` → `struct Point`（保留为结点型）。分治合并里"带状区域 + 只比后 7 个"的逻辑原样保留。

---

## 二、判断后决定"保留"的块（未动）

| 位置 | 决定 | 理由 |
|---|---|---|
| ch05 `bm.cpp` 的 `BM` | **去壳**（见上） | 里面没有独立查询逻辑，只是"模式串 + 两张表 + 预处理"，符合清单给的第一种判断 |
| ch13 `closest_pair.cpp` 的 `P` | **去壳**（见上） | `solve` 是作用在整张点表上的分治主函数，`P` 不是自带状态的数据结构 |
| ch10 `custom_hash` / `simple_random_hash` | 保留 | 传给 `unordered_map` 的哈希仿函数，必须是类型；清单明示保留 |
| ch13 `Mat`（`matrix_pow.cpp` / `matrix_pow_fib.cpp`） | 保留 | 矩阵类型，`a[K][K]` + `identity()` 是它的天然接口；清单明示保留 |
| ch12 `WinnerTree` ×2、`RunInfo` | 保留 | 真正的数据结构（n/val/win 等字段 + 建树/重赛/输赢重排），方法围绕内部状态；清单明示保留 |
| ch15 `DSU` / `MinHeap` | 保留 | 竞赛模板普遍封装，方法围绕 `fa[]` / `h[]` 内部状态 |
| 所有 `Node / TreeNode / Edge / Point / Triple / Customer / Task` 等结点型 | 保留 | 只描述数据长什么样，本来就该是 struct（构造函数、`operator<` 保留） |
| 其它 12 个页面 | 未动 | 本轮范围外 |

---

## 三、自检命令输出

```
$ node tools/cpp-check.mjs ch04-queue.html
── ch04-queue.html          通过 19/19
共 19 个 C++ 代码块：编译通过 19，失败 0，跳过 0

$ node tools/cpp-check.mjs ch06-array-matrix.html
── ch06-array-matrix.html   通过 11/11
共 11 个 C++ 代码块：编译通过 11，失败 0，跳过 0

$ node tools/cpp-check.mjs ch05-string-kmp-bm.html
── ch05-string-kmp-bm.html  通过 7/7
共 7 个 C++ 代码块：编译通过 7，失败 0，跳过 0

$ node tools/cpp-check.mjs ch08-graph-basic.html
── ch08-graph-basic.html    通过 17/17
共 17 个 C++ 代码块：编译通过 17，失败 0，跳过 0

$ node tools/cpp-check.mjs ch15-review.html
── ch15-review.html         通过 7/8（跳过 1）
（待人工确认：ch15-review.html/q2.cpp）        ← 原有片段，非本次改动

$ node tools/cpp-check.mjs ch13-paradigm-dp.html
── ch13-paradigm-dp.html    通过 50/55（跳过 5）
（待人工确认：coin_change / knapsack01_recur / binary_search_A / binary_search_B / answer01）
                                              ← 均为原有片段，非本次改动

$ node tools/check.mjs
通过检查 43 项　警告 2 项　错误 0 项
（2 条警告来自 index.html「没有任何 h2/h3 标题 / 该章没有交互动画容器」，与本次改动无关）

$ node tools/audit-structs2.mjs
含 struct 的代码块共 90 个
其中「写了真正的成员函数、且不属于算法型/结点型」的：8 个
建议去壳的清单：
  ch10 anti_hack_hash.cpp      custom_hash, simple_random_hash   ← 清单明示保留
  ch10 custom_hash_only.cpp    custom_hash                       ← 清单明示保留
  ch12 tournament_sort.cpp     WinnerTree                        ← 清单明示保留
  ch12 kway_merge_winner_tree  WinnerTree                        ← 清单明示保留
  ch12 replacement_selection   RunInfo                           ← 清单明示保留
  ch13 knapsack_bt.cpp         Item(cmp/bound/dfs)               ← 不在本轮范围
  ch13 matrix_pow.cpp          Mat                               ← 清单明示保留
  ch13 matrix_pow_fib.cpp      Mat                               ← 清单明示保留
（本轮 13 个目标条目已全部从"建议去壳"清单消失；块总数 96 → 90）
```

## 四、行为一致性验证（逐块真实编译运行 + 输出比对）

把改动前后每个代码块都抽成独立 .cpp，用
`g++ -std=c++17 -w -fpermissive -o ...` 真实编译、真实运行，输出重定向到文件后逐行比对：

```
ch04：相同 16，不同 3，缺失 0
ch05：相同 7，  不同 0，缺失 0
ch06：相同 11， 不同 0，缺失 0
ch08：相同 17， 不同 0，缺失 0
ch13：相同 50， 不同 0，缺失 0
ch15：相同 6，  不同 1，缺失 0
```

* **ch04 的 3 处"不同"全部只是印刷名差异**，指针对应关系完全一致：
  `front==rear ?` → `head==tail ?`（`link_queue_single_elem`、`q3_answer`），
  以及 `link_queue_bug` 里 `front/rear` → `head/tail`、`q.Push(99)` → `push(99)`
  （成员函数调用变自由函数调用必须改名）。数值、分支、结论文字全部相同。
  这正是页面自带的 `head = front, tail = rear` 对照约定。
* **ch15 `template_graph.cpp` 的 1 处差异是一处真实修复**：原 `struct Graph` 把
  `int head[MAXN], to[MAXN*2], nxt[MAXN*2], w[MAXN*2]` 全塞进结构体，`Graph G;` 是**局部的**，
  8 MB 落在 1 MB 默认栈上，实测 `exit=-1073741571`（0xC0000005，栈溢出）→ 进程直接崩，
  连 `cout << dist[3]` 都没输出（注释写着期望 5）。改成全局数组后输出 `5`，
  与注释里标注的期望值一致。为确认是这一原因，我另写了一份"原 struct 版 + 一行 `G.init(5)`"
  作对照，同样栈溢出崩溃，可见问题出在"大对象放栈上"，正是本次去壳顺带解决的。
