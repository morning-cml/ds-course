# scrub.ps1 —— 从 git 历史的每个提交中彻底移除指定文件
#
# 为什么不用 git filter-branch：它依赖 sh.exe，本机受限沙箱禁止创建命名管道
# （"couldn't create signal pipe, Win32 error 5"），必然失败。
#
# 做法（纯 git 原生命令，不经过 shell，也不改动工作区文件）：
#   对每个提交：read-tree 把它的树读进临时索引
#              → 只对要删的文件执行 update-index --force-remove
#              → write-tree 得到新树
#              → commit-tree 按原作者/时间/信息重建提交
#   不整表重建索引，所以不需要 --index-info（它要求重定向必须是最后一个参数，
#   PowerShell 里无法满足），也不受管道 UTF-16 转码影响。
#
# 用法： .\tools\scrub.ps1 -Paths "声明.txt","家教计划.pdf"           # 预览
#        .\tools\scrub.ps1 -Paths "声明.txt","家教计划.pdf" -Apply    # 执行

param(
    [Parameter(Mandatory = $true)][string[]]$Paths,
    [switch]$Apply,
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Set-Location $RepoRoot

function GitText {
    param([string[]]$cmdArgs)
    (& git @cmdArgs | Out-String).Trim()
}
function GitLines {
    param([string[]]$cmdArgs)
    $o = & git @cmdArgs
    @($o | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -ne "" })
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tmpIndex = Join-Path $RepoRoot ".git\_scrub_index"
$msgFile = Join-Path $RepoRoot ".git\_scrub_msg"
$env:GIT_INDEX_FILE = $tmpIndex

$revs = GitLines @("rev-list", "--topo-order", "--reverse", "--all")
Write-Host "共 $($revs.Count) 个提交需要检查" -ForegroundColor Cyan

$map = @{}
$rewritten = 0
$reused = 0
$removedTotal = 0

foreach ($rev in $revs) {
    $parts = @((GitText @("rev-list", "--parents", "-n", "1", $rev)) -split " " | Where-Object { $_ })
    $parents = @($parts | Select-Object -Skip 1)
    $newParents = @($parents | ForEach-Object { if ($map.ContainsKey($_)) { $map[$_] } else { $_ } })

    $treeAll = GitLines @("ls-tree", "-r", "--name-only", $rev)
    $present = @($Paths | Where-Object { $treeAll -contains $_ })
    $removedTotal += $present.Count

    if ($present.Count -eq 0 -and (($newParents -join " ") -eq ($parents -join " "))) {
        $map[$rev] = $rev
        $reused++
        continue
    }

    if (Test-Path $tmpIndex) { Remove-Item $tmpIndex -Force }
    & git read-tree $rev
    if ($LASTEXITCODE -ne 0) { throw "read-tree 失败（提交 $rev）" }
    foreach ($f in $present) {
        & git update-index --force-remove -- $f
        if ($LASTEXITCODE -ne 0) { throw "force-remove 失败：$f（提交 $rev）" }
    }
    $tree = GitText @("write-tree")
    if (-not $tree) { throw "write-tree 失败（提交 $rev）" }

    $msg = (& git log -1 --format=%B $rev | Out-String).TrimEnd()
    [System.IO.File]::WriteAllText($msgFile, $msg, $utf8NoBom)
    $env:GIT_AUTHOR_NAME = GitText @("log", "-1", "--format=%an", $rev)
    $env:GIT_AUTHOR_EMAIL = GitText @("log", "-1", "--format=%ae", $rev)
    $env:GIT_AUTHOR_DATE = GitText @("log", "-1", "--format=%aI", $rev)
    $env:GIT_COMMITTER_NAME = GitText @("log", "-1", "--format=%cn", $rev)
    $env:GIT_COMMITTER_EMAIL = GitText @("log", "-1", "--format=%ce", $rev)
    $env:GIT_COMMITTER_DATE = GitText @("log", "-1", "--format=%cI", $rev)

    $ctArgs = @("commit-tree", $tree)
    foreach ($p in $newParents) { $ctArgs += @("-p", $p) }
    $ctArgs += @("-F", $msgFile)
    $newRev = GitText $ctArgs
    if (-not $newRev) { throw "commit-tree 失败（提交 $rev）" }

    $map[$rev] = $newRev
    $rewritten++
    Write-Host ("  {0} -> {1}   删掉 {2} 个：{3}" -f $rev.Substring(0,7), $newRev.Substring(0,7), $present.Count, ($present -join ", "))
}

foreach ($tmp in @($tmpIndex, $msgFile)) { if (Test-Path $tmp) { Remove-Item $tmp -Force } }
Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "重写 $rewritten 个提交，复用 $reused 个，共移除 $removedTotal 个文件条目" -ForegroundColor Green
$headOld = GitText @("rev-parse", "HEAD")
$headNew = $map[$headOld]
Write-Host "新 HEAD: $($headNew.Substring(0,7))"

if (-not $Apply) {
    Write-Host "（预览模式：新对象已生成，引用尚未改动。加 -Apply 才真正改写）" -ForegroundColor Yellow
    exit 0
}

foreach ($b in (GitLines @("for-each-ref", "--format=%(refname)", "refs/heads"))) {
    $old = GitText @("rev-parse", $b)
    if ($map.ContainsKey($old) -and $map[$old] -ne $old) {
        & git update-ref $b $map[$old]
        Write-Host "分支 $b -> $($map[$old].Substring(0,7))"
    }
}

foreach ($line in (GitLines @("for-each-ref", "--format=%(refname)|%(contents:subject)", "refs/tags"))) {
    $pair = $line -split "\|", 2
    $ref = $pair[0]
    $subject = if ($pair.Count -gt 1) { $pair[1] } else { $ref }
    $c = GitText @("rev-parse", "$ref^{commit}")
    if ($c -and $map.ContainsKey($c)) {
        & git tag -f -a ($ref -replace "^refs/tags/", "") -m $subject $map[$c] | Out-Null
    }
}

Write-Host ""
Write-Host "完成：分支与标签已指向清理后的历史。工作区文件没有被删除。" -ForegroundColor Green
