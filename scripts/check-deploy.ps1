$ErrorActionPreference = 'Stop'
$body = @{email="admin@iers.org"; password="admin123"} | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri https://iers-api.onrender.com/api/auth/login -Body $body -ContentType "application/json" -TimeoutSec 60
$h = @{Authorization="Bearer $($login.access_token)"}
$tx = Invoke-RestMethod -Uri "https://iers-api.onrender.com/api/financial/transactions?limit=1" -Headers $h
if ($tx.Count -gt 0) {
    $id = $tx[0].id
    try {
        $r = Invoke-WebRequest -Uri "https://iers-api.onrender.com/api/financial/transactions/by-id/$id" -Headers $h -UseBasicParsing
        Write-Host "by-id: $($r.StatusCode) - DEPLOY OK"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "by-id NOT YET: $code - aguardando deploy"
    }
}
