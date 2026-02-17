# Elevare Setup Script (Windows)

Write-Host "Checking Node.js version..."
$nodeVersion = node -v
if ($nodeVersion -match "v(\d+)") {
    $majorVersion = [int]$matches[1]
    if ($majorVersion -lt 18) {
        Write-Error "Node.js version must be 18 or higher. Found $nodeVersion"
        exit 1
    }
} else {
    Write-Error "Node.js not found."
    exit 1
}

Write-Host "Installing Backend Dependencies..."
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend install failed"
    exit 1
}
Set-Location ..

Write-Host "Installing Frontend Dependencies..."
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend install failed"
    exit 1
}
Set-Location ..

Write-Host "--------------------------------------------------"
Write-Host "SUCCESS! Project setup complete."
Write-Host "--------------------------------------------------"
Write-Host "To run the project locally (without Docker):"
Write-Host "1. Start Backend: cd backend; npm run dev"
Write-Host "2. Start Frontend: cd frontend; npm run dev"
Write-Host ""
Write-Host "Ensure you have MongoDB running locally or configured in .env"
