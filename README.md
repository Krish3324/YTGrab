# YT Grab — YouTube Video & Audio Downloader

A Chrome extension that downloads YouTube videos (MP4) and audio (MP3) via a local server powered by `yt-dlp`. Clean dark UI, no bloat, no tracking.

---

## 📁 Project Structure

```
yt-downloader/
├── extension/              # Chrome extension files
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── background.js       # Service worker — API calls, download management
│   ├── content.js          # Injected into YouTube — extracts video metadata
│   ├── manifest.json       # MV3 extension manifest
│   ├── popup.html          # Popup UI markup
│   ├── popup.css           # Popup styles (dark industrial theme)
│   └── popup.js            # Popup controller — UI logic, messaging
├── YTGrab-Server.exe       # Pre-built local server (no Python needed)
├── START-SERVER.bat        # Double-click to start the server
├── server.py               # Server source code (for developers)
├── requirements.txt        # Python dependencies
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start (No Python Required — Windows)

### Step 1: Start the Server
- Double-click **`START-SERVER.bat`**
- A terminal window opens — **keep it running** the entire time you use the extension
- You should see:
```
  ✅ ffmpeg found — all resolutions supported
  Server starting on http://127.0.0.1:9000
```

> ⚠️ **ffmpeg is required** for downloading 720p and above.
> Install it by running this in terminal:
> ```
> winget install --id Gyan.FFmpeg -e
> ```
> Then restart the server.

### Step 2: Install the Chrome Extension
1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the **`extension/`** folder inside this project
5. The **YTGrab** icon will appear in your Chrome toolbar — pin it for easy access

### Step 3: Download a Video
1. Open any YouTube video in Chrome
2. Click the **YTGrab** icon in the toolbar
3. Select **MP4** (video) or **MP3** (audio only)
4. Choose your preferred quality
5. Click **Download**
6. A **"Save As" dialog** will appear — choose where to save your file ✅

---

## 🛠️ For Developers (Run from Source)

### Requirements
- Python 3.8+
- ffmpeg → `winget install --id Gyan.FFmpeg -e`

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/yt-grab.git
cd yt-grab
pip install -r requirements.txt
python server.py
```

Then load the `extension/` folder in Chrome as described in Step 2 above.

### Build the `.exe` yourself

```bash
pip install pyinstaller
pyinstaller --onefile --name "YTGrab-Server" server.py
# Output: dist/YTGrab-Server.exe
```

---

## ⚙️ How It Works

```
User clicks Download
       ↓
popup.js sends request to background.js
       ↓
background.js POSTs to local server (127.0.0.1:9000)
       ↓
server.py downloads via yt-dlp to a temp folder
(video + audio downloaded in parallel, merged by ffmpeg)
       ↓
server.py streams the merged file back to Chrome
       ↓
Chrome shows "Save As" dialog → user picks save location ✅
       ↓
Temp file auto-deleted after 30 seconds
```

### Component Overview

| File | Role |
|---|---|
| `background.js` | Fetches file from local server, converts to data URL, triggers Save As dialog |
| `content.js` | Injected into YouTube pages — reads DOM for title, channel, duration, video ID |
| `popup.html/css/js` | The popup UI — format/quality selection, download button, progress feedback |
| `server.py` | Flask server — receives requests, runs yt-dlp, streams merged file back |
| `YTGrab-Server.exe` | Standalone bundled server — no Python needed |

---

## 🎯 Supported Formats & Qualities

**MP4 (Video + Audio)**
| Quality | Notes |
|---|---|
| 480p | Fast — usually pre-merged, no ffmpeg needed |
| 720p HD | Fast — usually pre-merged, no ffmpeg needed |
| 1080p FHD | Fast — usually pre-merged, no ffmpeg needed |
| 1440p 2K | Requires ffmpeg merge |
| 2160p 4K | Requires ffmpeg merge |

**MP3 (Audio Only)**
| Bitrate | Notes |
|---|---|
| 128 kbps | Smallest file size |
| 192 kbps | Good quality |
| 256 kbps | High quality |
| 320 kbps | Best quality |

---

## 🔧 Troubleshooting

**Popup shows "Not a YouTube video page"**
→ Make sure you're on `youtube.com/watch?v=...` — not a playlist, homepage, or Shorts.

**"Could not get page info"**
→ Refresh the YouTube page, then click the extension again.

**"Server error" or download doesn't start**
→ Make sure `START-SERVER.bat` is running and the terminal shows `Running on http://127.0.0.1:9000`

**No Save As dialog appears**
→ Check Chrome settings: `chrome://settings/downloads` → enable **"Ask where to save each file before downloading"**

**ffmpeg not found error**
→ Run: `winget install --id Gyan.FFmpeg -e` then restart the server

**Video downloads at lower quality than selected**
→ That quality may not be available for that specific video — yt-dlp falls back to the best available

**Download is slow**
→ Speed depends on your internet connection and YouTube's servers. The extension already uses parallel chunk downloads for maximum speed.

---

## ⚠️ Legal & Ethical Notice

This tool is intended for **personal, fair-use purposes only.**

- Only download content you have the right to download
- Downloading copyrighted content may violate YouTube's Terms of Service and applicable laws
- The authors are not responsible for how this tool is used

---

## 🧑‍💻 Development Notes

No build step needed for the extension — pure vanilla JS, HTML, CSS.

**Reload extension after edits:**
`chrome://extensions` → click the **↺ reload** icon on YT Grab

**Inspect the service worker:**
`chrome://extensions` → YT Grab → click **"Service Worker"** → DevTools opens

**Test the server directly:**
```bash
curl http://127.0.0.1:9000/health
```