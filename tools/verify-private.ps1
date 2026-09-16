# verify-private.ps1 —— 确认私人材料在远端仓库里彻底不可读
$ErrorActionPreference = "Continue"
$repo = "morning-cml/ds-course"
$files = @("声明.txt", "家教计划.pdf")
$refs = @("main", "v0000", "v0005", "v0008", "aa36e58", "022df55", "f5c6b32", "55fc270", "6e3b935")

$bad = 0
$checked = 0
foreach ($ref in $refs) {
    foreach ($f in $files) {
        $checked++
        $url = "repos/$repo/contents/$f`?ref=$ref"
        $out = & gh api $url --jq .name 2>&1 | Out-String
        $out = $out.Trim()
        if ($out -match "Not Found|404|Git Repository is empty|No commit found") {
            Write-Host ("  OK   [{0,-8}] {1} 不可读" -f $ref, $f) -ForegroundColor Green
        } else {
            $bad++
            Write-Host ("  BAD  [{0,-8}] {1} —— 返回：{2}" -f $ref, $f, $out) -ForegroundColor Red
        }
    }
}
Write-Host ""
Write-Host "共检查 $checked 项，异常 $bad 项" -ForegroundColor Cyan
if ($bad -eq 0) { Write-Host "✓ 私人材料在远端任何 ref 下都读不到" -ForegroundColor Green }
