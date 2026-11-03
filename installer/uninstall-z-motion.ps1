param([string]$SandboxRoot, [switch]$RestoreDeveloperSetting)

. (Join-Path $PSScriptRoot 'installer-common.ps1')
if (!$SandboxRoot) { Assert-PremiereClosed }
$extensionRoot = Get-ExtensionRoot -SandboxRoot $SandboxRoot
$destination = Assert-ContainedPath -Path (Join-Path $extensionRoot $script:ExtensionId) -Root $extensionRoot
if (!(Test-Path -LiteralPath $destination)) { Write-Output 'Z Motion is already uninstalled.'; return }
Assert-NoLinks -Path $destination
$statePath = Join-Path $destination '.z-motion-install.json'
if (!(Test-Path -LiteralPath $statePath)) { throw 'Refusing to remove a folder without a Z Motion ownership record.' }
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
if ($state.id -ne $script:ExtensionId -or [bool]$state.sandbox -ne [bool]$SandboxRoot) { throw 'The installation ownership record is invalid.' }
if (!$SandboxRoot -and $RestoreDeveloperSetting) {
    $current = Get-DeveloperSetting
    if ([string]$current.value -eq '1') { Restore-DeveloperSetting -Setting $state.developerSetting }
}
Remove-ContainedTree -Path $destination -Root $extensionRoot
Write-Output 'Z Motion uninstalled. Other extensions and browser preset data were preserved.'
if (!$SandboxRoot -and !$RestoreDeveloperSetting) { Write-Output 'The shared Adobe CEP developer setting was retained for other local extensions.' }
