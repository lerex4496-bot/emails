# MailTrace Cloud Deployment Guide (Render + Vercel)

This guide walks you through deploying MailTrace to **Render** (Backend API + Database) and **Vercel** (Frontend Web Dashboard), and connecting your **Chrome Extension**.

---

## 1. Deploy Backend & Database on Render

### Method A: 1-Click Blueprint (Recommended)
1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Select your connected GitHub repository (`lerex4496-bot/emails`).
4. Render will read `render.yaml` and automatically create:
   - **PostgreSQL Database** (`mailtrace-db`) on the free tier.
   - **Web Service** (`mailtrace-api`) with all environment variables wired up.
5. Click **Apply**.
6. Once deployed, open the Web Service **Shell** tab on Render and run:
   ```bash
   pnpm db:push
   pnpm db:seed
   ```
7. Note down your API URL (e.g. `https://mailtrace-api-xxxx.onrender.com`).

---

### Method B: Manual Web Service Setup on Render
If you prefer creating services manually:

#### Step 1: Create Free PostgreSQL Database
1. In Render, click **New +** $\rightarrow$ **PostgreSQL**.
2. Name: `mailtrace-postgres`
3. Database: `mailtrace`
4. User: `mailtrace`
5. Plan: **Free**
6. Click **Create Database**.
7. Once created, copy the **Internal Database URL** (or **External Database URL**).

#### Step 2: Create Web Service for API
1. In Render, click **New +** $\rightarrow$ **Web Service**.
2. Connect your repository: `lerex4496-bot/emails`.
3. Set the following fields:
   - **Name**: `mailtrace-api`
   - **Region**: Same region as your database (e.g. Oregon or Frankfurt)
   - **Branch**: `main`
   - **Root Directory**: *(leave blank / default root)*
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     pnpm install && pnpm build:api
     ```
   - **Start Command**:
     ```bash
     node services/api/dist/server.js
     ```
   - **Instance Type**: **Free**

4. Scroll down to **Environment Variables** and add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production optimizations |
   | `PORT` | `10000` | Port used by Render |
   | `DATABASE_URL` | `<Your Render Postgres Database URL>` | Paste connection string from Step 1 |
   | `REDIS_URL` | `none` | Runs in standalone zero-Redis mode! |
   | `JWT_SECRET` | `mailtrace-production-secret-key-32-chars-long` | Any random 32+ character string |
   | `TRACKING_BASE_URL` | `https://your-api-name.onrender.com` | Your Render Web Service URL |

5. Click **Create Web Service**.
6. When the build finishes, open the **Shell** tab on Render and run:
   ```bash
   pnpm db:push
   ```
   *(Optional)* To populate sample tracking data for diagnostics:
   ```bash
   pnpm db:seed
   ```
7. Test the deployment by visiting: `https://your-api-name.onrender.com/health` in your browser. You should see `{"status":"ok","service":"mailtrace-api"}`.

> [!TIP]
> **Redis Alternative (Optional)**: If you want background async job queuing for high volumes without paying for Render Redis, use [Upstash Redis](https://upstash.com) (100% free tier, 10,000 requests/day). Paste the `rediss://default:xxx@...` URL into `REDIS_URL`. Otherwise, `REDIS_URL=none` processes tracking events directly into PostgreSQL with zero extra costs.

---

## 2. Deploy Frontend Web Dashboard on Vercel

1. Go to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository: `lerex4496-bot/emails`.
4. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click Edit $\rightarrow$ select `apps/web` *(or leave blank since root `vercel.json` is configured)*
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://your-api-name.onrender.com` |
   *(Replace with your actual Render API service URL)*
6. Click **Deploy**.
7. In ~1 minute, your dashboard will be live at `https://your-app.vercel.app`!

---

## 3. Configure the Chrome Extension

1. In Chrome, open `chrome://extensions`.
2. Find **MailTrace Webmail Companion** and click the extension icon in your Chrome toolbar.
3. In the popup:
   - **API Base URL**: `https://your-api-name.onrender.com` (or `http://localhost:3000` for local dev)
   - **Dashboard URL**: `https://your-app.vercel.app` (or `http://localhost:5173` for local dev)
4. Click **Test API Connection** $\rightarrow$ it should confirm **Connected**.
5. Click **Save Configuration**.

---

## 4. Verify End-to-End Tracking

1. Open [Gmail](https://mail.google.com).
2. Click **Compose**. The `⚡ Track: ON` badge appears automatically next to the Send button.
3. Write an email, include a link (e.g. `https://github.com`), and send it.
4. Check your **Sent** folder:
   - <span style="color:#94a3b8;font-weight:bold;">✓</span> *(Single Grey)* = Dispatched / waiting for recipient
   - <span style="color:#64748b;font-weight:bold;">✓✓</span> *(Double Grey)* = Delivered to inbox
   - <span style="color:#16a34a;font-weight:bold;">✓✓</span> *(Double Green)* = Opened / Viewed
   - <span style="color:#16a34a;font-weight:bold;">✓✓</span> <span style="color:#2563eb;font-weight:bold;">↗</span> *(Green check with Blue arrow)* = Link Clicked
5. Click the checkmark badge in Gmail or open your Vercel Dashboard to see the real-time event timeline and confidence classification.
