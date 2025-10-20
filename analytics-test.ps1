# Send 100 logs with mixed levels
for ($i=1; $i -le 100; $i++) {
    $level = switch ($i % 4) {
        0 { "error" }
        1 { "warn" }
        default { "info" }
    }
    
    Invoke-RestMethod -Uri http://localhost:3001/api/logs -Method Post -ContentType "application/json" -Body "{`"level`":`"$level`",`"message`":`"Test log $i`",`"service`":`"test-service`"}"
    
    if ($i % 10 -eq 0) {
        Write-Host "Sent $i logs..." -ForegroundColor Cyan
    }
}

