/**
 * MailTrace Page Interceptor (Runs in page MAIN world at document_start)
 * 
 * Purpose: Suppress sender self-opens when viewing sent emails in Gmail.
 * Neutralizes tracking pixels BEFORE the browser initiates any network request
 * to Google's Image Proxy (ci*.googleusercontent.com) or backend tracking endpoints.
 * 
 * Multi-layer suppression:
 * 1. Sent Tokens Registry: Tokens created by or belonging to this user are tracked.
 *    Any pixel containing a known sent token is neutralized to BLANK_PIXEL regardless of view.
 * 2. Sent Context Detection: If hash includes 'sent' or the message sender is 'me', pixels are neutralized.
 * 3. Non-Inbox Sent Threads: If viewing a sent email thread outside inbox where 'me' sent it, pixels are neutralized.
 * 4. Safe Compose Exception: Active compose inputs are never neutralized, ensuring outgoing emails carry the tracking pixel.
 */

(function () {
  const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // In-memory set of tokens that this sender has created/sent
  const sentTokens = new Set<string>();

  function loadSavedTokens(): void {
    try {
      const raw = localStorage.getItem('mailtrace_sent_tokens');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((t) => { if (typeof t === 'string') sentTokens.add(t); });
        }
      }
      const fromAttr = document.documentElement?.getAttribute('data-mailtrace-tokens');
      if (fromAttr) {
        const arr = JSON.parse(fromAttr);
        if (Array.isArray(arr)) {
          arr.forEach((t) => { if (typeof t === 'string') sentTokens.add(t); });
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  loadSavedTokens();

  // Listen for tokens emitted from isolated world (gmail.ts)
  window.addEventListener('mailtrace:add-sent-token', (e: any) => {
    if (e && e.detail && typeof e.detail === 'string') {
      sentTokens.add(e.detail);
    }
  });

  window.addEventListener('mailtrace:add-sent-tokens', (e: any) => {
    if (e && e.detail && Array.isArray(e.detail)) {
      e.detail.forEach((t: string) => { if (typeof t === 'string') sentTokens.add(t); });
    }
  });

  function extractToken(url: string | null | undefined): string | null {
    if (!url || typeof url !== 'string') return null;
    try {
      const decoded = decodeURIComponent(url);
      const match = decoded.match(/\/t\/open\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return match[1].replace(/\.png$/i, '');
      }
    } catch {
      // Ignore URI decode errors
    }
    const fallbackMatch = url.match(/\/t\/open\/([a-zA-Z0-9_-]+)/);
    if (fallbackMatch) {
      return fallbackMatch[1].replace(/\.png$/i, '');
    }
    return null;
  }

  function isSentToken(token: string | null | undefined): boolean {
    if (!token) return false;
    if (sentTokens.has(token)) return true;
    loadSavedTokens();
    return sentTokens.has(token);
  }

  function isTrackingUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    return (
      url.includes('/t/open/') ||
      url.includes('mailtrace-api') ||
      url.includes('data-mailtrace-pixel') ||
      (url.includes('googleusercontent.com/proxy') && (url.includes('/t/open/') || url.includes('mailtrace')))
    );
  }

  function isComposeContext(el: Element | null): boolean {
    if (!el) return false;
    try {
      if ((el as any).isContentEditable) return true;
      if (el.getAttribute('contenteditable') === 'true') return true;
      if (el.getAttribute('role') === 'textbox') return true;
      if (el.closest('[contenteditable="true"], [role="dialog"], .Am.Al.editable, div[aria-label*="Message Body"]')) {
        return true;
      }
    } catch {
      // Ignore DOM access errors
    }
    return false;
  }

  function isSentContext(el?: Element | null): boolean {
    try {
      const hash = (window.location.hash || '').toLowerCase();
      // 1. Current view is Sent folder or Sent thread
      if (hash.includes('sent')) {
        return true;
      }
      // 2. Element is inside a sent message container
      if (el) {
        const msgContainer = el.closest('div[role="listitem"], .adn, .h7');
        if (msgContainer) {
          const senderEl = msgContainer.querySelector('.gD, span.go, span.g2');
          const senderTxt = (senderEl?.textContent || '').trim().toLowerCase();
          if (senderTxt === 'me' || senderTxt.startsWith('me ')) {
            return true;
          }
        }
      }
    } catch {
      // Ignore context checking errors
    }
    return false;
  }

  function shouldSuppress(url: string | null | undefined, el?: Element | null): boolean {
    if (!url || !isTrackingUrl(url)) return false;
    if (isComposeContext(el || null)) return false;

    // Check 1: Known sent token belonging to this user -> always suppress
    const token = extractToken(url);
    if (token && isSentToken(token)) {
      return true;
    }

    // Check 2: Explicit sent context (in sent folder or sender is 'me') -> always suppress
    if (isSentContext(el)) {
      return true;
    }

    // Check 3: If viewing any message in Gmail where the sender element is 'me'
    if (el) {
      try {
        const msgContainer = el.closest('div[role="listitem"], .adn, .h7');
        if (msgContainer) {
          const senderEl = msgContainer.querySelector('.gD, span.go, span.g2');
          const senderTxt = (senderEl?.textContent || '').trim().toLowerCase();
          if (senderTxt === 'me' || senderTxt.startsWith('me ')) {
            return true;
          }
        }
      } catch {
        // Ignore DOM search errors
      }
    }

    return false;
  }

  function sanitizeHtmlString(html: string, container?: Element | null): string {
    if (!html || typeof html !== 'string') return html;
    if (!html.includes('/t/open/') && !html.includes('mailtrace')) return html;

    return html.replace(/<img\b([^>]*?)>/gi, (fullMatch, attrs) => {
      const srcMatch = attrs.match(/\bsrc=["']([^"']*)["']/i);
      const src = srcMatch ? srcMatch[1] : attrs;
      if (shouldSuppress(src, container)) {
        const cleanAttrs = attrs.replace(/\bsrc=["'][^"']*["']/gi, `src="${BLANK_PIXEL}" data-mailtrace-suppressed="true"`);
        return `<img ${cleanAttrs} style="display:none!important;width:0!important;height:0!important;" width="0" height="0">`;
      }
      return fullMatch;
    });
  }

  // 1. Intercept Element.prototype.innerHTML
  const innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (innerHTMLDesc && innerHTMLDesc.set) {
    const origSet = innerHTMLDesc.set;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      set: function (val: string) {
        if (typeof val === 'string' && !isComposeContext(this)) {
          val = sanitizeHtmlString(val, this);
        }
        return origSet.call(this, val);
      },
      get: function () {
        return innerHTMLDesc.get?.call(this);
      },
      configurable: true,
      enumerable: true,
    });
  }

  // 2. Intercept HTMLImageElement.prototype.src
  const imgProto = HTMLImageElement.prototype;
  const srcDesc = Object.getOwnPropertyDescriptor(imgProto, 'src') || Object.getOwnPropertyDescriptor(Element.prototype, 'src');
  if (srcDesc && srcDesc.set) {
    const origSrcSet = srcDesc.set;
    Object.defineProperty(imgProto, 'src', {
      set: function (val: string) {
        if (typeof val === 'string' && shouldSuppress(val, this)) {
          return origSrcSet.call(this, BLANK_PIXEL);
        }
        return origSrcSet.call(this, val);
      },
      get: function () {
        return srcDesc.get?.call(this);
      },
      configurable: true,
      enumerable: true,
    });
  }

  // 3. Intercept Element.prototype.setAttribute
  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: any) {
    if (typeof name === 'string' && name.toLowerCase() === 'src' && typeof value === 'string') {
      if (shouldSuppress(value, this)) {
        return origSetAttr.call(this, name, BLANK_PIXEL);
      }
    }
    return origSetAttr.call(this, name, value);
  };

  // 4. Intercept DOMParser.prototype.parseFromString
  if (typeof DOMParser !== 'undefined') {
    const origParse = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function (str: string, type: any) {
      if (typeof str === 'string') {
        str = sanitizeHtmlString(str, null);
      }
      return origParse.call(this, str, type);
    };
  }

  // 5. Intercept Range.prototype.createContextualFragment
  if (typeof Range !== 'undefined' && Range.prototype.createContextualFragment) {
    const origFragment = Range.prototype.createContextualFragment;
    Range.prototype.createContextualFragment = function (tagString: string) {
      if (typeof tagString === 'string') {
        tagString = sanitizeHtmlString(tagString, null);
      }
      return origFragment.call(this, tagString);
    };
  }

  // 6. Network safety layer: Intercept fetch for tracking URLs with sent tokens
  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch;
    window.fetch = function (input: any, init?: any) {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (url && shouldSuppress(url, null)) {
        return Promise.resolve(new Response(new Blob([], { type: 'image/gif' }), { status: 200 }));
      }
      return origFetch.apply(this, arguments as any);
    };
  }

  console.log('[MailTrace] Page interceptor initialized: Sender self-open suppression active with token registry.');
})();
