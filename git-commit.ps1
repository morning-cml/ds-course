#!/usr/bin/env pwsh
<#
.SYNOPSIS
  课件仓库的一键提交脚本：先跑校验，通过后提交并打标签。

.DESCRIPTION
  用法（在 家教 目录下执行）：
      .\git-commit.ps1 "第 12 讲动画重做"
      .\git-commit.ps1 "修右侧导航抖动" -SkipCheck        # 跳过校验（内容改动与代码无关时）
      .\git-commit.ps1 "调整样式" -NoTag                  # 不打标签
      .\git-commit.ps1 "试验性改动" -DryRun               # 只看会提交什么，不真提交

  行为：
    1. 先运行 node ds-course/tools/batch-check.mjs（结构 / 导航 / 动画逐帧 / C++ 编译 / 需求覆盖）
    2. 校验通过才提交；不通过则中止，避免把坏状态写进历史
    3. 提交信息自动带上时间戳，并打一个轻量标签（v0001、v0002 …），方便随时回退
#>
param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Message,
    [switch]$SkipCheck,
    [switch]$NoTag,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

# ---------- 0. 是否在 git 仓库里 ----------
if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
    Write-Host "✗ 当前目录不是 git 仓库：$repoRoot" -ForegroundColor Red
    exit 1
}

# ---------- 1. 有没有改动 ----------
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "没有需要提交的改动。" -ForegroundColor Yellow
    exit 0
}
Write-Host "检测到以下改动：" -ForegroundColor Cyan
$changes | ForEach-Object { "  $_" }

if ($DryRun) {
    Write-Host "`n（-DryRun：仅预览，未提交）" -ForegroundColor Yellow
    exit 0
}

# ---------- 2. 先校验，再提交 ----------
if (-not $SkipCheck) {
    $checkScript = Join-Path $repoRoot "ds-course\tools\batch-check.mjs"
    if (Test-Path $checkScript) {
        Write-Host "`n正在运行全量校验（结构 / 导航 / 动画逐帧 / C++ 编译 / 需求覆盖）…" -ForegroundColor Cyan
        & node $checkScript
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            Write-Host "`n✗ 校验未通过（退出码 $code），已中止提交。" -ForegroundColor Red
            Write-Host "  想强行提交请加 -SkipCheck；建议先修好问题再提交。" -ForegroundColor Yellow
            exit 1
        }
        Write-Host "✓ 校验全部通过" -ForegroundColor Green
    } else {
        Write-Host "! 找不到校验脚本，跳过校验：$checkScript" -ForegroundColor Yellow
    }
}

# ---------- 3. 提交 ----------
git add -A
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$subject = "$Message ($stamp)"
git commit -q -m $subject
if ($LASTEXITCODE -ne 0) { Write-Host "✗ 提交失败" -ForegroundColor Red; exit 1 }
$hash = (git rev-parse --short HEAD)
Write-Host "✓ 已提交：$hash  $subject" -ForegroundColor Green

# ---------- 4. 打标签（便于按版本号回退） ----------
if (-not $NoTag) {
    $n = (git tag --list "v*" | Measure-Object).Count + 1
    $tag = "v" + $n.ToString("0000")
    git tag -a $tag -m $subject 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "✓ 已打标签：$tag" -ForegroundColor Green }
}

# ---------- 5. 提示 ----------
Write-Host "`n当前历史（最近 8 条）：" -ForegroundColor Cyan
git log --oneline -8
Write-Host "`n回退方法：" -ForegroundColor Cyan
Write-Host "  撤销某个文件的改动 : git restore <文件>"
Write-Host "  回到上一个提交     : git reset --hard HEAD~1"
Write-Host "  回到某个标签       : git reset --hard <标签名>"
Write-Host "  看某次改了什么     : git show <提交号>"
