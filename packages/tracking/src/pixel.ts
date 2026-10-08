/**
 * Canonical 1x1 transparent PNG (68 bytes)
 * Base64: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=
 */
export const TRANSPARENT_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/**
 * Canonical 1x1 transparent GIF (43 bytes)
 * Base64: R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7
 */
export const TRANSPARENT_1X1_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Response headers that make a tracking pixel genuinely uncacheable, across proxies,
 * browsers, and email clients.
 *
 * This matters for correctness, not just hygiene. Gmail's image proxy keys its cache on
 * the original URL, which is identical for every render of a sent message. If the proxy is
 * allowed to serve a cached copy, a fetch around delivery time would satisfy every later
 * render and a genuine open hours later would never reach this server at all -- and would
 * be indistinguishable from "never opened".
 *
 * Deliberate choices:
 * - NO `ETag` and NO `Last-Modified`. The hazard is not that a 304 would skip our counting
 *   (a 304 does reach the handler). It is that RFC 9111 4.3.2 gives a cache an explicit
 *   licence to "generate a 200 (OK) response ... by reusing its corresponding stored
 *   response" on the strength of a 304 -- precisely the reuse we are preventing. A 304
 *   short-circuit also returns an empty body, which renders as a broken image. Frameworks
 *   add ETags unprompted, so never put a static-file middleware or @fastify/etag in front
 *   of /t/open/. A test asserts their absence.
 * - NO `Age`. Emitting it would be semantically false (RFC 9111 5.1 says it asserts the
 *   response did not come from the origin) and it destroys the best available diagnostic:
 *   because we never send `Age`, a nonzero `Age` on a response is proof something cached
 *   the pixel.
 * - `Vary: *` tells any conforming cache (RFC 9111 4.1) that no stored response may be
 *   reused for a subsequent request. It reaches caches through a different code path than
 *   `Cache-Control`, including ones configured to override origin directives, so it is the
 *   single highest-value directive here.
 * - `private` is load-bearing, not decoration: RFC 9111 5.2.2.7 forbids a *shared* cache
 *   from storing the response, which is what stops edge/CDN storage where `no-store` is
 *   handled loosely.
 * - `Pragma`, `Expires` and `must-revalidate` are retained only as zero-cost insurance for
 *   ancient proxies. `Pragma` is deprecated in responses, `Expires` must be disregarded
 *   when `max-age` is present, and `must-revalidate` governs reuse of *stale* responses --
 *   meaningless when nothing may be stored. Do not count any of them as defence.
 * - 200 with real image bytes, never 204: an <img> with no decodable body shows the
 *   broken-image placeholder. `Content-Length` must be correct, never 0, for the same
 *   reason.
 * - `Surrogate-Control` / `CDN-Cache-Control` are omitted on purpose. No CDN fronts this
 *   origin today, and they are footguns rather than insurance: RFC 9213 targeted fields
 *   OUTRANK `Cache-Control`, so a mistyped value there would silently defeat `no-store`.
 *   Note that if Render's edge cache is ever enabled it is Cloudflare underneath, which
 *   selects by file extension -- and this URL ends in `.png`, so it is cache-eligible and
 *   these headers are the only thing preventing a 120-minute stale pixel.
 */
export const TRACKING_PIXEL_HEADERS = {
  'Content-Type': 'image/png',
  'Content-Length': TRANSPARENT_1X1_PNG.length.toString(),
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Vary': '*',
  'Access-Control-Allow-Origin': '*',
} as const;

/**
 * Cache headers for the click redirect. A cached 302 means a repeat click is served by the
 * browser or an intermediary and never recorded, so the redirect must be as uncacheable as
 * the pixel. Clicks are the strongest open evidence available -- they are unproxied and
 * carry a real User-Agent -- so losing them is expensive.
 */
export const TRACKING_REDIRECT_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Vary': '*',
} as const;
