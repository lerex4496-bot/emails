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
    try {
      chrome.storage.sync.get(['mailtrace_api_url'], (items) => {
        const saved = items?.mailtrace_api_url;
        if (saved && !saved.includes('localhost') && !saved.includes('127.0.0.1')) {
          currentApiUrl = saved.replace(/\/$/, '');
        } else {
          currentApiUrl = DEFAULT_API_URL;
        }
        console.log('[MailTrace Background] Active API URL:', currentApiUrl);
      });
    } catch (err) {
      console.debug('[MailTrace Background] Storage read notice:', err);
    }
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
    const doFetch = (apiBase: string) => {
      return fetch(`${apiBase}/api/v1/extension/tracking-status`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        });
    };

    doFetch(currentApiUrl)
      .catch(() => {
        if (currentApiUrl !== DEFAULT_API_URL) {
          return doFetch(DEFAULT_API_URL);
        }
        throw new Error('API server unreachable');
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
    const doPrepare = (apiBase: string) => {
      return fetch(`${apiBase}/api/v1/extension/prepare-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload || {}),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    };

    doPrepare(currentApiUrl)
      .catch(() => {
        if (currentApiUrl !== DEFAULT_API_URL) {
          return doPrepare(DEFAULT_API_URL);
        }
        throw new Error('API server unreachable');
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
    const doConfirm = (apiBase: string) => {
      return fetch(`${apiBase}/api/v1/events/confirm-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload || {}),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    };

    doConfirm(currentApiUrl)
      .catch(() => {
        if (currentApiUrl !== DEFAULT_API_URL) {
          return doConfirm(DEFAULT_API_URL);
        }
        throw new Error('API server unreachable');
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

// Auto-inject content script into open Gmail tabs upon install or extension reload
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    refreshConfig();
    try {
      if (chrome.tabs && chrome.scripting) {
        chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
          for (const tab of tabs) {
            if (tab.id) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['dist/content/gmail.js'],
              }).catch((err) => {
                console.debug('[MailTrace Background] Tab auto-inject notice:', err);
              });
            }
          }
        });
      }
    } catch (e) {
      console.debug('[MailTrace Background] onInstalled error:', e);
    }
  });
}

