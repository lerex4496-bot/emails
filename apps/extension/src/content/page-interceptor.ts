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

  // 1. window message listener (crosses worlds reliably)
  window.addEventListener('message', (event) => {
    if (event && event.data && event.data.source === 'MAILTRACE_EXTENSION' && event.data.action === 'ADD_SENT_TOKENS') {
      const tokens = event.data.tokens;
      if (Array.isArray(tokens)) {
        tokens.forEach((t) => { if (typeof t === 'string') sentTokens.add(t); });
      }
    }
  });

  // 2. DOM CustomEvent listeners on document (shared DOM node)
  document.addEventListener('mailtrace:add-sent-token', (e: any) => {
    if (e && e.detail && typeof e.detail === 'string') {
      sentTokens.add(e.detail);
    }
  });

  document.addEventListener('mailtrace:add-sent-tokens', (e: any) => {
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
    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch {}
    return (
      decoded.includes('/t/open/') ||
      decoded.includes('mailtrace-api') ||
      decoded.includes('data-mailtrace-pixel') ||
      (decoded.includes('googleusercontent.com/proxy') && (decoded.includes('/t/open/') || decoded.includes('mailtrace')))
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

    // Check 3: If viewing any non-inbox view (sent folder, all mail, preview, search, drafts) -> always suppress
    const hash = (window.location.hash || '').toLowerCase();
    if (!hash.includes('inbox')) {
      return true;
    }

    // Check 4: If viewing any message in Gmail where the sender element is 'me'
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

  // Which of the patches below actually matter, verified against Blink:
  //
  // String-level, PRE-PARSE hooks are the load-bearing ones. They run synchronously
  // upstream of the HTML parser, so rewriting the string is decisive.
  //
  // Attribute-level hooks (the `src` setter, `setAttribute`) are near-dead weight against
  // Gmail's parser path. Element::ParserSetAttributes runs with DCHECK(!isConnected())
  // and calls the C++ AttributeChanged(..., kByParser) -- it never invokes the JS `src`
  // setter or setAttribute. The image load is then enqueued from
  // HTMLImageElement::ParseAttribute -> SelectSourceURL -> ImageLoader::UpdateFromElement,
  // all before insertion. They are kept only for pixels built imperatively by scripts.
  //
  // The MutationObserver further down is a race that is usually lost, not a guarantee:
  // observer delivery shares the image-loading microtask queue and its position is fixed
  // by the first mutation of the cycle. Clearing `src` in the callback does prevent the
  // fetch when it wins, so it is worth keeping -- but never rely on it. Note that
  // img.remove() alone never helps: a detached image in an active document still loads.

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

  // 1b. Intercept setHTMLUnsafe / parseHTMLUnsafe.
  // Same pre-parse string path as innerHTML, Baseline since September 2025, and previously
  // unpatched -- so they were a complete bypass of the sanitiser above.
  const elProtoAny = Element.prototype as any;
  if (typeof elProtoAny.setHTMLUnsafe === 'function') {
    const origSetHTMLUnsafe = elProtoAny.setHTMLUnsafe;
    elProtoAny.setHTMLUnsafe = function (html: string, ...rest: any[]) {
      if (typeof html === 'string' && !isComposeContext(this)) {
        html = sanitizeHtmlString(html, this);
      }
      return origSetHTMLUnsafe.call(this, html, ...rest);
    };
  }

  const shadowProtoAny = typeof ShadowRoot !== 'undefined' ? (ShadowRoot.prototype as any) : null;
  if (shadowProtoAny && typeof shadowProtoAny.setHTMLUnsafe === 'function') {
    const origShadowSetHTMLUnsafe = shadowProtoAny.setHTMLUnsafe;
    shadowProtoAny.setHTMLUnsafe = function (html: string, ...rest: any[]) {
      if (typeof html === 'string') {
        html = sanitizeHtmlString(html, null);
      }
      return origShadowSetHTMLUnsafe.call(this, html, ...rest);
    };
  }

  const documentCtor = Document as any;
  if (typeof documentCtor.parseHTMLUnsafe === 'function') {
    const origParseHTMLUnsafe = documentCtor.parseHTMLUnsafe;
    documentCtor.parseHTMLUnsafe = function (html: string, ...rest: any[]) {
      if (typeof html === 'string') {
        html = sanitizeHtmlString(html, null);
      }
      return origParseHTMLUnsafe.call(this, html, ...rest);
    };
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

  // 3. REMOVED: Element.prototype.setAttribute.
  //
  // It wrapped one of the hottest DOM calls on the page for no suppression benefit --
  // Gmail builds message bodies through the HTML parser, which sets attributes in C++ via
  // Element::ParserSetAttributes and never calls this setter (see the note above).
  //
  // It was also actively harmful. Because the wrapper sits in the call stack for EVERY
  // setAttribute on the page, Chrome attributed unrelated Gmail console warnings to this
  // extension: setting an iframe's allow="...speaker..." surfaced as
  // "Unrecognized feature: 'speaker'" against page-interceptor.js in chrome://extensions.
  // That is Gmail's warning, not ours, and no narrowing of the wrapper can suppress it --
  // any wrapper is in the stack. Not patching is the only fix.

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

  // 6. REMOVED: window.fetch.
  // Gmail does not load images through fetch(), so this caught nothing real, and it
  // fabricated a synthetic 200 Response for any URL that matched -- a way to corrupt
  // page state rather than suppress a pixel.

  // 7. Intercept Element.prototype.insertAdjacentHTML
  if (typeof Element !== 'undefined' && Element.prototype.insertAdjacentHTML) {
    const origInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    Element.prototype.insertAdjacentHTML = function (position: InsertPosition, text: string) {
      if (typeof text === 'string' && !isComposeContext(this)) {
        text = sanitizeHtmlString(text, this);
      }
      return origInsertAdjacentHTML.call(this, position, text);
    };
  }

  // 8. REMOVED: XMLHttpRequest.prototype.open.
  // Gmail does not load images through XHR either, and this substituted a data: URI as the
  // REQUEST URL, which XHR cannot load -- so on the only path where it would ever have
  // fired, it threw instead of suppressing anything.

  // 9. MutationObserver: Asynchronous DOM guard for any dynamic <img> injections
  function checkAndNeutralizeImage(img: HTMLImageElement): void {
    if (isComposeContext(img)) return;
    const src = img.getAttribute('src') || img.src || '';
    if (shouldSuppress(src, img)) {
      // Repointing src is what actually cancels the pending load: UpdateFromElement
      // clears the queued task, and the task re-reads ImageSourceURL() when it runs.
      //
      // The former img.remove() here did nothing for suppression -- a detached image in
      // an active document still loads -- while mutating Gmail's DOM out from under its
      // renderer. The node is left in place and hidden instead.
      img.src = BLANK_PIXEL;
      img.setAttribute('src', BLANK_PIXEL);
      img.setAttribute('data-mailtrace-suppressed', 'true');
      img.style.display = 'none';
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.tagName === 'IMG') {
            checkAndNeutralizeImage(el as HTMLImageElement);
          } else {
            const imgs = el.querySelectorAll?.('img');
            if (imgs && imgs.length > 0) {
              imgs.forEach((img) => checkAndNeutralizeImage(img));
            }
          }
        }
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    });
  }

  console.log('[MailTrace] Page interceptor initialized: Sender self-open suppression active with token registry.');
})();
