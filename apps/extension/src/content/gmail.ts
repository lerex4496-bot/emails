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
    if (items.mailtrace_api_url && items.mailtrace_api_url !== 'http://localhost:3000') {
      API_BASE_URL = items.mailtrace_api_url.replace(/\/$/, '');
    }
    if (items.mailtrace_dashboard_url && items.mailtrace_dashboard_url !== 'http://localhost:5173') {
      DASHBOARD_BASE_URL = items.mailtrace_dashboard_url.replace(/\/$/, '');
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
      padding: 1px 4px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      vertical-align: middle !important;
      font-size: 11px !important;
      flex-shrink: 0 !important;
      line-height: 1.2 !important;
    }
    .mailtrace-recip-tick:hover {
      opacity: 0.85 !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
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

async function fetchTrackingStatuses(): Promise<StatusItem[]> {
  const now = Date.now();
  if (now - lastStatusFetch < 4000 && cachedStatuses.length > 0) {
    return cachedStatuses;
  }
  if (isFetchingStatuses && cachedStatuses.length > 0) {
    return cachedStatuses;
  }

  isFetchingStatuses = true;

  // 1. Primary path: Call background service worker (Bypasses Gmail CSP)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise<{ success?: boolean; statuses?: StatusItem[]; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ action: 'GET_TRACKING_STATUS' }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp || { success: false });
          }
        });
      });

      if (response && response.success && Array.isArray(response.statuses)) {
        cachedStatuses = response.statuses;
        lastStatusFetch = now;
        isFetchingStatuses = false;
        console.log(`[MailTrace] Synchronized ${cachedStatuses.length} tracked messages via background service worker.`);
        return cachedStatuses;
      }
    } catch (err) {
      console.warn('[MailTrace] Background worker communication error:', err);
    }
  }

  // 2. Fallback path: Direct fetch
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/extension/tracking-status`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.statuses)) {
        cachedStatuses = data.statuses;
        lastStatusFetch = now;
        console.log(`[MailTrace] Synchronized ${cachedStatuses.length} tracked messages from ${API_BASE_URL}`);
      }
    } else {
      console.warn(`[MailTrace] Status fetch HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[MailTrace] Cannot reach tracking API directly:`, err);
  } finally {
    isFetchingStatuses = false;
  }

  return cachedStatuses;
}

// 1. Hook into Gmail Compose Window
function observeComposeWindows(): void {
  const composeDialogs = document.querySelectorAll('div[role="dialog"]');
  composeDialogs.forEach((dialog) => {
    const bodyBox = dialog.querySelector('div[aria-label="Message Body"], div[role="textbox"]');
    if (!bodyBox) return;

    // Find the bottom action toolbar (next to Send button)
    const toolbar = dialog.querySelector('tr.btC, div.btA, div.gU.Up');
    if (!toolbar) return;

    if (toolbar.querySelector('.mailtrace-toggle-btn')) return;

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

    toolbar.appendChild(btn);

    // Intercept Send Button & Ctrl+Enter with reliable race-condition prevention
    const sendBtn = dialog.querySelector('div[role="button"][data-tooltip*="Send"], div.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
    if (sendBtn && !sendBtn.getAttribute('data-mailtrace-hooked')) {
      sendBtn.setAttribute('data-mailtrace-hooked', 'true');

      let isPrepared = false;
      let isInjecting = false;

      const triggerTrackedSend = async (e: Event) => {
        if (isPrepared) {
          // Injection already completed, allow normal send
          return;
        }

        const isTracking = btn.getAttribute('data-mailtrace-active') === 'true';
        if (!isTracking) {
          // User turned tracking off, send normally
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
          // Now dispatch Gmail's actual send
          (sendBtn as HTMLElement).click();
        }
      };

      sendBtn.addEventListener('click', triggerTrackedSend, true);

      // Also intercept Ctrl+Enter / Cmd+Enter
      dialog.addEventListener('keydown', (e: any) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          triggerTrackedSend(e);
        }
      }, true);
    }
  });
}

// Inject tracking pixel and rewrite links in Compose Body
async function injectTrackingIntoCompose(dialog: Element): Promise<void> {
  const bodyEl = dialog.querySelector('div[aria-label="Message Body"], div[role="textbox"]');
  if (!bodyEl) return;

  // Prevent duplicate pixel injection
  if (bodyEl.querySelector('[data-mailtrace-pixel="true"]')) return;

  // Extract Subject
  const subjectInput = dialog.querySelector('input[name="subjectbox"]') as HTMLInputElement;
  const rawSubject = subjectInput?.value?.trim();
  const subject = rawSubject || '(no subject)';

  // Extract Recipient(s)
  const toList: Array<{ email: string; name?: string }> = [];
  const recipientEls = dialog.querySelectorAll('div[name="to"] [email], div[name="to"] [data-hovercard-id], input[name="to"]');

  recipientEls.forEach((el) => {
    const email = el.getAttribute('email') || el.getAttribute('data-hovercard-id') || (el as HTMLInputElement).value;
    if (email && email.includes('@')) {
      toList.push({ email: email.trim() });
    }
  });

  if (toList.length === 0) {
    const fallbackTo = dialog.querySelector('input[name="to"]') as HTMLInputElement;
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
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const resp = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'PREPARE_TRACKING', payload: trackingPayload }, (response) => {
          if (chrome.runtime.lastError) {
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
      // Fallback to direct fetch
    }
  }

  // 2. Fallback path: Direct fetch
  if (!trackingData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s safe timeout

      const res = await fetch(`${API_BASE_URL}/api/v1/extension/prepare-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(trackingPayload),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        trackingData = await res.json();
      }
    } catch (err) {
      console.warn('[MailTrace] Could not contact tracking API:', err);
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
      pixel.setAttribute('style', 'display:none;width:0;height:0;max-height:0;visibility:hidden;border:0;');
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

// Robust multi-pass status matcher
function findStatusMatch(
  subjectText: string,
  participantText: string,
  rowFullText: string,
  statuses: StatusItem[]
): StatusItem | undefined {
  const normSubject = (subjectText || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
  const normParticipant = (participantText || '').toLowerCase().trim();
  const normRow = (rowFullText || '').toLowerCase().trim();

  // Pass 1: Recipient AND Subject match
  for (const s of statuses) {
    const cleanSubj = (s.subject || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
    const recipEmail = (s.recipientEmail || '').toLowerCase().trim();
    const recipPrefix = recipEmail.split('@')[0] || '';

    const recipMatch = recipEmail && (
      normParticipant.includes(recipEmail) ||
      normRow.includes(recipEmail) ||
      (recipPrefix.length >= 3 && (normParticipant.includes(recipPrefix) || normRow.includes(recipPrefix)))
    );

    const isNoSubj = !cleanSubj || cleanSubj === '(no subject)';
    const subjMatch = isNoSubj
      ? (normRow.includes('(no subject)') || normRow.includes('no subject') || normSubject.includes('no subject'))
      : (cleanSubj.length > 0 && (normSubject.includes(cleanSubj) || normRow.includes(cleanSubj)));

    if (recipMatch && subjMatch) {
      return s;
    }
  }

  // Pass 2: Distinctive Subject match (when subject is not '(no subject)')
  for (const s of statuses) {
    const cleanSubj = (s.subject || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
    if (cleanSubj && cleanSubj !== '(no subject)' && cleanSubj.length >= 2) {
      if (normSubject.includes(cleanSubj) || normRow.includes(cleanSubj)) {
        return s;
      }
    }
  }

  // Pass 3: Match by Recipient + (no subject) indicator
  for (const s of statuses) {
    const cleanSubj = (s.subject || '').toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
    const recipEmail = (s.recipientEmail || '').toLowerCase().trim();
    const recipPrefix = recipEmail.split('@')[0] || '';
    const isNoSubj = !cleanSubj || cleanSubj === '(no subject)';

    if (isNoSubj && (normRow.includes('no subject') || normRow.includes('(no subject)'))) {
      if (recipEmail && (normParticipant.includes(recipEmail) || normRow.includes(recipPrefix))) {
        return s;
      }
    }
  }

  return undefined;
}

// 2. Inject & Live-Update Status Badges in Gmail Message Rows (Sent / Inbox)
function updateRowBadges(statuses: StatusItem[]): void {
  const rows = document.querySelectorAll('tr.zA, tr[role="row"]');
  rows.forEach((row) => {
    // Search subject ONLY within the subject cell (td.a4W or .xY.a4W) to avoid picking up recipient .bqe
    const subjectCell = row.querySelector('td.a4W, td.xY.a4W, .xT');
    const subjectEl = subjectCell?.querySelector('.bog, .bqe, span[data-thread-id], span');
    const subjectText = subjectEl?.textContent?.trim() || '';

    // Search recipient ONLY within recipient cell (td.yX, .yW)
    const participantEl = row.querySelector('td.yX, .yW, .yP, span[email]');
    const participantText = participantEl?.getAttribute('email') || participantEl?.textContent?.trim() || '';

    const rowFullText = row.textContent?.trim() || '';

    const match = findStatusMatch(subjectText, participantText, rowFullText, statuses);
    if (!match) return;

    const cfg = getBadgeConfig(match);
    const existingBadge = row.querySelector('.mailtrace-status-badge') as HTMLElement | null;
    const existingTick = row.querySelector('.mailtrace-recip-tick') as HTMLElement | null;

    if (existingBadge) {
      if (
        existingBadge.getAttribute('data-mailtrace-status') !== match.status ||
        existingBadge.getAttribute('data-mailtrace-clicks') !== String(match.totalClicks) ||
        existingBadge.getAttribute('data-mailtrace-opens') !== String(match.totalOpens)
      ) {
        existingBadge.className = `mailtrace-status-badge mailtrace-tooltip ${cfg.cssClass}`;
        existingBadge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;
        existingBadge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
        existingBadge.setAttribute('data-mailtrace-status', match.status);
        existingBadge.setAttribute('data-mailtrace-clicks', String(match.totalClicks));
        existingBadge.setAttribute('data-mailtrace-opens', String(match.totalOpens));
      }
    } else {
      const badge = document.createElement('span');
      badge.className = `mailtrace-status-badge mailtrace-tooltip ${cfg.cssClass}`;
      badge.innerHTML = `${cfg.iconHtml} <span class="mailtrace-badge-label">${cfg.label}</span>`;
      badge.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
      badge.setAttribute('data-mailtrace-status', match.status);
      badge.setAttribute('data-mailtrace-clicks', String(match.totalClicks));
      badge.setAttribute('data-mailtrace-opens', String(match.totalOpens));

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(`${DASHBOARD_BASE_URL}/messages/${match.messageId}`, '_blank');
      });

      // 1. Insert badge right in front of the subject line
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

    // 2. Also inject or live-update sleek tick directly in the Recipient column (td.yX) next to "To: ..."
    const recipCell = row.querySelector('td.yX, .yW, .yP');
    if (existingTick) {
      if (existingTick.getAttribute('data-mailtrace-status') !== match.status) {
        existingTick.className = `mailtrace-recip-tick mailtrace-tooltip ${cfg.cssClass}`;
        existingTick.innerHTML = cfg.iconHtml;
        existingTick.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
        existingTick.setAttribute('data-mailtrace-status', match.status);
      }
    } else if (recipCell) {
      const tick = document.createElement('span');
      tick.className = `mailtrace-recip-tick mailtrace-tooltip ${cfg.cssClass}`;
      tick.innerHTML = cfg.iconHtml;
      tick.setAttribute('data-tooltip', `${match.subject} — ${cfg.tooltip} (Click to open Dashboard)`);
      tick.setAttribute('data-mailtrace-status', match.status);
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

function initializeGmailCompanion(): void {
  injectStyles();
  observeComposeWindows();
  refreshBadges();
  observeGmailThreads();

  // Watch for dynamic DOM changes with debouncing
  let debounceTimeout: any = null;
  const observer = new MutationObserver(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      observeComposeWindows();
      refreshBadges();
      observeGmailThreads();
    }, 250);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Refresh status map every 5 seconds
  setInterval(refreshBadges, 5000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGmailCompanion);
} else {
  initializeGmailCompanion();
}
