param([string]$Source = 'F:\zotero插件\内容窗格调整\addon\content\scripts\addon.js')
$nodePath = (Get-Command node -ErrorAction Stop).Source
$full = (Resolve-Path $Source).Path
& $nodePath --check $full
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "OK: JavaScript syntax"
