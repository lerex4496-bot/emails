# MailTrace 🛰️

> Production-grade, privacy-conscious personal email tracking platform with evidence-based activity classification.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-black.svg)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev/)

---

## 🌟 Core Philosophy: Truth in Evidence

Traditional email trackers make misleading claims, falsely asserting that an email was "read" the moment a network request hits an image URL.

In reality, modern email delivery is governed by **caching proxies, automated spam scanners, and pre-fetching crawlers**:
- **Google Image Proxy** caches images on Google servers before the recipient opens the mail.
- **Apple Mail Privacy Protection (MPP)** downloads remote content in bulk on Apple proxies upon delivery.
- **Microsoft Office 365 ATP** inspects URLs and resources within milliseconds of arrival to detect phishing.

**MailTrace rejects deceptive "read" assertions.** Instead, every event is tracked as empirical evidence:

```
[Sent] ➔ [Delivered] ➔ [Resource Requested] ➔ [Possible Open] ➔ [Probable Open] ➔ [Confirmed View]
```

1. **`TRACKING_RESOURCE_REQUESTED`**: Server received an HTTP GET request. This is the **default** verdict — automated crawlers, prefetches, scanners, Apple MPP, and anything whose fetcher we cannot positively identify. Only positive evidence promotes an event above this.
2. **`POSSIBLE_EMAIL_OPEN`**: Legacy state, retained for historical rows. It does **not** count as an open: "possible" is not sufficient under a never-show-a-false-open policy.
3. **`PROBABLE_EMAIL_OPEN`**: Fetched by a recognised mail-client proxy more than 60s after dispatch, with no prefetch headers. Latched into `openedAt` so the verdict cannot regress.
4. **`CONFIRMED_EMAIL_VIEW`**: Directly observed viewport render in MailTrace first-party clients (Windows, Android, webmail extension).
5. **`LINK_CLICKED`**: Recipient clicked a tracked link (with strict open-redirect validation).
6. **`REPLY_RECEIVED`**: Inbound reply correlated via `In-Reply-To`, `References`, or sub-addressing alias.

---

## 🏗️ Architecture & Monorepo Layout

```
mailtrace/
├── apps/
│   ├── web/            # Vite + React 18 + Tailwind CSS + Recharts Dashboard
│   ├── windows/        # Tauri 2.0 native Windows desktop reader
│   ├── android/        # Kotlin + Jetpack Compose Android client
│   └── extension/      # Manifest V3 companion for Gmail and Outlook webmail
├── services/
│   ├── api/            # Fastify REST & Tracking API (/t/open, /t/click)
│   └── worker/         # BullMQ async queue processor
├── packages/
│   ├── shared/         # Zod schemas, TypeScript types, constants
│   ├── database/       # Prisma ORM + PostgreSQL schema + AES-256-GCM crypto
│   ├── tracking/       # 1x1 transparent PNG/GIF, token generator, HTML rewriter
│   ├── email/          # EmailProvider interface: Gmail, Microsoft Graph, SMTP
│   └── analytics/      # Anti-false-positive heuristic classification engine
├── docs/               # System specifications and diagrams
└── infrastructure/     # Docker Compose, Caddyfile, Dockerfiles, .env.example
```

---

## 🚀 Quickstart (Docker Self-Hosting)

You can launch the complete MailTrace stack with a single command:

```bash
# 1. Clone repository
git clone https://github.com/mailtrace/mailtrace.git
cd mailtrace

# 2. Configure environment
cp infrastructure/.env.example .env

# 3. Start containers
docker compose -f infrastructure/docker-compose.yml up -d
```

Services will be accessible at:
- **Web Dashboard**: `http://localhost:8080` (or `https://localhost` via Caddy reverse proxy)
- **API & Tracking Endpoints**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

---

## 📊 Endpoints & Protocol

### 1. Open Tracking Resource
```http
GET /t/open/:token
```
- Returns 1x1 transparent PNG buffer (68 bytes).
- Headers: `Cache-Control: private, no-cache, no-store, must-revalidate`.
- Queues request headers for proxy detection and timing classification.

### 2. Link Tracking (Open-Redirect Protected)
```http
GET /t/click/:token
```
- Looks up token in `tracked_links` table.
- Increments click counters and emits `LINK_CLICKED` event.
- Returns `302 Found` redirecting **strictly to the registered destination**.
- Rejects arbitrary open-redirect attempts with `404 Not Found`.

### 3. First-Party Confirmed View
```http
POST /api/v1/events/confirm-view
Content-Type: application/json

{
  "messageId": "01HV-MSG-12345",
  "deviceIdentifier": "desktop-client-01",
  "platform": "WINDOWS"
}
```

---

## 📚 Documentation

- [FALSE_OPENS.md](./FALSE_OPENS.md) - **Required setup.** Why sender self-views and Google's delivery scan forge opens, and what to configure before trusting a green badge.
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Deep architectural breakdown and component flows.
- [THREAT_MODEL.md](./THREAT_MODEL.md) - Security invariants, open-redirect defense, token entropy.
- [PRIVACY.md](./PRIVACY.md) - IP address policies, data retention, GDPR/CCPA alignment.
- [SELF_HOSTING.md](./SELF_HOSTING.md) - Production deployment guide with Docker and Caddy.
- [API.md](./API.md) - Full REST API documentation.
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guidelines for contributors.
- [SECURITY.md](./SECURITY.md) - Security disclosure policies.

---

## 📄 License

Licensed under the [Apache License, Version 2.0](./LICENSE).
