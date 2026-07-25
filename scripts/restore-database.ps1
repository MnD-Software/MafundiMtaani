param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [switch]$ConfirmRestore
)

if (-not $ConfirmRestore) { throw "Restore is destructive. Re-run with -ConfirmRestore after checking the target database." }
$databaseUrl = $env:MAFUNDI_DATABASE_URL
if (-not $databaseUrl) { throw "Set MAFUNDI_DATABASE_URL to the intended restore target." }
$resolvedBackup = [System.IO.Path]::GetFullPath($BackupFile)
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) { throw "Backup file not found: $resolvedBackup" }
& pg_restore --clean --if-exists --no-owner --no-acl --dbname=$databaseUrl $resolvedBackup
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE." }
Write-Output "Restore completed from: $resolvedBackup"
