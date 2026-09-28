/**
 * MailTrace Webmail Companion - Gmail Content Script
 * 
 * Capabilities:
 * 1. Injects a native tracking toggle into Gmail's Compose window.
 * 2. Injects invisible 1x1 tracking pixel & rewrites outbound links on Send.
 * 3. Renders truthful evidence checkmarks (✓, ✓✓) & tooltips in Gmail Sent/Inbox rows.
 * 4. Clicking any status badge jumps directly to the MailTrace Vercel Dashboard.
 * 5. Reports confirmed first-party thread viewing.
 */

console.log('[MailTrace] Gmail Webmail Companion active.');

// Default configuration fallbacks
let API_BASE_URL = 'http://localhost:3000';
let DASHBOARD_BASE_URL = 'https://emails-web-mu.vercel.app';
let TRACKING_ENABLED_BY_DEFAULT = true;

// Load user-configured URLs from Chrome storage if available
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(['mailtrace_api_url', 'mailtrace_dashboard_url', 'mailtrace_enabled'], (items) => {
    if (items.mailtrace_api_url) API_BASE_URL = items.mailtrace_api_url.replace(/\/$/, '');
    if (items.mailtrace_dashboard_url) DASHBOARD_BASE_URL = items.mailtrace_dashboard_url.replace(/\/$/, '');
    if (typeof items.mailtrace_enabled === 'boolean') TRACKING_ENABLED_BY_DEFAULT = items.mailtrace_enabled;
  });
}

// Injected styles for Gmail UI integration
function injectStyles(): void {
  if (document.getElementById('mailtrace-styles')) return;
  const style = document.createElement('style');
  style.id = 'mailtrace-styles';
  style.textContent = `
    .mailtrace-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      margin-left: 8px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 600;
      font-family: 'Google Sans', Roboto, sans-serif;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease-in-out;
      border: 1px solid rgba(59, 130, 246, 0.4);
      background: #eff6ff;
      color: #1d4ed8;
      vertical-align: middle;
    }
    .mailtrace-toggle-btn.off {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #64748b;
    }
    .mailtrace-toggle-btn:hover {
      opacity: 0.9;
      transform: translateY(-0.5px);
    }
    .mailtrace-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 6px;
      cursor: pointer;
      line-height: 1.2;
      transition: opacity 0.15s ease;
      vertical-align: middle;
    }
    .mailtrace-status-badge:hover {
      opacity: 0.8;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .mailtrace-badge-sent {
      background: #f1f5f9;
      color: #94a3b8;
      border: 1px solid #e2e8f0;
    }
    .mailtrace-badge-opened {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }
    .mailtrace-badge-clicked {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }
    .mailtrace-badge-replied {
      background: #faf5ff;
      color: #7c3aed;
      border: 1px solid #ddd6fe;
    }
    .mailtrace-tooltip {
      position: relative;
    }
    .mailtrace-tooltip::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 125%;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #f8fafc;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: normal;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 99999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    .mailtrace-tooltip:hover::after {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

// Cached tracking status from API
interface StatusItem {
  messageId: string;
  subject: string;
  recipientEmail: string;
  sentAt: string;
  status: string;
  confidence: string;
  eventLabel: string;
  totalOpens: number;
  totalClicks: number;
  uniqueClicks: number;
  replyReceived: boolean;
  lastActivity: string;
}

let cachedStatuses: StatusItem[] = [];
let lastStatusFetch = 0;

async function fetchTrackingStatuses(): Promise<StatusItem[]> {
  const now = Date.now();
  if (now - lastStatusFetch < 20000 && cachedStatuses.length > 0) {
    return cachedStatuses;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/extension/tracking-status`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.statuses)) {
        cachedStatuses = data.statuses;
        lastStatusFetch = now;
      }
    }
  } catch {
    // API not reachable
  }
  return cachedStatuses;
}

// 1. Hook into Gmail Compose Window
function observeComposeWindows(): void {
  // Gmail compose dialogs have role="dialog" or class M9
  const composeDialogs = document.querySelectorAll('div[role="dialog"]');
  composeDialogs.forEach((dialog) => {
    const bodyBox = dialog.querySelector('div[aria-label="Message Body"], div[role="textbox"]');
    if (!bodyBox) return;

    // Find the bottom toolbar (next to Send button)
    const toolbar = dialog.querySelector('tr.btC, div.btA, div.gU.Up');
    if (!toolbar) return;

    if (toolbar.querySelector('.mailtrace-toggle-btn')) return;

    // Create Toggle Button
    const btn = document.createElement('div');
    btn.className = 'mailtrace-toggle-btn' + (TRACKING_ENABLED_BY_DEFAULT ? '' : ' off');
    btn.setAttribute('data-mailtrace-active', TRACKING_ENABLED_BY_DEFAULT ? 'true' : 'false');
    btn.title = 'Click to toggle MailTrace pixel and click tracking';
    btn.innerHTML = TRACKING_ENABLED_BY_DEFAULT
      ? '<span>⚡</span> <span>Track: ON</span>'
      : '<span>⚪</span> <span>Track: OFF</span>';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyOn = btn.getAttribute('data-mailtrace-active') === 'true';
      const newState = !isCurrentlyOn;
      btn.setAttribute('data-mailtrace-active', newState ? 'true' : 'false');
      btn.className = 'mailtrace-toggle-btn' + (newState ? '' : ' off');
      btn.innerHTML = newState
        ? '<span>⚡</span> <span>Track: ON</span>'
        : '<span>⚪</span> <span>Track: OFF</span>';
    });

    toolbar.appendChild(btn);

    // Intercept Send Button
    const sendBtn = dialog.querySelector('div[role="button"][data-tooltip*="Send"], div.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
    if (sendBtn && !sendBtn.getAttribute('data-mailtrace-hooked')) {
      sendBtn.setAttribute('data-mailtrace-hooked', 'true');

      sendBtn.addEventListener('click', async () => {
        const isTracking = btn.getAttribute('data-mailtrace-active') === 'true';
        if (!isTracking) return;

        await injectTrackingIntoCompose(dialog);
      }, true); // Capture phase to inject before Gmail clears the compose box
    }
  });
}

// Inject tracking pixel and rewrite links in Compose Body
async function injectTrackingIntoCompose(dialog: Element): Promise<void> {
  const bodyEl = dialog.querySelector('div[aria-label="Message Body"], div[role="textbox"]');
  if (!bodyEl) return;

  // Prevent double injection
  if (bodyEl.querySelector('[data-mailtrace-pixel="true"]')) return;

  // Extract Subject
  const subjectInput = dialog.querySelector('input[name="subjectbox"]') as HTMLInputElement;
  const subject = subjectInput?.value || '(No Subject)';

  // Extract Recipient(s)
  const recipientEls = dialog.querySelectorAll('div[name="to"] [email], div[name="to"] [data-hovercard-id], input[name="to"]');
  const toList: Array<{ email: string; name?: string }> = [];

  recipientEls.forEach((el) => {
    const email = el.getAttribute('email') || el.getAttribute('data-hovercard-id') || (el as HTMLInputElement).value;
    if (email && email.includes('@')) {
      toList.push({ email });
    }
  });

  if (toList.length === 0) {
    const fallbackTo = dialog.querySelector('input[name="to"]') as HTMLInputElement;
    if (fallbackTo?.value && fallbackTo.value.includes('@')) {
      toList.push({ email: fallbackTo.value });
    }
  }

  // Extract Outbound Links
  const linkEls = Array.from(bodyEl.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  const links = linkEls
    .map((a) => a.href)
    .filter((href) => href && href.startsWith('http') && !href.includes('/t/'));

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/extension/prepare-tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        to: toList.length > 0 ? toList : [{ email: 'recipient@mailtrace.io' }],
        links,
        enableOpenTracking: true,
        enableClickTracking: links.length > 0,
      }),
    });

    if (res.ok) {
      const data = await res.json();

      // 1. Rewrite Outbound Links
      if (Array.isArray(data.trackedLinks)) {
        for (const item of data.trackedLinks) {
          linkEls.forEach((a) => {
            if (a.href === item.originalUrl) {
              a.href = item.trackedUrl;
              a.setAttribute('data-mailtrace-tracked', 'true');
            }
          });
        }
      }

      // 2. Append Invisible Tracking Pixel (1x1 PNG)
      if (data.pixelUrl) {
        const pixel = document.createElement('img');
        pixel.src = data.pixelUrl;
        pixel.width = 1;
        pixel.height = 1;
        pixel.alt = '';
        pixel.setAttribute('data-mailtrace-pixel', 'true');
        pixel.setAttribute('style', 'display:none;width:0;height:0;max-height:0;visibility:hidden;border:0;');
        bodyEl.appendChild(pixel);
      }

      console.log('[MailTrace] Tracking pixel and link wrappers injected for:', subject);
    }
  } catch (err) {
    console.warn('[MailTrace] Could not contact tracking API:', err);
  }
}

// 2. Inject Status Badges in Gmail Message Rows (Sent / Inbox)
async function updateRowBadges(): Promise<void> {
  const statuses = await fetchTrackingStatuses();
  if (!statuses || statuses.length === 0) return;

  const rows = document.querySelectorAll('tr.zA, tr[role="row"]');
  rows.forEach((row) => {
    if (row.querySelector('.mailtrace-status-badge')) return;

    // Extract row subject text
    const subjectEl = row.querySelector('.bog, .bqe, span[data-thread-id]');
    const subjectText = subjectEl?.textContent?.trim() || '';

    // Extract row recipient / sender text
    const participantEl = row.querySelector('.yX, .yW, span[email]');
    const participantText = participantEl?.textContent?.trim() || '';

    if (!subjectText) return;

    // Find best match in tracked statuses
    const match = statuses.find((s) => {
      if (!s.subject) return false;
      const cleanSubject = s.subject.trim().toLowerCase();
      const rowSubject = subjectText.toLowerCase();
      return rowSubject.includes(cleanSubject) || cleanSubject.includes(rowSubject);
    });

    if (!match) return;

    // Create Status Badge
    const badge = document.createElement('span');
    badge.className = 'mailtrace-status-badge mailtrace-tooltip';

    let iconText = '✓';
    let badgeClass = 'mailtrace-badge-sent';
    let tooltipText = `${match.subject} — Sent`;

    if (match.replyReceived) {
      iconText = '✓✓ ↩';
      badgeClass = 'mailtrace-badge-replied';
      tooltipText = `Reply received! • ${match.eventLabel}`;
    } else if (match.totalClicks > 0) {
      iconText = '✓✓ ↗';
      badgeClass = 'mailtrace-badge-clicked';
      tooltipText = `Link clicked (${match.uniqueClicks} unique) • ${match.eventLabel}`;
    } else if (match.status === 'OPENED' || match.totalOpens > 0) {
      iconText = '✓✓';
      badgeClass = 'mailtrace-badge-opened';
      tooltipText = `${match.eventLabel} (${match.confidence} confidence)`;
    } else {
      iconText = '✓';
      badgeClass = 'mailtrace-badge-sent';
      tooltipText = `Delivered • Waiting for recipient`;
    }

    badge.className += ` ${badgeClass}`;
    badge.textContent = iconText;
    badge.setAttribute('data-tooltip', `${tooltipText} (Click to open Dashboard)`);

    // Click badge to view on Vercel Dashboard
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.open(`${DASHBOARD_BASE_URL}/messages/${match.messageId}`, '_blank');
    });

    // Insert badge before subject
    if (subjectEl && subjectEl.parentElement) {
      subjectEl.parentElement.insertBefore(badge, subjectEl);
    }
  });
}

// 3. Observe First-Party Thread Viewing
function observeGmailThreads(): void {
  const threadHeaders = document.querySelectorAll('h2[data-thread-perm-id]');
  threadHeaders.forEach((header) => {
    const threadId = header.getAttribute('data-thread-perm-id');
    if (threadId && !header.getAttribute('data-mailtrace-observed')) {
      header.setAttribute('data-mailtrace-observed', 'true');
      reportConfirmedView(threadId);
    }
  });
}

async function reportConfirmedView(threadId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/events/confirm-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: threadId,
        deviceIdentifier: 'browser-extension-gmail',
        platform: 'EXTENSION',
      }),
    });
  } catch {
    // Offline
  }
}

// Initialize Loop
function initializeGmailCompanion(): void {
  injectStyles();
  observeComposeWindows();
  updateRowBadges();
  observeGmailThreads();

  // Watch for dynamic DOM changes (Gmail is an SPA)
  const observer = new MutationObserver(() => {
    observeComposeWindows();
    updateRowBadges();
    observeGmailThreads();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Refresh status map every 30 seconds
  setInterval(updateRowBadges, 30000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGmailCompanion);
} else {
  initializeGmailCompanion();
}
