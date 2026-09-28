# Security Policy & Vulnerability Disclosure

MailTrace prioritizes application and infrastructure security. Because email tracking services touch external mail agents, proxies, and untrusted network traffic, MailTrace implements defensive-in-depth engineering.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability in MailTrace, please report it privately:

- **Email**: `security@mailtrace.dev` (or via private GitHub Security Advisory)
- **Encryption**: You may request our PGP key before disclosing sensitive details.
- **Expected Information**:
  - Description of the vulnerability and its potential impact.
  - Step-by-step reproduction instructions or a minimal proof of concept (PoC).
  - Component affected (`packages/tracking`, `services/api`, `packages/database`, etc.).

### Our Commitment:
- We acknowledge reports within **48 hours**.
- We provide a target timeline for fixes within **7 business days**.
- We credit security researchers in release changelogs (with researcher consent).
- We request that you give us reasonable time to deploy a patch before public disclosure.

---

## 2. Security Architecture & Threat Defenses

### Open-Redirect Immunity
- Tracking redirects (`/t/click/:token`) **strictly prohibit** user-supplied destination URLs in query parameters or request headers.
- The server extracts the cryptographic token, queries the PostgreSQL `tracked_links` table, and verifies the record is tied to an active, valid outbound message.
- If the token is invalid, expired, or non-existent, the request terminates with HTTP 404/410. Arbitrary off-site redirection is physically impossible.

### Cryptographic Token Integrity
- Tokens are generated using Node.js `crypto.randomBytes(16)` (128-bit cryptographic entropy).
- Tokens are collision-resistant and immune to enumeration or brute-force crawling.

### Credential Protection at Rest
- Sensitive user credentials (SMTP passwords, OAuth 2.0 refresh tokens) are encrypted with **AES-256-GCM**.
- Each record receives a fresh, randomly generated 96-bit Initialization Vector (IV).
- The 128-bit Authentication Tag is validated upon decryption. Any tampering or corrupted ciphertext triggers an authentication failure exception and halts processing.

### Defense Against Injection in Emails
- Tracking pixels are injected as standard static `<img>` tags.
- No JavaScript, data-URIs, iframes, or executable constructs are ever placed in outbound emails.
- Links are validated and rewritten cleanly via Cheerio HTML parsing, preventing attribute breakout or XSS payloads.

### Rate Limiting & Denial of Service Protection
- Public tracking endpoints (`/t/open/*`, `/t/click/*`) utilize Fastify rate limiting with sliding windows.
- Ingestion events are buffered in Redis BullMQ queues rather than executed synchronously against the database, preventing connection starvation during spike traffic.
