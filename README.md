# 👗 Virtual Try-On Chrome Extension

A Chrome extension that lets you virtually try on clothes while shopping online. Upload your photo once, then see yourself wearing any garment from supported e-commerce websites using AI-powered virtual try-on technology.

![Virtual Try-On](https://via.placeholder.com/800x400?text=Virtual+Try-On+Demo)

## ✨ Features

- 🖼️ **AI-Powered Try-On** - See realistic previews of yourself wearing clothes
- 🎨 **6 Artistic Themes** - Customize your experience with beautiful color themes
- 📏 **Size Recommendations** - Get size suggestions based on your measurements
- 🔍 **Auto Product Detection** - Automatically detects clothing on supported sites
- 💾 **Persistent Storage** - Your profile, measurements, and history are saved
- ⚡ **Fast Mode** - Optimized for speed (~10-15 seconds per generation)

## 🛍️ Supported Sites

| Site | Status |
|------|--------|
| Lululemon | ✅ Full support |
| Amazon | ✅ Full support |
| ASOS | ✅ Full support |
| Zara | ✅ Full support |
| H&M | ✅ Full support |
| Nordstrom | ✅ Full support |
| Nike | ✅ Full support |
| Uniqlo | ✅ Full support |
| Other sites | 🔄 Generic detection |

---

## 🚀 Deployment Guide

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.9 or higher) - [Download](https://www.python.org/)
- **Google Chrome** browser
- **Git** (optional, for cloning)

### Step 1: Clone or Download the Project

```bash
git clone https://github.com/your-username/fashion_chrome.git
cd fashion_chrome
```

Or download and extract the ZIP file.

### Step 2: Install Chrome Extension

#### 2.1 Install Node Dependencies

```bash
npm install
```

#### 2.2 Build the Extension

```bash
npm run build
```

This creates a `dist` folder with the built extension.

#### 2.3 Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist` folder from your project directory
5. The extension icon should appear in your toolbar! 🎉

### Step 3: Set Up the Backend Server

The backend is required for AI-powered try-on. Without it, the extension will use a basic preview mode.

#### 3.1 Create Python Virtual Environment

```bash
cd backend
python -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

#### 3.2 Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### 3.3 Configure AI Service (Choose One)

Create a `.env` file in the `backend` folder:

```bash
touch .env  # On Windows: type nul > .env
```

Add your API key(s) to the `.env` file:

##### Option A: Fal.ai (Recommended - Fast & Affordable)

```env
FAL_KEY=your_fal_api_key_here
```

**Get your key:**
1. Sign up at [fal.ai](https://fal.ai)
2. Go to [Dashboard → Keys](https://fal.ai/dashboard/keys)
3. Create a new key
4. Add billing info at [Billing](https://fal.ai/dashboard/billing)

**Cost:** ~$0.01-0.02 per image

##### Option B: Replicate (Best Quality)

```env
REPLICATE_API_TOKEN=r8_your_token_here
```

**Get your token:**
1. Sign up at [replicate.com](https://replicate.com)
2. Go to [Account → API Tokens](https://replicate.com/account/api-tokens)
3. Create a new token

**Cost:** ~$0.02-0.05 per image

##### Option C: Hugging Face (Free but Unreliable)

```env
HUGGINGFACE_API_TOKEN=hf_your_token_here
```

**Get your token:**
1. Sign up at [huggingface.co](https://huggingface.co)
2. Go to [Settings → Access Tokens](https://huggingface.co/settings/tokens)
3. Create a new token with "Read" permission

**Cost:** Free (uses public Spaces, may be slow/unavailable)

#### 3.4 Start the Backend Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     [TryOn] AI backends: Replicate=False, Fal=True, HuggingFace=False
```

#### 3.5 Verify Backend is Running

Open a new terminal and run:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "ai_enabled": true,
  "fal_configured": true
}
```

### Step 4: Using the Extension

1. **Open Chrome** and navigate to a supported clothing website (e.g., lululemon.com)
2. **Click the extension icon** in your toolbar
3. **Complete onboarding:**
   - Upload a full-body photo (front-facing, form-fitting clothes work best)
   - Optionally enter your measurements for size recommendations
4. **Browse products** - the extension will auto-detect clothing items
5. **Click "Try On"** to see yourself wearing the item!

---

## 🐳 Alternative: Docker Deployment

If you prefer Docker:

```bash
cd backend

# Build and run
docker-compose up --build

# Or without docker-compose:
docker build -t tryon-api .
docker run -p 8000:8000 \
  -e FAL_KEY=your_key_here \
  tryon-api
```

---

## 🎨 Color Themes

The extension includes 6 artistic color themes:

| Theme | Description |
|-------|-------------|
| **Champagne Gold** | Luxe fashion palette (default) |
| **Midnight Rose** | Deep purples & rose gold |
| **Ocean Dusk** | Teal meets warm coral |
| **Autumn Ember** | Warm rusts & forest greens |
| **Tokyo Night** | Neon pink on indigo |
| **Sage & Blush** | Earthy green & soft pink |

Change themes in **Settings** → **Color Theme**

---

## ⚡ Performance Tips

### For Faster Generation

1. **Use smaller photos** - Photos are auto-compressed, but starting small helps
2. **Good lighting** - Clear, well-lit photos process faster
3. **Simple backgrounds** - Solid backgrounds work best
4. **Fast mode is ON by default** - Uses fewer AI steps for speed

### Typical Generation Times

| Mode | Time |
|------|------|
| Fast Mode (default) | 8-15 seconds |
| Quality Mode | 15-25 seconds |
| Preview Only (no AI) | Instant |

---

## 🔧 Troubleshooting

### Extension not detecting products?

1. **Refresh the page** after installing the extension
2. **Check permissions** - The extension needs access to the website
3. **Supported site?** - Check if the site is in our supported list
4. **Console errors** - Right-click extension icon → Inspect → Console

### Backend not starting?

```bash
# Check if port 8000 is in use
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Try a different port
uvicorn app.main:app --reload --port 8001
```

### AI generation failing?

1. **Check your API key** - Verify it's correctly set in `.env`
2. **Check billing** - Most AI services require payment info
3. **Check backend logs** - Look for error messages in the terminal
4. **Test the health endpoint:**
   ```bash
   curl http://localhost:8000/health
   ```

### "No items detected" on a clothing page?

1. Wait for the page to fully load
2. Scroll down to load product images
3. Try refreshing and clicking the extension again

---

## 📁 Project Structure

```
fashion_chrome/
├── src/
│   ├── popup/
│   │   ├── main.tsx          # React entry point
│   │   └── Popup.tsx         # Main UI component
│   ├── background/
│   │   └── index.ts          # Service worker
│   ├── content/
│   │   └── product-detector.ts  # Detects products on pages
│   └── styles/
│       └── globals.css       # Tailwind + theme CSS
├── backend/
│   ├── app/
│   │   └── main.py           # FastAPI server
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile
│   └── .env                  # API keys (create this)
├── dist/                     # Built extension (after npm run build)
├── assets/
│   └── icon512.png           # Extension icon
├── manifest.json             # Extension manifest
├── package.json              # Node dependencies
├── vite.config.ts            # Build configuration
└── tailwind.config.js        # Tailwind configuration
```

---

## 🛠️ Tech Stack

### Chrome Extension
- **Build**: Vite + @crxjs/vite-plugin
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS with custom themes
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **Storage**: Chrome Storage API

### Backend
- **Server**: FastAPI (Python)
- **Image Processing**: Pillow
- **AI Services**: Fal.ai, Replicate, Hugging Face
- **HTTP Client**: httpx (async)

---

## 🔒 Privacy

- Photos are **only sent to the AI service** for try-on generation
- Profile data is stored **locally in your browser**
- No data is shared with third parties beyond AI processing
- You can delete all data anytime from the extension settings

---

## 📝 Development

### Run in Development Mode

```bash
# Terminal 1: Extension (with hot reload)
npm run dev

# Terminal 2: Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Build for Production

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Fal.ai](https://fal.ai) - Fast AI inference
- [IDM-VTON](https://github.com/yisol/IDM-VTON) - Virtual try-on model
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Lucide Icons](https://lucide.dev/) - Icons

---

<p align="center">Made with ❤️ for online shoppers everywhere</p>
