/**
 * background.js — YT Grab Service Worker (MV3)
 */

const COBALT_API = "http://127.0.0.1:9000/";

// ---------------------------------------------------------------------------
// MESSAGE ROUTER
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "PING":
      sendResponse({ ok: true });
      break;

    case "GET_VIDEO_INFO":
      handleGetVideoInfo(message.url, sendResponse);
      return true;

    case "START_DOWNLOAD":
      handleStartDownload(message.payload, sendResponse);
      return true;

    default:
      sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
  }
});

// ---------------------------------------------------------------------------
// GET VIDEO INFO
// ---------------------------------------------------------------------------

async function handleGetVideoInfo(videoUrl, sendResponse) {
  try {
    if (!isValidYouTubeUrl(videoUrl)) {
      sendResponse({ ok: false, error: "Not a valid YouTube video URL." });
      return;
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      sendResponse({ ok: false, error: "Could not extract video ID." });
      return;
    }

    const mp4Qualities = [
      { label: "480p", value: "480" },
      { label: "720p (HD)", value: "720" },
      { label: "1080p (FHD)", value: "1080" },
      { label: "1440p (2K)", value: "1440" },
      { label: "2160p (4K)", value: "2160" },
    ];

    const mp3Qualities = [
      { label: "128 kbps", value: "128" },
      { label: "192 kbps", value: "192" },
      { label: "256 kbps", value: "256" },
      { label: "320 kbps (best)", value: "320" },
    ];

    sendResponse({ ok: true, videoId, videoUrl, mp4Qualities, mp3Qualities });

  } catch (err) {
    console.error("[YT Grab] handleGetVideoInfo error:", err);
    sendResponse({ ok: false, error: err.message || "Unknown error" });
  }
}

// ---------------------------------------------------------------------------
// START DOWNLOAD
// — Fix: Service Workers do NOT support URL.createObjectURL()
// — Solution: fetch the file, convert to base64 data URL, pass to chrome.downloads
// ---------------------------------------------------------------------------

async function handleStartDownload(payload, sendResponse) {
  const { url, format, quality, filename } = payload;

  try {
    if (!isValidYouTubeUrl(url)) {
      sendResponse({ ok: false, error: "Invalid YouTube URL." });
      return;
    }

    let endpoint = COBALT_API;
    try {
      const stored = await chrome.storage.sync.get("cobaltEndpoint");
      if (stored.cobaltEndpoint) endpoint = stored.cobaltEndpoint;
    } catch (_) { }

    const body = {
      url,
      videoQuality: format === "mp4" ? quality : "1080",
      downloadMode: format === "mp3" ? "audio" : "auto",
      audioBitrate: format === "mp3" ? quality : "192",
    };

    // Step 1: Fetch file from local server
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errMsg = `Server error ${response.status}`;
      try {
        const errData = await response.json();
        if (errData.error) errMsg = errData.error;
      } catch (_) { }
      sendResponse({ ok: false, error: errMsg });
      return;
    }

    // Step 2: Convert blob → base64 data URL
    // (URL.createObjectURL is NOT available in service workers)
    const blob = await response.blob();
    const ext = format === "mp3" ? "mp3" : "mp4";
    const mime = format === "mp3" ? "audio/mpeg" : "video/mp4";
    const suggestedFilename = sanitizeFilename(filename || `yt-grab-${Date.now()}`) + "." + ext;

    const dataUrl = await blobToDataUrl(blob, mime);

    // Step 3: Trigger download with saveAs: true → shows Save As dialog
    const downloadId = await triggerDownload(dataUrl, suggestedFilename);
    sendResponse({ ok: true, downloadId });

  } catch (err) {
    console.error("[YT Grab] handleStartDownload error:", err);
    sendResponse({ ok: false, error: err.message || "Download failed." });
  }
}

// ---------------------------------------------------------------------------
// BLOB → DATA URL  (works in service workers unlike createObjectURL)
// ---------------------------------------------------------------------------

function blobToDataUrl(blob, mime) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is like "data:video/mp4;base64,AAAA..."
      // We force the correct mime type in case the server sends a generic one
      const base64 = reader.result.split(",")[1];
      resolve(`data:${mime};base64,${base64}`);
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------
// CHROME DOWNLOADS
// ---------------------------------------------------------------------------

async function triggerDownload(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: true,               // ✅ Always show Save As dialog
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function isValidYouTubeUrl(url) {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "www.youtube.com" ||
        u.hostname === "youtube.com" ||
        u.hostname === "youtu.be") &&
      (u.pathname === "/watch" || u.hostname === "youtu.be")
    );
  } catch { return false; }
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    return u.searchParams.get("v") || null;
  } catch { return null; }
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 200);
}

console.log("[YT Grab] Background service worker loaded.");