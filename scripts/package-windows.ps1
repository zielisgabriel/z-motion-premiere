Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $projectRoot 'installer\installer-common.ps1')
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$releaseRoot = Join-Path $projectRoot 'release'
New-Item -Path $releaseRoot -ItemType Directory -Force | Out-Null
$bundle = Assert-ContainedPath -Path (Join-Path $releaseRoot "z-motion-$version-windows") -Root $releaseRoot
Remove-ContainedTree -Path $bundle -Root $releaseRoot
New-Item -Path $bundle -ItemType Directory | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'dist') -Destination (Join-Path $bundle 'payload') -Recurse
foreach ($name in @('install-z-motion.ps1', 'uninstall-z-motion.ps1', 'installer-common.ps1', 'install-z-motion.cmd', 'uninstall-z-motion.cmd')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot "installer\$name") -Destination $bundle
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs') -Destination (Join-Path $bundle 'docs') -Recurse
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = Assert-ContainedPath -Path (Join-Path $releaseRoot "z-motion-$version-windows.zip") -Root $releaseRoot
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($bundle, $archive, [IO.Compression.CompressionLevel]::Optimal, $false)
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (!(Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is required to build the EXE installer.' }
Add-Type -AssemblyName System.Drawing
$original = [Drawing.Bitmap]::new((Join-Path $projectRoot 'public\images\icon.png'))
$bitmap = [Drawing.Bitmap]::new($original, [Drawing.Size]::new(64, 64))
$icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath = Join-Path $releaseRoot 'z-motion.ico'
$iconStream = [IO.File]::Create($iconPath)
try { $icon.Save($iconStream) } finally { $iconStream.Dispose(); $icon.Dispose(); $bitmap.Dispose(); $original.Dispose() }
$executable = Join-Path $releaseRoot "z-motion-$version-setup.exe"
& $compiler /nologo /target:winexe /optimize+ /platform:anycpu "/out:$executable" "/win32icon:$iconPath" "/resource:$archive,z-motion-package.zip" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $projectRoot 'installer\z-motion-setup.cs')
if ($LASTEXITCODE -ne 0) { throw 'Compiling the Windows installer failed.' }
$checksums = @()
foreach ($file in @($archive, $executable)) { $checksums += (Get-Sha256 -Path $file) + '  ' + [IO.Path]::GetFileName($file) }
$checksums | Set-Content -LiteralPath (Join-Path $releaseRoot 'sha256sums.txt') -Encoding ASCII
Write-Output "Created $executable and $archive"
