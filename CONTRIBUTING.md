# Contributing to MailTrace

Thank you for your interest in contributing to **MailTrace**! We welcome bug fixes, documentation improvements, heuristics refinements for proxy signatures, and client companions.

---

## 1. Development Prerequisites

- **Node.js**: v20.x or v22.x LTS
- **Package Manager**: `pnpm` (v10+ or v11+)
- **Docker & Docker Compose**: For local PostgreSQL and Redis dependencies
- **Git**

---

## 2. Setting Up Your Local Environment

### Step 1: Clone and Install
```bash
git clone https://github.com/your-username/mailtrace.git
cd mailtrace
pnpm install
```

### Step 2: Start Local Backends
Launch local PostgreSQL and Redis instances:
```bash
docker run --name mailtrace-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mailtrace -p 5432:5432 -d postgres:16-alpine
docker run --name mailtrace-redis -p 6379:6379 -d redis:7-alpine
```

### Step 3: Configure Local Environment
Create `.env` inside `packages/database` and `services/api`:
```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mailtrace?schema=public"
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
JWT_SECRET="dev-jwt-secret-do-not-use-in-production"
PORT=3000
```

Run database migrations:
```bash
pnpm --filter @mailtrace/database prisma migrate dev
```

### Step 4: Run Tests & Build
Ensure your development environment is fully functional:
```bash
# Run unit test suites across all packages
pnpm test

# Build all packages and applications
pnpm build
```

---

## 3. Monorepo Structure

```
mailtrace/
├── apps/
│   ├── web/          # React 18 + Vite + Tailwind CSS dashboard
│   ├── windows/      # Tauri 2.0 desktop shell & offline sync queue
│   ├── android/      # Kotlin + Jetpack Compose mobile client
│   └── extension/    # Webmail companion (Manifest V3)
├── packages/
│   ├── shared/       # Shared TypeScript types, enums, Zod validation schemas
│   ├── database/     # Prisma schema, migrations, AES-256-GCM crypto
│   ├── tracking/     # Pixel buffer generator, link rewriter, token builder
│   ├── email/        # SMTP, Gmail API, and Microsoft Graph senders, reply matcher
│   └── analytics/    # Proxy signatures & confidence classification engine
├── services/
│   ├── api/          # Fastify tracking engine & REST API
│   └── worker/       # BullMQ deduplication & event processor
└── infrastructure/   # Docker Compose, Caddyfile, and deployment manifests
```

---

## 4. Immutable Design Invariants

When contributing pull requests, you **must adhere to these design principles**:

1. **Truth in Evidence**:
   - Never mark an email as "read" or "confirmed view" from a passive HTTP pixel fetch.
   - Passive pixel hits must be classified as `TRACKING_RESOURCE_REQUESTED`, `SECURITY_SCANNER_PREFETCH`, or `POSSIBLE_EMAIL_OPEN`.
   - `CONFIRMED_EMAIL_VIEW` is reserved exclusively for verified first-party sender clients.
2. **Open-Redirect Immunity**:
   - The `/t/click/:token` redirect handler must strictly resolve the destination URL from the database whitelist. Never accept query parameters like `?url=https://...`.
3. **Privacy by Default**:
   - Raw IP addresses must never be stored on disk or in the database unless the owner explicitly enables `RAW_IP_STORAGE=true`.
   - Never store email message bodies in the database.
4. **No Injected Banners or JavaScript**:
   - Outgoing tracked emails must never contain visual banners, tracking warnings, or executable scripts.

---

## 5. Pull Request Workflow

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Write unit tests for your changes using Vitest.
3. Verify all tests and builds pass:
   ```bash
   pnpm test
   pnpm build
   ```
4. Follow Conventional Commits:
   - `feat: add support for Fastmail reply headers`
   - `fix: correct regex for Yahoo Image Proxy user-agent`
   - `docs: update self-hosting guide for Traefik`
5. Open a Pull Request on GitHub with a clear summary of your changes.
