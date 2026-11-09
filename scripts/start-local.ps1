$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$containerName = 'juniper-postgres'
$databasePort = 5433
$apiPort = 3001
$apiUrl = "http://localhost:$apiPort"
$logDirectory = Join-Path $projectRoot '.local'
$apiLog = Join-Path $logDirectory 'api.log'
$apiErrorLog = Join-Path $logDirectory 'api-error.log'

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $false)][string[]]$ArgumentList = @()
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
  }
}

function Wait-ForTcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $connection = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
      return
    }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $HostName`:$Port to accept TCP connections."
}

function Wait-ForApiReadiness {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri "$Url/api/readyz" -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        return
      }
    } catch {
      # The API is still building or connecting to PostgreSQL.
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url/api/readyz to return HTTP 200. See $apiLog and $apiErrorLog."
}

Set-Location $projectRoot
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker CLI was not found on PATH. Start Docker Desktop and install the Docker CLI.'
}
if (-not (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)) {
  throw 'pnpm.cmd was not found on PATH. Install pnpm or enable Corepack.'
}

$containerId = (& docker ps -aq --filter "name=^$containerName$")
if (-not $containerId) {
  Write-Host "Creating $containerName..."
  Invoke-CheckedCommand 'docker' @(
    'run', '--name', $containerName,
    '-e', 'POSTGRES_USER=juniper',
    '-e', 'POSTGRES_PASSWORD=juniper-local',
    '-e', 'POSTGRES_DB=juniper',
    '-p', "$databasePort`:5432",
    '-d', 'postgres:16'
  )
} else {
  $running = (& docker inspect -f '{{.State.Running}}' $containerName).Trim()
  if ($running -ne 'true') {
    Write-Host "Starting stopped $containerName..."
    Invoke-CheckedCommand 'docker' @('start', $containerName)
  }
}

Write-Host "Waiting for PostgreSQL on localhost:$databasePort..."
Wait-ForTcpPort -HostName 'localhost' -Port $databasePort -TimeoutSeconds 60

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { 'postgresql://juniper:juniper-local@localhost:5433/juniper' }
$env:JWT_SECRET = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { 'juniper-local-only-signing-secret-change-before-deployment' }
$env:APP_ORIGIN = if ($env:APP_ORIGIN) { $env:APP_ORIGIN } else { 'http://localhost:8081' }
$env:APP_PUBLIC_URL = if ($env:APP_PUBLIC_URL) { $env:APP_PUBLIC_URL } else { 'http://localhost:8081' }
$env:NODE_ENV = if ($env:NODE_ENV) { $env:NODE_ENV } else { 'development' }
$env:PORT = "$apiPort"

Write-Host 'Applying database migrations...'
Invoke-CheckedCommand 'pnpm.cmd' @('--filter', '@workspace/db', 'migrate')

if (Test-Path $apiLog) { Remove-Item $apiLog -Force }
if (Test-Path $apiErrorLog) { Remove-Item $apiErrorLog -Force }

Write-Host "Starting API on $apiUrl..."
$apiProcess = Start-Process -FilePath 'pnpm.cmd' `
  -ArgumentList @('--filter', '@workspace/api-server', 'dev') `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $apiLog `
  -RedirectStandardError $apiErrorLog `
  -PassThru

try {
  Wait-ForApiReadiness -Url $apiUrl -TimeoutSeconds 120
} catch {
  if (-not $apiProcess.HasExited) {
    Stop-Process -Id $apiProcess.Id -Force
  }
  throw
}

Write-Host "API is ready: $apiUrl/api/readyz"
Write-Host "API process ID: $($apiProcess.Id)"
Write-Host "Logs: $apiLog and $apiErrorLog"
Write-Host 'Stop the API with: Stop-Process -Id ' $apiProcess.Id
