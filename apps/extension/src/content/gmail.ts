/**
 * MailTrace Webmail Companion - Gmail Content Script
 * Scoped strictly to mail.google.com
 * Never injects tracking scripts into recipient emails.
 * Only reports first-party thread viewing by the authenticated owner.
 */

console.log('[MailTrace] Gmail Webmail Companion initialized.');

function observeGmailThreads(): void {
  // Listen for message thread container renders in Gmail DOM
  const observer = new MutationObserver(() => {
    const threadHeaders = document.querySelectorAll('h2[data-thread-perm-id]');
    threadHeaders.forEach((header) => {
      const threadId = header.getAttribute('data-thread-perm-id');
      if (threadId && !header.getAttribute('data-mailtrace-observed')) {
        header.setAttribute('data-mailtrace-observed', 'true');
        reportConfirmedView(threadId);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

async function reportConfirmedView(threadId: string): Promise<void> {
  try {
    await fetch('http://localhost:3000/api/v1/events/confirm-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: threadId,
        deviceIdentifier: 'browser-extension-gmail',
        platform: 'EXTENSION',
      }),
    });
    console.log('[MailTrace] Emitted confirmed view for thread:', threadId);
  } catch {
    // API server unreachable or offline
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeGmailThreads);
} else {
  observeGmailThreads();
}
