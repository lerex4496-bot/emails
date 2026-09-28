# MailTrace Threat Model & Security Architecture

This document outlines the threat model, attack vectors, security invariants, and mitigations implemented in **MailTrace**.

---

## 1. Threat Vectors & Defenses

| Threat Vector | Potential Impact | MailTrace Defense |
| :--- | :--- | :--- |
| **Open-Redirect Abuse** | Attacker crafts phishing emails using MailTrace tracking domain to redirect victims to malicious websites. | **Strict Token Association:** Tokens in `/t/click/:token` strictly resolve against pre-registered `tracked_links` in PostgreSQL. Redirection targets cannot be supplied via query strings. Tampered or unknown tokens return `404 Not Found`. |
| **Tracking Token Enumeration** | Attacker brute-forces sequential IDs to fabricate open or click events. | **128-bit Cryptographic Randomness:** Tokens are generated using Node.js `crypto.randomBytes(16)` (hex) or UUIDv4, yielding $2^{128}$ possible values. Sequential database IDs are never exposed. |
| **Credential Theft at Rest** | Compromise of the database leads to plaintext theft of Gmail/Microsoft OAuth refresh tokens or SMTP passwords. | **AES-256-GCM Encryption:** All provider credentials and OAuth tokens are encrypted using authenticated AES-256-GCM with unique random initialization vectors (IVs) and authentication tags before persistence. |
| **Denial of Service (DoS) on Tracking Endpoints** | Malicious bot sends millions of GET requests to `/t/open` to overwhelm the server. | **High-Throughput Caching & Rate Limiting:** Fastify rate-limiting (`@fastify/rate-limit`) and in-memory pre-rendered 68-byte binary buffers allow the open endpoint to serve thousands of requests per second with minimal CPU and zero disk I/O. |
| **Timing & False Read Deception** | Automated spam scanners ping tracking pixels, tricking the sender into believing the recipient opened the email. | **Heuristic Anti-False-Positive Engine:** Events requested <1s after dispatch, or originating from datacenter ASNs or matching security crawler signatures, are classified as `TRACKING_RESOURCE_REQUESTED (Likely Automated)`. |
| **Recipient PII Leakage** | Storing recipient IP addresses violates privacy regulations (GDPR/CCPA) and exposes user location data. | **Zero Raw IP Storage by Default:** MailTrace drops the client IP address at the API layer unless the owner explicitly turns on IP logging in privacy settings. |

---

## 2. Cryptographic Specifications

- **Token Generation:** `crypto.randomBytes(16).toString('hex')` (32 characters, 128 bits entropy).
- **Symmetric Encryption:** `AES-256-GCM` with 96-bit random IV and 128-bit authentication tag.
- **Password Hashing:** `bcrypt` with work factor 10.
- **Session Tokens:** `JWT (JSON Web Token)` signed with HS256 using 256-bit+ secret.
