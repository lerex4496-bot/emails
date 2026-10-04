/**
 * MailTrace Webmail Companion - Gmail Content Script
 * 
 * Capabilities:
 * 1. Injects a native tracking toggle into Gmail's Compose window.
 * 2. Reliably intercepts Send button and Ctrl+Enter to inject 1x1 tracking pixel & rewrite links.
 * 3. Renders truthful evidence checkmarks (✓, ✓✓) & tooltips in Gmail Sent/Inbox rows.
 * 4. Clicking any status badge jumps directly to the MailTrace Dashboard (localhost:5173 or Vercel).
 * 5. Reports confirmed first-party thread viewing.
 */

console.log('[MailTrace] Gmail Webmail Companion active.');

// Default configuration fallbacks (Pointing directly to live Render cloud API and Vercel web)
let API_BASE_URL = 'https://mailtrace-api-7bx5.onrender.com';
let DASHBOARD_BASE_URL = 'https://emails-web-mu.vercel.app';
let TRACKING_ENABLED_BY_DEFAULT = true;

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(['mailtrace_api_url', 'mailtrace_dashboard_url', 'mailtrace_enabled'], (items) => {
    // Ignore stale localhost defaults if user hasn't explicitly customized
    if (items.mailtrace_api_url && !items.mailtrace_api_url.includes('localhost') && !items.mailtrace_api_url.includes('127.0.0.1')) {
      API_BASE_URL = items.mailtrace_api_url.replace(/\/$/, '');
    } else {
      API_BASE_URL = 'https://mailtrace-api-7bx5.onrender.com';
    }
    if (items.mailtrace_dashboard_url && !items.mailtrace_dashboard_url.includes('localhost') && !items.mailtrace_dashboard_url.includes('127.0.0.1')) {
      DASHBOARD_BASE_URL = items.mailtrace_dashboard_url.replace(/\/$/, '');
    } else {
      DASHBOARD_BASE_URL = 'https://emails-web-mu.vercel.app';
    }
    if (typeof items.mailtrace_enabled === 'boolean') {
      TRACKING_ENABLED_BY_DEFAULT = items.mailtrace_enabled;
    }
    refreshBadges();
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
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      padding: 1px 6px !important;
      border-radius: 4px !important;
      margin-right: 6px !important;
      cursor: pointer !important;
      line-height: 1.3 !important;
      transition: all 0.15s ease !important;
      vertical-align: middle !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      z-index: 5 !important;
    }
    .mailtrace-status-badge:hover {
      opacity: 0.85 !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
    }
    .mailtrace-recip-tick {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin-right: 6px !important;
      padding: 1px 5px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      vertical-align: middle !important;
      font-size: 13px !important;
      font-weight: 800 !important;
      letter-spacing: -1px !important;
      flex-shrink: 0 !important;
      line-height: 1.2 !important;
      background: rgba(128, 128, 128, 0.15) !important;
    }
    .mailtrace-recip-tick:hover {
      opacity: 0.85 !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
    }
    .mailtrace-thread-badge {
      font-size: 12px !important;
      padding: 2px 8px !important;
      margin-right: 8px !important;
      border-radius: 12px !important;
      vertical-align: middle !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
    }
    .mailtrace-badge-label {
      font-size: 11px !important;
      font-weight: 700 !important;
      margin-left: 2px !important;
    }
    .mailtrace-header-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      padding: 1px 6px !important;
      margin-left: 8px !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      vertical-align: middle !important;
    }
    .mailtrace-thread-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 14px;
      margin: 10px 0 14px 0;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #3b82f6;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'Google Sans', Roboto, sans-serif;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .mailtrace-thread-banner.opened {
      border-left-color: #16a34a;
      background: #f0fdf4;
    }
    .mailtrace-thread-banner.clicked {
      border-left-color: #2563eb;
      background: #eff6ff;
    }
    .mailtrace-banner-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .mailtrace-badge-pill {
      font-size: 11px;
      font-weight: 700;
      background: #1e293b;
      color: #fff;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.3px;
    }
    .mailtrace-banner-text {
      color: #475569;
      font-size: 12px;
    }
    .mailtrace-banner-btn {
      padding: 4px 10px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease;
    }
    .mailtrace-banner-btn:hover {
      background: #1d4ed8;
    }
    .mailtrace-badge-sent {
      background: #f1f5f9 !important;
      color: #64748b !important;
      border: 1px solid #cbd5e1 !important;
    }
    .mailtrace-badge-delivered {
      background: #f8fafc !important;
      color: #475569 !important;
      border: 1px solid #94a3b8 !important;
    }
    .mailtrace-badge-opened {
      background: #dcfce7 !important;
      color: #15803d !important;
      border: 1px solid #86efac !important;
    }
    .mailtrace-badge-clicked {
      background: #eff6ff !important;
      color: #1d4ed8 !important;
      border: 1px solid #93c5fd !important;
    }
    .mailtrace-badge-replied {
      background: #faf5ff !important;
      color: #7c3aed !important;
      border: 1px solid #c4b5fd !important;
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
      padding: 5px 9px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: normal;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
let isFetchingStatuses = false;

let pollInterval: any = null;

function cleanupInvalidatedExtension(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function isExtensionValid(): boolean {
  try {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  } catch {
    cleanupInvalidatedExtension();
    return false;
  }
}

async function fetchTrackingStatuses(): Promise<StatusItem[]> {
  if (!isExtensionValid()) {
    cleanupInvalidatedExtension();
    return cachedStatuses;
  }
  const now = Date.now();
  if (now - lastStatusFetch < 4000 && cachedStatuses.length > 0) {
    return cachedStatuses;
  }
  if (isFetchingStatuses && cachedStatuses.length > 0) {
    return cachedStatuses;
  }

  isFetchingStatuses = true;

  // 1. Primary path: Call background service worker (Bypasses Gmail CSP)
  if (isExtensionValid() && typeof chrome.runtime.sendMessage === 'function') {
    try {
      const response = await new Promise<{ success?: boolean; statuses?: StatusItem[]; error?: string }>((resolve) => {
        if (!isExtensionValid()) {
          cleanupInvalidatedExtension();
          resolve({ success: false });
          return;
        }
        try {
          chrome.runtime.sendMessage({ action: 'GET_TRACKING_STATUS' }, (resp) => {
            const err = chrome.runtime?.lastError;
            if (err || !isExtensionValid()) {
              cleanupInvalidatedExtension();
              resolve({ success: false });
            } else {
              resolve(resp || { success: false });
            }
          });
        } catch {
          cleanupInvalidatedExtension();
          resolve({ success: false });
        }
      });

      if (response && response.success && Array.isArray(response.statuses)) {
        cachedStatuses = response.statuses;
        lastStatusFetch = now;
      }
    } catch {
      cleanupInvalidatedExtension();
    }
  }

  isFetchingStatuses = false;
  return cachedStatuses;
}

// 1. Hook into Gmail Compose Window (Standard, Docked, Fullscreen, and Inline)
function observeComposeWindows(): void {
  // Query all possible compose dialogs, windows, and containers
  const composeDialogs = document.querySelectorAll<HTMLElement>(
    'div[role="dialog"], div[role="region"], div.M9, div.AD, div.inboxsdk__compose, table.cf.An, div[aria-label*="Compose"], div[aria-label*="New Message"], div.nH.Hd'
  );

  composeDialogs.forEach((dialog) => {
    hookComposeDialog(dialog);
  });

  // Direct fallback: find any Send buttons anywhere in document
  const sendBtns = document.querySelectorAll<HTMLElement>(
    'div[role="button"][data-tooltip*="Send"]:not([data-mailtrace-hooked]), div.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3:not([data-mailtrace-hooked]), div[aria-label*="Send"]:not([data-mailtrace-hooked])'
  );
  sendBtns.forEach((sendBtn) => {
    const dialog =
      sendBtn.closest<HTMLElement>('div[role="dialog"], div[role="region"], div.M9, div.AD, table.cf.An, div.nH') ||
      sendBtn.parentElement?.parentElement;
    if (dialog) {
      hookComposeDialog(dialog);
    }
  });
}

function hookComposeDialog(dialog: HTMLElement): void {
  // Check if toggle button already injected
  if (dialog.querySelector('.mailtrace-toggle-btn')) return;

  const sendBtn = dialog.querySelector<HTMLElement>(
    'div[role="button"][data-tooltip*="Send"], div.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3, div[aria-label*="Send"], div[data-tooltip^="Send"]'
  );
  if (!sendBtn) return;

  // Find toolbar container
  const toolbar =
    dialog.querySelector<HTMLElement>('tr.btC, td.gU.Up, td.gU, div.btA, div.gU.Up, [role="toolbar"]') ||
    sendBtn.closest<HTMLElement>('tr, td, .gU, .btA, div.dC') ||
    sendBtn.parentElement;

  if (!toolbar) return;

  // Create Toggle Button
  const btn = document.createElement('div');
  btn.className = 'mailtrace-toggle-btn' + (TRACKING_ENABLED_BY_DEFAULT ? '' : ' off');
  btn.setAttribute('data-mailtrace-active', TRACKING_ENABLED_BY_DEFAULT ? 'true' : 'false');
  btn.title = 'Click to toggle MailTrace tracking on/off for this email';
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

  // Insert right next to Send button
  if (sendBtn.parentElement && sendBtn.parentElement !== toolbar) {
    sendBtn.parentElement.appendChild(btn);
  } else if (sendBtn.nextSibling) {
    sendBtn.parentElement?.insertBefore(btn, sendBtn.nextSibling);
  } else {
    toolbar.appendChild(btn);
  }

  // Intercept Send Button & Ctrl+Enter with reliable race-condition prevention
  if (!sendBtn.getAttribute('data-mailtrace-hooked')) {
    sendBtn.setAttribute('data-mailtrace-hooked', 'true');

    let isPrepared = false;
    let isInjecting = false;

    const triggerTrackedSend = async (e: Event) => {
      if (isPrepared) {
        return;
      }

      const isTracking = btn.getAttribute('data-mailtrace-active') === 'true';
      if (!isTracking) {
        return;
      }

      // Intercept and prevent Gmail from submitting immediately
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (isInjecting) return;
      isInjecting = true;
      btn.innerHTML = '<span>⏳</span> <span>Tracking...</span>';

      try {
        await injectTrackingIntoCompose(dialog);
      } catch (err) {
        console.error('[MailTrace] Injection error:', err);
      } finally {
        isPrepared = true;
        isInjecting = false;
        btn.innerHTML = '<span>⚡</span> <span>Track: ON</span>';
        sendBtn.click();
      }
    };

    sendBtn.addEventListener('click', triggerTrackedSend, true);

    dialog.addEventListener('keydown', (e: any) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        triggerTrackedSend(e);
      }
    }, true);
  }
}

// Inject tracking pixel and rewrite links in Compose Body
async function injectTrackingIntoCompose(dialog: HTMLElement): Promise<void> {
  const bodyEl = dialog.querySelector<HTMLElement>(
    'div[aria-label*="Message Body"], div[role="textbox"], div[contenteditable="true"], .Am.Al.editable, div[aria-label*="Body"]'
  );
  if (!bodyEl) return;

  // Prevent duplicate pixel injection
  if (bodyEl.querySelector('[data-mailtrace-pixel="true"]')) return;

  // Extract Subject
  const subjectInput = dialog.querySelector<HTMLInputElement>(
    'input[name="subjectbox"], input[placeholder*="Subject"], input[aria-label*="Subject"]'
  );
  const rawSubject = subjectInput?.value?.trim();
  const subject = rawSubject || '(no subject)';

  // Extract Recipient(s)
  const toList: Array<{ email: string; name?: string }> = [];
  const recipientEls = dialog.querySelectorAll<HTMLElement>(
    '[email], [data-hovercard-id], input[name="to"], input[peoplekit-id], div[name="to"] span, [aria-label*="To"]'
  );

  recipientEls.forEach((el) => {
    const email = el.getAttribute('email') || el.getAttribute('data-hovercard-id') || (el as HTMLInputElement).value;
    if (email && email.includes('@')) {
      const clean = email.trim();
      if (!toList.some((r) => r.email.toLowerCase() === clean.toLowerCase())) {
        toList.push({ email: clean });
      }
    }
  });

  if (toList.length === 0) {
    const fallbackTo = dialog.querySelector<HTMLInputElement>('input[name="to"]');
    if (fallbackTo?.value && fallbackTo.value.includes('@')) {
      toList.push({ email: fallbackTo.value.trim() });
    }
  }

  // Extract Outbound Links
  const linkEls = Array.from(bodyEl.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  const links = linkEls
    .map((a) => a.href)
    .filter((href) => href && href.startsWith('http') && !href.includes('/t/'));

  const trackingPayload = {
    subject,
    to: toList.length > 0 ? toList : [{ email: 'recipient@example.com' }],
    links,
    enableOpenTracking: true,
    enableClickTracking: links.length > 0,
  };

  let trackingData: any = null;

  // 1. Primary path: Background service worker (Bypasses Gmail CSP)
  if (isExtensionValid() && typeof chrome.runtime.sendMessage === 'function') {
    try {
      const resp = await new Promise<any>((resolve) => {
        if (!isExtensionValid()) {
          resolve(null);
          return;
        }
        chrome.runtime.sendMessage({ action: 'PREPARE_TRACKING', payload: trackingPayload }, (response) => {
          if (!isExtensionValid() || chrome.runtime?.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
      if (resp && resp.success && resp.data) {
        trackingData = resp.data;
      }
    } catch {
      // Extension context invalidated
    }
  }

  if (trackingData) {
    // 1. Rewrite Outbound Links
    if (Array.isArray(trackingData.trackedLinks)) {
      for (const item of trackingData.trackedLinks) {
        linkEls.forEach((a) => {
          if (a.href === item.originalUrl) {
            a.href = item.trackedUrl;
            a.setAttribute('data-mailtrace-tracked', 'true');
          }
        });
      }
    }

    // 2. Append Invisible Tracking Pixel (1x1 PNG)
    if (trackingData.pixelUrl) {
      const pixel = document.createElement('img');
      pixel.src = trackingData.pixelUrl;
      pixel.width = 1;
      pixel.height = 1;
      pixel.alt = '';
      pixel.setAttribute('data-mailtrace-pixel', 'true');
      pixel.setAttribute('style', 'width:1px!important;height:1px!important;border:0!important;padding:0!important;margin:0!important;outline:none!important;opacity:0.01!important;');
      bodyEl.appendChild(pixel);
    }

    console.log('[MailTrace] Tracking pixel and link wrappers injected for:', subject);
    setTimeout(refreshBadges, 800);
  }
}

// Centralized status badge appearance configuration
interface BadgeConfig {
  iconHtml: string;
  label: string;
  cssClass: string;
  tooltip: string;
}

function getBadgeConfig(match: StatusItem): BadgeConfig {
  if (match.replyReceived || match.status === 'REPLIED') {
    return {
      iconHtml: '<span style="color:#16a34a;font-weight:800;">✓✓</span> <span style="color:#7c3aed;font-weight:900;">↩</span>',
      label: 'Replied',
      cssClass: 'mailtrace-badge-replied',
      tooltip: `Reply received! • ${match.eventLabel}`,
    };
  }
  if (match.totalClicks > 0 || match.status === 'CLICKED') {
    return {
      iconHtml: '<span style="color:#16a34a;font-weight:800;">✓✓</span> <span style="color:#2563eb;font-weight:900;">↗</span>',
      label: 'Clicked',
      cssClass: 'mailtrace-badge-clicked',
      tooltip: `Link clicked (${match.uniqueClicks} unique) • ${match.eventLabel}`,
    };
  }
  if (match.status === 'OPENED' || match.totalOpens > 0) {
    return {
      iconHtml: '<span style="color:#16a34a;font-weight:800;">✓✓</span>',
      label: 'Opened',
      cssClass: 'mailtrace-badge-opened',
      tooltip: `${match.eventLabel} (${match.confidence} confidence)`,
    };
  }
  if (match.status === 'DELIVERED') {
    return {
      iconHtml: '<span style="color:#64748b;font-weight:800;">✓✓</span>',
      label: 'Delivered',
      cssClass: 'mailtrace-badge-delivered',
      tooltip: 'Delivered to recipient • Not yet opened',
    };
  }
  return {
    iconHtml: '<span style="color:#94a3b8;font-weight:700;">✓</span>',
    label: 'Sent',
    cssClass: 'mailtrace-badge-sent',
    tooltip: 'Sent • Waiting for recipient',
  };
}

// Robust multi-pass status matcher with exact subject priority
function findStatusMatch(
  subjectText: string,
  participantText: string,
  rowFullText: string,
  statuses: StatusItem[],
  claimedIds?: Set<string>
): StatusItem | undefined {
  const normSubject = (subjectText || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
  const normParticipant = (participantText || '').toLowerCase().trim();
  const normRow = (rowFullText || '').toLowerCase().trim();

  const isRowNoSubj = !normSubject || normSubject === '(no subject)' || normSubject === 'no subject';

  const isRecipMatch = (s: StatusItem) => {
    const sRecip = (s.recipientEmail || '').toLowerCase().trim();
    if (!sRecip) return false;
    const sPrefix = sRecip.split('@')[0] || '';

    if (normParticipant.includes(sRecip) || normRow.includes(sRecip)) return true;
    if (sPrefix.length >= 3) {
      if (normParticipant.includes(sPrefix) || normRow.includes(sPrefix)) return true;
      const cleanPart = normParticipant.replace(/[\.\s]+$/, '');
      if (cleanPart && (sPrefix.startsWith(cleanPart) || cleanPart.startsWith(sPrefix))) return true;
    }
    return false;
  };

  // PASS 1: Exact Subject Match + Recipient Match
  for (const s of statuses) {
    if (claimedIds && claimedIds.has(s.messageId)) continue;
    const cleanSubj = (s.subject || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
    const isStatusNoSubj = !cleanSubj || cleanSubj === '(no subject)' || cleanSubj === 'no subject';

    if (isRecipMatch(s)) {
      if (isRowNoSubj && isStatusNoSubj) {
        return s;
      }
      if (!isRowNoSubj && !isStatusNoSubj && cleanSubj === normSubject) {
        return s;
      }
    }
  }

  // PASS 2: Exact Subject Match without strict recipient match (e.g. if Gmail displays contact name instead of email)
  if (!isRowNoSubj) {
    for (const s of statuses) {
      if (claimedIds && claimedIds.has(s.messageId)) continue;
      const cleanSubj = (s.subject || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
      if (cleanSubj && cleanSubj !== '(no subject)' && cleanSubj.length >= 2) {
        if (normSubject.includes(cleanSubj) || normRow.includes(cleanSubj)) {
          return s;
        }
      }
    }
  }

  // PASS 3: Prefix / Truncated Subject Match + Recipient Match (minimum 4 characters)
  if (!isRowNoSubj && normSubject.length >= 4) {
    for (const s of statuses) {
      if (claimedIds && claimedIds.has(s.messageId)) continue;
      const cleanSubj = (s.subject || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
      if (!cleanSubj || cleanSubj === '(no subject)' || cleanSubj.length < 4) continue;

      if (isRecipMatch(s)) {
        if (normSubject.startsWith(cleanSubj) || cleanSubj.startsWith(normSubject) || normSubject.includes(cleanSubj)) {
          return s;
        }
      }
    }
  }

  // PASS 4: (no subject) + Recipient Match
  if (isRowNoSubj) {
    for (const s of statuses) {
      if (claimedIds && claimedIds.has(s.messageId)) continue;
      const cleanSubj = (s.subject || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
      if (!cleanSubj || cleanSubj === '(no subject)') {
        if (isRecipMatch(s)) return s;
      }
    }
  }

  return undefined;
}

// 2. Inject & Live-Update Status Badges in Gmail Message Rows (Sent / Inbox)
function updateRowBadges(statuses: StatusItem[]): void {
  const rows = document.querySelectorAll('tr.zA, tr[role="row"]');
  const claimedIds = new Set<string>();

  rows.forEach((row) => {
    // Search subject strictly within subject element (.bog or .bqe) to avoid matching stray spans
    const subjectEl = row.querySelector('.bog, .bqe, span[data-thread-id]');
    const subjectCell = row.querySelector('td.a4W, td.xY.a4W, .xT');
    const subjectText = subjectEl?.textContent?.trim() || '';

    // Search recipient ONLY within recipient cell (td.yX, .yW, .yP)
    const participantEl = row.querySelector('td.yX, .yW, .yP, span[email]');
    const participantEmail = participantEl?.getAttribute('email') || '';
    const participantText = participantEmail || participantEl?.textContent?.trim() || '';

    const rowFullText = row.textContent?.trim() || '';

    const match = findStatusMatch(subjectText, participantText, rowFullText, statuses, claimedIds);
    if (!match) return;

    claimedIds.add(match.messageId);

    const cfg = getBadgeConfig(match);
    const existingBadge = row.querySelector('.mailtrace-status-badge') as HTMLElement | null;
    const existingTick = row.querySelector('.mailtrace-recip-tick') as HTMLElement | null;

    // A. Inject or update subject status badge
    if (existingBadge) {
      if (
        existingBadge.getAttribute('data-mailtrace-status') !== match.status ||
        existingBadge.getAttribute('data-mailtrace-message-id') !== match.messageId ||
        existingBadge.getAttribute('data-mailtrace-clicks') !== String(match.totalClicks) ||
        existingBadge.getAttribute('data-mailtrace-opens') !== String(match.totalOpens)
      ) {
        existingBadge.className = `mailtrace-status-badge mailtrace-tooltip ${cfg.cssClass}`;
        existingBadge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;
        existingBadge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
        existingBadge.setAttribute('data-mailtrace-status', match.status);
        existingBadge.setAttribute('data-mailtrace-message-id', match.messageId);
        existingBadge.setAttribute('data-mailtrace-clicks', String(match.totalClicks));
        existingBadge.setAttribute('data-mailtrace-opens', String(match.totalOpens));
      }
    } else {
      const badge = document.createElement('span');
      badge.className = `mailtrace-status-badge mailtrace-tooltip ${cfg.cssClass}`;
      badge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;
      badge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
      badge.setAttribute('data-mailtrace-status', match.status);
      badge.setAttribute('data-mailtrace-message-id', match.messageId);
      badge.setAttribute('data-mailtrace-clicks', String(match.totalClicks));
      badge.setAttribute('data-mailtrace-opens', String(match.totalOpens));

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(`${DASHBOARD_BASE_URL}/messages/${match.messageId}`, '_blank');
      });

      // Insert right before subject line
      if (subjectEl && subjectEl.parentElement) {
        subjectEl.parentElement.insertBefore(badge, subjectEl);
      } else {
        const insertTarget = subjectCell?.querySelector('.xT, .y6') || subjectCell;
        if (insertTarget) {
          insertTarget.insertBefore(badge, insertTarget.firstChild);
        } else {
          const container = row.querySelector('.y6, .xY, td.xY, td.yX');
          if (container) {
            container.prepend(badge);
          }
        }
      }
    }

    // B. Inject or live-update sleek tick directly in Recipient column (.yW, td.yX)
    const recipCell = row.querySelector('.yW, td.yX') || participantEl?.parentElement || row.querySelector('td.yX, .yW, .yP');
    if (existingTick) {
      if (
        existingTick.getAttribute('data-mailtrace-status') !== match.status ||
        existingTick.getAttribute('data-mailtrace-message-id') !== match.messageId
      ) {
        existingTick.className = `mailtrace-recip-tick mailtrace-tooltip ${cfg.cssClass}`;
        existingTick.innerHTML = cfg.iconHtml;
        existingTick.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
        existingTick.setAttribute('data-mailtrace-status', match.status);
        existingTick.setAttribute('data-mailtrace-message-id', match.messageId);
      }
    } else if (recipCell) {
      const tick = document.createElement('span');
      tick.className = `mailtrace-recip-tick mailtrace-tooltip ${cfg.cssClass}`;
      tick.innerHTML = cfg.iconHtml;
      tick.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
      tick.setAttribute('data-mailtrace-status', match.status);
      tick.setAttribute('data-mailtrace-message-id', match.messageId);
      tick.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(`${DASHBOARD_BASE_URL}/messages/${match.messageId}`, '_blank');
      });
      recipCell.insertBefore(tick, recipCell.firstChild);
    }
  });
}

// 3. Inject & Live-Update Badges & Telemetry into Open Thread / Email View
function updateThreadBadges(statuses: StatusItem[]): void {
  // Look for thread subject headings in open email view (e.g. "hi")
  const threadHeadings = document.querySelectorAll('h2.hP, div[role="main"] h2');
  threadHeadings.forEach((heading) => {
    const subjectText = heading.textContent?.trim() || '';
    if (!subjectText) return;

    // Search for recipient info anywhere in this thread view
    const mainView = document.querySelector('div[role="main"]');
    const participantEls = mainView ? mainView.querySelectorAll('span[email], .g2, .hb, .gD') : [];
    let participantText = '';
    participantEls.forEach((el) => {
      participantText += ' ' + (el.getAttribute('email') || el.textContent || '');
    });

    const match = findStatusMatch(subjectText, participantText, subjectText + ' ' + participantText, statuses);
    if (!match) return;

    const cfg = getBadgeConfig(match);
    const existingThreadBadge = heading.querySelector('.mailtrace-thread-badge') as HTMLElement | null;

    if (existingThreadBadge) {
      if (existingThreadBadge.getAttribute('data-mailtrace-status') !== match.status) {
        existingThreadBadge.className = `mailtrace-status-badge mailtrace-thread-badge mailtrace-tooltip ${cfg.cssClass}`;
        existingThreadBadge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
        existingThreadBadge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;
        existingThreadBadge.setAttribute('data-mailtrace-status', match.status);
      }
    } else {
      const badge = document.createElement('span');
      badge.className = `mailtrace-status-badge mailtrace-thread-badge mailtrace-tooltip ${cfg.cssClass}`;
      badge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
      badge.setAttribute('data-mailtrace-status', match.status);
      badge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(`${DASHBOARD_BASE_URL}/messages/${match.messageId}`, '_blank');
      });

      heading.insertBefore(badge, heading.firstChild);
    }

    // 2) Inject sleek telemetry information banner right above the message body
    const existingBanner = document.getElementById(`mailtrace-banner-${match.messageId}`);
    if (existingBanner) {
      existingBanner.className = `mailtrace-thread-banner ${match.status === 'OPENED' ? 'opened' : match.status === 'CLICKED' ? 'clicked' : ''}`;
      const bannerLeft = existingBanner.querySelector('.mailtrace-banner-left');
      if (bannerLeft) {
        bannerLeft.innerHTML = `
          <span class="mailtrace-badge-pill">⚡ MailTrace</span>
          <span class="mailtrace-status-badge ${cfg.cssClass}" style="margin:0;">${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span></span>
          <span class="mailtrace-banner-text">To: <strong>${match.recipientEmail}</strong> • ${cfg.tooltip}</span>
        `;
      }
    } else {
      const banner = document.createElement('div');
      banner.id = `mailtrace-banner-${match.messageId}`;
      banner.className = `mailtrace-thread-banner ${match.status === 'OPENED' ? 'opened' : match.status === 'CLICKED' ? 'clicked' : ''}`;

      const bannerLeft = document.createElement('div');
      bannerLeft.className = 'mailtrace-banner-left';
      bannerLeft.innerHTML = `
        <span class="mailtrace-badge-pill">⚡ MailTrace</span>
        <span class="mailtrace-status-badge ${cfg.cssClass}" style="margin:0;">${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span></span>
        <span class="mailtrace-banner-text">To: <strong>${match.recipientEmail}</strong> • ${cfg.tooltip}</span>
      `;

      const viewBtn = document.createElement('button');
      viewBtn.className = 'mailtrace-banner-btn';
      viewBtn.textContent = 'View Evidence ↗';
      viewBtn.title = 'Inspect complete evidence timeline on MailTrace Dashboard';
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(`${DASHBOARD_BASE_URL}/messages/${match.messageId}`, '_blank');
      });

      banner.appendChild(bannerLeft);
      banner.appendChild(viewBtn);

      const messageContainer = document.querySelector('div.adn.ads, div[role="listitem"], div.gE.iv.gt, div.nH.hx');
      if (messageContainer && messageContainer.parentElement) {
        messageContainer.parentElement.insertBefore(banner, messageContainer);
      } else if (heading.parentElement) {
        heading.parentElement.appendChild(banner);
      }
    }
  });

  // 3) Inject status badge directly into message header row (next to "to jignesh")
  const messageHeaders = document.querySelectorAll('div.gH, .adn.ads .ajy');
  messageHeaders.forEach((mHeader) => {
    const toEl = mHeader.querySelector('span.g2, span[email], span.hb, .gD');
    const toText = toEl?.getAttribute('email') || toEl?.textContent?.trim() || '';

    const mainSubject = document.querySelector('h2.hP, div[role="main"] h2')?.textContent?.trim() || '';
    const match = findStatusMatch(mainSubject, toText, mainSubject + ' ' + toText, statuses);
    if (!match) return;

    const cfg = getBadgeConfig(match);
    const existingHeaderBadge = mHeader.querySelector('.mailtrace-header-badge') as HTMLElement | null;

    if (existingHeaderBadge) {
      if (existingHeaderBadge.getAttribute('data-mailtrace-status') !== match.status) {
        existingHeaderBadge.className = `mailtrace-status-badge mailtrace-header-badge mailtrace-tooltip ${cfg.cssClass}`;
        existingHeaderBadge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
        existingHeaderBadge.setAttribute('data-mailtrace-status', match.status);
        existingHeaderBadge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;
      }
    } else {
      const badge = document.createElement('span');
      badge.className = `mailtrace-status-badge mailtrace-header-badge mailtrace-tooltip ${cfg.cssClass}`;
      badge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
      badge.setAttribute('data-mailtrace-status', match.status);
      badge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(`${DASHBOARD_BASE_URL}/messages/${match.messageId}`, '_blank');
      });

      if (toEl && toEl.parentElement) {
        toEl.parentElement.appendChild(badge);
      } else {
        mHeader.appendChild(badge);
      }
    }
  });
}

// Master refresh for badges in both list and thread views
async function refreshBadges(): Promise<void> {
  const statuses = await fetchTrackingStatuses();
  if (!statuses || statuses.length === 0) return;
  updateRowBadges(statuses);
  updateThreadBadges(statuses);
}

// 4. Observe First-Party Thread Viewing
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
  if (!isExtensionValid() || typeof chrome.runtime.sendMessage !== 'function') return;
  try {
    chrome.runtime.sendMessage({
      action: 'CONFIRM_VIEW',
      payload: {
        messageId: threadId,
        deviceIdentifier: 'browser-extension-gmail',
        platform: 'EXTENSION',
      },
    }, () => {
      if (chrome.runtime?.lastError) { /* ignore */ }
    });
  } catch {
    // Context invalidated
  }
}

function safeRefreshBadges(): void {
  if (!isExtensionValid()) {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    return;
  }
  refreshBadges().catch(() => {});
}

function initializeGmailCompanion(): void {
  if (!isExtensionValid()) return;

  injectStyles();
  observeComposeWindows();
  safeRefreshBadges();
  observeGmailThreads();

  // Watch for dynamic DOM changes with debouncing
  let debounceTimeout: any = null;
  const observer = new MutationObserver(() => {
    if (!isExtensionValid()) {
      observer.disconnect();
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      return;
    }
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      if (!isExtensionValid()) return;
      observeComposeWindows();
      safeRefreshBadges();
      observeGmailThreads();
    }, 250);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Refresh status map every 5 seconds with context guard
  pollInterval = setInterval(safeRefreshBadges, 5000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGmailCompanion);
  } else {
    initializeGmailCompanion();
  }
}
