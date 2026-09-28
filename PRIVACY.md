# MailTrace Privacy Policy & Telemetry Philosophy

**MailTrace** is engineered from the ground up to respect recipient privacy while providing accurate, evidence-grounded telemetry for email senders. Unlike legacy tracking platforms that rely on deceptive metrics, intrusive banners, or invasive surveillance, MailTrace adheres to strict truth-in-evidence principles.

---

## 1. Core Principles

### 1. Truth in Evidence (No Fake "Read" Receipts)
Passive HTTP image requests (tracking pixels) **never prove an email was read**. MailTrace enforces strict classification:
- **`TRACKING_RESOURCE_REQUESTED`**: An image was fetched by an email client or proxy.
- **`SECURITY_SCANNER_PREFETCH`**: Security filters (Proofpoint, Barracuda, Mimecast, Microsoft Defender ATP) scanned the link or image before user delivery.
- **`PROXY_CACHE_REQUEST`**: Google Image Proxy, Apple Mail Privacy Protection (MPP), or Yahoo Image Proxy fetched the pixel in advance.
- **`POSSIBLE_EMAIL_OPEN` / `PROBABLE_EMAIL_OPEN`**: Heuristic evaluation considering timing, user-agent, and repeat fetches.
- **`CONFIRMED_EMAIL_VIEW` (`FIRST_PARTY_VIEW_CONFIRMED`)**: **Reserved exclusively** for verified first-party sender clients (MailTrace Windows Desktop, Android client, Webmail extension). Passive web requests can never trigger this classification.

### 2. Recipient Invisibility & Non-Invasiveness
- **Zero Injected Banners**: MailTrace never injects visible disclaimers, badges, or tracking alerts into outgoing emails.
- **Micro-Footprint Pixel**: Uses an invisible 68-byte 1x1 transparent PNG or 43-byte GIF. It does not distort typography, alter layouts, or break email formatting.
- **Zero JavaScript**: In accordance with RFC email standards and modern security practices, emails contain zero executable scripts.
- **No Anti-Tracking Circumvention**: MailTrace never attempts to bypass recipient ad-blockers, Apple Mail Privacy Protection, or client-side privacy settings. If a recipient blocks remote images, remote images remain blocked.

### 3. Data Minimization & Anonymization
- **No Email Body Storage**: When tracking outbound emails or matching incoming replies, MailTrace stores **zero email body content**. Inbound replies are matched exclusively using RFC-2822 headers (`In-Reply-To`, `References`) or sub-addressed tokens (`reply+token@domain.com`).
- **IP Anonymization by Default**: By default, MailTrace hashes all incoming client IP addresses using SHA-256 combined with a daily rotating salt, or masks the last octet (e.g., `192.0.2.0/24` or `2001:db8::/32`). Raw IP addresses are never saved to disk or database tables unless explicitly toggled in self-hosted privacy settings.
- **Cryptographic Link Wrapping**: All tracked links are wrapped with unique, high-entropy 128-bit cryptographic tokens. MailTrace does not leak original destination URLs or recipient metadata in URL parameters.
- **Strict Open-Redirect Prevention**: Tracked links resolve exclusively from a server-side PostgreSQL whitelist (`tracked_links` table). Query-parameter redirects (e.g., `/t/click?url=...`) are strictly prohibited and rejected.

---

## 2. Telemetry Classification Matrix

| Signal | Source | Confidence Level | System Classification | Display Badge |
| :--- | :--- | :--- | :--- | :--- |
| First-Party Viewport Observation | MailTrace Desktop / Android App | **Confirmed (100%)** | `CONFIRMED_EMAIL_VIEW` | 🟢 Confirmed View |
| Link Click (Human timing > 5s) | Direct Browser Navigation | **High (80-90%)** | `PROBABLE_EMAIL_OPEN` / `LINK_CLICKED` | 🔵 High Confidence |
| Pixel Request (Human timing > 5s) | Standalone Mail Client | **Medium (50-60%)** | `POSSIBLE_EMAIL_OPEN` | 🟡 Medium Confidence |
| Fast Pixel Request (< 1s after send) | Security Gateway | **Low (10-20%)** | `SECURITY_SCANNER_PREFETCH` | ⚪ Security Scanner |
| Pixel Request from Known Proxy | Apple MPP / Google Image Proxy | **Informational** | `PROXY_CACHE_REQUEST` | 🟣 Cached by Proxy |

---

## 3. Data Retention & Lifecycle

1. **Configurable Token Expiration**: Tracking tokens expire automatically after a user-configured window (default: 90 days). Once expired, tracking endpoints return HTTP 410 Gone and no further telemetry is logged.
2. **Right to Be Forgotten (GDPR Article 17)**: Users can delete any tracked message or recipient through the dashboard or REST API. Deletion permanently cascades across:
   - Message records
   - Recipient associations
   - Tracking tokens
   - Tracked link mappings
   - Tracking and click events
   - Device audit logs
3. **Zero Third-Party Telemetry**: MailTrace contains zero trackers, no Google Analytics, no Meta Pixel, and no third-party telemetry services. All data resides exclusively on your self-hosted infrastructure.

---

## 4. Security & Encryption Standards

- **Credential Encryption**: Email account credentials (SMTP passwords, OAuth 2.0 refresh tokens) are encrypted at rest using **AES-256-GCM** with unique 96-bit initialization vectors (IVs) and 128-bit authentication tags.
- **Authentication**: REST APIs are protected using JSON Web Tokens (JWT) signed with HMAC-SHA256, HTTP-only SameSite cookies, and rate-limiting on sensitive endpoints.
- **Secure Communication**: First-party clients connect over TLS 1.3 with pinned certificates where supported.

---

## 5. Compliance Checklist

- [x] **GDPR Compliant**: Data minimization, IP hashing, no body storage, complete data erasure endpoints.
- [x] **CCPA / CPRA Compliant**: Zero sale or sharing of personal information with third parties.
- [x] **ePrivacy Directive Compliant**: Respects remote resource blocking; zero client-side fingerprinting or storage manipulation.
