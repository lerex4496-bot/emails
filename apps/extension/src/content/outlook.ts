/**
 * MailTrace Webmail Companion - Outlook Content Script
 * Scoped strictly to outlook.live.com and outlook.office.com
 */

console.log('[MailTrace] Outlook Webmail Companion initialized.');

function observeOutlookThreads(): void {
  const observer = new MutationObserver(() => {
    const readingPanes = document.querySelectorAll('div[aria-label="Reading Pane"]');
    readingPanes.forEach((pane) => {
      if (!pane.getAttribute('data-mailtrace-observed')) {
        pane.setAttribute('data-mailtrace-observed', 'true');
        reportConfirmedViewOutlook();
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

async function reportConfirmedViewOutlook(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
    try {
      chrome.runtime.sendMessage({
        action: 'CONFIRM_VIEW',
        payload: {
          messageId: '00000000-0000-0000-0000-000000000000',
          deviceIdentifier: 'browser-extension-outlook',
          platform: 'EXTENSION',
        },
      }, () => {
        if (chrome.runtime?.lastError) { /* ignore */ }
      });
    } catch {
      // Offline / context invalidated
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeOutlookThreads);
} else {
  observeOutlookThreads();
}
