# FindMe — Enterprise Courier & COD Reconciliation Platform (v2.0.0)

FindMe is a multi-tenant logistics and financial reconciliation platform designed for courier networks and cash-on-delivery (COD) operations. 

---

## 🚀 Key Features in v2.0.0

- **Multi-Tenant Isolation:** Scopes all data (Users, Branches, Parcels, Ledger Events) by company tenant (`companyId`).
- **Granular Permissions & Role Default Routing:** routes users dynamically upon sign-in (`BRANCH_STAFF` ➔ Scanner panel, `DELIVERY_AGENT` ➔ Parcels list, `FINANCE_OFFICER` ➔ Settlements).
- **Consignment Scanner Landing:** Camera-based 1D Barcode & QR Code scanner utilizing native mobile browser `BarcodeDetector` with a rule-based auto-carrier matcher and manual input fallbacks.
- **Offline Caching Sync:** Scans performed while offline are cached in `localStorage` and synchronized automatically upon connection recovery.
- **Double-Entry Financial Ledger:** Every parcel lifecycle event writes debit/credit custody events to verify cash handover and flag accounting discrepancies.
- **Printable Daily Closing Reports:** Summary sheets aggregating scanner usage rate ratios and COD amounts grouped by carrier.
- **Partner Labels:** Dynamic PDF label printing supporting custom carrier logos and Code128 barcodes.

---

## 🛠 Tech Stack

- **Frontend & Routing:** Next.js (App Router, Turbopack, TailwindCSS/Vanilla styling).
- **Database ORM:** Prisma (PostgreSQL database hosted on Supabase).
- **Icons:** Lucide React.
- **Scanning Library:** `jsQR` (for legacy QR code detection) + Native browser `BarcodeDetector` API.

---

## 🔐 Quick-Login Demo Accounts

All accounts use the password: `password123`

| Username | Role | Landing Screen | Description |
| :--- | :--- | :--- | :--- |
| `branch_del` | Counter Operator | Scan | Scans consignment barcodes and attaches receipt photos. |
| `agent` | Delivery Agent | Parcels | Collects COD payments at doorstep. |
| `finance` | Finance Officer | Finance | Reconciles cash sheets and approves seller payouts. |
| `seller` | Seller / Vendor | Parcels | Creates shipments and prints shipping labels. |

---

## 📋 Project Directory Structure

```
FindMe/
├── prisma/
│   ├── schema.prisma   (PostgreSQL Models & Indices)
│   └── seed.js         (Database seeding scripts)
├── src/
│   ├── app/
│   │   ├── api/        (Standardized API routes)
│   │   ├── label/      (PDF partner labels print view)
│   │   ├── reports/    (Daily cash closing report page)
│   │   └── page.tsx    (Main dashboard application controller)
│   ├── components/
│   │   └── QRScanner.tsx (Scanner dashboard, offline queues, carrier detectors)
│   ├── repositories/   (Decoupled multi-tenant database abstraction layer)
│   └── services/       (Business services for import and notifications)
├── pilot_guide.md      (Quick start onboarding guide)
└── architecture.md     (System design specifications)
```

---

*FindMe Pilot v2.0 | Confidential | © 2026 FindMe Logistics Platform*
