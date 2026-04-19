# YT Grab — YouTube Video & Audio Downloader

A Chrome extension that downloads YouTube videos (MP4) and audio (MP3) via a local server powered by `yt-dlp`. Clean dark UI, no bloat, no tracking, always asks where to save your file.

---

## ❓ Why a Local Server?

You might wonder — why does this extension need a local server running on your PC?

**The short answer: YouTube blocked public download APIs.**

- Services like [cobalt.tools](https://cobalt.tools) used to work as a public API
- YouTube actively blocks and rate-limits public download servers
- Public APIs break frequently, go down, or get blocked entirely
- Running `yt-dlp` **locally on your own machine** bypasses all of this — YouTube sees it as a normal browser request
- Your downloads never go through anyone else's server — **100% private**
- No rate limits, no downtime, no third-party dependencies

This is why the local server approach is the most **reliable, private, and fast** solution.

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

## 🚀 Installation (No Python Required — Windows)

### Step 1: Download the Project

- Click the green **"Code"** button on GitHub → **"Download ZIP"**
- Extract the ZIP anywhere on your PC (e.g. `C:\YTGrab\`)

---

### Step 2: Install ffmpeg (Required for 720p and above)

ffmpeg is needed to merge video and audio streams for HD quality.

Open **Command Prompt as Administrator** and run:

```
winget install --id Gyan.FFmpeg -e
```

After it installs, **restart your PC** (or restart the terminal).

Verify it works:
```
ffmpeg -version
```

You should see version info — not an error.

---

### Step 3: Install the Chrome Extension

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the **`extension/`** folder inside the extracted project
5. The **YTGrab** icon will appear in your Chrome toolbar
6. Click the puzzle piece 🧩 icon → pin **YTGrab** for easy access

---

### Step 4: Start the Server

Double-click **`START-SERVER.bat`**

A terminal window will open showing:
```
==========================================
  YT Grab Server - Starting...
==========================================
✅ ffmpeg found — all resolutions supported
Server starting on http://127.0.0.1:9000
```

> ⚠️ **Keep this window open** the entire time you use the extension.
> Closing it will stop all downloads.

---

### Step 5: Download a Video

1. Open any YouTube video in Chrome
2. Click the **YTGrab** icon in the toolbar
3. Select **MP4** (video) or **MP3** (audio only)
4. Choose your preferred quality
5. Click **Download**
6. A **"Save As" dialog** will appear — choose where to save ✅

---

## ⚡ Optional: Auto-Start Server on Windows Startup

Tired of manually double-clicking `START-SERVER.bat` every time?
Follow these steps to make the server start **automatically when Windows boots.**

### Method 1: Startup Folder (Easiest)

1. Press **`Win + R`** → type `shell:startup` → press Enter
2. A folder will open — this is your Windows Startup folder
3. Right-click inside it → **"New"** → **"Shortcut"**
4. Click **Browse** → navigate to your project folder → select **`START-SERVER.bat`**
5. Click **Next** → name it `YTGrab Server` → click **Finish**

Now every time Windows starts, the server will launch automatically in the background.

> 💡 **Tip:** To stop it from auto-starting, just delete the shortcut from the startup folder.

---

### Method 2: Task Scheduler (Runs hidden — no terminal window)

If you don't want a terminal window popping up on every boot:

1. Press **`Win + S`** → search **"Task Scheduler"** → open it
2. Click **"Create Basic Task"** on the right
3. Fill in:
   - **Name:** `YTGrab Server`
   - **Description:** `Starts YT Grab local download server`
4. Click **Next** → select **"When the computer starts"** → click **Next**
5. Select **"Start a program"** → click **Next**
6. Click **Browse** → select your **`YTGrab-Server.exe`** file
7. In **"Start in"** field → paste the full path to your project folder  
   e.g. `C:\YTGrab\yt-downloader\`
8. Click **Next** → check **"Open the Properties dialog"** → click **Finish**
9. In the Properties window:
   - Go to **"General"** tab
   - Check **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**
10. Click **OK** → enter your Windows password if prompted

The server will now run silently on every boot — no terminal window needed.

> 💡 **To disable:** Open Task Scheduler → find `YTGrab Server` → right-click → **Disable**

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
server.py streams merged file back to Chrome
       ↓
Chrome shows "Save As" dialog → user picks save location ✅
       ↓
Temp file auto-deleted after 30 seconds
```

---

## 🎯 Supported Formats & Qualities

**MP4 (Video + Audio)**
| Quality | Speed | Notes |
|---|---|---|
| 480p | ⚡ Very Fast | Pre-merged, no ffmpeg needed |
| 720p HD | ⚡ Very Fast | Pre-merged, no ffmpeg needed |
| 1080p FHD | ⚡ Fast | Pre-merged, no ffmpeg needed |
| 1440p 2K | 🔄 Moderate | Requires ffmpeg merge |
| 2160p 4K | 🔄 Slower | Requires ffmpeg merge, large file |

**MP3 (Audio Only)**
| Bitrate | Quality |
|---|---|
| 128 kbps | Good — smallest file |
| 192 kbps | Better |
| 256 kbps | High quality |
| 320 kbps | Best quality |

---

## 🔧 Troubleshooting

**Popup shows "Not a YouTube video page"**
→ Make sure you're on `youtube.com/watch?v=...` — not a playlist, homepage, or Shorts.

**"Could not get page info"**
→ Refresh the YouTube page, then click the extension again.

**Server won't start / "ffmpeg not found"**
→ Run: `winget install --id Gyan.FFmpeg -e` then restart your PC and try again.

**"Server error" or download doesn't start**
→ Make sure `START-SERVER.bat` is running and the terminal shows `Running on http://127.0.0.1:9000`

**No Save As dialog appears**
→ Check Chrome settings: `chrome://settings/downloads` → enable **"Ask where to save each file before downloading"**

**Video downloads at lower quality than selected**
→ That quality may not be available for that specific video — yt-dlp automatically falls back to the best available quality.

**Download is slow**
→ Speed depends on your internet connection. The server already uses parallel chunk downloads for maximum speed.

**Windows Defender warns about the .exe**
→ This is a false positive — the `.exe` is built from the open source `server.py` in this repo using PyInstaller. You can verify by reading `server.py` and building it yourself (see Developer section below).

---

## 🛠️ For Developers (Run from Source)

### Requirements
- Python 3.10+ from **python.org** (not Microsoft Store)
- ffmpeg → `winget install --id Gyan.FFmpeg -e`

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/yt-grab.git
cd yt-grab
pip install -r requirements.txt
python server.py
```

Then load the `extension/` folder in Chrome as described in Step 3 above.

### Build the `.exe` yourself

```bash
pip install pyinstaller
pyinstaller --onefile --name "YTGrab-Server" --collect-all flask_cors --collect-all flask --collect-all yt_dlp server.py
# Output: dist/YTGrab-Server.exe
```

---

## ⚠️ Legal & Ethical Notice

This tool is intended for **personal, fair-use purposes only.**

- Only download content you have the right to download
- Downloading copyrighted content may violate YouTube's Terms of Service and applicable copyright laws in your country
- The authors are not responsible for how this tool is used
- No data is sent to any third-party server — everything runs locally on your machine

---

## 🧑‍💻 Developer Notes

**Reload extension after edits:**
`chrome://extensions` → click the **↺ reload** icon on YT Grab

**Inspect the service worker:**
`chrome://extensions` → YT Grab → click **"Service Worker"** → DevTools opens

**Test the server directly:**
```bash
curl http://127.0.0.1:9000/health
```

Expected response:
```json
{"ffmpeg": true, "message": "ffmpeg is ready", "status": "ok"}
```