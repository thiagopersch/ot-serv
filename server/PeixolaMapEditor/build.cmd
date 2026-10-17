@echo off
rem Compila o PeixolaMapEditor e atualiza PeixolaMapEditor.exe nesta pasta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
pause
