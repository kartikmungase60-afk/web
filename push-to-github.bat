@echo off
setlocal EnableDelayedExpansion
title Battlepie Network - Push to GitHub
color 0B

echo ===================================================================
echo   [BATTLEPIE NETWORK] GITHUB PUSH ^& SETUP WIZARD
echo ===================================================================
echo.

set "GIT_PATH=%LOCALAPPDATA%\Programs\MinGit\cmd"
if exist "%GIT_PATH%\git.exe" (
    set "PATH=%GIT_PATH%;%PATH%"
)

where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] Git was not found in PATH or MinGit.
    pause
    exit /b 1
)

echo [+] Local Git Repository Status:
git status -s
echo.

set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/YourUsername/battlepie.git): "

if "%REPO_URL%"=="" (
    echo [!] No URL entered. Aborting.
    pause
    exit /b 1
)

echo.
echo [+] Configuring remote origin to: %REPO_URL%
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [+] Renaming branch to main...
git branch -M main

echo [+] Staging and committing any recent changes...
git add .
git commit -m "feat: sync battlepie web store updates" >nul 2>&1

echo.
echo [+] Pushing code to GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================================
    echo   [SUCCESS] Code successfully pushed to GitHub!
    echo ===================================================================
    echo.
    echo Next optional steps on GitHub:
    echo  1. Go to your repo -> Settings -> Pages.
    echo  2. Under 'Build and deployment', choose 'GitHub Actions'.
    echo  3. The website will automatically deploy live to GitHub Pages!
    echo.
) else (
    echo.
    echo [!] Push failed or authentication needed.
    echo If GitHub asked for a password, please use a GitHub Personal Access Token (PAT).
    echo.
)

pause
