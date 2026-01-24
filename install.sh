#!/bin/bash

# ============================================
# 👗 Virtual Try-On - Easy Installer (Mac/Linux)
# ============================================

set -e

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_banner() {
    echo ""
    echo -e "${PURPLE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}   👗 ${CYAN}Virtual Try-On Chrome Extension${NC}    ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}      ${YELLOW}Easy Installation Script${NC}            ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if a command exists
check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

print_banner

# ============================================
# Step 1: Check Prerequisites
# ============================================
print_step "Step 1/5: Checking prerequisites..."

# Check Node.js
if check_command node; then
    NODE_VERSION=$(node -v)
    print_success "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found!"
    echo ""
    echo "Please install Node.js first:"
    echo "  → Visit: https://nodejs.org/"
    echo "  → Download the LTS version"
    echo "  → Run the installer"
    echo ""
    echo "After installing, run this script again."
    exit 1
fi

# Check Python
if check_command python3; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python found: $PYTHON_VERSION"
elif check_command python; then
    PYTHON_VERSION=$(python --version)
    print_success "Python found: $PYTHON_VERSION"
    alias python3=python
else
    print_error "Python not found!"
    echo ""
    echo "Please install Python first:"
    echo "  → Visit: https://www.python.org/downloads/"
    echo "  → Download Python 3.9 or higher"
    echo "  → Run the installer"
    echo ""
    echo "After installing, run this script again."
    exit 1
fi

# ============================================
# Step 2: Install Chrome Extension
# ============================================
print_step "Step 2/5: Installing Chrome extension dependencies..."

npm install --silent
print_success "Node packages installed"

print_step "Step 3/5: Building Chrome extension..."
npm run build --silent
print_success "Extension built! Files are in the 'dist' folder"

# ============================================
# Step 3: Setup Backend
# ============================================
print_step "Step 4/5: Setting up backend server..."

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Python virtual environment created"
else
    print_success "Python virtual environment already exists"
fi

# Activate and install dependencies
source venv/bin/activate
pip install -q -r requirements.txt
print_success "Python packages installed"

# ============================================
# Step 4: Configure API Key
# ============================================
print_step "Step 5/5: Configuring AI service..."

if [ -f ".env" ]; then
    print_success "Configuration file already exists"
else
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}To enable AI-powered try-on, you need an API key.${NC}"
    echo ""
    echo "We recommend Fal.ai (fast & affordable, ~\$0.01/image)"
    echo ""
    echo -e "${CYAN}How to get a Fal.ai API key:${NC}"
    echo "  1. Go to: https://fal.ai"
    echo "  2. Sign up for free"
    echo "  3. Go to Dashboard → Keys"
    echo "  4. Create a new key"
    echo "  5. Add billing info (pay-as-you-go)"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    read -p "Do you have a Fal.ai API key? (y/n): " HAS_KEY
    
    if [[ $HAS_KEY == "y" || $HAS_KEY == "Y" ]]; then
        read -p "Enter your Fal.ai API key: " FAL_KEY
        echo "FAL_KEY=$FAL_KEY" > .env
        print_success "API key saved!"
    else
        echo ""
        print_warning "Skipping API setup. The extension will work in preview mode."
        echo "You can add your API key later by creating backend/.env file"
        echo "with the content: FAL_KEY=your_key_here"
        touch .env
    fi
fi

cd ..

# ============================================
# Done!
# ============================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}     🎉 ${CYAN}Installation Complete!${NC}              ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "  ${CYAN}1. Load the extension in Chrome:${NC}"
echo "     → Open Chrome"
echo "     → Go to: chrome://extensions"
echo "     → Turn ON 'Developer mode' (top right)"
echo "     → Click 'Load unpacked'"
echo "     → Select the 'dist' folder in this directory"
echo ""
echo -e "  ${CYAN}2. Start the backend server:${NC}"
echo "     → Run: ${YELLOW}./start-server.sh${NC}"
echo "     → Or manually: cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo ""
echo -e "  ${CYAN}3. Try it out:${NC}"
echo "     → Go to lululemon.com or any supported site"
echo "     → Click the extension icon"
echo "     → Upload your photo and try on clothes!"
echo ""
echo -e "${PURPLE}Enjoy shopping! 👗✨${NC}"
echo ""
