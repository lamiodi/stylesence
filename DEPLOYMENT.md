# Style Sence Deployment Guide

This guide details how to manually deploy the **Backend on Render** and the **Frontend on Vercel**.

---

## Architecture

- **Backend (Render)**: Next.js 16 API service with PostgreSQL database connection and Cloudinary CDN.
- **Frontend (Vercel)**: Next.js 16 luxury storefront. Automatically proxies `/api/*` requests to the Render backend via Next.js rewrites.
- **Database**: Supabase PostgreSQL (Frankfurt `eu-central-1` via IPv4 pooler).
- **Media**: Cloudinary (`qaruxkhf`).

---

## Part 1: Deploy Backend on Render (Manual Setup)

In your [Render Dashboard](https://dashboard.render.com/):

### 1. Create or Open Web Service
- If creating a new service: Click **"New +"** &rarr; **"Web Service"** &rarr; Select `lamiodi/stylesence`.
- If modifying your existing service: Go to **Settings** of your `stylessence-backend` service.

### 2. Configure Service Settings

| Setting | Recommended Value | Alternative (if Root Dir is empty) |
| :--- | :--- | :--- |
| **Root Directory** | `backend` | *(Leave empty)* |
| **Build Command** | `npm install && npm run build` | `npm install && npm run build:backend` |
| **Start Command** | `npm run start` | `npm run start:backend` |
| **Health Check Path** | `/api/health` | `/api/health` |

> [!IMPORTANT]
> **Why the previous deploy gave "Could not find a production build in the '.next' directory":**
> Render's default build command is only `npm install` (which does not compile Next.js), and the start command defaulted to the root `concurrently` script. Setting the **Build Command** to `npm install && npm run build` and **Start Command** to `npm run start` ensures the Next.js production build is created before starting the server.

### 3. Configure Environment Variables
Under the service's **Environment** tab, set:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://postgres.cqdksblxkdznugfczgem:Ri8eObh2dLpijoEN@aws-0-eu-central-1.pooler.supabase.com:5432/postgres` |
| `CLOUDINARY_URL` | `cloudinary://897313336739949:Ctg4CB3CjD0xoCEj-_lyazaa5Xw@qaruxkhf` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `qaruxkhf` |
| `RESEND_API_KEY` | `re_xxxxxxxx` (Your live Resend API key) |
| `EMAIL_FROM` | `Style Sence <onboarding@resend.dev>` (or your verified domain sender) |
| `FRONTEND_URL` | `https://<your-vercel-app>.vercel.app` (or `*` for dev/wildcard) |


### 4. Deploy
Click **"Save Changes"** / **"Manual Deploy > Deploy latest commit"**.
Once deployed, verify by opening in your browser:
`https://<your-render-app>.onrender.com/api/health`
It will return:
```json
{ "status": "ok", "service": "stylessence-backend" }
```

---

## Part 2: Deploy Frontend on Vercel (Manual Setup)

In your [Vercel Dashboard](https://vercel.com/dashboard):

### 1. Import Repository
1. Click **"Add New... > Project"**.
2. Select your repository: `lamiodi/stylesence`.

### 2. Configure Project Settings
- **Project Name**: `stylesence` (or `stylesence-frontend`)
- **Framework Preset**: `Next.js`
- **Root Directory**: Click **Edit** &rarr; select **`frontend`**
- **Build Command**: Default (`npm run build`)
- **Output Directory**: Default (`.next`)

### 3. Add Environment Variables
| Key | Value | Notes |
| :--- | :--- | :--- |
| `BACKEND_URL` | `https://<your-render-app>.onrender.com` | **Your live Render URL from Part 1** |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `qaruxkhf` | Cloudinary public identifier |

### 4. Deploy
Click **"Deploy"**.
Your frontend will go live (e.g. `https://stylesence.vercel.app`), automatically proxying all storefront API calls (`/api/products`, `/api/cart`, `/api/checkout`, etc.) directly to your Render backend with zero CORS issues!

---

## Part 3: Database Migration Status

The database schema, categories, 185 product variants, and uploaded catalog items have already been seeded directly to your live Supabase PostgreSQL instance:
- **Admin**: `owner@stylesence.example` / `stylesence-dev-2026`
- **Catalog**: The Camille Skirt Set, The Camille Trouser Set, The Ariella Dress (Short & Long), The Àrẹ̀wà Set, and core collections.
