# Avoiding False Opens

MailTrace's whole claim is truth in evidence, so a green "opened" badge has to be
trustworthy. This document covers the three things that can forge one — the sender's own
browser, Google's delivery-time image scan, and an unrecognised fetcher — what the code does
about each, and the one thing you have to configure yourself.

## Required setup: turn off remote images on your own Gmail account

**Do this before trusting any open.**

- Gmail web: Settings → General → **Images** → "Ask before displaying external images"
- Gmail Android and Gmail iOS: the same per-account setting inside each app (the web
  setting does not cover them)

### Why this is configuration and not code

When you open your own message in Sent, Gmail fetches its tracking pixel through
`ci*.googleusercontent.com` exactly as the recipient's Gmail would. At the origin those two
requests are indistinguishable, and not by accident:

- The Sent copy and the recipient's copy contain the **same pixel URL**.
- Gmail's proxy URL is a deterministic signature over that URL, so it is the same for both.
- The proxy strips IP, User-Agent, cookies and `Referer`, so nothing in the request
  identifies who caused it.

There is no header, timing pattern or fingerprint that separates them. And a browser
extension can only defend the browsers it is installed in — never the Gmail mobile apps, a
different browser, or someone else's machine.

Switching off remote images moves the defence from "intercept the fetch" to "the client
never initiates one", which is the only version that holds on every device. The cost is
that you click "Display images below" on mail you *receive*. Recipients are unaffected, so
tracking still works normally.

The origin cannot verify this setting is in force — if images are off there is simply no
request, which looks identical to "the sender hasn't looked yet". No classification rule
depends on it, and none should.

## What the code does

### 1. The sender's browser cannot fetch its own pixel

The extension appends the tracking `<img>` to the live compose document, which makes the
sender's browser request the pixel immediately — one false open per send, at T≈0, from the
sender's real IP. This was the single largest source of false opens.

[`apps/extension/rules.json`](apps/extension/rules.json) blocks it in the network stack:

```json
{ "action": { "type": "block" },
  "condition": { "urlFilter": "/t/open/", "initiatorDomains": ["mail.google.com"] } }
```

Deliberately host-agnostic — the tracking host is derived from the request server-side and
is editable in the extension popup, so pinning `requestDomains` would silently stop matching
if the Render URL ever changed.

A blocked request does not alter the element, so the `src` still survives into the HTML
Gmail serializes and **the recipient receives a working pixel**.

### This rule covers more than direct fetches

DNR matches against the URL **spec**, which in current Chromium still carries the fragment —
the ref is only dropped further downstream, at `HttpUtil::SpecForRequest`, for the wire
request-target and the HTTP cache key. Gmail's proxy `src` is:

```
https://ci<N>.googleusercontent.com/meips/<token>=s0-d-e1-ft#https://origin/t/open/<tok>.png
```

That spec contains `/t/open/`, so the rule blocks **proxied** fetches too. For this project
that is the desirable outcome: it suppresses your proxied self-view of your own Sent copy,
which is otherwise indistinguishable at the origin. (Corroboration from the field: AdGuard's
mail-tracking list ships Gmail-scoped rules keyed on content that only exists inside the
fragment.)

Two consequences you need to know:

1. **A send-to-self test will show no open**, because this browser is also the recipient.
   Verify open tracking from a browser *without* the extension — which is the realistic
   recipient anyway.
2. **Fragment matching is undocumented.** Chrome's and MDN's DNR references never mention
   it, there is no upstream test guarding it against regression, and WECG issue #770 is
   actively proposing to change DNR input canonicalisation. Treat it as a measured bonus,
   never a contract. If it regresses, only direct fetches are blocked and the server-side
   classifier remains the backstop.

Expect at least one `net::ERR_BLOCKED_BY_CLIENT` in the console per send. That is the rule
working. Its absence means the rule is not loaded — `rules.json` changes require an
extension reload.

### 2. The default verdict is the weakest one

[`services/api/src/queue.ts`](services/api/src/queue.ts) now initialises every event to
`TRACKING_RESOURCE_REQUESTED / LIKELY_AUTOMATED / LOW`. Only a positive signature raises it.

Previously the initial verdict was `PROBABLE_EMAIL_OPEN / HIGH` and the signature chain had
no `else`, so **any** unrecognised fetcher past the transit buffer was reported as "Opened by
recipient" — `curl`, scanners, and every Apple Mail Privacy Protection fetch.

MPP deserves a note: it is not detectable by User-Agent. Its relay presents an ordinary
Apple Mail UA, and the old `AppleMailProxy` signature matched nothing real (the test that
covered it fabricated a UA by appending the literal to a stock Safari string). MPP traffic
now lands on the default verdict, which is the correct fail-closed outcome. An MPP recipient
will generally show as Delivered and never as Opened — that is honest, not a bug.

**Do not try to separate Google's delivery scan from a real open by User-Agent.** Both carry
the identical string:

```
Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)
```

This is byte-identical across every bot-signature corpus that records it, and an NDSS-2025
research artifact reproduces it from Gmail web, Android **and** iOS alike. Timing and
request shape are the only discriminators. The "Gmail prefetch bot" UA that circulates
(a doubled string ending `Edge/12.246 Mozilla/5.0`) is a 2021 artifact — keep it on a
denylist if you like, but it is not a third class of fetcher to design around.

### 3. Delivery requires recipient-side evidence

A bare pixel request is not delivery evidence, because the sender's own browser can produce
one. Status advances to `DELIVERED` only on a **proxy-signed** fetch or a counted open:
Google proxies and scans images only for a message its servers accepted into a mailbox.

`DeliveryEvent` and
[`classifyDeliveryNotification`](packages/email/src/delivery/classifier.ts) are the stronger
source and are wired into the read path as a seam — they have no producer yet. Until a
webhook or Gmail API confirmation exists, **non-Gmail recipients show `SENT`**, because they
produce no proxy fetch at all. That is a known gap, not a misreport.

### 4. The pixel must be genuinely uncacheable

Gmail's proxy keys its cache on the original URL, which never changes for a sent message. If
the proxy were allowed to serve a cached copy, a fetch around delivery time would satisfy
every later render and a genuine open hours later would never reach the origin — and would
be indistinguishable from "never opened".

[`packages/tracking/src/pixel.ts`](packages/tracking/src/pixel.ts) therefore sends
`private, no-cache, no-store, must-revalidate, max-age=0`, `Vary: *`, and a correct
`Content-Length` with real image bytes at status 200.

Which of those actually carry weight:

- **`Vary: *`** is the highest-value directive. RFC 9111 §4.1 makes a stored response with
  `Vary: *` always fail to match, and it reaches caches through a different code path than
  `Cache-Control` — including ones configured to override origin directives.
- **`private`** is load-bearing, not decoration: RFC 9111 §5.2.2.7 forbids a *shared* cache
  from storing the response, which is what stops edge storage where `no-store` is handled
  loosely.
- **No `ETag`, no `Last-Modified`.** Not because a 304 would skip counting — it would still
  reach the handler. Because RFC 9111 §4.3.2 lets a cache generate a 200 from its stored
  body on the strength of a 304, which is exactly the reuse we are preventing. A 304 also
  returns an empty body, which renders as a broken image. Frameworks add ETags unprompted,
  so never put a static-file middleware or `@fastify/etag` in front of `/t/open/`.
- **No `Age`.** Because we never send it, a nonzero `Age` on a response is proof something
  cached the pixel. That is the best diagnostic available; don't spend it.
- `Pragma`, `Expires` and `must-revalidate` are retained only as free insurance for ancient
  proxies. `Pragma` is deprecated in responses, `Expires` must be disregarded when
  `max-age` is present, and `must-revalidate` governs reuse of *stale* responses. None is
  defence.
- `Surrogate-Control` and `CDN-Cache-Control` are omitted deliberately: RFC 9213 targeted
  fields **outrank** `Cache-Control`, so a mistyped value there would silently defeat
  `no-store`. Add them only if a CDN is genuinely in path.

A test asserts the absence of the validators. Keep it that way — and note that if Render's
edge cache is ever enabled it is Cloudflare underneath, which selects by **file extension**.
This URL ends in `.png`, so it is cache-eligible and these headers are the only thing
standing between you and a 120-minute stale pixel.

The click redirect carries the same headers. A cached 302 is served without reaching the
handler, so every click after the first would go unrecorded — and clicks are the strongest
evidence available, being unproxied and carrying a real User-Agent.

### 5. The open badge is latched

`MessageRecipient.openedAt` is set once on the first counted open and never cleared. Status
used to be recomputed on each poll from the 10 most recent tracking events, so an open that
fell out of that window made the badge revert from opened to delivered.

## Operational requirement: keep the origin warm

Render free instances spin down after 15 minutes idle, and **Render answers the cold request
itself with an HTML loading page** — the request never reaches Fastify and nothing is
recorded. The exposed case is the overnight open, which is the most common real open for this
tool.

Either ping `/health` every 10 minutes from an external scheduler, or move off the free
plan. Until one of those is in place, a missing open may simply mean the instance was asleep,
and any cache measurement (below) is unreliable.

## Does Google's proxy re-fetch per render?

**Largely settled: yes, and the first real open is never swallowed.** Measurement on
2026-10-08 found Google's proxy **passes the origin's `Cache-Control` through verbatim** to
the Gmail client and **strips the origin's `ETag` and `Last-Modified`**. There is no
Gmail-chosen TTL — the widely repeated "24–72 hours" figures trace back to uncited secondary
content and an RFC that was obsoleted in 2022. If your pixel is ever cached, *you* set the
window.

With no validators and no freshness directive, Chromium computes zero freshness and zero
staleness, has no conditional request to send, and degrades to a full re-fetch. So the
recipient's browser cache does not absorb the pixel either.

What headers do **not** solve, so repeat-open counts are a **lower bound**:

- **Blink's in-document memory cache.** Gmail web is a single-page app. Within one document,
  a repeat image load can be served with zero network requests, so re-entering a thread
  without a document teardown may produce no hit.
- **The native Gmail Android/iOS image caches.** Not browser HTTP caches, not governed by
  browser semantics, never measured.

The practical reading: the *presence* of a second fetch is good evidence of a repeat open;
its *absence* proves nothing. Do not build a rule that infers "not opened again" from a
missing second fetch.

Worth confirming on your own account once the origin is kept warm: send a tracked mail to a
second Gmail account, open it, wait, re-open from a different device, and count distinct
`/t/open` hits. Run it only after the keep-warm is in place, or a cold start will look like a
cache hit.

## The structural fix for self-views, if the image setting is too costly

If giving up remote images is unacceptable, the industry answer is to **rewrite your own Sent
copy to remove the pixel**, via the Gmail API. Mailtrack ships this as "Debeaconizer" and
GMass as "Open Tracking Hardening".

Be aware of what it costs and what it does not fix:

- **It is not device-independent.** Both vendors document that a recipient's **quoted reply**
  carries the original live pixel, which the rewrite never touches. Mailsuite states that a
  residual percentage of self-opens cannot be prevented, and GMass's own guidance ranks the
  extension first and lists self-opens *fifth of five* false-open causes.
- **It needs `gmail.insert` or full-mailbox scope**, which means OAuth verification and a
  recurring third-party security assessment.
- **It destroys the authentic Sent record**, replacing it with a synthetic copy under a new
  message ID, and bypasses most Gmail scanning and classification. It should be opt-in, and
  should trash rather than hard-delete the original.
- **Mailtrack holds an active patent** on it (US 10,749,835, granted 2020, expiry 2036). Not
  legal advice, but note its claim 1 requires *replacing* an already-stored copy — an
  architecture that never stores a tracked Sent copy in the first place (send the
  pixel-bearing MIME through your own MTA, write a clean Sent copy) does not literally
  practise that element, and is cheaper anyway.

## What no implementation can fix

State these rather than papering over them:

- A genuine open that happens while you are viewing the same message in Sent, if remote
  images are enabled on your account.
- Apple MPP recipients: one delivery-time fetch, no second fetch, so never a green badge.
- Recipients who never load images: no signal at all.
- Printing your own sent mail, and a stale pixel quoted into a reply.
- An idle-instance cold start, which is indistinguishable from "never opened".
