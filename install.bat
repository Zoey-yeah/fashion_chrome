@echo off
REM ============================================
REM Virtual Try-On - Easy Installer (Windows)
REM ============================================

title Virtual Try-On Installer

echo.
echo ========================================
echo    Virtual Try-On Chrome Extension
echo       Easy Installation Script
echo ========================================
echo.

REM ============================================
REM Step 1: Check Prerequisites
REM ============================================
echo [Step 1/5] Checking prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node.js not found!
    echo.
    echo Please install Node.js first:
    echo   - Visit: https://nodejs.org/
    echo   - Download the LTS version
    echo   - Run the installer
    echo.
    echo After installing, run this script again.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js found: %NODE_VERSION%

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Python not found!
    echo.
    echo Please install Python first:
    echo   - Visit: https://www.python.org/downloads/
    echo   - Download Python 3.9 or higher
    echo   - IMPORTANT: Check "Add Python to PATH" during install
    echo.
    echo After installing, run this script again.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo [OK] Python found: %PYTHON_VERSION%

REM ============================================
REM Step 2: Install Chrome Extension
REM ============================================
echo.
echo [Step 2/5] Installing Chrome extension dependencies...
call npm install --silent
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install Node packages
    pause
    exit /b 1
)
echo [OK] Node packages installed

echo.
echo [Step 3/5] Building Chrome extension...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build extension
    pause
    exit /b 1
)
echo [OK] Extension built! Files are in the 'dist' folder

REM ============================================
REM Step 3: Setup Backend
REM ============================================
echo.
echo [Step 4/5] Setting up backend server...

cd backend

if not exist "venv" (
    python -m venv venv
    echo [OK] Python virtual environment created
) else (
    echo [OK] Python virtual environment already exists
)

call venv\Scripts\activate.bat
pip install -q -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install Python packages
    pause
    exit /b 1
)
echo [OK] Python packages installed

REM ============================================
REM Step 4: Configure API Key
REM ============================================
echo.
echo [Step 5/5] Configuring AI service...

if exist ".env" (
    echo [OK] Configuration file already exists
) else (
    echo.
    echo ================================================
    echo To enable AI-powered try-on, you need an API key.
    echo.
    echo We recommend Fal.ai (fast and affordable, ~$0.01/image)
    echo.
    echo How to get a Fal.ai API key:
    echo   1. Go to: https://fal.ai
    echo   2. Sign up for free
    echo   3. Go to Dashboard - Keys
    echo   4. Create a new key
    echo   5. Add billing info (pay-as-you-go)
    echo ================================================
    echo.
    
    set /p HAS_KEY="Do you have a Fal.ai API key? (y/n): "
    
    if /i "%HAS_KEY%"=="y" (
        set /p FAL_KEY="Enter your Fal.ai API key: "
        echo FAL_KEY=%FAL_KEY%> .env
        echo [OK] API key saved!
    ) else (
        echo.
        echo [WARNING] Skipping API setup. The extension will work in preview mode.
        echo You can add your API key later by creating backend\.env file
        echo with the content: FAL_KEY=your_key_here
        type nul > .env
    )
)

cd ..

REM ============================================
REM Done!
REM ============================================
echo.
echo ========================================
echo      Installation Complete!
echo ========================================
echo.
echo Next Steps:
echo.
echo   1. Load the extension in Chrome:
echo      - Open Chrome
echo      - Go to: chrome://extensions
echo      - Turn ON 'Developer mode' (top right)
echo      - Click 'Load unpacked'
echo      - Select the 'dist' folder in this directory
echo.
echo   2. Start the backend server:
echo      - Double-click: start-server.bat
echo.
echo   3. Try it out:
echo      - Go to lululemon.com or any supported site
echo      - Click the extension icon
echo      - Upload your photo and try on clothes!
echo.
echo Enjoy shopping!
echo.
pause
