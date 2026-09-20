#requires -Version 5.1
<#
  课件仓库的一键提交脚本：先校验，通过后再提交并打标签。

  用法（在 家教 目录下执行）：
      .\git-commit.ps1 "第 12 讲动画重做"
      .\git-commit.ps1 "第 12 讲动画重做" -Push      # 提交后顺便推到 GitHub
      .\git-commit.ps1 "只改了 PDF" -SkipCheck      # 跳过校验
      .\git-commit.ps1 "调整样式" -NoTag            # 本次不打标签
      .\git-commit.ps1 "试验性改动" -DryRun         # 只看会提交什么

  行为：
    1. 运行 node ds-course/tools/batch-check.mjs（结构 / 导航 / 动画逐帧 / C++ 编译 / 需求覆盖）
    2. 校验不通过就中止，不把坏状态写进历史
    3. 通过后提交，提交信息自动带时间戳，并打标签 v0001、v0002 …（便于按版本回退）
    4. 带 -Push 时，提交完自动推到 origin（含标签）

  注意：本文件必须保存为「UTF-8 带 BOM」，否则 Windows PowerShell 5.1 会把中文读成乱码。
#>
param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Message,
    [switch]$SkipCheck,
    [switch]$NoTag,
    [switch]$DryRun,
    [switch]$Push
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot          # 本脚本所在目录 = 仓库根（家教/）；后面所有路径都从它拼
Set-Location $repoRoot

# 四个带颜色的输出助手，只是为了在终端里一眼分清「信息 / 成功 / 失败 / 警告」
function Info($t) { Write-Host $t -ForegroundColor Cyan }
function Good($t) { Write-Host $t -ForegroundColor Green }
function Bad($t)  { Write-Host $t -ForegroundColor Red }
function Warn($t) { Write-Host $t -ForegroundColor Yellow }

# ---------- 0. 检查仓库 ----------
if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
    Bad "当前目录不是 git 仓库：$repoRoot"
    exit 1
}

# ---------- 1. 有没有改动 ----------
# $changes —— `git status --porcelain` 的每一行（形如 " M ds-course/xxx.html"），空数组表示工作区干净
$changes = @(git status --porcelain)
if ($changes.Count -eq 0) {
    Warn "没有需要提交的改动。"
    exit 0
}
Info "检测到以下改动："
$changes | ForEach-Object { "  $_" }

if ($DryRun) {
    Warn "（-DryRun：仅预览，未提交）"
    exit 0
}

# ---------- 2. 先校验，再提交 ----------
# 这一步是「不把坏状态写进历史」的关键：batch-check 不过就直接退出，绝不提交
if (-not $SkipCheck) {
    $checkScript = Join-Path $repoRoot "ds-course\tools\batch-check.mjs"   # 八项全量校验的入口
    if (Test-Path $checkScript) {
        Info "`n正在运行全量校验（结构 / 导航 / 动画逐帧 / 帧状态 / 状态类 / C++ 编译 / 需求覆盖 / 交叉引用 / 公开数字）…"
        & node $checkScript
        if ($LASTEXITCODE -ne 0) {
            Bad "`n校验未通过（退出码 $LASTEXITCODE），已中止提交。"
            Warn "  确认无关可加 -SkipCheck 强行提交；否则建议先修好问题。"
            exit 1
        }
        Good "校验全部通过"
    } else {
        Warn "找不到校验脚本，跳过校验：$checkScript"
    }
}

# ---------- 3. 提交 ----------
git add -A
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"   # 时间戳，附加到提交信息末尾，便于看历史时定位
$subject = "$Message ($stamp)"                 # 最终的提交信息
git commit -q -m $subject
if ($LASTEXITCODE -ne 0) { Bad "提交失败"; exit 1 }
$hash = (git rev-parse --short HEAD)           # 新提交的短哈希，打印出来方便回退时引用
Good "已提交：$hash  $subject"

# ---------- 4. 打标签（取现有最大编号 +1，避免跳号或重号） ----------
if (-not $NoTag) {
    $existing = @(git tag --list "v[0-9][0-9][0-9][0-9]")   # 已有的 vNNNN 标签
    $max = -1                                              # 当前最大编号；-1 表示还没有任何 vNNNN 标签
    foreach ($t in $existing) {
        $s = "$t".Trim()                                   # 去掉可能的空白
        $num = 0                                           # TryParse 的输出参数
        if ($s.Length -ge 2 -and [int]::TryParse($s.Substring(1), [ref]$num)) {
            if ($num -gt $max) { $max = $num }
        }
    }
    $tag = "v" + ($max + 1).ToString("0000")               # 本次要打的标签，如 v0032
    Info "现有 $($existing.Count) 个标签，最大编号 v$($max.ToString('0000'))，本次使用 $tag"
    git tag -a $tag -m $subject                            # 附注标签（-a），信息与提交一致
    if ($LASTEXITCODE -eq 0) { Good "已打标签：$tag" } else { Warn "打标签失败：$tag" }
}

# ---------- 5. 推送到 GitHub ----------
if ($Push) {
    if (@(git remote).Count -eq 0) {
        Warn "没有配置远端，跳过推送。可先执行：git remote add origin <仓库地址>"
    } else {
        Info "`n正在推送到 origin…"
        git push origin HEAD --tags                        # 分支与标签一起推；标签要单独带 --tags
        if ($LASTEXITCODE -eq 0) { Good "已推送（含标签）" } else { Warn "推送失败，本地提交仍然安全，稍后可重试 git push" }
    }
}

# ---------- 6. 提示 ----------
Info "`n最近 8 条提交："
git log --oneline -8
Info "`n回退方法："
Write-Host "  撤销某文件未提交的改动 : git restore <文件>"
Write-Host "  丢弃全部未提交改动     : git restore ."
Write-Host "  回到上一个提交         : git reset --hard HEAD~1"
Write-Host "  回到某个标签           : git reset --hard <标签>"
Write-Host "  从旧版本捞回单个文件   : git checkout <标签> -- <文件路径>"
Write-Host "  看某次改了什么         : git show <提交号>"
