/**
 * content.js — YT Grab Content Script
 *
 * Injected into every YouTube page. Listens for messages from the popup
 * and returns the current video URL + title + thumbnail.
 *
 * Also monitors URL changes (YouTube is a SPA) and notifies the background.
 */

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__ytGrabInjected) return;
  window.__ytGrabInjected = true;

  // ---------------------------------------------------------------------------
  // MESSAGE HANDLER
  // ---------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case "GET_PAGE_INFO":
        sendResponse(getPageInfo());
        break;
      default:
        break;
    }
    // Return true not needed — getPageInfo is synchronous
  });

  // ---------------------------------------------------------------------------
  // PAGE INFO EXTRACTION
  // ---------------------------------------------------------------------------

  function getPageInfo() {
    const url = window.location.href;

    // Only process watch pages
    if (!url.includes("/watch")) {
      return { ok: false, error: "Not a YouTube video page.", url };
    }

    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId) {
      return { ok: false, error: "Could not find video ID in URL.", url };
    }

    // Title — try multiple selectors (YouTube updates DOM frequently)
    const title =
      document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string")?.textContent?.trim() ||
      document.querySelector("yt-formatted-string.ytd-watch-metadata")?.textContent?.trim() ||
      document.querySelector("h1.title")?.textContent?.trim() ||
      document.title?.replace(" - YouTube", "")?.trim() ||
      `YouTube Video ${videoId}`;

    // Channel name
    const channel =
      document.querySelector("ytd-channel-name yt-formatted-string a")?.textContent?.trim() ||
      document.querySelector("#channel-name a")?.textContent?.trim() ||
      "";

    // Thumbnail
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    // Duration from player
    const durationEl = document.querySelector(".ytp-time-duration");
    const duration = durationEl?.textContent?.trim() || "";

    return {
      ok: true,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      title,
      channel,
      thumbnail,
      duration,
    };
  }

  // ---------------------------------------------------------------------------
  // SPA NAVIGATION OBSERVER
  // ---------------------------------------------------------------------------
  // YouTube updates the URL via history.pushState without full page reloads.
  // We watch for this so the popup gets fresh data on navigation.

  let lastUrl = window.location.href;

  const navObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Notify background of navigation (background can relay to popup if open)
      chrome.runtime.sendMessage({ type: "TAB_NAVIGATED", url: lastUrl }).catch(() => {});
    }
  });

  navObserver.observe(document.body, { childList: true, subtree: true });
})();
