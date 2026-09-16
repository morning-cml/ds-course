# 代码风格改写规范：教材/工程写法 → 算法竞赛写法

> 适用对象：课件里所有 `<pre data-lang="cpp">` 代码块。
> 背景：学习者看不懂 `class` / 模板 / 封装那套语法，需要统一改成算法竞赛（OI/ACM）常见写法。

## 一、核心原则

**只保留"数据结构本身"的知识点，去掉"面向对象封装"的语法负担。**

| 维度 | 现在（教材/工程） | 改成（竞赛） |
|---|---|---|
| 数据组织 | `template <typename T> class SeqList { ... }` | 全局数组 + 自由函数 |
| 结点表示 | `struct Node { int val; Node* next; };` + 类方法 | **保留 `struct Node`**，但操作写成自由函数 |
| 函数归属 | `lst.insert(i, x)`（成员函数） | `insertAt(lst, i, x)` / `pushBack(x)`（自由函数，作用在全局量上） |
| 泛型 | `template <typename T>` | 具体类型（按题目用 `int` / `long long` / `string`） |
| 错误处理 | `throw std::out_of_range("...")` | 布尔返回值 / 打印提示 / 直接 `return` |
| 资源管理 | 析构函数、拷贝构造、`delete` | 竞赛里干脆不释放（程序结束即回收），或明确注释"竞赛不回收" |
| 输入输出 | `cin >> x`（可保留） | 统一用 `scanf/printf` 或 `cin` 均可，**但同一段代码里保持一致**；推荐 `scanf/printf` 因为选手更熟悉 |
| 头文件 | `#include <iostream>` 等 | `#include <bits/stdc++.h>`（竞赛万能头） |
| 命名空间 | `using namespace std;` | 保留 |

## 二、允许并鼓励的竞赛写法

- 全局数组开够：`const int N = 100005; int a[N];`（**数组大小写在注释里说明依据**）
- 哨兵与边界技巧：`a[0]` 作哨兵、`++top` 前置自增等
- 宏：`#define ll long long`、`#define rep(i,a,b) for(int i=(a);i<=(b);++i)` —— 适度使用，**不要用过度缩写**（课件面向初学者，`rep` 可以，`#define F(i,a,b)` 这种就不行）
- `struct` 只用来描述"数据长什么样"：
  ```cpp
  struct Node {          // 链表的结点：数据域 + 指针域
      int val;
      Node *nxt;
      Node(int v = 0, Node *n = nullptr) : val(v), nxt(n) {}   // 这个构造函数可留可去
  };
  ```
- 函数按"解题动作"命名：`pushFront`、`insertAt`、`eraseAt`、`getKth`、`buildList`、`printList`
- 每段代码都要有 `main()` 演示一次调用（能直接编译运行、看到输出）

## 三、明确禁止

- `class`（无论是否带模板）
- `template <typename T>`
- 成员函数、构造/析构函数的"三法则"那套讲解式实现（要讲可以在正文里用一两句话带过，但代码不写）
- `throw` / `try` / `catch`
- `std::unique_ptr`、智能指针
- 迭代器封装、运算符重载（除非该知识点本身就是考点，例如第 15 讲的 STL 速查）

## 四、改写时必须保住的知识点（不许改没）

改写**只换写法，不换内容**。原来代码演示的算法/结论必须原样保留，例如：

- 顺序表：地址公式、插入搬移 n/2、删除搬移 (n−1)/2、动态扩容
- 单链表：头插/尾插、按位查找、插入删除的指针顺序、反转、快慢指针判环
- 双向/循环链表：指针域的作用、遍历终止条件
- 栈/队列：判空判满条件、循环队列取模、链队列出队后 rear 的处理
- 矩阵压缩：下标映射公式、行优先存储顺序
- 树：二叉树的数组/指针表示、赫夫曼合并顺序、并查集路径压缩
- 查找/排序：算法的比较与交换过程、ASL 计算、稳定性

**代码里原有的注释（尤其是讲解性注释、复杂度标注、易错点提示）要保留并适配新写法。**

## 五、交付要求

1. 每段代码必须能通过 `g++ -std=c++17 -fsyntax-only` 编译（课件里所有块都会跑这个检查）
2. 改完必须跑两条自检命令：
   ```
   node tools/cpp-check.mjs <你改的页面>
   node tools/check.mjs
   ```
   前者确认代码能编译，后者确认页面结构没被破坏（转义、容器、死链等）
3. **只改 `<pre data-lang="cpp">` 代码块的内容**，不要动页面的其它部分；如果正文里有文字明确写着"我们把它封装成类"之类与新代码矛盾的话，需要同步微调那句话
4. `data-file="..."` 属性同步改成符合新写法的文件名（例如 `seqlist.h` → `seqlist_array.cpp`、`seq_list_template.cpp` → `seqlist.cpp`）
