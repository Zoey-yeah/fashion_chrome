# 👗 Virtual Try-On Chrome Extension

See yourself wearing any clothes while shopping online! Upload your photo once, then virtually try on items from your favorite stores.

![Virtual Try-On Demo](https://via.placeholder.com/800x400?text=See+Yourself+In+Any+Outfit)

## ✨ What It Does

- 📸 Upload your photo once, use it everywhere
- 🛍️ Automatically detects clothes on shopping websites
- 🪄 AI generates realistic images of you wearing the clothes
- 📏 Get size recommendations based on your measurements
- 🎨 Choose from 6 beautiful color themes

## 🛒 Works On These Sites

Lululemon, Amazon, ASOS, Zara, H&M, Nordstrom, Nike, Uniqlo, and more!

---

# 🚀 Easy Installation (5 minutes)

## What You Need First

Before installing, make sure you have:

1. **Google Chrome** browser
2. **Node.js** - [Download here](https://nodejs.org/) (click the big green LTS button)
3. **Python** - [Download here](https://www.python.org/downloads/) (click the yellow Download button)

> 💡 **Windows users:** When installing Python, make sure to check ✅ "Add Python to PATH"

---

## Step 1: Download This Project

**Option A: Download ZIP** (easiest)
1. Click the green **Code** button above
2. Click **Download ZIP**
3. Extract the ZIP file to your Desktop or Documents folder

**Option B: Using Git** (if you have it)
```bash
git clone https://github.com/Zoey-yeah/fashion_chrome.git
```

---

## Step 2: Run the Installer

### On Mac/Linux:

1. Open **Terminal**
2. Navigate to the project folder:
   ```bash
   cd ~/Desktop/fashion_chrome   # or wherever you extracted it
   ```
3. Run the installer:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

### On Windows:

1. Open the project folder
2. Double-click **`install.bat`**

The installer will:
- ✅ Check if Node.js and Python are installed
- ✅ Install all required packages
- ✅ Build the extension
- ✅ Help you set up your AI key (optional)

---

## Step 3: Add to Chrome

1. Open **Google Chrome**
2. Type `chrome://extensions` in the address bar and press Enter
3. Turn ON **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the **`dist`** folder inside the project

You should see the extension icon appear in your toolbar! 🎉

---

## Step 4: Start the Server

The server needs to run in the background for AI try-on to work.

### On Mac/Linux:
```bash
./start-server.sh
```

### On Windows:
Double-click **`start-server.bat`**

> 💡 Keep this window open while using the extension. You can minimize it.

---

## Step 5: Try It Out!

1. Go to [lululemon.com](https://shop.lululemon.com) or any supported store
2. Click the extension icon in Chrome
3. Upload a full-body photo of yourself
4. Browse products - they'll be detected automatically
5. Click **Try On** to see yourself in the outfit!

---

# 🔑 Setting Up AI (Optional but Recommended)

Without an AI key, you'll only see a preview overlay. With AI, you get realistic try-on images!

### Get a Fal.ai Key (Recommended)

1. Go to [fal.ai](https://fal.ai) and sign up
2. Go to **Dashboard** → **Keys**
3. Click **Create Key**
4. Go to **Billing** and add payment info (pay only for what you use, ~$0.01/image)
5. Copy your key

### Add the Key

Create a file called `.env` in the `backend` folder with this content:
```
FAL_KEY=your_key_here
```

Or re-run the installer and enter your key when prompted.

---

# 🎨 Customize Your Theme

Open the extension and go to **Settings** to choose from 6 color themes:

| Theme | Look |
|-------|------|
| Champagne Gold | Luxurious gold & burgundy |
| Midnight Rose | Purple & rose gold |
| Ocean Dusk | Teal & coral sunset |
| Autumn Ember | Warm orange & forest green |
| Tokyo Night | Neon pink & blue |
| Sage & Blush | Earthy green & soft pink |

---

# ❓ Troubleshooting

### "No items detected" on a clothing page

- Make sure the page fully loaded
- Try scrolling down to load images
- Refresh the page and try again

### Extension not working

- Make sure the server is running (Step 4)
- Check that Developer mode is ON in chrome://extensions
- Try removing and re-loading the extension

### AI try-on not working

- Check your API key is correct in `backend/.env`
- Make sure the server window shows "AI mode enabled"
- Check you have billing set up on fal.ai

### Server won't start

- Make sure Python is installed (`python --version` in terminal)
- Try running `pip install -r requirements.txt` in the backend folder

---

# 📱 Quick Reference

| Task | Command |
|------|---------|
| Install everything | `./install.sh` (Mac) or `install.bat` (Windows) |
| Start server | `./start-server.sh` (Mac) or `start-server.bat` (Windows) |
| Rebuild extension | `npm run build` |
| Load in Chrome | chrome://extensions → Load unpacked → select `dist` folder |

---

# 🙏 Credits

- AI powered by [Fal.ai](https://fal.ai)
- Virtual try-on model: [IDM-VTON](https://github.com/yisol/IDM-VTON)

---

<p align="center">
  Made with ❤️ for online shoppers everywhere
  <br>
  <a href="https://github.com/Zoey-yeah/fashion_chrome">⭐ Star this project</a> if you find it useful!
</p>
