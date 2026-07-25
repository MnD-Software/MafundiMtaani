param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$databaseUrl = $env:MAFUNDI_DATABASE_URL
if (-not $databaseUrl) { throw "Set MAFUNDI_DATABASE_URL before creating a backup." }

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not $resolvedOutput.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Backups must stay inside the Mafundi Mtaani workspace."
}

New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $resolvedOutput "mafundi-$stamp.dump"
& pg_dump --format=custom --no-owner --no-acl --file=$target $databaseUrl
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
Write-Output "Backup created: $target"
