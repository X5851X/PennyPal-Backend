@echo off
echo ========================================
echo    PennyPal Backend Deployment Script
echo ========================================
echo.

:: Check if git is initialized
if not exist .git (
    echo Initializing Git repository...
    git init
    git remote add origin https://github.com/Core-KADA-2025/PennyPal.git
)

:: Check current branch
for /f "tokens=*" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i

if not "%CURRENT_BRANCH%"=="Backend" (
    echo Switching to Backend branch...
    git checkout -b Backend 2>nul || git checkout Backend
)

echo Current branch: Backend
echo.

:: Add all files
echo Adding files to git...
git add .

:: Commit with timestamp
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%-%MM%-%DD% %HH%:%Min%:%Sec%"

git commit -m "deploy: Docker setup and backend updates - %timestamp%"

:: Push to GitHub
echo Pushing to GitHub...
git push -u origin Backend

echo.
echo ========================================
echo    Deployment Complete!
echo ========================================
echo.
echo GitHub Actions will now build and push the Docker image.
echo Check the Actions tab at: https://github.com/Core-KADA-2025/PennyPal/actions
echo.
echo Docker image will be available at:
echo ghcr.io/core-kada-2025/pennypal:latest
echo.
pause