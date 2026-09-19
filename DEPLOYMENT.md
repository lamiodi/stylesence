# Style Sence Deployment Guide

This guide details how to manually deploy **Backend on Render** and **Frontend on Vercel**.

---

## Architecture

- **Backend (Render)**: Next.js 16 API service with Prisma ORM connecting to Supabase PostgreSQL and Cloudinary.
- **Frontend (Vercel)**: Next.js 16 luxury storefront. Automatically proxies `/api/*` requests to the Render backend via Next.js rewrites.
- **Database**: Supabase PostgreSQL.
- **Media**: Cloudinary (`qaruxkhf`).

---

## Part 1: Deploy Backend on Render (Manual Setup)

Follow these steps in your [Render Dashboard](https://dashboard.render.com/):

### 1. Create a New Web Service
1. In the top right, click **"New +"** and select **"Web Service"**.
2. Select **"Build and deploy from a Git repository"** and choose your repository: `lamiodi/stylesence`.

### 2. Configure Service Settings
Enter the following exact settings:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `stylessence-backend` | Or any name you prefer |
| **Language** | `Node` | Native Node.js environment |
| **Branch** | `main` | Production branch |
| **Root Directory** | `backend` | **Crucial:** sets build context to the backend folder |
| **Build Command** | `npm install && npm run build` | Installs dependencies and generates Prisma client |
| **Start Command** | `npm run start` | Binds to `0.0.0.0` and listens on Render's `$PORT` |
| **Instance Type** | `Free` (or Starter) | Free tier spins down after inactivity |

### 3. Configure Health Check
Under **Advanced**:
- **Health Check Path**: `/api/health`

### 4. Add Environment Variables
Under **Environment Variables**, add the following keys:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode |
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.cqdksblxkdznugfczgem.supabase.co:5432/postgres` | Your Supabase PostgreSQL connection string |
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@qaruxkhf` | Cloudinary credentials |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `qaruxkhf` | Cloudinary cloud identifier |
| `FRONTEND_URL` | `*` (or your Vercel URL once deployed) | Allowed origin for CORS |

### 5. Deploy & Obtain Backend URL
1. Click **"Create Web Service"**.
2. Wait for the build and health check to complete.
3. Once live, copy your Render service URL (e.g. `https://stylessence-backend.onrender.com`).
4. Verify by visiting `https://stylessence-backend.onrender.com/api/health` in your browser. You will see:
   ```json
   { "status": "ok", "service": "stylessence-backend" }
   ```

---

## Part 2: Deploy Frontend on Vercel (Manual Setup)

Follow these steps in your [Vercel Dashboard](https://vercel.com/dashboard):

### 1. Import the Project
1. In Vercel, click **"Add New... > Project"**.
2. Select your repository: `lamiodi/stylesence`.

### 2. Configure Project Settings
Enter the following settings:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Project Name** | `stylesence` (or `stylesence-frontend`) | Your storefront project name |
| **Framework Preset** | `Next.js` | Automatically detected |
| **Root Directory** | Click **Edit** and choose **`frontend`** | **Crucial:** isolates frontend build |
| **Build Command** | Leave default (`npm run build`) | Executes Next.js production build |
| **Output Directory** | Leave default (`.next`) | Default |

### 3. Add Environment Variables
Expand the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `BACKEND_URL` | `https://stylessence-backend.onrender.com` | **Paste your actual Render backend URL from Part 1** |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `qaruxkhf` | Cloudinary public identifier |

### 4. Deploy
1. Click **"Deploy"**.
2. Vercel will build the frontend and assign a live URL (e.g. `https://stylesence.vercel.app`).
3. Because `frontend/next.config.ts` includes server rewrites, any browser request to `/api/*` is automatically reverse-proxied to your Render backend with zero CORS issues!

---

## Part 3: Database Migration & Initial Catalog (Supabase)

From your local machine, run the following commands to apply your database tables and seed products into Supabase:

```bash
# 1. Push Prisma schema to Supabase PostgreSQL
npm run db:push

# 2. Seed system data (categories, initial collections, default admin account)
npm run db:seed

# 3. Import staged catalog products and media
npm run products:import
```

---

## Summary of Two Local Environment Files

Your workspace uses strictly **two** environment files for local development:

1. **[`backend/.env`](backend/.env)**:
   ```env
   PORT=3001
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.cqdksblxkdznugfczgem.supabase.co:5432/postgres"
   CLOUDINARY_URL="cloudinary://<your_api_key>:<your_api_secret>@qaruxkhf"
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="qaruxkhf"
   ```

2. **[`frontend/.env`](frontend/.env)**:
   ```env
   BACKEND_URL="http://127.0.0.1:3001"
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="qaruxkhf"
   ```
