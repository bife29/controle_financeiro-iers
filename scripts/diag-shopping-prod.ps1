$ErrorActionPreference = 'Stop'
$API = 'https://iers-api.onrender.com'

function Show($label, [scriptblock]$action) {
  Write-Host ""
  Write-Host "=== $label ==="
  try { & $action } catch {
    $code = $null
    $body = $null
    if ($_.Exception.Response) {
      $code = $_.Exception.Response.StatusCode.value__
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
      } catch {}
    }
    if (-not $body) { $body = $_.ErrorDetails.Message }
    Write-Host "  HTTP $code - body: $body"
  }
}

Show "Login" {
  $script:tok = (Invoke-RestMethod -Uri "$API/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='admin@iers.org';password='admin123'} | ConvertTo-Json)).access_token
  $script:h = @{Authorization = "Bearer $script:tok"; 'Content-Type'='application/json'}
  Write-Host "  ok"
}

$tag = "[DIAG-$(Get-Date -Format yyyyMMddHHmmss)]"

Show "Cria pedido" {
  $script:req = Invoke-RestMethod -Uri "$API/api/shopping/requests" -Method Post -Headers $script:h -Body (@{
    title="$tag Diag"; items=@(@{description="$tag x"; quantity=1; estimated_price=10})
  } | ConvertTo-Json -Depth 4)
  Write-Host "  req.id=$($script:req.id) status=$($script:req.status)"
}

Show "Approve" {
  $r = Invoke-RestMethod -Uri "$API/api/shopping/requests/$($script:req.id)/approve" -Method Post -Headers $script:h -Body '{}'
  Write-Host "  status=$($r.status)"
}

Show "Receive" {
  $script:rc = Invoke-RestMethod -Uri "$API/api/shopping/requests/$($script:req.id)/receive" -Method Post -Headers $script:h -Body (@{payment_method='Pix'; status='Confirmado'} | ConvertTo-Json)
  Write-Host "  status=$($script:rc.status) tx_id=$($script:rc.transaction_id)"
}

Show "DELETE pedido (esperado 400, tx ainda existe)" {
  $r = Invoke-WebRequest -Uri "$API/api/shopping/requests/$($script:req.id)" -Method Delete -Headers $script:h -UseBasicParsing
  Write-Host "  HTTP $($r.StatusCode) (INESPERADO se 200)"
}

Show "DELETE Transaction $($script:rc.transaction_id)" {
  $r = Invoke-WebRequest -Uri "$API/api/financial/transactions/$($script:rc.transaction_id)" -Method Delete -Headers $script:h -UseBasicParsing
  Write-Host "  HTTP $($r.StatusCode) body=$($r.Content)"
}

Show "GET Transaction by-id $($script:rc.transaction_id) (esperado 404)" {
  $r = Invoke-WebRequest -Uri "$API/api/financial/transactions/by-id/$($script:rc.transaction_id)" -Method Get -Headers $script:h -UseBasicParsing
  Write-Host "  HTTP $($r.StatusCode) body=$($r.Content)"
}

Show "GET pedido $($script:req.id) para inspecionar transaction_id" {
  $r = Invoke-RestMethod -Uri "$API/api/shopping/requests/$($script:req.id)" -Method Get -Headers $script:h
  Write-Host "  status=$($r.status) transaction_id=$($r.transaction_id)"
}

Show "DELETE pedido novamente (esperado 200, tx removida)" {
  $r = Invoke-WebRequest -Uri "$API/api/shopping/requests/$($script:req.id)" -Method Delete -Headers $script:h -UseBasicParsing
  Write-Host "  HTTP $($r.StatusCode) body=$($r.Content)"
}
