# struct 去壳清单（第二轮精修）

> 判断标准：这个 `struct` 是不是在**表达一个数据结构本身**？
> - 是 → 保留（竞赛界也这么写）
> - 不是，只是一层"数组 + 下标"的壳 → 去壳，改成全局数组 + 自由函数

## 一、保留，不要动（已确认）

| 位置 | struct | 保留理由 |
|---|---|---|
| ch10 `anti_hack_hash.cpp` | `custom_hash`、`simple_random_hash` | 这是**传给 `unordered_map` 的哈希仿函数**，必须是类型（有 `operator()`）。竞赛防卡哈希的标准形态 |
| ch10 `custom_hash_only.cpp` | `custom_hash` | 同上 |
| ch13 `matrix_pow.cpp` | `Mat` | 矩阵快速幂的矩阵类型，`a[K][K]` + `identity()` 是它的天然接口 |
| ch13 `matrix_pow_fib.cpp` | `Mat` | 同上 |
| ch12 `tournament_sort.cpp` | `WinnerTree` | 胜者树是**真正的数据结构**：n/val/win 三个字段 + 建树/重赛，方法围绕内部状态 |
| ch12 `kway_merge_winner_tree.cpp` | `WinnerTree` | 同上 |
| ch12 `replacement_selection.cpp` | `RunInfo` | 置换选择算法的归并段状态封装 |
| 所有 `Node / TreeNode / Edge / Point / Triple / Customer / Task` 等 | 结点型 | 只描述数据长什么样，本来就该是 struct（构造函数、`operator<` 保留） |
| ch07 `dsu_kruskal_sketch.cpp` | `DSU` | 并查集：竞赛模板普遍封装，方法围绕 `fa[]` 内部状态 |

## 二、去壳改造（改成全局数组 + 自由函数）

### A. ch04-queue.html（7 个块，本轮重点）

| data-file | 现在的 struct | 改成 |
|---|---|---|
| `seq_queue_naive.cpp` | `SeqQueue`（InitQueue/QueueEmpty/Length/QueueFull/EnQueue/DeQueue） | 全局 `int data[MaxSize], front, rear;` + 自由函数 `initQueue/queueEmpty/queueLength/queueFull/enQueue/deQueue` |
| `circular_queue_scheme1.cpp` | `CircularQueue1` | 同上，判满改成 `(rear+1)%MaxSize==front` |
| `circular_queue_scheme2.cpp` | `CircularQueue2`（用 size 计数） | 全局数组 + `sz` + 自由函数，判满 `sz == MaxSize` |
| `circular_queue_scheme3.cpp` | `CircularQueue3`（用 tag 标志） | 全局数组 + `tag` + 自由函数 |
| `link_queue_bug.cpp` | `BuggyQueue`（故意有 bug 的版本） | 全局 `head/tail` + 自由函数，**故意留的 bug 必须原样保留**（这是教学反例） |
| `link_queue_single_elem.cpp` | `LinkQueue`（PopV1 错 / PopV2 对） | 全局 `head/tail/cnt` + 自由函数，**两个版本都要保留**（一个错一个对，是教学对比） |
| `q3_answer.cpp` | `LinkQueue` | 全局 `head/tail` + 自由函数 |

要求：
- 三个判满方案的**区别**（牺牲单元 / size / tag）必须在注释里讲清楚，这是考点
- `link_queue_single_elem.cpp` 里「只剩一个元素出队时必须 `head = tail = nullptr`」的两版对比**不能丢**
- `link_queue_bug.cpp` 的 bug 是「出队后队列为空却没有把 tail 归位」，必须保持"错的还是错的"，并在注释里标出

### B. 其它页面

| 位置 | struct | 改成 |
|---|---|---|
| ch06 四个 `sparse_*.cpp` | `SparseMatrix`（只有 `push`） | 全局 `Triple t[MAXT]; int tu;` + 自由函数 `pushTriple(...)`；`Triple` 本身保留（它是结点型） |
| ch05 `bm.cpp` | `BM`（只有 `build`） | **先自己看代码判断**：如果它只是「模式串 + 两张表 + 一个预处理函数」，就改成全局 `string P; int m; int badChar[256]; int goodSuffix[];` + `buildBadChar()/buildGoodSuffix()`；如果里面还有完整的 search 逻辑，保留 struct 并说明理由 |
| ch08 `graph_handshake.cpp` | `Graph`（`addEdge`） | 全局 `int head[N], to[M], nxt[M], ecnt;`（链式前向星写法）+ 自由函数 `addEdge(u,v)` |
| ch15 `template_graph.cpp` | `Graph`（`init/addEdge`） | 同上（这是复习章的模板，要和 ch08 一致） |
| ch13 `closest_pair.cpp` | `P`（`dist/solve`） | 先看代码：若 `solve` 是分治主函数、`dist` 是工具函数，则改成全局 `Point p[N];` + 自由函数 `dist(a,b)`、`solve(l,r)` |

## 三、通用要求

1. **只改代码块内容**，页面其它部分不动；若正文写了"封装成结构体/类"之类矛盾的话，同步微调
2. 每段代码必须能编译（`g++ -std=c++17 -fsyntax-only`），并保持 `main()` 能跑出**与原来相同的结果**
3. 改写后必须跑：
   ```
   node tools/cpp-check.mjs <你改的页面>    # 期望 失败 0
   node tools/check.mjs                      # 期望 错误 0
   node tools/audit-structs2.mjs             # 确认对应条目已从"建议去壳"清单里消失
   ```
4. HTML 转义：C++ 的 `<` `>` `&` 必须写成 `&lt;` `&gt;` `&amp;`
5. 用 `tools/replace-block.mjs <页面> <data-file名> <新代码文件> --apply` 做替换（自动转义），不要手改 HTML
