# Deploy to Render using PowerShell
Write-Host "🚀 Triggering deployment to Render..." -ForegroundColor Cyan

$url = "https://api.render.com/deploy/srv-d4bc8bruibrs739pn27g?key=CZDYwCvhzGY"

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Deployment triggered successfully!" -ForegroundColor Green
        Write-Host "🌐 Check status: https://dashboard.render.com/" -ForegroundColor Yellow
        Write-Host "🔗 Site: https://jdpdftoexcel.online/" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Deployment failed with status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
