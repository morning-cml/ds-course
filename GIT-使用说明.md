# 课件仓库 · 使用说明

这是一个 git 仓库，用来给《数据结构与算法设计》课件做版本管理。
**每次更新都提交一次**，改错了可以随时回退。

## 目录

```
家教/                     ← 仓库根目录
├── .git/                 git 数据（不要手动删）
├── .gitignore            忽略规则
├── git-commit.ps1        一键提交脚本（先校验，后提交）
├── 声明.txt
├── 家教计划.pdf
└── ds-course/            课件本体（15 讲 + assets + tools）
```

## 一键提交（推荐）

在 `家教` 目录下打开 PowerShell：

```powershell
.\git-commit.ps1 "说明这次改了什么"
```

它会：
1. 先跑一遍全量校验（结构 / 导航链 / 动画逐帧渲染 / C++ 代码编译 / 需求覆盖）；
2. **校验不通过就中止**，不把坏状态写进历史；
3. 通过后提交，并自动打标签 `v0001`、`v0002`…（方便按版本回退）。

常用参数：

| 参数 | 用途 |
|---|---|
| `-SkipCheck` | 跳过校验（例如只改了 PDF、和课件代码无关时） |
| `-NoTag` | 本次不打标签 |
| `-DryRun` | 只看会提交哪些文件，不真提交 |

## 手动提交（不用脚本也行）

```powershell
git add -A
git commit -m "说明"
```

## 回退方法

| 我想…… | 命令 |
|---|---|
| 撤销某个文件还没提交的改动 | `git restore ds-course/ch07-tree.html` |
| 撤销全部未提交改动 | `git restore .` |
| 看看上次提交改了什么 | `git show --stat HEAD` |
| 回到上一个提交（丢弃之后的改动） | `git reset --hard HEAD~1` |
| 回到某个标签 | `git reset --hard v0003` |
| 从旧版本里单独捞回一个文件 | `git checkout v0003 -- ds-course/assets/js/ch07-viz.js` |
| 看历史 | `git log --oneline` |
| 看所有标签 | `git tag -l` |
| 看当前状态 | `git status` |

> ⚠️ `git reset --hard` 会**丢弃**工作区里未提交的改动。执行前先 `git stash`
> 或先提交一次，就没有风险了。

## 提交前的自检（脚本已自动做，手动提交时可单独跑）

```powershell
cd ds-course
node tools/batch-check.mjs      # 一次性跑完下面五项
node tools/check.mjs            # 结构完整性（文件、锚点、容器、转义）
node tools/nav-check.mjs        # 15 讲的「上一讲 / 下一讲」链条与站内链接
node tools/dom-sim.mjs          # 真实执行页面脚本 + 逐帧渲染所有动画
node tools/cpp-check.mjs        # 把每段 C++ 抽出来交给 g++ 编译
node tools/coverage-check.mjs   # 按需求清单逐项核对知识点
```

`cpp-check.mjs` 需要系统里有 `g++`（本机已具备）；其余几个只需要 Node.js。

## 两条经验（本仓库踩过的坑）

1. **批量改名千万不要用会静默覆盖的方式**（`fs.renameSync`、`mv`）。
   链式改名（`ch01→ch02`、`ch02→ch03`…）会互相覆盖、成批丢文件。
   正确做法：先检测目标是否存在 → 存在就中止；或先复制到临时目录、在副本上改名、最后整体替换。
   **改名/批量替换前先跑一次 `git add -A; git commit`，出问题直接 `git reset --hard` 就能回来。**
2. 改名后要同步四处：各页 `DS_PAGE.id`、`<script src>` 引用、`course.js` 的 `PAGES` 注册表、
   `tools/check.mjs` 的页面清单。

## 仓库身份配置

本仓库使用局部配置（不影响你机器上的其它仓库）：

```
user.name  = DS Courseware
user.email = courseware@local
core.autocrlf = true        # Windows 换行自动转换
```

想换成自己的名字：

```powershell
git config user.name "你的名字"
git config user.email "你的邮箱"
```
