@echo off
cd /d "C:\Projects\chanclazo game\project"
call npx vite build
call npx wrangler deploy --assets=./dist
