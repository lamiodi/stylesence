# Style Sence Deployment Guide

This guide details how to deploy the **Style Sence** monorepo to production.

---

## Architecture Overview

The repository is structured as a modern monorepo:
- **`frontend/`**: Next.js 16 storefront application (App Router, Tailwind CSS, Lucide, Framer Motion, WhatsApp Concierge).
- **`backend/`**: Next.js 16 API service with Prisma ORM, Supabase PostgreSQL, and Cloudinary media processing.
- **Database**: Supabase PostgreSQL.
- **Media CDN**: Cloudinary (`qaruxkhf`).

All client-side API requests from the frontend use `/api/*`, which are transparently reverse-proxied to `BACKEND_URL` by Next.js rewrites.

---

## Option 1: Deploy Both to Vercel (Recommended)

Because both the frontend and backend are Next.js applications, deploying both to Vercel provides zero-config serverless scaling, global edge caching, and automated Git deployments.

### Step 1: Deploy the Backend Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New... > Project"**.
2. Select your repository: `lamiodi/stylesence`.
3. In the project configuration:
   - **Project Name**: `stylesence-backend` (or your choice).
   - **Framework Preset**: Next.js.
   - **Root Directory**: Click *Edit* and select **`backend`**.
4. Configure **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.cqdksblxkdznugfczgem.supabase.co:5432/postgres` | Your Supabase PostgreSQL connection string |
   | `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@qaruxkhf` | Your Cloudinary credentials |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `qaruxkhf` | Cloudinary cloud identifier |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` (or `*`) | Allowed origin for CORS |
5. Click **Deploy**.
6. Copy the assigned backend URL (e.g., `https://stylesence-backend.vercel.app`).

---

### Step 2: Deploy the Frontend Project

1. In Vercel Dashboard, click **"Add New... > Project"** again.
2. Select the same repository: `lamiodi/stylesence`.
3. In the project configuration:
   - **Project Name**: `stylesence-frontend` (or `stylesence`).
   - **Framework Preset**: Next.js.
   - **Root Directory**: Click *Edit* and select **`frontend`**.
4. Configure **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `BACKEND_URL` | `https://stylesence-backend.vercel.app` | URL of the deployed backend from Step 1 |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `qaruxkhf` | Cloudinary cloud identifier |
5. Click **Deploy**.

The frontend will now seamlessly proxy all `/api/*` calls to the backend with zero CORS issues!

---

## Option 2: Deploy Frontend on Vercel + Backend on Docker / Railway / Render

If you prefer running the backend on a dedicated container platform:

### Deploy Backend with Docker or Railway
1. A multi-stage production [`backend/Dockerfile`](backend/Dockerfile) is included.
2. Port: `3001` (or `$PORT` supplied by your host).
3. Set the environment variables in Railway/Render (`DATABASE_URL`, `CLOUDINARY_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `FRONTEND_URL`).
4. Set `BACKEND_URL` in the Vercel frontend project to the public URL of your container.

### Deploy Backend with Render
A [`render.yaml`](render.yaml) blueprint is pre-configured. Connect the repository to Render and create a Web Service pointing to `backend`.

---

## Database Migration & Seeding (Supabase)

Before launching, apply your schema and seed the initial data:

1. Update `backend/.env` with your real Supabase password:
   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.cqdksblxkdznugfczgem.supabase.co:5432/postgres"
   ```
2. Push the Prisma schema to Supabase:
   ```bash
   npm run db:push
   ```
3. Seed default data (categories, initial collections, admin user):
   ```bash
   npm run db:seed
   ```
4. Import staged catalog products:
   ```bash
   npm run products:import
   ```

---

## Local Verification Commands

To test both builds locally before pushing:

```bash
# Verify backend build (includes Prisma generation)
npm run build:backend

# Verify frontend build
npm run build:frontend

# Verify entire monorepo build
npm run build
```
