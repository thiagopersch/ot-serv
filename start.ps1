<#
  Sobe o projeto no Docker (db -> site -> servidor), abre o cliente e mostra os logs de tudo.

  .\start.ps1            abre o cliente nativo (cliente\otclient_dx.exe)
  .\start.ps1 -Browser   abre o cliente do Docker no navegador (http://localhost:6080)
  .\start.ps1 -NoBuild   não recompila as imagens (sobe mais rápido)

  Ctrl+C para de mostrar os logs; os containers continuam rodando.
  Para parar tudo: docker compose --profile client down   (nunca use -v: apaga o banco)
#>
param(
    [switch]$Browser,
    [switch]$NoBuild,
    [int]$TimeoutMinutes = 10
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host '.env criado a partir do .env.example'
}

$profileArgs = @()
if ($Browser) { $profileArgs = @('--profile', 'client') }

Step 'Subindo containers (db -> site -> servidor)...'
$upArgs = @('compose') + $profileArgs + @('up', '-d')
if (-not $NoBuild) { $upArgs += '--build' }
& docker @upArgs
if ($LASTEXITCODE -ne 0) { throw 'docker compose up falhou (veja a saída acima).' }

Step 'Aguardando o servidor ficar online...'
$started = (docker inspect -f '{{.State.StartedAt}}' ndbo-server).Trim()
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while ($true) {
    $log = docker logs --since $started ndbo-server 2>&1 | Out-String
    if ($log -match 'servidor Online') { break }
    if ((docker inspect -f '{{.State.Running}}' ndbo-server).Trim() -ne 'true') {
        docker logs --tail 40 ndbo-server
        throw 'O container do servidor parou. Veja o log acima.'
    }
    if ((Get-Date) -gt $deadline) {
        docker logs --tail 40 ndbo-server
        throw "O servidor não ficou online em $TimeoutMinutes min."
    }
    Start-Sleep -Seconds 2
}
Write-Host 'Servidor online.' -ForegroundColor Green

$clientLog = Join-Path $PSScriptRoot 'cliente\WodBleach.log'
if ($Browser) {
    Step 'Abrindo o cliente no navegador...'
    Start-Process 'http://localhost:6080/vnc.html?autoconnect=1&resize=scale'
} else {
    Step 'Abrindo cliente\otclient_dx.exe...'
    Start-Process -FilePath (Join-Path $PSScriptRoot 'cliente\otclient_dx.exe') -WorkingDirectory (Join-Path $PSScriptRoot 'cliente')
}

Step 'Logs (Ctrl+C para sair; os containers continuam rodando)'
$jobs = @()
$jobs += Start-Job -ArgumentList $PSScriptRoot, $profileArgs -ScriptBlock {
    param($dir, $profileArgs)
    # lê a saída do docker como UTF-8 (o PowerShell 5.1 decodificaria como ANSI e quebraria acentos)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'docker'
    $psi.Arguments = ((@('compose') + $profileArgs + @('logs', '-f', '--tail', '50')) -join ' ')
    $psi.WorkingDirectory = $dir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
    $proc = [System.Diagnostics.Process]::Start($psi)
    try {
        while ($null -ne ($line = $proc.StandardOutput.ReadLine())) { $line }
    } finally {
        if (-not $proc.HasExited) { $proc.Kill() }
    }
}
if (-not $Browser) {
    $jobs += Start-Job -ArgumentList $clientLog -ScriptBlock {
        param($file)
        while (-not (Test-Path $file)) { Start-Sleep -Milliseconds 500 }
        Get-Content -Path $file -Wait -Tail 0 | ForEach-Object { "client-exe    | $_" }
    }
}

try {
    while ($true) {
        foreach ($line in ($jobs | Receive-Job)) { Write-Host $line }
        Start-Sleep -Milliseconds 300
    }
} finally {
    $jobs | Stop-Job -ErrorAction SilentlyContinue
    $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
    Write-Host "`nLogs encerrados. Os containers continuam rodando." -ForegroundColor Yellow
    Write-Host 'Parar tudo: docker compose --profile client down   (sem -v)'
}
