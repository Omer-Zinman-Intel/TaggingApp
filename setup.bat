@echo off
REM TaggingApp Deployment Script for Windows
REM This script helps set up the TaggingApp for production deployment

echo 🏷️  TaggingApp Deployment Setup
echo ================================

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

echo ✅ Python detected

REM Create virtual environment
echo 📦 Creating virtual environment...
python -m venv tagging_env

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call tagging_env\Scripts\activate.bat

REM Upgrade pip
echo ⬆️  Upgrading pip...
pip install --upgrade pip

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Create necessary directories if they don't exist
echo 📁 Creating directories...
if not exist "states" mkdir states
if not exist "logs" mkdir logs
if not exist "user-config" mkdir user-config

echo ✅ Directory structure verified

echo.
echo 🎉 Setup complete!
echo.
echo To start the application:
echo 1. Activate the virtual environment:
echo    tagging_env\Scripts\activate.bat
echo 2. Run the application:
echo    python app.py
echo.
echo The application will be available at: http://localhost:5000
echo.
echo For production deployment, consider using:
echo - Waitress: waitress-serve --host=0.0.0.0 --port=5000 app:app
echo - Gunicorn (if available): gunicorn --bind 0.0.0.0:5000 --workers 4 app:app

pause
