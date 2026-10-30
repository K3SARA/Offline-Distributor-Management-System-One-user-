# Deploying Distributor Pro on Railway

This guide walks you through hosting your distribution system on **[Railway](https://railway.app/)** with a cloud PostgreSQL database and high availability.

---

## 🏗 Architecture on Railway

```text
┌────────────────────────────────────────────────────────┐
│                      Railway                           │
│                                                        │
│  ┌─────────────────────────┐   ┌────────────────────┐  │
│  │   Web Service           │   │  PostgreSQL DB     │  │
│  │   - Express API         │◄──┤  (Managed Database)│  │
│  │   - React Static Assets │   │  DATABASE_URL      │  │
│  └───────────┬─────────────┘   └────────────────────┘  │
└──────────────┼─────────────────────────────────────────┘
               │ (HTTPS)
               ▼
       Web Browser / Clients
```

The Express server automatically:
1. Serves the **React web frontend** from `dist/` on all standard routes.
2. Handles all **REST API requests** at `/api/...`.
3. Runs database migrations automatically at startup via `npx prisma db push`.

---

## 🚀 Step-by-Step Deployment Guide

### Step 1: Switch Prisma to PostgreSQL

Run this one-line command in your terminal to switch the schema to PostgreSQL:
```powershell
npm run use:postgres
```
*(If you ever want to switch back to local SQLite, run `npm run use:sqlite`).*

---

### Step 2: Push Your Project to GitHub

1. Initialize git and commit:
```powershell
git init
git add .
git commit -m "feat: distributor system ready for Railway"
```

2. Push to your GitHub repository:
```powershell
git remote add origin https://github.com/YOUR_USERNAME/distributor-pro.git
git branch -M main
git push -u origin main
```

---

### Step 3: Create a Railway Project

1. Log in to [Railway](https://railway.app/).
2. Click **+ New Project**.
3. Select **Deploy from GitHub repo** and choose your repository (`distributor-pro`).

---

### Step 4: Add a Managed PostgreSQL Database

1. In your Railway project canvas, click **+ New** (or press `Cmd/Ctrl + K`).
2. Select **Database** ➔ **Add PostgreSQL**.
3. Railway will provision a cloud PostgreSQL instance in seconds.

---

### Step 5: Link the Database URL to your Web Service

1. Click on your **Web Service** in Railway.
2. Go to the **Variables** tab.
3. Click **+ Add Variable Reference**.
4. Select `DATABASE_URL` from your PostgreSQL service.
   *(Railway will automatically map the connection string: `postgresql://postgres:...`)*.
5. Add the following environment variable:
   - **`PORT`**: `8080` (or leave default, Railway provides this automatically).

---

### Step 6: Generate a Public Domain

1. In your Web Service settings on Railway, go to the **Settings** tab.
2. Scroll to the **Networking** section.
3. Click **Generate Domain** (e.g. `distributor-pro-production.up.railway.app`).
4. Once the deployment finishes, open your URL in any browser!

---

## 🛠 Railway Configuration Details

- **Build Command**: `npm run build` *(compiles Vite React frontend and generates Prisma client)*
- **Start Command**: `npm start` *(pushes DB schema to PostgreSQL and launches Express server)*
- **Configuration File**: [`railway.json`](./railway.json) and [`Procfile`](./Procfile) are already pre-configured in the repository.
