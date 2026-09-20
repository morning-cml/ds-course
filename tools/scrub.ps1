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
    [Parameter(Mandatory = $true)][string[]]$Paths,      # 要从历史里彻底抹掉的仓库相对路径（可多个）
    [switch]$Apply,                                      # 不加则只预览（生成新对象但不改引用）
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path   # 仓库根，默认本脚本的上一级
)

$ErrorActionPreference = "Stop"
Set-Location $RepoRoot

# 两个 git 输出助手：GitText 把输出合成一整段字符串，GitLines 拆成去掉空行的字符串数组
function GitText {
    param([string[]]$cmdArgs)                            # $cmdArgs = git 的子命令与参数
    (& git @cmdArgs | Out-String).Trim()
}
function GitLines {
    param([string[]]$cmdArgs)
    $o = & git @cmdArgs
    @($o | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -ne "" })
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)   # 写提交信息用「UTF-8 无 BOM」
$tmpIndex = Join-Path $RepoRoot ".git\_scrub_index"        # 临时索引文件（不碰正常工作区的索引）
$msgFile = Join-Path $RepoRoot ".git\_scrub_msg"           # 暂存每个提交的原始信息
$env:GIT_INDEX_FILE = $tmpIndex                            # 让后续所有 git 命令改用这个临时索引

# $revs —— 所有分支/标签可达的提交，按拓扑序「从旧到新」排列（重写必须按这个顺序）
$revs = GitLines @("rev-list", "--topo-order", "--reverse", "--all")
Write-Host "共 $($revs.Count) 个提交需要检查" -ForegroundColor Cyan

$map = @{}                 # 旧提交 SHA → 新提交 SHA（未改动过的映射到自身）
$rewritten = 0             # 真正重建过的提交数
$reused = 0                # 不含目标文件、原样复用的提交数
$removedTotal = 0          # 累计移除的文件条目数

foreach ($rev in $revs) {
    # 取该提交的父提交，并把父提交也换成重写后的新 SHA（这样历史才连得上）
    $parts = @((GitText @("rev-list", "--parents", "-n", "1", $rev)) -split " " | Where-Object { $_ })
    $parents = @($parts | Select-Object -Skip 1)          # 第 1 个是提交自身，父提交在后面
    $newParents = @($parents | ForEach-Object { if ($map.ContainsKey($_)) { $map[$_] } else { $_ } })

    $treeAll = GitLines @("ls-tree", "-r", "--name-only", $rev)      # 该提交的完整文件清单
    $present = @($Paths | Where-Object { $treeAll -contains $_ })    # 其中命中「要删的文件」的那些
    $removedTotal += $present.Count

    # 这个提交既不含目标文件、父提交也没被改写过 → 原样复用，不必重建
    if ($present.Count -eq 0 -and (($newParents -join " ") -eq ($parents -join " "))) {
        $map[$rev] = $rev
        $reused++
        continue
    }

    if (Test-Path $tmpIndex) { Remove-Item $tmpIndex -Force }
    & git read-tree $rev                                  # 把该提交的树读进临时索引
    if ($LASTEXITCODE -ne 0) { throw "read-tree 失败（提交 $rev）" }
    foreach ($f in $present) {
        & git update-index --force-remove -- $f            # 只从索引里摘掉这几个文件
        if ($LASTEXITCODE -ne 0) { throw "force-remove 失败：$f（提交 $rev）" }
    }
    $tree = GitText @("write-tree")                        # 写出不含这些文件的新树
    if (-not $tree) { throw "write-tree 失败（提交 $rev）" }

    # 用**原作者/原时间/原提交信息**重建提交，这样除了被删的文件，历史面貌完全不变
    $msg = (& git log -1 --format=%B $rev | Out-String).TrimEnd()
    [System.IO.File]::WriteAllText($msgFile, $msg, $utf8NoBom)
    $env:GIT_AUTHOR_NAME = GitText @("log", "-1", "--format=%an", $rev)
    $env:GIT_AUTHOR_EMAIL = GitText @("log", "-1", "--format=%ae", $rev)
    $env:GIT_AUTHOR_DATE = GitText @("log", "-1", "--format=%aI", $rev)
    $env:GIT_COMMITTER_NAME = GitText @("log", "-1", "--format=%cn", $rev)
    $env:GIT_COMMITTER_EMAIL = GitText @("log", "-1", "--format=%ce", $rev)
    $env:GIT_COMMITTER_DATE = GitText @("log", "-1", "--format=%cI", $rev)

    $ctArgs = @("commit-tree", $tree)                      # 组装 commit-tree 的命令行
    foreach ($p in $newParents) { $ctArgs += @("-p", $p) }
    $ctArgs += @("-F", $msgFile)
    $newRev = GitText $ctArgs
    if (-not $newRev) { throw "commit-tree 失败（提交 $rev）" }

    $map[$rev] = $newRev
    $rewritten++
    Write-Host ("  {0} -> {1}   删掉 {2} 个：{3}" -f $rev.Substring(0,7), $newRev.Substring(0,7), $present.Count, ($present -join ", "))
}

# 收尾：删临时文件、清环境变量
foreach ($tmp in @($tmpIndex, $msgFile)) { if (Test-Path $tmp) { Remove-Item $tmp -Force } }
Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "重写 $rewritten 个提交，复用 $reused 个，共移除 $removedTotal 个文件条目" -ForegroundColor Green
$headOld = GitText @("rev-parse", "HEAD")                  # HEAD 改写前后的 SHA，便于确认
$headNew = $map[$headOld]
Write-Host "新 HEAD: $($headNew.Substring(0,7))"

if (-not $Apply) {
    Write-Host "（预览模式：新对象已生成，引用尚未改动。加 -Apply 才真正改写）" -ForegroundColor Yellow
    exit 0
}

# 把分支引用指到重写后的提交（只有真正被改写的才需要动）
foreach ($b in (GitLines @("for-each-ref", "--format=%(refname)", "refs/heads"))) {
    $old = GitText @("rev-parse", $b)
    if ($map.ContainsKey($old) -and $map[$old] -ne $old) {
        & git update-ref $b $map[$old]
        Write-Host "分支 $b -> $($map[$old].Substring(0,7))"
    }
}

# 标签同理：逐行解析出「标签名|标题」，把指向被改写提交的标签重新打到新提交上（-f 强制覆盖）
foreach ($line in (GitLines @("for-each-ref", "--format=%(refname)|%(contents:subject)", "refs/tags"))) {
    $pair = $line -split "\|", 2                  # 只按第一个 | 切，标题里可能还有 |
    $ref = $pair[0]                               # 如 refs/tags/v0003
    $subject = if ($pair.Count -gt 1) { $pair[1] } else { $ref }   # 标签信息（沿用原标题）
    $c = GitText @("rev-parse", "$ref^{commit}")  # 该标签指向的提交
    if ($c -and $map.ContainsKey($c)) {
        & git tag -f -a ($ref -replace "^refs/tags/", "") -m $subject $map[$c] | Out-Null
    }
}

Write-Host ""
Write-Host "完成：分支与标签已指向清理后的历史。工作区文件没有被删除。" -ForegroundColor Green
