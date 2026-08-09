# 内容窗格调整 - XPI Beta 打包脚本
$ErrorActionPreference = "Stop"
$buildDir = $PSScriptRoot
$addonDir = Join-Path $buildDir "addon"
$manifest = Get-Content (Join-Path $addonDir "manifest.json") -Raw | ConvertFrom-Json
$xpi = Join-Path $buildDir ("itempaneorganizer-" + $manifest.version + ".xpi")
& py -3 (Join-Path $buildDir "pack_xpi.py") $addonDir $xpi
if ($LASTEXITCODE -ne 0) { throw "pack failed" }
Write-Output ("OK: " + $xpi + " (" + (Get-Item $xpi).Length + " bytes)")
