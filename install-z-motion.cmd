@echo off
echo Z Motion local installer
echo This enables unsigned Adobe CEP extensions for your Windows user.
echo Close Premiere Pro before continuing.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-z-motion.ps1" -EnableUnsigned
if errorlevel 1 (echo Installation failed.) else (echo Installation complete.)
pause
