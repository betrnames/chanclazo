# deploy-netlify.ps1
# Easy local deployment helper for chanclazo.com on Netlify
# Usage:
#   1. Get the Site ID of the site that has chanclazo.com attached (Netlify dashboard > Site settings > General > Site ID)
#   2. Set the env var or pass it:
#      $env:NETLIFY_SITE_ID = "your-site-id-here"
#      .\deploy-netlify.ps1
#
# Or run with param: .\deploy-netlify.ps1 -SiteId "your-site-id-here"
#
# This will build and deploy the latest game + assets to the site.
# After this, chanclazo.com will show the project build (assuming the domain is attached to this site).

param(
    [string]$SiteId = $env:NETLIFY_SITE_ID
)

$ErrorActionPreference = "Stop"

Write-Host "=== Chanclazo Netlify Deploy ===" -ForegroundColor Cyan

if (-not $SiteId) {
    Write-Host "ERROR: No Site ID provided." -ForegroundColor Red
    Write-Host "Either set `$env:NETLIFY_SITE_ID = 'the-site-id-that-has-chanclazo.com' "
    Write-Host "or run: .\deploy-netlify.ps1 -SiteId 'the-site-id-that-has-chanclazo.com'"
    Write-Host ""
    Write-Host "How to get the Site ID:"
    Write-Host "  Netlify dashboard > select the site that shows chanclazo.com in Domain management > Site settings > General > Site ID"
    exit 1
}

Write-Host "Using Site ID: $SiteId" -ForegroundColor Yellow

# Build
Write-Host "`n[1/3] Building project..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Deploy
Write-Host "`n[2/3] Deploying to Netlify (production)..." -ForegroundColor Green
npx netlify-cli deploy --prod --dir=dist --site $SiteId

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed. Make sure you are logged in (npx netlify-cli login) or the site ID and token are correct." -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/3] Done!" -ForegroundColor Green
Write-Host "Visit https://chanclazo.com (and https://www.chanclazo.com)" -ForegroundColor Cyan
Write-Host "If you still see a placeholder, double-check that this Site ID is the one with the custom domain attached." -ForegroundColor Yellow
