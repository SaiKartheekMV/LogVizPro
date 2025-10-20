Write-Host "Performance Benchmark Test" -ForegroundColor Cyan

$iterations = 20
$times = @()

for ($i = 1; $i -le $iterations; $i++) {
    $start = Get-Date
    
    Invoke-RestMethod -Uri http://localhost:3001/api/logs -Method Post -ContentType "application/json" -Body '{"level":"info","message":"Performance test","service":"benchmark"}' | Out-Null
    
    $end = Get-Date
    $elapsed = ($end - $start).TotalMilliseconds
    $times += $elapsed
    
    Write-Progress -Activity "Running Benchmark" -Status "Test $i/$iterations" -PercentComplete (($i / $iterations) * 100)
}

$avgTime = ($times | Measure-Object -Average).Average
$minTime = ($times | Measure-Object -Minimum).Minimum
$maxTime = ($times | Measure-Object -Maximum).Maximum

Write-Host ""
Write-Host "Benchmark Results:" -ForegroundColor Green
Write-Host "   Average Response Time: $([math]::Round($avgTime, 2))ms" -ForegroundColor White
Write-Host "   Fastest Response: $([math]::Round($minTime, 2))ms" -ForegroundColor White
Write-Host "   Slowest Response: $([math]::Round($maxTime, 2))ms" -ForegroundColor White
Write-Host "   Total Requests: $iterations" -ForegroundColor White