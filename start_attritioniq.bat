@echo off
setlocal enabledelayedexpansion

title AttritionIQ Launcher

echo ===================================================
echo           AttritionIQ Enterprise Platform
echo               System Startup Manager
echo ===================================================
echo.

:: 1. Verify Project Directory Structure
if not exist "%~dp0backend" (
    echo [ERROR] Backend folder not found at: "%~dp0backend"
    echo Please make sure this script is located in the AttritionIQ project root.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0backend\venv\Scripts\activate.bat" (
    echo [ERROR] Python virtual environment not found at:
    echo "%~dp0backend\venv\Scripts\activate.bat"
    echo Please ensure the Python virtual environment is installed in the backend folder.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0frontend" (
    echo [ERROR] Frontend folder not found at: "%~dp0frontend"
    echo Please make sure this script is located in the AttritionIQ project root.
    echo.
    pause
    exit /b 1
)

:: 2. Ensure standard Node.js / npm directories are in PATH for Explorer launches
if exist "C:\Program Files\nodejs" (
    set "PATH=%PATH%;C:\Program Files\nodejs"
)
if exist "%ProgramFiles%\nodejs" (
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
)
if exist "%LOCALAPPDATA%\Programs\nodejs" (
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\nodejs"
)
if exist "C:\Program Files (x86)\nodejs" (
    set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
)
if exist "%APPDATA%\npm" (
    set "PATH=%PATH%;%APPDATA%\npm"
)
if exist "%USERPROFILE%\AppData\Roaming\npm" (
    set "PATH=%PATH%;%USERPROFILE%\AppData\Roaming\npm"
)

:: 3. Comprehensive Node.js / npm detection
set NPM_DETECTED=0

where npm.cmd >nul 2>&1 && set NPM_DETECTED=1
if "!NPM_DETECTED!"=="0" (
    where npm >nul 2>&1 && set NPM_DETECTED=1
)
if "!NPM_DETECTED!"=="0" (
    where node.exe >nul 2>&1 && set NPM_DETECTED=1
)
if "!NPM_DETECTED!"=="0" (
    where node >nul 2>&1 && set NPM_DETECTED=1
)
if "!NPM_DETECTED!"=="0" (
    call npm --version >nul 2>&1 && set NPM_DETECTED=1
)
if "!NPM_DETECTED!"=="0" (
    call node --version >nul 2>&1 && set NPM_DETECTED=1
)

if "!NPM_DETECTED!"=="0" (
    echo [ERROR] Node.js / npm was not detected in your system PATH.
    echo Please verify that Node.js is installed and accessible.
    echo.
    pause
    exit /b 1
)

:: 4. Start Backend Server
echo [1/3] Starting AttritionIQ Backend (FastAPI / Uvicorn on :8000)...
start "AttritionIQ Backend" cmd /k "cd /d "%~dp0backend" && call "%~dp0backend\venv\Scripts\activate.bat" && echo === AttritionIQ Backend Server === && echo Running on http://localhost:8000 && echo. && "%~dp0backend\venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000"

:: Small delay before starting frontend
ping 127.0.0.1 -n 3 >nul

:: 5. Start Frontend Server
echo [2/3] Starting AttritionIQ Frontend (Vite on :3000)...
start "AttritionIQ Frontend" cmd /k "cd /d "%~dp0frontend" && echo === AttritionIQ Frontend Server === && echo Running on http://localhost:3000 && echo. && npm run dev"

:: Small delay before opening browser
ping 127.0.0.1 -n 3 >nul

:: 6. Open Browser
echo [3/3] Launching web browser at http://localhost:3000...
start http://localhost:3000

echo.
echo ===================================================
echo  AttritionIQ is starting up!
echo.
echo  - Backend API:    http://localhost:8000 (docs: /docs)
echo  - Frontend App:   http://localhost:3000
echo.
echo  To stop the application, simply close the
echo  "AttritionIQ Backend" and "AttritionIQ Frontend"
echo  terminal windows.
echo ===================================================
echo.

:: Automatically close the launcher window after 4 seconds
timeout /t 4 >nul
