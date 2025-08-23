@echo off
echo.
echo ========================================
echo   Simple Weekly Scheduler
echo ========================================
echo.
echo Starting the Simple Weekly Scheduler...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if required dependencies are installed
if not exist node_modules (
    echo Installing dependencies...
    npm install express cors
    echo.
)

REM Start the server
echo Starting server on http://localhost:3000
echo.
echo ========================================
echo   Server is running!
echo   Open your browser and go to:
echo   http://localhost:3000
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

node simple-server.js