# 课件仓库 · 使用说明

这是一个 git 仓库，用来给《数据结构与算法设计》课件做版本管理。
**每次更新都提交一次**，改错了可以随时回退。

## 目录

```
家教/                     ← 仓库根目录
├── .git/                 git 数据（不要手动删）
├── .gitignore            忽略规则
├── git-commit.ps1        一键提交脚本（先校验，后提交）
├── GIT-使用说明.md        本文件
├── 声明.txt
├── 家教计划.pdf
└── ds-course/            课件本体（15 讲 + assets + tools）
```

## 远端仓库

已推送到 GitHub：**https://github.com/morning-cml/ds-course**（public）

- 当前状态：**52 个文件已入库**，标签 `v0000`（课件完整版）→ `v0001` → `v0002` → `v0003` → `v0004` → `v0005`（配置远端）→ `v0006`（仓库主页 README），**全部已推送**
- `origin` = `https://github.com/morning-cml/ds-course.git`，`main` 已跟踪 `origin/main`
- 本地与远端 HEAD 一致（`f5c6b32`）

## 一键提交 + 推送（推荐）

在 `家教` 目录下打开 PowerShell：

```powershell
.\git-commit.ps1 "说明这次改了什么" -Push
```

它会：
1. 先跑一遍全量校验（结构 / 导航链 / 动画逐帧渲染 / C++ 代码编译 / 需求覆盖）；
2. **校验不通过就中止**，不把坏状态写进历史；
3. 通过后提交，并自动打标签 `v0007`、`v0008`…（方便按版本回退）；
4. `-Push` 会把提交和标签一起推到 GitHub。

常用参数：

| 参数 | 用途 |
|---|---|
| `-Push` | 提交后自动推送到 GitHub（含标签） |
| `-SkipCheck` | 跳过校验（例如只改了 PDF、和课件代码无关时） |
| `-NoTag` | 本次不打标签 |
| `-DryRun` | 只看会提交哪些文件，不真提交 |

### 关于推送的一个环境说明

我在这个受限沙箱里执行 `git push` 时，git 的 schannel 后端会因为拿不到 Windows 证书/密钥存储而报
`SEC_E_NO_CREDENTIALS`，**每次都需要单独提权批准**才能推送。

**你自己在普通 PowerShell 窗口里推送不会有这个问题**（`-Push` 直接可用）。
所以以后可以这样分工：

- 我负责改课件 + 本地提交（`git-commit.ps1 "说明"`，不带 `-Push`）；
- 你随手补一句 `.\git-commit.ps1 "说明" -Push`，或在终端里执行 `git push origin main --tags`。

## 手动提交 / 推送（不用脚本也行）

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

## 私人材料：只在本地，绝不入库

`声明.txt` 与 `家教计划.pdf` **已加入 `.gitignore`**，不会被提交、也不会被推送。
文件本体仍然在你本地（和以前一样能打开），只是不进版本控制。

> 教训：建仓时我把整个目录都纳入了版本控制，而仓库是**公开**的，这两个私人材料就一起被推上去了。
> 正确做法是**建公开仓库前先确认哪些文件不该公开**，或建仓时就把课程无关的个人材料排除。

### 万一以后又不小心提交了私人文件，处理步骤

```powershell
# 1) 从所有历史提交里移除（本仓库自带工具，纯 git 命令实现，不依赖 sh.exe）
.\tools\scrub.ps1 -Paths "要删的文件" -Apply

# 2) 清理引用日志与不可达对象，否则旧提交还在本地
git update-ref -d refs/remotes/origin/main     # 远端跟踪引用会"吊住"旧历史
git reflog expire --expire=now --expire-unreachable=now --all
git gc --prune=now

# 3) 强制推送覆盖远端
git push --force origin main
git push --force --tags origin
```

**注意**：强推只能改掉"引用"，GitHub 上的旧对象在一段时间内**仍能通过具体 commit SHA 读到**。
要立刻消除这个窗口，最可靠的是**删库重建**：

```powershell
gh auth refresh -h github.com -s delete_repo   # 需要 delete_repo 权限，只做一次
gh repo delete <账号>/<仓库> --yes
gh repo create <仓库> --public --description "..."
git push -u origin main; git push --tags origin
```

本仓库已经走过一遍这个流程，并用 `tools\verify-private.ps1` 逐项验证过
（在 main、各标签、以及多个旧 SHA 下都读不到私人文件）。

## 两条经验（本仓库踩过的坑）

1. **批量改名千万不要用会静默覆盖的方式**（`fs.renameSync`、`mv`）。
   链式改名（`ch01→ch02`、`ch02→ch03`…）会互相覆盖、成批丢文件。
   正确做法：先检测目标是否存在 → 存在就中止；或先复制到临时目录、在副本上改名、最后整体替换。
   **改名/批量替换前先 `.\git-commit.ps1 "改名前存档"`，出问题直接 `git reset --hard` 就能回来。**
2. 改名后要同步四处：各页 `DS_PAGE.id`、`<script src>` 引用、`course.js` 的 `PAGES` 注册表、
   `tools/check.mjs` 的页面清单。

## 两个技术细节（避免以后再踩）

- **`.ps1` 脚本必须保存为「UTF-8 带 BOM」**。Windows PowerShell 5.1 会把无 BOM 的 UTF-8 当成本地
  代码页（GBK）读取，脚本里的中文会变成乱码、字符串甚至被截断导致语法错误。
  `git-commit.ps1` 已带 BOM（文件头 `EF BB BF`）。如果以后用编辑器另存，请确认保留 BOM。
- 本仓库 `core.autocrlf = true`（Windows 常规设置，入库统一存 CRLF、工作区也是 CRLF），
  所以不会出现"什么都没改却显示被修改"的情况。

## 备份建议

目前是**纯本地仓库**，没有远程。`.git` 就在 `家教` 目录里，如果整个目录被误删就全没了。
建议二选一：

1. **定期打包备份**：把整个 `家教` 目录（含 `.git`）复制到网盘 / U 盘 / 另一个盘；
2. **加一个远程仓库**（GitHub / Gitee / 自建均可）：

```powershell
git remote add origin <你的仓库地址>
git push -u origin main --tags
```

之后每次提交完 `git push --tags` 即可。因为我是在你的机器上直接操作本地仓库，
**创建远程仓库并推送需要你自己授权**（要账号凭据），这一步我没有代做。

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
