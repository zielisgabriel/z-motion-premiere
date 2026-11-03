param(
    [string]$SourcePath = (Join-Path $PSScriptRoot 'payload'),
    [string]$PremierePath = (Join-Path $env:ProgramFiles 'Adobe\Adobe Premiere Pro 2026'),
    [string]$SandboxRoot,
    [switch]$EnableUnsigned
)

. (Join-Path $PSScriptRoot 'installer-common.ps1')
$source = [IO.Path]::GetFullPath($SourcePath)
Assert-NoLinks -Path $source
$inventory = Get-Content -Raw -LiteralPath (Join-Path $source 'integrity.json') | ConvertFrom-Json
if ($inventory.id -ne $script:ExtensionId -or $inventory.product -ne 'Z Motion') { throw 'The payload is not a Z Motion release.' }
if (!$SandboxRoot) {
    if (!$EnableUnsigned) { throw 'This local release requires -EnableUnsigned to enable Adobe CEP unsigned extensions for the current user.' }
    Assert-PremiereClosed
    $premiereExe = Join-Path $PremierePath 'Adobe Premiere Pro.exe'
    $cepExe = Join-Path $PremierePath 'CEPHtmlEngine\CEPHtmlEngine.exe'
    if (!(Test-Path -LiteralPath $premiereExe) -or !(Test-Path -LiteralPath $cepExe)) { throw 'Adobe Premiere Pro 2026 with CEP 12 is required. Install it through your Adobe account, or provide -PremierePath.' }
    if ((Get-Item -LiteralPath $premiereExe).VersionInfo.FileMajorPart -ne 26) { throw 'This release supports Premiere Pro 2026 (26.x).' }
    if ((Get-Item -LiteralPath $cepExe).VersionInfo.FileMajorPart -ne 12) { throw 'This release requires Adobe CEP 12.' }
}
$paths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($file in $inventory.files) {
    if ($file.path -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._/-]*$' -or @($file.path.Split('/') | Where-Object { $_ -eq '..' -or $_ -eq '.' }).Count -gt 0) { throw 'Unsafe payload path.' }
    if (!$paths.Add($file.path)) { throw 'Unsafe duplicate payload path.' }
    $payloadFile = Assert-ContainedPath -Path (Join-Path $source $file.path) -Root $source
    if (!(Test-Path -LiteralPath $payloadFile -PathType Leaf) -or (Get-Sha256 -Path $payloadFile) -ne $file.sha256) { throw "Integrity check failed: $($file.path)" }
}
foreach ($required in @('index.html', 'CSXS/manifest.xml', 'host/z-motion-host.jsx', 'assets/z-motion.js')) {
    if (!$paths.Contains($required)) { throw "Integrity inventory is missing $required." }
}
$extensionRoot = Get-ExtensionRoot -SandboxRoot $SandboxRoot
New-Item -Path $extensionRoot -ItemType Directory -Force | Out-Null
if (((Get-Item -LiteralPath $extensionRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Unsafe installation root.' }
$destination = Assert-ContainedPath -Path (Join-Path $extensionRoot $script:ExtensionId) -Root $extensionRoot
$identifier = [guid]::NewGuid().ToString('N')
$staging = Assert-ContainedPath -Path (Join-Path $extensionRoot ('.z-motion-stage-' + $identifier)) -Root $extensionRoot
$backup = Assert-ContainedPath -Path (Join-Path $extensionRoot ('.z-motion-backup-' + $identifier)) -Root $extensionRoot
$state = @{ product = 'Z Motion'; id = $script:ExtensionId; version = $inventory.version; installedAt = [DateTime]::UtcNow.ToString('o'); sandbox = [bool]$SandboxRoot; developerSetting = @{ existed = $false; value = $null } }
if (!$SandboxRoot) { $state.developerSetting = Get-DeveloperSetting }
$settingBeforeRun = $state.developerSetting
if (Test-Path -LiteralPath $destination) {
    Assert-NoLinks -Path $destination
    $statePath = Join-Path $destination '.z-motion-install.json'
    if (!(Test-Path -LiteralPath $statePath)) { throw 'An unmanaged folder already exists at the Z Motion destination. Move it manually before installing.' }
    $previous = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
    if ($previous.id -ne $script:ExtensionId -or [bool]$previous.sandbox -ne [bool]$SandboxRoot) { throw 'The existing installation has an invalid ownership record.' }
    $state.installedAt = $previous.installedAt
    $state.developerSetting = $previous.developerSetting
}
$moved = $false
$activated = $false
try {
    New-Item -Path $staging -ItemType Directory | Out-Null
    foreach ($file in $inventory.files) {
        $target = Assert-ContainedPath -Path (Join-Path $staging $file.path) -Root $staging
        New-Item -Path (Split-Path -Parent $target) -ItemType Directory -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $source $file.path) -Destination $target
        if ((Get-Sha256 -Path $target) -ne $file.sha256) { throw "Integrity check failed after copy: $($file.path)" }
    }
    Copy-Item -LiteralPath (Join-Path $source 'integrity.json') -Destination $staging
    foreach ($scriptName in @('uninstall-z-motion.ps1', 'installer-common.ps1', 'uninstall-z-motion.cmd')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $scriptName) -Destination $staging }
    $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $staging '.z-motion-install.json') -Encoding UTF8
    if (Test-Path -LiteralPath $destination) { Move-Item -LiteralPath $destination -Destination $backup; $moved = $true }
    Move-Item -LiteralPath $staging -Destination $destination
    $activated = $true
    if (!$SandboxRoot) {
        New-Item -Path $script:DebugRegistryPath -Force | Out-Null
        New-ItemProperty -LiteralPath $script:DebugRegistryPath -Name PlayerDebugMode -PropertyType String -Value '1' -Force | Out-Null
    }
} catch {
    if ($activated) { Remove-ContainedTree -Path $destination -Root $extensionRoot }
    if ($moved) { Move-Item -LiteralPath $backup -Destination $destination }
    if (!$SandboxRoot) { Restore-DeveloperSetting -Setting $settingBeforeRun }
    throw
} finally {
    Remove-ContainedTree -Path $staging -Root $extensionRoot
}
if ($moved) { Remove-ContainedTree -Path $backup -Root $extensionRoot }
Write-Output "Z Motion $($inventory.version) installed at $destination"
Write-Output 'Open Premiere, then Window > Extensions > Z Motion. No Node.js, npm or separate font installation is required.'
