/**
 * MailTrace Webmail Companion - Background Service Worker (Manifest V3)
 * 
 * Handles all cross-origin API calls on behalf of content scripts (gmail.ts, outlook.ts).
 * This completely bypasses webpage Content Security Policy (CSP) restrictions
 * that block direct fetch() calls from mail.google.com.
 */

const DEFAULT_API_URL = 'https://mailtrace-api-7bx5.onrender.com';
let currentApiUrl = DEFAULT_API_URL;

// Initialize API URL from storage
function refreshConfig(): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['mailtrace_api_url'], (items) => {
      const saved = items.mailtrace_api_url;
      if (saved) {
        currentApiUrl = saved.replace(/\/$/, '');
      } else {
        currentApiUrl = DEFAULT_API_URL;
      }
      console.log('[MailTrace Background] Active API URL:', currentApiUrl);
    });
  }
}

refreshConfig();

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.mailtrace_api_url) {
      refreshConfig();
    }
  });
}

// Message Listener for Content Scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'GET_TRACKING_STATUS') {
    const url = `${currentApiUrl}/api/v1/extension/tracking-status`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, statuses: data.statuses || [] });
      })
      .catch((err) => {
        console.debug('[MailTrace Background] GET_TRACKING_STATUS notice:', err);
        sendResponse({ success: false, error: err.message, statuses: [] });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'PREPARE_TRACKING') {
    const url = `${currentApiUrl}/api/v1/extension/prepare-tracking`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload || {}),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        console.debug('[MailTrace Background] PREPARE_TRACKING notice:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.action === 'CONFIRM_VIEW') {
    const url = `${currentApiUrl}/api/v1/events/confirm-view`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload || {}),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});
