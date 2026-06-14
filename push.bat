@echo off
cd /d "%~dp0"
git add -A
git commit -m "polish game + live players"
git push origin main
