/**
 * popup.js — YT Grab Popup Controller
 *
 * Flow:
 *  1. On open: query the active tab
 *  2. If YouTube watch page: inject content script (if needed) + request page info
 *  3. Request available formats from background
 *  4. Render UI (video card, quality chips, format tabs)
 *  5. On Download click: send START_DOWNLOAD to background → relay status
 */

"use strict";

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

const state = {
  activeTab: null,
  pageInfo: null,       // { ok, url, videoId, title, channel, thumbnail, duration }
  formats: null,        // { mp4Qualities, mp3Qualities }
  selectedFormat: "mp4",
  selectedQuality: "1080",
  downloading: false,
};

// ---------------------------------------------------------------------------
// DOM REFS
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const statusDot    = $("statusDot");
const stateNotYT   = $("stateNotYT");
const stateLoading = $("stateLoading");
const stateError   = $("stateError");
const errorMsg     = $("errorMsg");
const retryBtn     = $("retryBtn");
const panelMain    = $("panelMain");
const videoThumb   = $("videoThumb");
const videoTitle   = $("videoTitle");
const videoChannel = $("videoChannel");
const videoDuration= $("videoDuration");
const urlInput     = $("urlInput");
const copyBtn      = $("copyBtn");
const formatTabs   = $("formatTabs");
const qualityGrid  = $("qualityGrid");
const downloadBtn  = $("downloadBtn");
const downloadBtnText = $("downloadBtnText");
const feedback     = $("feedback");
const feedbackMsg  = $("feedbackMsg");
const progressFill = $("progressFill");

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);

async function init() {
  showState("loading");

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.activeTab = tab;

    if (!isYouTubeTab(tab)) {
      showState("notYT");
      setStatusDot("warn");
      return;
    }

    // Inject content script in case it wasn't auto-injected (e.g. extension just installed)
    await ensureContentScript(tab.id);

    // Get page info from content script
    const pageInfo = await sendToContent(tab.id, { type: "GET_PAGE_INFO" });

    if (!pageInfo || !pageInfo.ok) {
      showError(pageInfo?.error || "Could not get page info. Make sure you're on a video page.");
      return;
    }

    state.pageInfo = pageInfo;

    // Fetch available qualities from background
    const infoResp = await sendToBackground({ type: "GET_VIDEO_INFO", url: pageInfo.url });

    if (!infoResp || !infoResp.ok) {
      showError(infoResp?.error || "Failed to get video info from server.");
      return;
    }

    state.formats = { mp4: infoResp.mp4Qualities, mp3: infoResp.mp3Qualities };

    // Set default quality
    state.selectedFormat = "mp4";
    state.selectedQuality = "1080"; // sensible default

    renderPanel();
    setStatusDot("ok");

  } catch (err) {
    console.error("[YT Grab] init error:", err);
    showError(err.message || "Unexpected error during init.");
    setStatusDot("error");
  }
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------

function renderPanel() {
  const info = state.pageInfo;

  // Video card
  videoThumb.src = info.thumbnail;
  videoThumb.onerror = () => { videoThumb.style.display = "none"; };
  videoTitle.textContent = info.title || "Unknown Title";
  videoChannel.textContent = info.channel || "";
  videoDuration.textContent = info.duration || "";

  // URL
  urlInput.value = info.url;

  // Quality chips for current format
  renderQualityChips();

  showState("main");
}

function renderQualityChips() {
  qualityGrid.innerHTML = "";
  const qualities = state.selectedFormat === "mp4"
    ? state.formats.mp4
    : state.formats.mp3;

  // Set a valid default selection
  const validValues = qualities.map((q) => q.value);
  if (!validValues.includes(state.selectedQuality)) {
    state.selectedQuality = validValues[Math.min(2, validValues.length - 1)] || validValues[0];
  }

  qualities.forEach(({ label, value }) => {
    const chip = document.createElement("button");
    chip.className = "quality-chip" + (value === state.selectedQuality ? " selected" : "");
    chip.textContent = label;
    chip.dataset.value = value;
    chip.addEventListener("click", () => {
      state.selectedQuality = value;
      renderQualityChips();
    });
    qualityGrid.appendChild(chip);
  });
}

// ---------------------------------------------------------------------------
// EVENT HANDLERS
// ---------------------------------------------------------------------------

// Format tabs
formatTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  const format = tab.dataset.format;
  if (format === state.selectedFormat) return;

  state.selectedFormat = format;

  // Update active tab styling
  formatTabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.format === format));

  // Reset quality selection
  if (format === "mp4") state.selectedQuality = "1080";
  else state.selectedQuality = "320";

  renderQualityChips();
});

// Copy URL
copyBtn.addEventListener("click", async () => {
  const url = state.pageInfo?.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    copyBtn.classList.add("copied");
    setTimeout(() => copyBtn.classList.remove("copied"), 1800);
  } catch {
    // Fallback: select and exec copy
    urlInput.select();
    document.execCommand("copy");
  }
});

// Retry
retryBtn.addEventListener("click", () => init());

// Download
downloadBtn.addEventListener("click", handleDownload);

async function handleDownload() {
  if (state.downloading) return;

  const { url, title } = state.pageInfo;
  const { selectedFormat: format, selectedQuality: quality } = state;

  state.downloading = true;
  downloadBtn.disabled = true;
  downloadBtnText.textContent = "Starting…";

  feedback.classList.remove("hidden");
  progressFill.classList.remove("done");
  feedbackMsg.textContent = `Resolving ${format.toUpperCase()} stream…`;

  try {
    const payload = {
      url,
      format,
      quality,
      filename: sanitizeFilename(title),
    };

    const resp = await sendToBackground({ type: "START_DOWNLOAD", payload });

    if (resp && resp.ok) {
      progressFill.classList.add("done");
      feedbackMsg.textContent = "✓ Download started — check your Downloads folder.";
      downloadBtnText.textContent = "Download";
      setTimeout(() => {
        feedback.classList.add("hidden");
        progressFill.classList.remove("done");
      }, 4000);
    } else {
      const errText = resp?.error || "Download failed.";
      feedbackMsg.textContent = `✗ ${errText}`;
      progressFill.style.animation = "none";
      progressFill.style.width = "100%";
      progressFill.style.background = "var(--accent)";
      downloadBtnText.textContent = "Download";
      setTimeout(() => {
        feedback.classList.add("hidden");
        progressFill.style = "";
      }, 5000);
    }
  } catch (err) {
    feedbackMsg.textContent = `✗ ${err.message || "Unknown error."}`;
    downloadBtnText.textContent = "Download";
    setTimeout(() => feedback.classList.add("hidden"), 5000);
  } finally {
    state.downloading = false;
    downloadBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// UI HELPERS
// ---------------------------------------------------------------------------

function showState(which) {
  stateNotYT.classList.add("hidden");
  stateLoading.classList.add("hidden");
  stateError.classList.add("hidden");
  panelMain.classList.add("hidden");
  feedback.classList.add("hidden");

  switch (which) {
    case "notYT":   stateNotYT.classList.remove("hidden"); break;
    case "loading": stateLoading.classList.remove("hidden"); break;
    case "error":   stateError.classList.remove("hidden"); break;
    case "main":    panelMain.classList.remove("hidden"); break;
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  showState("error");
  setStatusDot("error");
}

function setStatusDot(status) {
  statusDot.className = "status-dot " + status;
}

// ---------------------------------------------------------------------------
// COMMUNICATION HELPERS
// ---------------------------------------------------------------------------

/**
 * Send a message to the background service worker.
 */
function sendToBackground(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

/**
 * Send a message to the content script in a specific tab.
 */
function sendToContent(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not be ready yet — this is expected sometimes
          resolve(null);
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * Ensure the content script is injected into the tab.
 * chrome.scripting.executeScript is idempotent if the script is already loaded
 * because content.js guards against double-injection with __ytGrabInjected.
 */
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    // Small delay to let the script initialize
    await sleep(150);
  } catch (_) {
    // May fail if already injected or insufficient permissions — that's OK
  }
}

// ---------------------------------------------------------------------------
// MISC HELPERS
// ---------------------------------------------------------------------------

function isYouTubeTab(tab) {
  if (!tab?.url) return false;
  try {
    const u = new URL(tab.url);
    return (u.hostname === "www.youtube.com" || u.hostname === "youtube.com");
  } catch {
    return false;
  }
}

function sanitizeFilename(name) {
  return (name || "video").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 120);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
