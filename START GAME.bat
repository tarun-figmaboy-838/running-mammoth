@echo off
rem Double-click this to play the game.
rem
rem The game uses ES modules, which browsers refuse to load from a file:// path --
rem opening game\index.html directly gives you a permanent "Loading the frozen world".
rem This starts a small local web server and opens the game in your browser.

title Ice Age Mammoth Runner - local server
echo.
echo   Starting local server...
echo.

rem Open in Microsoft Edge specifically, rather than whatever the default browser is.
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  echo   Opening Microsoft Edge...
  start "" "%EDGE%" "http://127.0.0.1:8080"
) else (
  echo   Edge not found, using your default browser...
  start "" "http://127.0.0.1:8080"
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8080

echo.
echo   Server stopped. Press any key to close.
pause > nul
