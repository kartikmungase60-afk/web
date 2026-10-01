@echo off
title MineOrange Server Deployer - Battlepie
cls
echo ========================================================
echo   Battlepie Minecraft Server SFTP Deployer
echo ========================================================
echo Host: Node1.mineorange.fun:2022
echo User: master.006427ba
echo.
echo Please enter your MineOrange panel password when prompted:
echo.

python "%~dp0tools\deploy_mc_server.py" %*

echo.
pause
