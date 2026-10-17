@echo off
rem Atalho para o start.ps1 (dá para clicar duas vezes). Repassa os parâmetros: start.cmd -Browser
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
