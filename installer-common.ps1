Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ExtensionId = 'com.zielis.z-motion'
$script:DebugRegistryPath = 'HKCU:\Software\Adobe\CSXS.12'

function Get-Sha256 {
    param([string]$Path)
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}

function Assert-ContainedPath {
    param([string]$Path, [string]$Root)
    $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $resolvedPath = [IO.Path]::GetFullPath($Path)
    if (!$resolvedPath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe path outside the installation root: $resolvedPath" }
    return $resolvedPath
}

function Assert-NoLinks {
    param([string]$Path)
    if (!(Test-Path -LiteralPath $Path)) { return }
    $pending = New-Object 'System.Collections.Generic.Stack[string]'
    $pending.Push($Path)
    while ($pending.Count -gt 0) {
        $current = Get-Item -LiteralPath $pending.Pop() -Force
        if (($current.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Unsafe symbolic link or junction: $($current.FullName)" }
        if ($current.PSIsContainer) {
            foreach ($entry in Get-ChildItem -LiteralPath $current.FullName -Force) { $pending.Push($entry.FullName) }
        }
    }
}

function Remove-ContainedTree {
    param([string]$Path, [string]$Root)
    $checkedPath = Assert-ContainedPath -Path $Path -Root $Root
    Assert-NoLinks -Path $checkedPath
    if (Test-Path -LiteralPath $checkedPath) { Remove-Item -LiteralPath $checkedPath -Recurse -Force }
}

function Get-ExtensionRoot {
    param([string]$SandboxRoot)
    if ($SandboxRoot) { return [IO.Path]::GetFullPath((Join-Path $SandboxRoot 'extensions')) }
    return Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Adobe\CEP\extensions'
}

function Get-DeveloperSetting {
    $key = Get-Item -LiteralPath $script:DebugRegistryPath -ErrorAction SilentlyContinue
    $exists = $null -ne $key -and $key.GetValueNames() -contains 'PlayerDebugMode'
    $value = $null
    if ($exists) { $value = $key.GetValue('PlayerDebugMode') }
    return @{ existed = $exists; value = $value }
}

function Restore-DeveloperSetting {
    param($Setting)
    if ($Setting.existed) {
        New-Item -Path $script:DebugRegistryPath -Force | Out-Null
        New-ItemProperty -LiteralPath $script:DebugRegistryPath -Name PlayerDebugMode -PropertyType String -Value ([string]$Setting.value) -Force | Out-Null
    } elseif (Test-Path -LiteralPath $script:DebugRegistryPath) {
        Remove-ItemProperty -LiteralPath $script:DebugRegistryPath -Name PlayerDebugMode -ErrorAction SilentlyContinue
    }
}

function Assert-PremiereClosed {
    if (Get-Process -Name 'Adobe Premiere Pro' -ErrorAction SilentlyContinue) { throw 'Close Adobe Premiere Pro before installing or uninstalling Z Motion.' }
}
