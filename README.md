# FindMe — COD Settlement PWA

A production-ready Progressive Web App for managing Cash-on-Delivery settlement workflows across courier company networks. Built with Next.js 16, Prisma, and PostgreSQL.

## Features

- **Doorstep COD Collection** — Delivery agents record exact cash collected from customers
- **Verified Handovers** — Two-party confirmation between every staff handover prevents cash leakage
- **Discrepancy Flagging** — Automatic freeze if confirmed amounts don't match
- **Finance Reconciliation** — Finance officers investigate and resolve disputes
- **Seller Payouts** — Traceable, reference-stamped settlement to origin sellers
- **Offline Mode** — Actions are queued locally and synced when connectivity returns
- **CSRF & Rate Limiting** — Security hardened for production
- **Full PWA** — Installable on mobile (Android/iOS) with offline shell caching

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Webpack mode) |
| Language | TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT (HttpOnly cookie) + CSRF double-submit |
| Styling | Tailwind CSS v4 |
| Validation | Zod |
| PWA | @ducanh2912/next-pwa |
| Password Hashing | bcryptjs |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/login/       # Login endpoint
│   │   ├── auth/me/          # Session check & logout
│   │   ├── parcels/          # Parcel CRUD + pagination
│   │   │   └── [id]/
│   │   │       ├── collect/  # COD collection
│   │   │       ├── handover/ # Branch/hub handovers
│   │   │       └── payout/   # Seller payout
│   │   ├── discrepancies/resolve/
│   │   ├── metadata/         # Locations & users
│   │   └── cron/check-overdue/
│   ├── page.tsx              # Single-page PWA shell
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── auth.ts               # JWT sign/verify
│   ├── db.ts                 # Prisma client
│   ├── logger.ts             # Structured JSON logging
│   ├── rateLimit.ts          # In-memory rate limiter
│   └── validations.ts        # Zod schemas
└── proxy.ts                  # CSRF + rate limiting middleware
prisma/
├── schema.prisma
└── seed.ts
docs/
├── API.md                    # Full API reference
└── DEPLOYMENT.md             # Production deployment guide
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Git

### 1. Clone & Install

```bash
git clone https://github.com/your-org/findme.git
cd findme
npm install
```

### 2. Configure Environment

Copy the example env and fill in your values:

```bash
cp .env.example .env
```

`.env` variables:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/findme_cod"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
NODE_ENV="development"
```

### 3. Set Up Database

```bash
# Push schema and create tables
npx prisma db push

# Seed demo data (development only — never in production)
npx prisma db seed
```

### 4. Start Development Server

```bash
npm run dev
```

Visit **http://localhost:3000**

---

## Demo Accounts (Development Only)

| Username | Password | Role |
|---|---|---|
| `agent` | `password123` | Delivery Agent |
| `branch_mum` | `password123` | Branch Staff (Mumbai) |
| `hub_mum` | `password123` | Hub Operator (Mumbai) |
| `hub_del` | `password123` | Hub Operator (Delhi) |
| `finance` | `password123` | Finance Officer |
| `admin` | `password123` | Admin |
| `seller` | `password123` | Seller |

> ⚠️ **Never seed demo accounts in production.**

---

## Production Build

```bash
npm run build
npm start
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full deployment instructions.

---

## API Reference

See [`docs/API.md`](docs/API.md) for full OpenAPI-style documentation of all endpoints.

---

## Database Schema

See [`docs/SCHEMA.md`](docs/SCHEMA.md) for the entity relationship diagram and field descriptions.

---

## Security

- Passwords hashed with `bcryptjs` (cost factor 10)
- Sessions: JWT in `HttpOnly; SameSite=Lax` cookie (7-day expiry)
- CSRF: Double-submit cookie pattern (`X-CSRF-Token` header must match `csrf_token` cookie)
- Rate limiting: 5 login attempts/15 min per IP; 100 API calls/min per user
- HTTPS enforced in production via Vercel

---

## License

Private — All rights reserved.
