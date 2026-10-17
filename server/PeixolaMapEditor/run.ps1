# Compila (se necessario), atualiza .\PeixolaMapEditor.exe e abre o editor. Uso: .\run.ps1 [caminho\do\mapa.otbm]
$ErrorActionPreference = "Stop"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
Set-Location $PSScriptRoot
cargo build --release
$exe = "$PSScriptRoot\PeixolaMapEditor.exe"
Copy-Item "$PSScriptRoot\target\release\PeixolaMapEditor.exe" $exe -Force
if ($args.Count -gt 0) { Start-Process $exe -ArgumentList ('"' + (Resolve-Path $args[0]) + '"') } else { Start-Process $exe }
