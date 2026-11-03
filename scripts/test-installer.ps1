Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path $projectRoot ('artifacts\installer-test-' + [guid]::NewGuid().ToString('N'))
$source = Join-Path $projectRoot 'dist'
$installer = Join-Path $projectRoot 'installer\install-z-motion.ps1'
$uninstaller = Join-Path $projectRoot 'installer\uninstall-z-motion.ps1'
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$sandbox = Join-Path $testRoot 'profile'
& $installer -SourcePath $source -SandboxRoot $sandbox
$installed = Join-Path $sandbox 'extensions\com.zielis.z-motion'
if (!(Test-Path -LiteralPath (Join-Path $installed 'CSXS\manifest.xml'))) { throw 'The extension manifest was not installed.' }
$firstState = Get-Content -Raw -LiteralPath (Join-Path $installed '.z-motion-install.json') | ConvertFrom-Json
& $installer -SourcePath $source -SandboxRoot $sandbox
$secondState = Get-Content -Raw -LiteralPath (Join-Path $installed '.z-motion-install.json') | ConvertFrom-Json
if ($firstState.installedAt -ne $secondState.installedAt) { throw 'Upgrade did not preserve the original installation state.' }
$neighbor = Join-Path $sandbox 'extensions\another-extension'
New-Item -ItemType Directory -Path $neighbor -Force | Out-Null
Set-Content -LiteralPath (Join-Path $neighbor 'keep.txt') -Value 'Keep this extension.'
& $uninstaller -SandboxRoot $sandbox
if (Test-Path -LiteralPath $installed) { throw 'Uninstall did not remove Z Motion.' }
if (!(Test-Path -LiteralPath (Join-Path $neighbor 'keep.txt'))) { throw 'Uninstall touched a neighboring extension.' }
& $uninstaller -SandboxRoot $sandbox
$tampered = Join-Path $testRoot 'tampered'
Copy-Item -LiteralPath $source -Destination $tampered -Recurse
Add-Content -LiteralPath (Join-Path $tampered 'index.html') -Value 'tampered'
$rejected = $false
try { & $installer -SourcePath $tampered -SandboxRoot $sandbox } catch { $rejected = $_.Exception.Message -like '*Integrity*' }
if (!$rejected) { throw 'Installer accepted a corrupted payload.' }
if (Test-Path -LiteralPath $installed) { throw 'A rejected installation left a destination behind.' }
$inventoryPath = Join-Path $tampered 'integrity.json'
$inventory = Get-Content -Raw -LiteralPath $inventoryPath | ConvertFrom-Json
$inventory.files[0].path = '../escape.txt'
$inventory | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $inventoryPath -Encoding UTF8
$rejected = $false
try { & $installer -SourcePath $tampered -SandboxRoot $sandbox } catch { $rejected = $_.Exception.Message -like '*Unsafe*' }
if (!$rejected) { throw 'Installer accepted a path traversal entry.' }
Write-Output 'PASS: install, upgrade, uninstall, repeated uninstall, neighboring extension preservation, corrupted payload rejection and path traversal rejection.'
