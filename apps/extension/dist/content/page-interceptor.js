"use strict";
/**
 * MailTrace Page Interceptor (Runs in page MAIN world at document_start)
 *
 * Purpose: Completely suppress sender self-opens when viewing sent emails in Gmail.
 * Neutralizes tracking pixels BEFORE the browser initiates any network request
 * to Google's Image Proxy (ci*.googleusercontent.com) or backend tracking endpoints.
 */
(function () {
    const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    function isTrackingUrl(url) {
        if (!url || typeof url !== 'string')
            return false;
        return (url.includes('/t/open/') ||
            url.includes('mailtrace-api') ||
            url.includes('data-mailtrace-pixel') ||
            (url.includes('googleusercontent.com/proxy') && (url.includes('/t/open/') || url.includes('mailtrace'))));
    }
    function isComposeContext(el) {
        if (!el)
            return false;
        try {
            if (el.isContentEditable)
                return true;
            if (el.getAttribute('contenteditable') === 'true')
                return true;
            if (el.getAttribute('role') === 'textbox')
                return true;
            if (el.closest('[contenteditable="true"], [role="dialog"], .Am.Al.editable, div[aria-label*="Message Body"]')) {
                return true;
            }
        }
        catch {
            // Ignore DOM access errors
        }
        return false;
    }
    function sanitizeHtmlString(html) {
        if (!html || typeof html !== 'string')
            return html;
        if (!html.includes('/t/open/') && !html.includes('mailtrace'))
            return html;
        return html.replace(/<img\b([^>]*?)>/gi, (fullMatch, attrs) => {
            if (isTrackingUrl(attrs)) {
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
            set: function (val) {
                if (typeof val === 'string' && !isComposeContext(this)) {
                    val = sanitizeHtmlString(val);
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
            set: function (val) {
                if (typeof val === 'string' && isTrackingUrl(val) && !isComposeContext(this)) {
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
    Element.prototype.setAttribute = function (name, value) {
        if (typeof name === 'string' && name.toLowerCase() === 'src' && typeof value === 'string') {
            if (isTrackingUrl(value) && !isComposeContext(this)) {
                return origSetAttr.call(this, name, BLANK_PIXEL);
            }
        }
        return origSetAttr.call(this, name, value);
    };
    // 4. Intercept DOMParser.prototype.parseFromString
    if (typeof DOMParser !== 'undefined') {
        const origParse = DOMParser.prototype.parseFromString;
        DOMParser.prototype.parseFromString = function (str, type) {
            if (typeof str === 'string') {
                str = sanitizeHtmlString(str);
            }
            return origParse.call(this, str, type);
        };
    }
    // 5. Intercept Range.prototype.createContextualFragment
    if (typeof Range !== 'undefined' && Range.prototype.createContextualFragment) {
        const origFragment = Range.prototype.createContextualFragment;
        Range.prototype.createContextualFragment = function (tagString) {
            if (typeof tagString === 'string') {
                tagString = sanitizeHtmlString(tagString);
            }
            return origFragment.call(this, tagString);
        };
    }
    console.log('[MailTrace] Page interceptor initialized: Sender self-open suppression active.');
})();
