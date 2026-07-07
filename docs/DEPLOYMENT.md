# Deployment Guide — FindMe COD Settlement PWA

## Production Architecture

```
Delivery Agent / Branch Staff Phone
          │  (HTTPS)
          ▼
    ┌─────────────┐
    │   Vercel    │  Next.js 16 App + API Routes
    │  (Next.js)  │  Proxy: CSRF + Rate Limiting
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  PostgreSQL │  Supabase / Neon / AWS RDS
    │  Database   │  Indexes on key fields
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   Backups   │  Automated daily snapshots
    └─────────────┘
```

---

## Step 1: Prepare the Database

### Option A — Supabase (Recommended for MVP)

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection String → URI**
3. Copy the connection string (use the **Transaction Pooler** URL for serverless)

### Option B — Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string from the dashboard

### Option C — AWS RDS (Production Scale)

1. Create a PostgreSQL 16 RDS instance in your preferred region
2. Set Multi-AZ for high availability
3. Note the endpoint, port, database name, username, password

### Run Migrations

Once you have your production `DATABASE_URL`:

```bash
DATABASE_URL="your-production-url" npx prisma migrate deploy
```

> ⚠️ **Do NOT run `npx prisma db seed`** in production. The seed script inserts demo users with known passwords.

---

## Step 2: Generate a Strong JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy this output — it will be your `JWT_SECRET`.

---

## Step 3: Deploy to Vercel

### 3a. Push to GitHub

```bash
git init
git add .
git commit -m "Initial production release"
git remote add origin https://github.com/your-org/findme.git
git push -u origin main
```

### 3b. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your GitHub repository
4. Vercel auto-detects Next.js — click **Deploy**

### 3c. Configure Environment Variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your production PostgreSQL connection string |
| `JWT_SECRET` | Your 64-character random hex string |
| `NODE_ENV` | `production` |

> Vercel automatically sets `NODE_ENV=production` for production deployments.

### 3d. Redeploy

After adding env vars, go to **Deployments → Redeploy** to pick up the new variables.

---

## Step 4: Verify HTTPS & Secure Cookies

Vercel provides HTTPS automatically on all deployments. The app's cookies are configured with:

```typescript
secure: process.env.NODE_ENV === 'production'  // HttpOnly + Secure in prod
```

These will automatically use `Secure` flag in production.

---

## Step 5: Enable Database Backups

### Supabase
- Go to **Settings → Database → Backups**
- Enable **Point-in-Time Recovery** (PITR) for production projects

### Neon
- Automatic branching serves as a backup mechanism
- Enable scheduled exports via the Neon API for extra safety

### AWS RDS
- Enable **Automated Backups** with 7–35 day retention
- Set up a **Manual Snapshot** before any major schema change

### Restoration Test
Run a restore to a staging environment once a quarter to verify backups work.

---

## Step 6: Custom Domain (Optional)

1. In Vercel → Project → **Settings → Domains**
2. Add your domain (e.g., `findme.yourcourier.com`)
3. Update your DNS records as instructed by Vercel
4. SSL is provisioned automatically

---

## Step 7: Post-Deploy Smoke Test

After your first production deployment, manually verify:

- [ ] Login with a real user account
- [ ] Delivery agent can view parcels
- [ ] Handover initiation works
- [ ] CSRF protection: `curl -X POST https://yourapp.vercel.app/api/parcels` returns `403 CSRF token missing`
- [ ] Rate limit: 6 rapid failed logins return `429`
- [ ] Expired session: Delete cookie, refresh — redirected to login

---

## Monitoring

Vercel provides built-in:
- **Real-time logs** under Deployments → Functions
- **Analytics** (page views, performance)

For deeper monitoring, consider:
- **Sentry** — error tracking (`npm install @sentry/nextjs`)
- **Datadog** or **Better Uptime** — availability monitoring

---

## Rollback

If a deployment breaks:
1. Go to Vercel → Deployments
2. Find the last good deployment
3. Click **Promote to Production**

Instant rollback with zero downtime.

---

## CI/CD (Optional but Recommended)

Create `.github/workflows/ci.yml` to run TypeScript checks on every PR:

```yaml
name: CI
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
```

Vercel automatically deploys on merge to `main`.
