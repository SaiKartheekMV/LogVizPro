Write-Host "🚀 Starting Complete Integration Test..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Step 1: Register & Login
Write-Host "`n[1/6] Testing Authentication..." -ForegroundColor Yellow
$user = @{
    name = "Integration Test User"
    email = "integration@test.com"
    password = "Test123456"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri http://localhost:3001/api/auth/register -Method Post -ContentType "application/json" -Body $user | Out-Null
    Write-Host "✅ User Registration" -ForegroundColor Green
} catch {
    Write-Host "⚠️  User already exists" -ForegroundColor Yellow
}

$login = @{
    email = "integration@test.com"
    password = "Test123456"
} | ConvertTo-Json

$token = (Invoke-RestMethod -Uri http://localhost:3001/api/auth/login -Method Post -ContentType "application/json" -Body $login).token
Write-Host "✅ User Login" -ForegroundColor Green

$headers = @{"Authorization" = "Bearer $token"}

# Step 2: Send Various Logs
Write-Host "`n[2/6] Sending Test Logs..." -ForegroundColor Yellow
$logTypes = @("info", "warn", "error", "debug")
foreach ($type in $logTypes) {
    Invoke-RestMethod -Uri http://localhost:3001/api/logs -Method Post -ContentType "application/json" -Body "{`"level`":`"$type`",`"message`":`"Integration test $type log`",`"service`":`"integration-test`"}" | Out-Null
    Write-Host "✅ Sent $type log" -ForegroundColor Green
}

# Step 3: Query Logs
Write-Host "`n[3/6] Querying Logs..." -ForegroundColor Yellow
$logs = Invoke-RestMethod -Uri "http://localhost:3001/api/logs?service=integration-test"
Write-Host "✅ Retrieved $($logs.data.Count) logs" -ForegroundColor Green

# Step 4: Create Alert
Write-Host "`n[4/6] Creating Alert..." -ForegroundColor Yellow
$alert = @{
    name = "Integration Test Alert"
    description = "Test alert for integration"
    condition = "error_rate"
    threshold = "10"
    severity = "warning"
} | ConvertTo-Json

$newAlert = Invoke-RestMethod -Uri http://localhost:3001/api/alerts -Method Post -Headers $headers -ContentType "application/json" -Body $alert
Write-Host "✅ Alert Created: $($newAlert.data.name)" -ForegroundColor Green

# Step 5: Get Analytics
Write-Host "`n[5/6] Fetching Analytics..." -ForegroundColor Yellow
$analytics = Invoke-RestMethod -Uri "http://localhost:8000/api/analytics/summary"
Write-Host "✅ Total Logs: $($analytics.data.totalLogs)" -ForegroundColor Green
Write-Host "✅ Error Rate: $($analytics.data.errorRate)%" -ForegroundColor Green

# Step 6: Cleanup
Write-Host "`n[6/6] Cleanup..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:3001/api/alerts/$($newAlert.data.id)" -Method Delete -Headers $headers | Out-Null
Write-Host "✅ Alert Deleted" -ForegroundColor Green

Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host "✅ Integration Test Complete!" -ForegroundColor Green
Write-Host "📊 Open http://localhost:5173 to see results" -ForegroundColor Cyan