@echo off
setlocal
cd /d "%~dp0"
echo Starting Luminous Game Engine Lab...
node lab-server.mjs
if errorlevel 1 (
  echo.
  echo Node.js could not start the Lab.
  echo Install Node.js or run: node lab-server.mjs
  pause
)
