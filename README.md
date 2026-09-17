# ⚡ Whis Video Structure Patcher

> **Lossless, in-browser ISO-BMFF container patching engine with surgical byte precision.**
> 100% client-side execution — Zero server uploads, zero quality degradation, zero re-encoding.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Railway](https://img.shields.io/badge/Railway-Deploy%20Ready-0B0D0E?logo=railway)](https://railway.app)
[![Web Standards](https://img.shields.io/badge/Engine-Web%20Worker%20%7C%20ArrayBuffer-a855f7)](https://developer.mozilla.org)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-10b981)](#-features)

---

## ✨ Features

- **🛡️ 100% Private & Local**: All parsing, container restructuring, and byte patching occur inside your browser memory (`ArrayBuffer` & `Web Worker`). Videos are never uploaded to any remote server.
- **⚡ Zero Re-encoding (Lossless)**: Preserves media payloads bit-for-bit while restructuring container headers. Audio and video quality remain completely untouched.
- **🎥 Live Video Stream Monitor**: Built-in player allows immediate verification of video stream and technical dimensions.
- **🔬 ISO-BMFF Pipeline Visualizer**: Real-time visual feedback tracking the transformation of container atoms:
  - `ftyp`: Branding and compatibility sanitized.
  - `moov`: Fast-start placement with technical audio track synthesis.
  - `mdat`: Primary raw media payloads preserved and safely re-indexed.
- **🌐 Deploy Anywhere**: Runs as a standalone Web App (Railway, Cloudflare Pages, Vercel, Netlify) or as a Manifest V3 Chrome Extension.

---

## 🚀 Deployment

### Option 1: Deploy to Railway (1-Click Container)

1. Fork or push this repository to your GitHub account.
2. Go to [Railway.app](https://railway.app) and create a **New Project**.
3. Choose **Deploy from GitHub repo** and select `video-patcher`.
4. Railway will automatically detect the `Dockerfile` and deploy the service.
5. In your Railway service settings under **Networking**, click **Generate Domain** to get your public URL (e.g. `https://your-app.up.railway.app`).

### Option 2: Deploy to Cloudflare Pages / Vercel (Static Web)

Because the engine is 100% static client-side JavaScript, you can host it for free on Cloudflare Pages or Vercel:
- **Build command**: *(leave blank)*
- **Output directory**: `.` *(root)*

### Option 3: Run Locally

Run a simple local web server:

```bash
# Using Python:
python -m http.server 8080

# Or using Node.js:
npx serve .
```
Then open `http://localhost:8080` in your browser.

### Option 4: Load as Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select this directory.

---

## 🛠️ Architecture

```
kryptonaep-video-patcher/
├── index.html         # Main Web App interface
├── app.html           # Chrome Extension popup/app entry
├── app.js             # UI controller, audio synthesis, preview logic
├── styles.css         # Modern dark-mode glassmorphism design system
├── worker.js          # Web Worker thread for async processing
├── mp4-patcher.js     # Low-level ISO-BMFF box parser & assembler
├── manifest.json      # Chrome Extension Manifest V3 configuration
├── background.js      # Extension service worker
├── Dockerfile         # Lightweight Nginx container for Railway
├── nginx.conf         # Nginx configuration template
└── README.md          # Documentation
```

---

## 📜 Technical Verification

An automated verification script is provided in `verify.sh` to validate the integrity of container atoms using `ffprobe`, `ffmpeg`, and `mp4dump`:

```bash
bash verify.sh OUTPUT.mp4 [ORIGINAL_INPUT.mp4]
```

---

## 🤝 Community & Links

- **GitHub**: [whiskyyyyys/video-patcher](https://github.com/whiskyyyyys/video-patcher)
- **TikTok**: [@whis](https://www.tiktok.com/@whis)
- **Discord**: [Join Whis Discord](https://discord.gg/whis)
