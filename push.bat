@echo off
cd /d "%~dp0"
git add -A
git commit -m "update (auto deploys via netlify on push)"
git push origin main
