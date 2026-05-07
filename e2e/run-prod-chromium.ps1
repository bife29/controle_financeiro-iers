Set-Location $PSScriptRoot
$env:E2E_ENV = 'production'
$env:ALLOW_PROD_DESTRUCTIVE = 'true'
$env:ALLOW_PROD_CLEANUP = 'true'
$env:E2E_RUN_ID = "$(Get-Date -Format yyyyMMdd-HHmmss)-$(Get-Random -Maximum 99999)"
Write-Host "RUN_ID: $env:E2E_RUN_ID"
npx playwright test --project=chromium --reporter=list 2>&1 | Tee-Object -FilePath prod-chromium-run.log
