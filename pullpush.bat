@echo off
cd /d "%~dp0"
git pull origin main --no-edit
git push origin main
