@echo off
REM ============================================
REM 👗 Virtual Try-On - Start Server (Windows)
REM ============================================

title Virtual Try-On Server

echo.
echo 🚀 Starting Virtual Try-On backend server...
echo.

cd /d "%~dp0backend"

call venv\Scripts\activate.bat

if exist ".env" (
    findstr /C:"FAL_KEY" .env >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo ✓ AI mode enabled (Fal.ai)
    ) else (
        echo ⚠ Running in preview mode (no AI key configured)
        echo   To enable AI: add FAL_KEY=your_key to backend\.env
    )
) else (
    echo ⚠ Running in preview mode (no AI key configured)
)

echo.
echo Server starting at: http://localhost:8000
echo Press Ctrl+C to stop
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
