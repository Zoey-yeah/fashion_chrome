#!/bin/bash

# ============================================
# 👗 Virtual Try-On - Start Server (Mac/Linux)
# ============================================

echo ""
echo "🚀 Starting Virtual Try-On backend server..."
echo ""

cd "$(dirname "$0")/backend"

# Activate virtual environment
source venv/bin/activate

# Check if .env exists and has API key
if [ -f ".env" ] && grep -q "FAL_KEY" .env; then
    echo "✓ AI mode enabled (Fal.ai)"
else
    echo "⚠ Running in preview mode (no AI key configured)"
    echo "  To enable AI: add FAL_KEY=your_key to backend/.env"
fi

echo ""
echo "Server starting at: http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
