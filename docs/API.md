# FindMe API Reference

> **Base URL:** `/api`  
> **Version:** 1.0  
> **Last Updated:** 2026-07-07

---

## Table of Contents

- [Overview](#overview)
- [Authentication & Security](#authentication--security)
  - [Session Cookie](#session-cookie)
  - [CSRF Protection](#csrf-protection)
  - [Rate Limiting](#rate-limiting)
- [Error Responses](#error-responses)
- [Endpoints](#endpoints)
  - [Auth](#auth)
    - [POST /auth/login](#post-authlogin)
    - [GET /auth/me](#get-authme)
    - [POST /auth/me](#post-authme)
  - [Parcels](#parcels)
    - [GET /parcels](#get-parcels)
    - [POST /parcels](#post-parcels)
    - [POST /parcels/[id]/collect](#post-parcelsidcollect)
    - [POST /parcels/[id]/handover](#post-parcelsidhandover)
    - [POST /parcels/[id]/payout](#post-parcelsidpayout)
  - [Discrepancies](#discrepancies)
    - [POST /discrepancies/resolve](#post-discrepanciesresolve)
  - [Metadata](#metadata)
    - [GET /metadata](#get-metadata)
  - [Cron Jobs](#cron-jobs)
    - [GET /cron/check-overdue](#get-croncheck-overdue)

---

## Overview

The FindMe API is a RESTful JSON API that powers the parcel tracking and COD (Cash-on-Delivery) management platform. All request and response bodies use `application/json` unless stated otherwise.

### Roles

| Role | Description |
|------|-------------|
| `ADMIN` | Full access to all resources |
| `SELLER` | Can create parcels assigned to them |
| `DELIVERY_AGENT` | Can collect COD amounts and perform handovers |
| `FINANCE` | Can process payouts and resolve discrepancies |

---

## Authentication & Security

### Session Cookie

All endpoints **except** `POST /api/auth/login` require an authenticated session. Authentication is maintained via an **HTTP-only session cookie** set upon successful login.

| Property | Value |
|----------|-------|
| Cookie Name | `session` (HTTP-only) |
| Set by | `POST /api/auth/login` |
| Cleared by | `POST /api/auth/me` (logout) |

If the session cookie is missing or invalid, the API returns `401 Unauthorized`.

---

### CSRF Protection

To prevent Cross-Site Request Forgery attacks, all **state-mutating requests** (POST, PUT, DELETE) — **except** `POST /api/auth/login` — must include a CSRF token.

| Property | Value |
|----------|-------|
| Cookie Name | `csrf_token` (readable by JS) |
| Request Header | `X-CSRF-Token` |
| Provided by | `POST /api/auth/login` response body (`csrfToken`) |

The server validates that the `X-CSRF-Token` header value matches the `csrf_token` cookie. A mismatch results in `403 Forbidden`.

**Example header:**
```http
X-CSRF-Token: eyJhbGciOiJIUzI1NiIsInR5...
```

---

### Rate Limiting

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/auth/login` | 5 requests | 15 minutes | Per IP address |
| All other authenticated endpoints | 100 requests | 1 minute | Per authenticated user |

When a rate limit is exceeded, the server returns `429 Too Many Requests`.

---

## Error Responses

All error responses follow a consistent JSON structure:

```json
{
  "error": "Human-readable error message"
}
```

### Common HTTP Status Codes

| Status Code | Meaning |
|-------------|---------|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created successfully |
| `400 Bad Request` | Invalid request body or missing required fields |
| `401 Unauthorized` | Missing or invalid session cookie |
| `403 Forbidden` | CSRF token mismatch, or insufficient role permissions |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | State machine conflict (e.g., invalid parcel state transition) |
| `422 Unprocessable Entity` | Validation error (e.g., amount mismatch) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server-side error |

---

## Endpoints

---

## Auth

### POST /auth/login

Authenticates a user with username and password. Sets an HTTP-only session cookie and returns a CSRF token.

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/auth/login` |
| **Auth Required** | ❌ No |
| **CSRF Required** | ❌ No |
| **Rate Limit** | 5 requests / 15 min per IP |

#### Request Body

```json
{
  "username": "string",
  "password": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | `string` | ✅ Yes | The user's username |
| `password` | `string` | ✅ Yes | The user's plaintext password (sent over HTTPS) |

#### Success Response — `200 OK`

> Sets an HTTP-only `session` cookie and a JS-readable `csrf_token` cookie.

```json
{
  "user": {
    "id": "string",
    "username": "string",
    "name": "string",
    "role": "ADMIN | SELLER | DELIVERY_AGENT | FINANCE",
    "locationId": "string | null"
  },
  "csrfToken": "string"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user` | `object` | The authenticated user object |
| `user.id` | `string` | Unique user ID |
| `user.username` | `string` | Login username |
| `user.name` | `string` | Display name |
| `user.role` | `string` | One of `ADMIN`, `SELLER`, `DELIVERY_AGENT`, `FINANCE` |
| `user.locationId` | `string \| null` | The location this user is assigned to (agents/sellers) |
| `csrfToken` | `string` | Token to be sent as `X-CSRF-Token` on subsequent requests |

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400 Bad Request` | Missing `username` or `password` | `{ "error": "Username and password are required" }` |
| `401 Unauthorized` | Invalid credentials | `{ "error": "Invalid username or password" }` |
| `429 Too Many Requests` | Rate limit exceeded | `{ "error": "Too many login attempts. Try again later." }` |

#### Example

```bash
curl -X POST https://findme.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "s3cr3t"}'
```

```json
// Response 200 OK
{
  "user": {
    "id": "usr_01HXYZ",
    "username": "alice",
    "name": "Alice Nguyen",
    "role": "FINANCE",
    "locationId": null
  },
  "csrfToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### GET /auth/me

Returns the currently authenticated user from the session cookie.

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/auth/me` |
| **Auth Required** | ✅ Yes (session cookie) |
| **CSRF Required** | ❌ No |
| **Rate Limit** | 100 requests / min per user |

#### Success Response — `200 OK`

```json
{
  "id": "string",
  "username": "string",
  "name": "string",
  "role": "ADMIN | SELLER | DELIVERY_AGENT | FINANCE",
  "locationId": "string | null"
}
```

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |

#### Example

```bash
curl https://findme.example.com/api/auth/me \
  -H "Cookie: session=<session-cookie>"
```

```json
// Response 200 OK
{
  "id": "usr_01HXYZ",
  "username": "alice",
  "name": "Alice Nguyen",
  "role": "FINANCE",
  "locationId": null
}
```

---

### POST /auth/me

Logs out the current user by clearing the session cookie.

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/auth/me` |
| **Auth Required** | ✅ Yes (session cookie) |
| **CSRF Required** | ✅ Yes (`X-CSRF-Token` header) |
| **Rate Limit** | 100 requests / min per user |

#### Request Body

None required.

#### Success Response — `200 OK`

> Clears the `session` and `csrf_token` cookies.

```json
{
  "message": "Logged out successfully"
}
```

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |
| `403 Forbidden` | CSRF token mismatch | `{ "error": "Invalid CSRF token" }` |

#### Example

```bash
curl -X POST https://findme.example.com/api/auth/me \
  -H "Cookie: session=<session-cookie>; csrf_token=<csrf-token>" \
  -H "X-CSRF-Token: <csrf-token>"
```

---

## Parcels

### GET /parcels

Returns a paginated, role-filtered list of parcels. The results are scoped to the requesting user's role (e.g., delivery agents only see parcels at their location).

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/parcels` |
| **Auth Required** | ✅ Yes |
| **CSRF Required** | ❌ No |
| **Rate Limit** | 100 requests / min per user |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | `integer` | ❌ No | `1` | Page number (1-indexed) |
| `pageSize` | `integer` | ❌ No | `20` | Number of items per page (max: 100) |
| `search` | `string` | ❌ No | — | Filter by parcel ID prefix (e.g., `PRCL-001`) |

#### Role-Based Filtering

| Role | Visible Parcels |
|------|----------------|
| `ADMIN` | All parcels |
| `SELLER` | Only their own parcels |
| `DELIVERY_AGENT` | Parcels at their assigned location |
| `FINANCE` | All parcels |

#### Success Response — `200 OK`

```json
{
  "data": [
    {
      "id": "string",
      "sellerId": "string",
      "codAmount": "number",
      "status": "string",
      "originLocationId": "string",
      "destinationLocationId": "string",
      "createdAt": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 142,
  "totalPages": 8
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | `Parcel[]` | Array of parcel objects for this page |
| `page` | `integer` | Current page number |
| `pageSize` | `integer` | Number of items per page |
| `total` | `integer` | Total number of matching parcels |
| `totalPages` | `integer` | Total number of pages |

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |

#### Example

```bash
curl "https://findme.example.com/api/parcels?page=1&pageSize=20&search=PRCL-001" \
  -H "Cookie: session=<session-cookie>"
```

```json
// Response 200 OK
{
  "data": [
    {
      "id": "PRCL-001",
      "sellerId": "usr_SELLER01",
      "codAmount": 5500,
      "status": "IN_TRANSIT",
      "originLocationId": "loc_HAN",
      "destinationLocationId": "loc_SGN",
      "createdAt": "2026-07-01T09:00:00Z",
      "updatedAt": "2026-07-05T14:32:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1
}
```

---

### POST /parcels

Creates a new parcel. Restricted to `ADMIN` and `SELLER` roles.

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/parcels` |
| **Auth Required** | ✅ Yes |
| **CSRF Required** | ✅ Yes (`X-CSRF-Token` header) |
| **Roles Allowed** | `ADMIN`, `SELLER` |
| **Rate Limit** | 100 requests / min per user |

#### Request Body

```json
{
  "id": "string",
  "sellerId": "string",
  "codAmount": "number",
  "originLocationId": "string",
  "destinationLocationId": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ Yes | Unique parcel identifier (e.g., `PRCL-007`) |
| `sellerId` | `string` | ✅ Yes | ID of the seller associated with this parcel |
| `codAmount` | `number` | ✅ Yes | Cash-on-delivery amount (positive number) |
| `originLocationId` | `string` | ✅ Yes | ID of the origin hub/location |
| `destinationLocationId` | `string` | ✅ Yes | ID of the destination hub/location |

#### Success Response — `201 Created`

```json
{
  "id": "PRCL-007",
  "sellerId": "usr_SELLER01",
  "codAmount": 8200,
  "status": "PENDING",
  "originLocationId": "loc_HAN",
  "destinationLocationId": "loc_SGN",
  "createdAt": "2026-07-07T23:34:00Z",
  "updatedAt": "2026-07-07T23:34:00Z"
}
```

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400 Bad Request` | Missing required fields | `{ "error": "Missing required fields" }` |
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |
| `403 Forbidden` | Insufficient role or CSRF mismatch | `{ "error": "Forbidden" }` |
| `409 Conflict` | Parcel ID already exists | `{ "error": "Parcel with this ID already exists" }` |

#### Example

```bash
curl -X POST https://findme.example.com/api/parcels \
  -H "Cookie: session=<session-cookie>; csrf_token=<csrf-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "PRCL-007",
    "sellerId": "usr_SELLER01",
    "codAmount": 8200,
    "originLocationId": "loc_HAN",
    "destinationLocationId": "loc_SGN"
  }'
```

---

### POST /parcels/[id]/collect

Records a delivery agent collecting the COD amount from the recipient. Optionally accepts photo evidence and GPS coordinates.

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/parcels/{id}/collect` |
| **Auth Required** | ✅ Yes |
| **CSRF Required** | ✅ Yes (`X-CSRF-Token` header) |
| **Roles Allowed** | `DELIVERY_AGENT`, `ADMIN` |
| **Rate Limit** | 100 requests / min per user |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The unique parcel ID (e.g., `PRCL-007`) |

#### Request Body

```json
{
  "amount": "number",
  "photoUrl": "string (optional)",
  "gpsCoords": "string (optional)"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | `number` | ✅ Yes | The COD amount collected from the recipient |
| `photoUrl` | `string` | ❌ No | URL to the photo evidence of collection |
| `gpsCoords` | `string` | ❌ No | GPS coordinates at time of collection (e.g., `"10.7769,106.7009"`) |

#### Success Response — `200 OK`

```json
{
  "id": "PRCL-007",
  "status": "COD_COLLECTED",
  "collectedAmount": 8200,
  "collectedAt": "2026-07-07T10:15:00Z",
  "photoUrl": "https://cdn.example.com/photos/collect-prcl007.jpg",
  "gpsCoords": "10.7769,106.7009"
}
```

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400 Bad Request` | Missing `amount` | `{ "error": "Amount is required" }` |
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |
| `403 Forbidden` | Wrong role or CSRF mismatch | `{ "error": "Forbidden" }` |
| `404 Not Found` | Parcel not found | `{ "error": "Parcel not found" }` |
| `409 Conflict` | Invalid state transition | `{ "error": "Parcel is not in a collectible state" }` |

#### Example

```bash
curl -X POST https://findme.example.com/api/parcels/PRCL-007/collect \
  -H "Cookie: session=<session-cookie>; csrf_token=<csrf-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 8200,
    "photoUrl": "https://cdn.example.com/photos/collect-prcl007.jpg",
    "gpsCoords": "10.7769,106.7009"
  }'
```

---

### POST /parcels/[id]/handover

Initiates or confirms a COD handover between parties (e.g., delivery agent → hub manager). Two-phase flow: **initiate** then **confirm**.

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/parcels/{id}/handover` |
| **Auth Required** | ✅ Yes |
| **CSRF Required** | ✅ Yes (`X-CSRF-Token` header) |
| **Roles Allowed** | `DELIVERY_AGENT`, `ADMIN`, `FINANCE` |
| **Rate Limit** | 100 requests / min per user |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The unique parcel ID |

#### Phase 1 — Initiate Handover Request Body

```json
{
  "eventType": "INITIATE",
  "expectedAmount": "number",
  "toPartyId": "string",
  "photoUrl": "string (optional)"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventType` | `string` | ✅ Yes | Must be `"INITIATE"` to begin a handover |
| `expectedAmount` | `number` | ✅ Yes | The amount expected to be handed over |
| `toPartyId` | `string` | ✅ Yes | The user ID of the receiving party |
| `photoUrl` | `string` | ❌ No | URL to handover photo evidence |

#### Phase 2 — Confirm Handover Request Body

```json
{
  "eventType": "CONFIRM",
  "amount": "number"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventType` | `string` | ✅ Yes | Must be `"CONFIRM"` to confirm receipt |
| `amount` | `number` | ✅ Yes | Actual amount received by the confirming party |

> **Note:** If the confirmed `amount` does not match the `expectedAmount`, a discrepancy record is automatically created and flagged for Finance review.

#### Success Response — `200 OK`

```json
{
  "id": "PRCL-007",
  "status": "HANDED_OVER",
  "handoverEvent": {
    "type": "CONFIRM",
    "fromPartyId": "usr_AGENT01",
    "toPartyId": "usr_HUB01",
    "expectedAmount": 8200,
    "actualAmount": 8200,
    "handedOverAt": "2026-07-07T11:00:00Z",
    "hasDiscrepancy": false
  }
}
```

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400 Bad Request` | Missing or invalid `eventType` | `{ "error": "Invalid eventType" }` |
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |
| `403 Forbidden` | Insufficient role or CSRF mismatch | `{ "error": "Forbidden" }` |
| `404 Not Found` | Parcel not found | `{ "error": "Parcel not found" }` |
| `409 Conflict` | Invalid state transition | `{ "error": "No pending handover to confirm" }` |

#### Example — Initiate

```bash
curl -X POST https://findme.example.com/api/parcels/PRCL-007/handover \
  -H "Cookie: session=<session-cookie>; csrf_token=<csrf-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "INITIATE",
    "expectedAmount": 8200,
    "toPartyId": "usr_HUB01",
    "photoUrl": "https://cdn.example.com/photos/handover-prcl007.jpg"
  }'
```

#### Example — Confirm

```bash
curl -X POST https://findme.example.com/api/parcels/PRCL-007/handover \
  -H "Cookie: session=<session-cookie>; csrf_token=<csrf-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "CONFIRM",
    "amount": 8200
  }'
```

---

### POST /parcels/[id]/payout

Finance officer marks a parcel's COD amount as settled (paid out) to the seller.

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/parcels/{id}/payout` |
| **Auth Required** | ✅ Yes |
| **CSRF Required** | ✅ Yes (`X-CSRF-Token` header) |
| **Roles Allowed** | `FINANCE`, `ADMIN` |
| **Rate Limit** | 100 requests / min per user |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The unique parcel ID |

#### Request Body

```json
{
  "referenceId": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `referenceId` | `string` | ✅ Yes | External payment reference (e.g., bank transfer ID) |

#### Success Response — `200 OK`

```json
{
  "id": "PRCL-007",
  "status": "PAID_OUT",
  "payout": {
    "referenceId": "TXN-2026-07-07-88932",
    "amount": 8200,
    "paidAt": "2026-07-07T14:00:00Z",
    "processedBy": "usr_FINANCE01"
  }
}
```

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400 Bad Request` | Missing `referenceId` | `{ "error": "referenceId is required" }` |
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |
| `403 Forbidden` | Insufficient role or CSRF mismatch | `{ "error": "Forbidden" }` |
| `404 Not Found` | Parcel not found | `{ "error": "Parcel not found" }` |
| `409 Conflict` | Parcel not in payable state | `{ "error": "Parcel is not ready for payout" }` |

#### Example

```bash
curl -X POST https://findme.example.com/api/parcels/PRCL-007/payout \
  -H "Cookie: session=<session-cookie>; csrf_token=<csrf-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{"referenceId": "TXN-2026-07-07-88932"}'
```

---

## Discrepancies

### POST /discrepancies/resolve

Allows a Finance officer to resolve a flagged COD discrepancy, either approving or rejecting the discrepancy and specifying the final settled amount.

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/discrepancies/resolve` |
| **Auth Required** | ✅ Yes |
| **CSRF Required** | ✅ Yes (`X-CSRF-Token` header) |
| **Roles Allowed** | `FINANCE`, `ADMIN` |
| **Rate Limit** | 100 requests / min per user |

#### Request Body

```json
{
  "parcelId": "string",
  "targetState": "string",
  "resolvedAmount": "number",
  "note": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parcelId` | `string` | ✅ Yes | ID of the parcel with a discrepancy |
| `targetState` | `string` | ✅ Yes | Desired state after resolution (e.g., `"RESOLVED"`, `"ESCALATED"`) |
| `resolvedAmount` | `number` | ✅ Yes | The final agreed COD amount |
| `note` | `string` | ✅ Yes | Resolution note for audit trail |

#### Success Response — `200 OK`

```json
{
  "parcelId": "PRCL-007",
  "discrepancy": {
    "id": "disc_01HABC",
    "status": "RESOLVED",
    "resolvedAmount": 8100,
    "note": "Short payment confirmed by agent. Adjusted to collected amount.",
    "resolvedAt": "2026-07-07T15:00:00Z",
    "resolvedBy": "usr_FINANCE01"
  }
}
```

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400 Bad Request` | Missing required fields | `{ "error": "Missing required fields" }` |
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |
| `403 Forbidden` | Insufficient role or CSRF mismatch | `{ "error": "Forbidden" }` |
| `404 Not Found` | Parcel or discrepancy not found | `{ "error": "No active discrepancy found for this parcel" }` |

#### Example

```bash
curl -X POST https://findme.example.com/api/discrepancies/resolve \
  -H "Cookie: session=<session-cookie>; csrf_token=<csrf-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "parcelId": "PRCL-007",
    "targetState": "RESOLVED",
    "resolvedAmount": 8100,
    "note": "Short payment confirmed by agent. Adjusted to collected amount."
  }'
```

---

## Metadata

### GET /metadata

Returns all reference data needed to populate UI dropdowns — locations and users.

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/metadata` |
| **Auth Required** | ✅ Yes |
| **CSRF Required** | ❌ No |
| **Rate Limit** | 100 requests / min per user |

#### Success Response — `200 OK`

```json
{
  "locations": [
    {
      "id": "string",
      "name": "string",
      "code": "string"
    }
  ],
  "users": [
    {
      "id": "string",
      "name": "string",
      "role": "string",
      "locationId": "string | null"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `locations` | `Location[]` | All hub/location objects in the system |
| `locations[].id` | `string` | Unique location ID |
| `locations[].name` | `string` | Human-readable location name |
| `locations[].code` | `string` | Short location code (e.g., `HAN`, `SGN`) |
| `users` | `User[]` | All user objects (for handover target selection, etc.) |
| `users[].id` | `string` | Unique user ID |
| `users[].name` | `string` | Display name |
| `users[].role` | `string` | User's role |
| `users[].locationId` | `string \| null` | Assigned location |

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `401 Unauthorized` | No active session | `{ "error": "Not authenticated" }` |

#### Example

```bash
curl https://findme.example.com/api/metadata \
  -H "Cookie: session=<session-cookie>"
```

```json
// Response 200 OK
{
  "locations": [
    { "id": "loc_HAN", "name": "Hanoi Hub", "code": "HAN" },
    { "id": "loc_SGN", "name": "Ho Chi Minh City Hub", "code": "SGN" }
  ],
  "users": [
    { "id": "usr_AGENT01", "name": "Bob Tran", "role": "DELIVERY_AGENT", "locationId": "loc_HAN" },
    { "id": "usr_HUB01",   "name": "Carol Le",  "role": "ADMIN",          "locationId": "loc_HAN" }
  ]
}
```

---

## Cron Jobs

### GET /cron/check-overdue

Internal cron endpoint that scans all parcels and flags any that have been idle (no status change) beyond the configured threshold. Intended to be called by an external cron scheduler (e.g., Vercel Cron, GitHub Actions).

> ⚠️ **Security Note:** This endpoint should be protected by a secret header (e.g., `Authorization: Bearer <CRON_SECRET>`) in production. Confirm your deployment's cron configuration.

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/cron/check-overdue` |
| **Auth Required** | ✅ Yes (cron secret / internal) |
| **CSRF Required** | ❌ No |
| **Rate Limit** | Not subject to user rate limit |

#### Success Response — `200 OK`

```json
{
  "checked": 142,
  "flagged": 3,
  "flaggedParcels": ["PRCL-003", "PRCL-019", "PRCL-055"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `checked` | `integer` | Total number of parcels evaluated |
| `flagged` | `integer` | Number of parcels flagged as overdue |
| `flaggedParcels` | `string[]` | IDs of newly flagged parcels |

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `401 Unauthorized` | Missing/invalid cron secret | `{ "error": "Unauthorized" }` |
| `500 Internal Server Error` | Unexpected failure | `{ "error": "Internal server error" }` |

#### Example

```bash
curl "https://findme.example.com/api/cron/check-overdue" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

```json
// Response 200 OK
{
  "checked": 142,
  "flagged": 3,
  "flaggedParcels": ["PRCL-003", "PRCL-019", "PRCL-055"]
}
```

---

## Parcel State Machine

For reference, here is the standard parcel lifecycle and valid state transitions:

```
PENDING
  └─► IN_TRANSIT
        └─► COD_COLLECTED
              └─► HANDOVER_PENDING
                    └─► HANDED_OVER
                          └─► PAID_OUT

At any stage ─► DISCREPANCY_FLAGGED
                    └─► RESOLVED / ESCALATED
                          └─► PAID_OUT
```

| State | Description |
|-------|-------------|
| `PENDING` | Parcel created, not yet in transit |
| `IN_TRANSIT` | Parcel is being delivered |
| `COD_COLLECTED` | Delivery agent has collected COD |
| `HANDOVER_PENDING` | Handover initiated, awaiting confirmation |
| `HANDED_OVER` | COD handed over to next party |
| `DISCREPANCY_FLAGGED` | Amount mismatch detected during handover |
| `RESOLVED` | Discrepancy resolved by Finance |
| `ESCALATED` | Discrepancy escalated for further review |
| `PAID_OUT` | COD settled to seller |

---

*This document was generated from the FindMe API specification. For implementation questions, refer to the source route handlers in `/app/api/`.*
