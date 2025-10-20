Write-Host "Generating ML Test Data..." -ForegroundColor Cyan

# Phase 1: Normal traffic (60 logs)
Write-Host "`nPhase 1: Normal traffic..." -ForegroundColor Green
for ($i=1; $i -le 60; $i++) {
    $level = if ($i % 10 -eq 0) { "error" } else { "info" }
    $body = @{
        level = $level
        message = "Normal operation log $i"
        service = "api-gateway"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri http://localhost:3001/api/logs -Method Post -ContentType "application/json" -Body $body | Out-Null
    if ($i % 20 -eq 0) { Write-Host "  Sent $i logs" -ForegroundColor Gray }
    Start-Sleep -Milliseconds 100
}

Start-Sleep -Seconds 2

# Phase 2: Anomaly - High error rate (30 logs)
Write-Host "`nPhase 2: Simulating anomaly (high error rate)..." -ForegroundColor Red
for ($i=1; $i -le 30; $i++) {
    $level = if ($i % 2 -eq 0) { "error" } else { "warn" }
    $body = @{
        level = $level
        message = "System overload - request timeout"
        service = "database-service"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri http://localhost:3001/api/logs -Method Post -ContentType "application/json" -Body $body | Out-Null
    if ($i % 10 -eq 0) { Write-Host "  Sent $i anomalous logs" -ForegroundColor Yellow }
}

Start-Sleep -Seconds 2

# Phase 3: Recovery (40 logs)
Write-Host "`nPhase 3: System recovery..." -ForegroundColor Green
for ($i=1; $i -le 40; $i++) {
    $level = if ($i % 15 -eq 0) { "warn" } else { "info" }
    $body = @{
        level = $level
        message = "System stabilizing - recovery $i"
        service = "api-gateway"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri http://localhost:3001/api/logs -Method Post -ContentType "application/json" -Body $body | Out-Null
    if ($i % 20 -eq 0) { Write-Host "  Sent $i logs" -ForegroundColor Gray }
}

Write-Host "`nGenerated 130 test logs!" -ForegroundColor Green
Write-Host "Now go to ML Dashboard and click 'Run Detection'" -ForegroundColor Cyan
Write-Host "http://localhost:5173/ml-dashboard" -ForegroundColor White