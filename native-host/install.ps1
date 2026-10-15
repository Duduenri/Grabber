$ErrorActionPreference = 'Stop'

$HostName = 'com.grabber.host'
$ExtensionId = 'cmjilacbcoijmjemgcjpmbndepbibjje'
$FirefoxId = 'grabber@duduenri'
$HostDir = $PSScriptRoot

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $links = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links'
  $env:Path = (@($machine, $user, $links) | Where-Object { $_ }) -join ';'
}

function Has-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike '*\WindowsApps\*' })
}

function Install-Package($id, $label) {
  Write-Host "Instalando $label..." -ForegroundColor Cyan
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { Write-Host "  winget terminou com codigo $LASTEXITCODE ao instalar $label" -ForegroundColor Yellow }
  Refresh-Path
}

function Find-Python {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    try {
      $exe = (& py -3 -c 'import sys; print(sys.executable)' 2>$null)
      if ($LASTEXITCODE -eq 0 -and $exe -and (Test-Path $exe.Trim())) { return $exe.Trim() }
    } catch {
      Write-Host "  py nao respondeu: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
  $python = Get-Command python -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike '*\WindowsApps\*' } | Select-Object -First 1
  if ($python) { return $python.Source }
  $local = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python3*\python.exe') -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($local) { return $local.FullName }
  return $null
}

function Write-Json($path, $data) {
  [IO.File]::WriteAllText($path, ($data | ConvertTo-Json -Depth 3))
}

Write-Host ''
Write-Host '=== Grabber: instalando o suporte ao YouTube ===' -ForegroundColor Green
Write-Host ''

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host 'O winget nao foi encontrado. Atualize o "Instalador de Aplicativo" pela Microsoft Store e rode de novo.' -ForegroundColor Red
  exit 1
}

Refresh-Path
if (-not (Find-Python)) { Install-Package 'Python.Python.3.12' 'Python' }
if (-not (Has-Command 'yt-dlp')) { Install-Package 'yt-dlp.yt-dlp' 'yt-dlp' }
if (-not (Has-Command 'ffmpeg')) { Install-Package 'Gyan.FFmpeg' 'ffmpeg' }
if (-not (Has-Command 'deno') -and -not (Has-Command 'node')) { Install-Package 'DenoLand.Deno' 'Deno' }

$PythonExe = Find-Python
if (-not $PythonExe) {
  Write-Host 'Nao consegui achar o Python depois de instalar. Reinicie o computador e rode de novo.' -ForegroundColor Red
  exit 1
}

$Launcher = Join-Path $HostDir 'run.bat'
$batch = @(
  '@echo off',
  "set `"PATH=$env:Path`"",
  "`"$PythonExe`" `"%~dp0grabber_host.py`" %*"
)
[IO.File]::WriteAllLines($Launcher, $batch)

$ChromeManifest = Join-Path $HostDir "$HostName.json"
Write-Json $ChromeManifest ([ordered]@{
  name = $HostName
  description = 'Grabber yt-dlp bridge'
  path = $Launcher
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
})

$FirefoxManifest = Join-Path $HostDir "$HostName.firefox.json"
Write-Json $FirefoxManifest ([ordered]@{
  name = $HostName
  description = 'Grabber yt-dlp bridge'
  path = $Launcher
  type = 'stdio'
  allowed_extensions = @($FirefoxId)
})

$ChromiumKeys = @(
  'Google\Chrome',
  'Chromium',
  'Vivaldi',
  'Microsoft\Edge',
  'BraveSoftware\Brave-Browser'
)
foreach ($key in $ChromiumKeys) {
  $path = "HKCU:\Software\$key\NativeMessagingHosts\$HostName"
  New-Item -Path $path -Force | Out-Null
  Set-Item -Path $path -Value $ChromeManifest
  Write-Host "OK  $key"
}
$path = "HKCU:\Software\Mozilla\NativeMessagingHosts\$HostName"
New-Item -Path $path -Force | Out-Null
Set-Item -Path $path -Value $FirefoxManifest
Write-Host 'OK  Firefox'

Write-Host ''
$pong = '{"type":"ping"}'
$bytes = [Text.Encoding]::UTF8.GetBytes($pong)
[byte[]]$frame = [BitConverter]::GetBytes([int]$bytes.Length) + $bytes
$psi = New-Object Diagnostics.ProcessStartInfo
$psi.FileName = $PythonExe
$psi.Arguments = "`"$(Join-Path $HostDir 'grabber_host.py')`""
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.CreateNoWindow = $true
$proc = [Diagnostics.Process]::Start($psi)
$proc.StandardInput.BaseStream.Write($frame, 0, $frame.Length)
$proc.StandardInput.Close()
$reply = $proc.StandardOutput.ReadToEnd()
$proc.WaitForExit()

if ($reply -match '"ytdlp": "([^"]+)"') {
  Write-Host "Tudo pronto! yt-dlp $($Matches[1]) funcionando." -ForegroundColor Green
  if ($reply -notmatch '"ffmpeg": true') { Write-Host 'Aviso: ffmpeg nao encontrado, audio e video podem sair separados.' -ForegroundColor Yellow }
  Write-Host 'Feche e abra o navegador de novo antes de usar.' -ForegroundColor Green
} else {
  Write-Host 'Algo deu errado no teste. Tire um print desta janela e mande pro Eduardo.' -ForegroundColor Red
  Write-Host $reply
}
Write-Host 'Nao apague nem mova esta pasta, o Grabber usa ela.'
