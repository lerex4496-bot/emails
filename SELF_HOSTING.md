# MailTrace Self-Hosting Guide

This guide walks you through deploying **MailTrace** on your own server or cloud instance using Docker Compose and Caddy with automated HTTPS.

---

## 1. Prerequisites & System Requirements

- **Operating System**: Linux (Ubuntu 22.04+ recommended), macOS, or Windows Server with Docker Desktop / WSL2
- **Memory**: Minimum 2 GB RAM (4 GB recommended)
- **Disk Space**: 10 GB free SSD storage
- **Software**:
  - Docker Engine 24.0+
  - Docker Compose v2.20+
- **Network**:
  - Ports `80` (HTTP) and `443` (HTTPS) open for incoming web traffic.
  - A registered domain or subdomain (e.g. `mailtrace.example.com`) pointing to your server's public IP (A/AAAA DNS records).

---

## 2. 5-Minute Quickstart

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/mailtrace.git
cd mailtrace
```

### Step 2: Configure Environment Variables
Copy the template configuration file:
```bash
cp infrastructure/.env.example infrastructure/.env
```

Generate secure 32-byte cryptographic keys using OpenSSL:
```bash
# Generate ENCRYPTION_KEY (64 hex characters = 32 bytes)
openssl rand -hex 32

# Generate JWT_SECRET
openssl rand -hex 32
```

Edit `infrastructure/.env`:
```ini
# Core Configuration
NODE_ENV=production
DOMAIN=mailtrace.example.com
PUBLIC_URL=https://mailtrace.example.com
PORT=3000

# Security (Paste generated keys)
ENCRYPTION_KEY=your_64_character_hex_key_here
JWT_SECRET=your_jwt_secret_here

# PostgreSQL Credentials
POSTGRES_DB=mailtrace
POSTGRES_USER=mailtrace
POSTGRES_PASSWORD=generate_a_secure_db_password
DATABASE_URL=postgresql://mailtrace:generate_a_secure_db_password@postgres:5432/mailtrace?schema=public

# Redis Credentials
REDIS_HOST=redis
REDIS_PORT=6379

# Privacy Defaults
ANONYMIZE_IPS=true
RAW_IP_STORAGE=false
BURST_WINDOW_MS=3000
```

### Step 3: Configure Caddy Reverse Proxy
Open `infrastructure/Caddyfile` and ensure your domain is set:
```caddyfile
mailtrace.example.com {
    encode gzip zstd

    # API and Tracking endpoints
    handle /t/* {
        reverse_proxy api:3000
    }
    handle /api/* {
        reverse_proxy api:3000
    }
    handle /health* {
        reverse_proxy api:3000
    }
    handle /ready* {
        reverse_proxy api:3000
    }
    handle /metrics* {
        reverse_proxy api:3000
    }

    # Frontend Dashboard
    handle {
        reverse_proxy web:80
    }
}
```

### Step 4: Launch the Stack
```bash
cd infrastructure
docker compose up -d --build
```

### Step 5: Initialize the Database Schema
Execute Prisma migrations inside the running API container:
```bash
docker compose exec api pnpm --filter @mailtrace/database prisma migrate deploy
```

Verify service status:
```bash
docker compose ps
```
Visit `https://mailtrace.example.com` in your browser. Caddy automatically provisions an SSL certificate from Let's Encrypt.

---

## 3. Architecture & Service Ports

| Service | Container Name | Internal Port | Description |
| :--- | :--- | :--- | :--- |
| **Caddy** | `mailtrace-caddy` | `80`, `443` | Reverse proxy, TLS termination, static asset compression |
| **API** | `mailtrace-api` | `3000` | Fastify REST API, pixel server, redirect dispatcher |
| **Worker** | `mailtrace-worker` | - | BullMQ background consumer, deduplication & classification engine |
| **Web** | `mailtrace-web` | `80` | NGINX serving compiled React 18 dashboard |
| **PostgreSQL** | `mailtrace-postgres` | `5432` | Relational database (tokens, links, telemetry, accounts) |
| **Redis** | `mailtrace-redis` | `6379` | In-memory message queue and deduplication cache |

---

## 4. Email Provider Setup

### Option A: Standard SMTP / IMAP
Go to the MailTrace dashboard -> **Settings** -> **Connected Accounts**:
- **Host**: `smtp.provider.com`
- **Port**: `587` (STARTTLS) or `465` (SSL/TLS)
- **Username**: `user@domain.com`
- **Password**: App-specific password or API token

Credentials are encrypted at rest with AES-256-GCM before entering the database.

### Option B: Google Workspace / Gmail OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create an OAuth 2.0 Client ID (Web Application).
3. Set Authorized Redirect URI: `https://mailtrace.example.com/api/v1/auth/google/callback`.
4. Enter `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `infrastructure/.env`.

### Option C: Microsoft 365 / Outlook OAuth
1. Go to [Azure Portal](https://portal.azure.com) -> **App Registrations**.
2. Register an app with `Mail.Send` and `Mail.ReadBasic` permissions.
3. Set Redirect URI: `https://mailtrace.example.com/api/v1/auth/microsoft/callback`.
4. Enter `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in `infrastructure/.env`.

---

## 5. Maintenance, Backup & Restores

### Database Backup
Run an automated dump of PostgreSQL:
```bash
docker compose exec postgres pg_dump -U mailtrace mailtrace > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore
```bash
cat backup_YYYYMMDD_HHMMSS.sql | docker compose exec -T postgres psql -U mailtrace mailtrace
```

### Health & Observability Endpoints
- **Liveness probe**: `GET /health` -> `{"status":"ok"}`
- **Readiness probe**: `GET /ready` -> Checks database and Redis connectivity
- **Prometheus metrics**: `GET /metrics` -> Real-time throughput, event latency, and queue depths
