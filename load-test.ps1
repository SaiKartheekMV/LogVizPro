# Load Test - 50 logs in quick succession
Write-Host "Starting Load Test - Sending 50 logs..." -ForegroundColor Cyan

$services = @("auth-service", "payment-service", "api-gateway", "order-service", "notification-service")
$levels = @("info", "warn", "error", "debug")
$messages = @(
    "Request processed successfully",
    "High latency detected",
    "Connection failed",
    "Cache miss",
    "Rate limit approaching",
    "Query execution slow",
    "Service health check passed",
    "Timeout warning"
)

for ($i = 1; $i -le 50; $i++) {
    $service = $services | Get-Random
    $level = $levels | Get-Random
    $message = $messages | Get-Random
    
    $bodyObject = @{
        level = $level
        message = "$message - Request #$i"
        service = $service
        metadata = @{
            requestId = "req-$(Get-Random -Minimum 1000 -Maximum 9999)"
            timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            loadTest = $true
        }
    }
    
    $body = $bodyObject | ConvertTo-Json

    Invoke-RestMethod -Uri http://localhost:3001/api/logs -Method Post -ContentType "application/json" -Body $body
    
    Write-Host "Sent log $i/50" -ForegroundColor Green
    Start-Sleep -Milliseconds 100
}

Write-Host "Load Test Complete! Check dashboard for real-time updates." -ForegroundColor Green