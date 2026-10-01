@echo off
setlocal EnableDelayedExpansion
title Battlepie Network - Push to GitHub
color 0B

echo ===================================================================
echo   [BATTLEPIE NETWORK] GITHUB REPOSITORY PUSH WIZARD
echo ===================================================================
echo.

set "GIT_CMD=%LOCALAPPDATA%\Programs\MinGit\cmd"
set "GIT_BIN=%LOCALAPPDATA%\Programs\MinGit\mingw64\bin"
if exist "%GIT_CMD%\git.exe" (
    set "PATH=%GIT_CMD%;%GIT_BIN%;%PATH%"
)

where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] Git was not found in PATH or MinGit.
    pause
    exit /b 1
)

set "DEFAULT_REPO=https://github.com/kartikmungase60-afk/web.git"

echo [+] Configured Repository:
echo     %DEFAULT_REPO%
echo.
echo Press ENTER to push to this repository, or paste a new URL below:
set /p USER_INPUT="Repository URL [%DEFAULT_REPO%]: "

if "%USER_INPUT%"=="" (
    set "REPO_URL=%DEFAULT_REPO%"
) else (
    set "REPO_URL=%USER_INPUT%"
)

echo.
echo [+] Setting remote origin to: %REPO_URL%
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [+] Ensuring branch is named 'main'...
git branch -M main

echo [+] Staging recent changes and committing...
git add .
git commit -m "feat: setup battlepie website and in-game integration" >nul 2>&1

echo.
echo ===================================================================
echo   PUSHING TO GITHUB (BRANCH: main)
echo ===================================================================
echo If this is your first time pushing, a GitHub browser login or
echo token prompt will appear in a moment. Please approve it.
echo.

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================================
    echo   [SUCCESS] Code successfully pushed to:
    echo   https://github.com/kartikmungase60-afk/web
    echo ===================================================================
    echo.
    echo Next Steps on GitHub:
    echo  1. Open: https://github.com/kartikmungase60-afk/web/settings/pages
    echo  2. Under 'Source', select 'GitHub Actions'.
    echo  3. The website will be published live on GitHub Pages!
    echo.
) else (
    echo.
    echo ===================================================================
    echo   [PUSH NOTE] If GitHub prompted for credentials:
    echo ===================================================================
    echo   - GitHub no longer accepts account passwords for git push.
    echo   - If asked for Password, generate a Personal Access Token (classic)
    echo     at: https://github.com/settings/tokens (select 'repo' scope)
    echo     and paste it as the password.
    echo.
)

pause
