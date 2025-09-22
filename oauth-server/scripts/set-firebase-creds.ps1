# Usage:
#   ./scripts/set-firebase-creds.ps1 -Path "C:\\secrets\\gcp\\serviceAccountKey.json" -Mode File
#   ./scripts/set-firebase-creds.ps1 -Path "C:\\secrets\\gcp\\serviceAccountKey.json" -Mode Env

param(
  [Parameter(Mandatory=$true)] [string]$Path,
  [ValidateSet('File','Env')] [string]$Mode = 'File'
)

if (-not (Test-Path $Path)) {
  Write-Error "File not found: $Path"
  exit 1
}

if ($Mode -eq 'File') {
  $env:GOOGLE_APPLICATION_CREDENTIALS = $Path
  Write-Host "Set GOOGLE_APPLICATION_CREDENTIALS=$Path"
} else {
  $json = Get-Content -Raw -Path $Path
  # Use a here-string-like literal to preserve newlines
  $env:FIREBASE_SERVICE_ACCOUNT = $json
  Write-Host "Set FIREBASE_SERVICE_ACCOUNT from $Path (length=$($json.Length))"
}

Write-Host "Done. Start the OAuth server with: node server.js"