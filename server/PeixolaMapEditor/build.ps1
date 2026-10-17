# Compila o PeixolaMapEditor em modo release (otimizado) e copia o executavel para esta pasta.
$ErrorActionPreference = "Stop"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
Set-Location $PSScriptRoot
cargo build --release
Copy-Item "$PSScriptRoot\target\release\PeixolaMapEditor.exe" "$PSScriptRoot\PeixolaMapEditor.exe" -Force
Write-Host "Executavel: $PSScriptRoot\PeixolaMapEditor.exe"
