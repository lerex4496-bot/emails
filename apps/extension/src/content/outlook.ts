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
  try {
    await fetch('http://localhost:3000/api/v1/events/confirm-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: '00000000-0000-0000-0000-000000000000',
        deviceIdentifier: 'browser-extension-outlook',
        platform: 'EXTENSION',
      }),
    });
  } catch {
    // Offline
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeOutlookThreads);
} else {
  observeOutlookThreads();
}
