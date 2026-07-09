# Changelog

All notable changes to the FindMe project will be documented in this file.

---

## [2.0.0] - 2026-07-09 (Pilot Release Milestone)

### Added
- **Multi-Carrier Rule Engine:** Added prefix regex detection rules (ST Courier, DTDC, etc.) inside the scanner.
- **Offline Scanner Caching:** Scans are automatically cached in `localStorage` when offline and synced on connection recovery.
- **Receipt Model:** Created the `Receipt` DB schema to store photo attachments and metadata.
- **Ledger Auditing:** Added `PARCEL_IMPORTED` ledger events and employee tracking on creations.
- **Progress Tracker:** Added a step-by-step indicator modal showing progress ticks on imports.
- **Carrier printed labels:** Integrated dynamic carrier partner names and Code128 barcodes into printable shipping labels.

### Refactored
- **Branch-Aware Routing:** Configured role-based tab defaults (`BRANCH_STAFF` redirects to Scan dashboard).
- **Scanner Dashboard UI:** Replaced the plain camera viewfinder with a grid of options (Scan Barcode, Scan QR, Manual Entry) and session history panels.
- **Prisma Schemas & API Projection:** Configured unique composite keys on `[trackingNumber, carrier, companyId]`.

### Removed
- Deleted legacy Bulk CSV import page component.

---

## [1.0.0] - 2026-07-07 (MVP Release)

### Added
- Multi-role login authentication.
- Single-carrier parcel creation and basic tracking list.
- Cash collection and settlement approvals.
- Simple daily closing PDF summaries.
