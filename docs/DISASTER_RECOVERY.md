# Disaster Recovery Guide — FindMe

## Backup Strategy

### What to Back Up

| Resource | How | Frequency |
|---|---|---|
| PostgreSQL database | Automated snapshots | Daily (+ before deploys) |
| Environment variables | Secure password manager | On change |
| Prisma schema | Git (version controlled) | Every commit |
| Application code | Git + Vercel | Every commit |

---

## PostgreSQL Backup & Restore

### Take a Manual Backup (pg_dump)

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup

```bash
psql $DATABASE_URL < backup_20260101_120000.sql
```

> ⚠️ Always test restores in a staging environment before trusting them for production recovery.

---

## Quarterly Restore Drill

Every quarter, run this drill:

1. Spin up a fresh PostgreSQL database (Supabase free tier works)
2. Run the latest `pg_dump` snapshot against it
3. Run `npx prisma db push` to apply the schema
4. Spot-check: query parcel count, verify one settled parcel's ledger events
5. Document date and result in your ops log

---

## Application Rollback

If a bad deploy breaks production:

1. Go to **Vercel Dashboard → Deployments**
2. Find the last working deployment
3. Click **⋯ → Promote to Production**

Instant rollback — zero downtime.

---

## Emergency Contacts

Fill in before going live:

| Role | Contact |
|---|---|
| Database Admin | ________________ |
| Vercel Account Owner | ________________ |
| On-call Developer | ________________ |

---

## Incident Response

1. **Detect** — Error rate spike in Vercel logs or user reports
2. **Isolate** — Check Vercel function logs for the specific error
3. **Rollback** — Promote last stable Vercel deployment
4. **Root cause** — Review recent commits and env var changes
5. **Fix forward** — Deploy patch and monitor
6. **Post-mortem** — Document what happened and how to prevent it
