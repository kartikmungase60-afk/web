@echo off
title Battlepie Web Store & Account Server
color 0B
echo ===================================================================
echo     [BATTLEPIE NETWORK] WEB STORE & ACCOUNT LINKING SERVER
echo ===================================================================
echo  [+] Local Website URL: http://localhost:3000
echo  [+] Account Linking:   http://localhost:3000/me
echo  [+] Web Store:         http://localhost:3000/store
echo ===================================================================
echo.
echo Starting Node.js server on port 3000...
echo.
node server/index.js
pause
