# MailTrace Cloud Deployment Guide (Render + Vercel)

This guide walks you through deploying MailTrace to **Render** (Backend API + Database) and **Vercel** (Frontend Web Dashboard), with **100% automated database migration (no terminal access needed)** and **zero paid services required**.

---

## 1. Why Did Render Show an Error Earlier?

In your screenshot, two specific Render Free Tier limits were triggered:
1. **"cannot have more than one active free tier database"**:
   Render allows only **1 free PostgreSQL database per account**. If you already have a database in your Render workspace, Render blocks creating a second one.
2. **"i can't access terminal on render because i am using free account"**:
   Render's web shell / terminal is locked behind paid plans.
   
### How We Solved Both:
- **No Duplicate Database**: We updated `render.yaml` to deploy only the Web Service and connect to your existing database.
- **Zero Terminal Required**: The application now runs `pnpm --filter @mailtrace/database prisma:push` automatically in the `startCommand` on every startup, followed by auto-creating the initial owner user. **You never need to open the terminal on Render!**

---

## 2. Deploy Backend on Render

### Method A: Use Manual Web Service (Simplest & Most Reliable)

#### Step 1: Get Your Existing Database Connection String
1. In your [Render Dashboard](https://dashboard.render.com), open your existing PostgreSQL database (e.g. `mailtrace-db` or similar).
2. Scroll to the **Connections** section:
   - If deploying in the same region, copy the **Internal Database URL** (e.g. `postgres://mailtrace:...@dpg-xxx:5432/mailtrace`).
   - Or copy the **External Database URL**.

*(If you don't have a database, click **New +** $\rightarrow$ **PostgreSQL** to create one for free).*

#### Step 2: Create Web Service for the API
1. In Render, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository: `lerex4496-bot/emails`.
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
     pnpm --filter @mailtrace/database prisma:push && node services/api/dist/server.js
     ```
   - **Instance Type**: **Free**

4. Scroll down to **Environment Variables** and add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production optimizations |
   | `PORT` | `10000` | Port automatically routed by Render |
   | `DATABASE_URL` | `<Your Postgres Connection String>` | Pasted from Step 1 |
   | `REDIS_URL` | `none` | Enables standalone zero-Redis mode (100% free) |
   | `JWT_SECRET` | `mailtrace-production-secret-key-32-chars-long` | Any random 32+ character string |
   | `TRACKING_BASE_URL` | `https://your-api-name.onrender.com` | Your Render Web Service URL |

5. Click **Create Web Service**.
6. Render will build and launch your service. Notice in the deploy logs:
   ```
   The database is already in sync with the Prisma schema.
   ✔ Generated Prisma Client
   [Init] Default owner account initialized (owner@mailtrace.io / Password123!).
   MailTrace API listening on http://0.0.0.0:10000
   ```
   **All database tables and the owner user are created automatically without terminal access!**
7. Verify by opening `https://your-api-name.onrender.com/health` in your browser. It will return:
   ```json
   {"status":"ok","service":"mailtrace-api","uptime":...}
   ```

---

### Method B: Render Blueprint Sync

If syncing from the Blueprint (`render.yaml`) in your screenshot:
1. In your Blueprint page (`mailtrace-db`), click **Settings** $\rightarrow$ link your existing PostgreSQL database to `DATABASE_URL`.
2. Click **Manual Sync**.
3. Render will pull commit `main` and deploy cleanly without trying to create a second database.

---

## 3. Deploy Frontend Web Dashboard on Vercel

1. Open your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import `lerex4496-bot/emails`.
4. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Select `apps/web` *(or leave blank; the root `vercel.json` automatically routes to `apps/web`)*.
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://your-api-name.onrender.com` |
   *(Replace with your actual Render API URL)*
6. Click **Deploy**.
7. In ~1 minute, your dashboard will be live at `https://your-app.vercel.app`!

---

## 4. Connecting the Chrome Extension

1. In Google Chrome, go to `chrome://extensions` and click **Reload (↻)** on **MailTrace Webmail Companion**.
2. Click the MailTrace extension icon in your Chrome toolbar.
3. In the popup, update the endpoints:
   - **API Base URL**: `https://your-api-name.onrender.com`
   - **Dashboard URL**: `https://your-app.vercel.app`
4. Click **Test API Connection** $\rightarrow$ it will show **Connected**.
5. Click **Save Configuration**.

---

## 5. Send Tracked Emails in Gmail

1. Open [Gmail](https://mail.google.com).
2. Click **Compose**. The `⚡ Track: ON` toggle is active in the toolbar.
3. Send an email to any recipient (with or without links).
4. Watch the multi-stage checkmarks update in your Sent folder:
   - <span style="color:#94a3b8;font-weight:bold;">✓</span> *(Single Grey)* = Dispatched / waiting for recipient
   - <span style="color:#64748b;font-weight:bold;">✓✓</span> *(Double Grey)* = Delivered to recipient's inbox
   - <span style="color:#16a34a;font-weight:bold;">✓✓</span> *(Double Green)* = Opened / Viewed
   - <span style="color:#16a34a;font-weight:bold;">✓✓</span> <span style="color:#2563eb;font-weight:bold;">↗</span> *(Green check with Blue arrow)* = Link Clicked
   - <span style="color:#16a34a;font-weight:bold;">✓✓</span> <span style="color:#7c3aed;font-weight:bold;">↩</span> *(Green check with Purple arrow)* = Reply Received
5. Click any tick badge to open your live Vercel dashboard and inspect full evidence telemetry!
