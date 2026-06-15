# deploy-netlify.ps1
# Easy local deployment helper for chanclazo.com on Netlify
# 
# Prerequisites for easiest use:
#   $env:NETLIFY_SITE_ID = "site-id-of-the-site-with-chanclazo.com-domain"
#   $env:NETLIFY_AUTH_TOKEN = "your-netlify-personal-access-token"   # (optional but recommended)
#
# Then run: .\deploy-netlify.ps1
#
# Or pass SiteId: .\deploy-netlify.ps1 -SiteId "the-id"
#
# Get Site ID: Netlify dashboard > your site (the one with custom domain) > Site settings > General > "Site information" > Site ID
# Current site ID for chanclazo.com new build: c4ffe657-ecdd-4cf0-b1cb-5ae9c3ed9c35 (use this for the secret or this script)
# Get token: Netlify account settings > Applications > Personal access tokens (create with "Deploy" scope)
#
# This will build + deploy the game to the site so chanclazo.com shows it.

param(
    [string]$SiteId = $(if ($env:NETLIFY_SITE_ID) { $env:NETLIFY_SITE_ID } else { "c4ffe657-ecdd-4cf0-b1cb-5ae9c3ed9c35" })
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
$deployArgs = "--prod --dir=dist --site $SiteId"
if ($env:NETLIFY_AUTH_TOKEN) {
    $deployArgs += " --auth $env:NETLIFY_AUTH_TOKEN"
    Write-Host "Using NETLIFY_AUTH_TOKEN from environment" -ForegroundColor Yellow
}
npx netlify-cli deploy $deployArgs.Split(' ')

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed. Set `$env:NETLIFY_AUTH_TOKEN and `$env:NETLIFY_SITE_ID, or run 'npx netlify-cli login' first. Check the exact error above." -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/3] Done!" -ForegroundColor Green
Write-Host "Visit https://chanclazo.com (and https://www.chanclazo.com)" -ForegroundColor Cyan
Write-Host "If you still see a placeholder, double-check that this Site ID is the one with the custom domain attached." -ForegroundColor Yellow
