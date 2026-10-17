@echo off
rem Compila (se necessario) e abre o PeixolaMapEditor. Uso: run.cmd [mapa.otbm]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
