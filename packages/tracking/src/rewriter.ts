import * as cheerio from 'cheerio';

export interface TrackingInjectionOptions {
  html: string;
  openToken?: string;
  trackingBaseUrl: string;
  /** Mapping of originalUrl -> clickToken */
  linkTokenMap?: Record<string, string> | Map<string, string>;
}

/**
 * Extracts all trackable web URLs (http/https) from HTML content.
 * Deduplicates and excludes non-trackable schemes like mailto, tel, and hashes.
 */
export function extractTrackableLinks(html: string): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a').each((_, element) => {
    const href = $(element).attr('href')?.trim();
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      links.add(href);
    }
  });

  return Array.from(links);
}

/**
 * Injects tracking pixel and rewrites trackable links in HTML email.
 * - Does NOT alter email typography or layout styling.
 * - Injects visually invisible 1x1 pixel image.
 * - Does NOT insert visible banners, notifications, or tracking headers into body.
 */
export function injectTracking({
  html,
  openToken,
  trackingBaseUrl,
  linkTokenMap,
}: TrackingInjectionOptions): string {
  if (!html) return '';

  const baseUrl = trackingBaseUrl.replace(/\/+$/, '');
  const isFullDocument = /<html|<body/i.test(html);
  const $ = isFullDocument ? cheerio.load(html) : cheerio.load(html, null, false);

  // 1. Rewrite trackable links if token map is provided
  if (linkTokenMap) {
    const getMapping = (url: string): string | undefined => {
      if (linkTokenMap instanceof Map) {
        return linkTokenMap.get(url);
      }
      return linkTokenMap[url];
    };

    $('a').each((_, element) => {
      const originalHref = $(element).attr('href')?.trim();
      if (originalHref && (originalHref.startsWith('http://') || originalHref.startsWith('https://'))) {
        const clickToken = getMapping(originalHref);
        if (clickToken) {
          $(element).attr('href', `${baseUrl}/t/click/${clickToken}`);
        }
      }
    });
  }

  // 2. Append tracking pixel if openToken is provided
  if (openToken) {
    const pixelImg = `<img src="${baseUrl}/t/open/${openToken}.png" width="1" height="1" alt="" border="0" style="width:1px!important;height:1px!important;border:0!important;padding:0!important;margin:0!important;outline:none!important;opacity:0.01!important;" />`;

    if ($('body').length > 0) {
      $('body').append(pixelImg);
    } else {
      $.root().append(pixelImg);
    }
  }

  return $.html();
}
