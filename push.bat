@echo off
cd /d "%~dp0"
git add -A
git commit -m "update (auto deploys via netlify on push)"
git push origin main

echo.
echo After push, the GitHub Action will deploy to the site defined by the NETLIFY_SITE_ID secret.
echo Make sure that secret matches the Site ID of the Netlify site that has chanclazo.com attached.
echo (See NETLIFY_CUSTOM_DOMAIN.md for exact steps if you see domain in DNS but no game.)
echo.
echo For local/manual deploy to the correct site: .\deploy-netlify.ps1 -SiteId "your-site-id"
