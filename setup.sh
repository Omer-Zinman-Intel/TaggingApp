#!/bin/bash

# TaggingApp Deployment Script
# This script helps set up the TaggingApp for production deployment

set -e

echo "🏷️  TaggingApp Deployment Setup"
echo "================================"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python $PYTHON_VERSION detected"

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv tagging_env

# Activate virtual environment
echo "🔧 Activating virtual environment..."
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    source tagging_env/Scripts/activate
else
    source tagging_env/bin/activate
fi

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories if they don't exist
echo "📁 Creating directories..."
mkdir -p states
mkdir -p logs
mkdir -p user-config

echo "✅ Directory structure verified"

# Set permissions (Unix-like systems only)
if [[ "$OSTYPE" != "msys" ]] && [[ "$OSTYPE" != "win32" ]]; then
    chmod 755 states logs user-config
    echo "✅ Directory permissions set"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo "1. Activate the virtual environment:"
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "   tagging_env\\Scripts\\activate"
else
    echo "   source tagging_env/bin/activate"
fi
echo "2. Run the application:"
echo "   python app.py"
echo ""
echo "The application will be available at: http://localhost:5000"
echo ""
echo "For production deployment, consider using:"
echo "- Gunicorn (Linux/macOS): gunicorn --bind 0.0.0.0:5000 --workers 4 app:app"
echo "- Waitress (Windows): waitress-serve --host=0.0.0.0 --port=5000 app:app"
