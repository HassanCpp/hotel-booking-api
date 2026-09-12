# Hotel Booking API — Multi-Tenant Backend Engine

> **Repository:** [hotel-booking-api](https://github.com/abanchaudry/hotel-booking-api)  
> **Status:** Phase 1 Complete (13/13 Automated Tests Passing)  
> **Core Architecture:** Node.js • Express • TypeScript • MongoDB (Mongoose) • JWT • Zod

---

## 📖 Overview

The **Hotel Booking API** is a high-performance, multi-tenant backend service designed for hotel commerce and operations. It serves as the single source of truth for properties, rooms, pricing, authoritative inventory, and natural-language AI agent assistance.

---

## 🔒 Security & Multi-Tenancy

The API enforces strict **server-side tenant isolation**:
* **Tenant Root (`HotelAccount`):** Every hotel organization is an isolated tenant.
* **Membership Bridge (`HotelMembership`):** Maps users to hotels with assigned roles (`HOTEL_ADMIN`, `HOTEL_STAFF`).
* **Isolation Middleware (`tenantGuard`):** Inspects incoming requests and blocks cross-tenant data access attempts (`403 CROSS_TENANT_ACCESS_DENIED`).
* **Dual-Token Auth Strategy:**
  * **Access Token:** Short-lived (15 minutes), passed via `Authorization: Bearer <token>`.
  * **Refresh Token:** Long-lived (7 days), stored securely in an `HttpOnly`, `SameSite=Strict` cookie.

---

## 🛠 Tech Stack

- **Runtime:** Node.js (v18+)
- **Language:** TypeScript
- **Framework:** Express
- **Database:** MongoDB via Mongoose
- **Validation:** Zod
- **Authentication:** `bcryptjs` (12 salt rounds) + `jsonwebtoken`
- **Testing:** Native automated HTTP regression test suite

---

## 📁 Project Structure

```text
src/
├── config/                # Environment validation (Zod) & DB connection
│   ├── env.ts
│   └── database.ts
├── models/                # Core Mongoose data schemas
│   ├── User.ts            # SuperAdmin, HotelAdmin, Staff, Guest
│   ├── HotelAccount.ts    # Tenant Boundary
│   ├── HotelMembership.ts # User-to-Hotel relationship
│   └── Property.ts        # Hotel physical catalog entry
├── middleware/            # Security pipeline
│   ├── auth.ts            # requireAuth (JWT token verification)
│   ├── roleGuard.ts       # requireRole (RBAC)
│   ├── tenantGuard.ts     # Mandatory tenant isolation
│   └── errorHandler.ts    # Centralized JSON error envelope
├── modules/
│   ├── auth/              # Login, token refresh, logout, profile
│   ├── admin/             # Super Admin oversight & hotel listings
│   └── portal/            # Hotel Admin scoped operations
├── scripts/
│   ├── seed.ts            # Database seed script
│   └── test-tenancy.ts    # Automated tenant isolation test suite
├── app.ts                 # Express application setup
└── server.ts              # Server bootstrapper
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v18+
- **MongoDB:** Running locally on `mongodb://localhost:27017`

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/ai_hotel_agent
JWT_ACCESS_SECRET=super_secret_access_jwt_key_2026_hotel_agent
JWT_REFRESH_SECRET=super_secret_refresh_jwt_key_2026_hotel_agent
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 4. Database Seeding
Populate the database with Super Admin and two isolated hotel tenants:
```bash
npm run seed
```

#### Seeded Accounts:
| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@hotelagent.com` | `Admin123!` | Platform-wide |
| **Hotel A Admin** | `admin@heritagehotel.com` | `Heritage123!` | The Grand Heritage Lahore |
| **Hotel B Admin** | `admin@sereneresort.com` | `Oasis123!` | Serene Oasis Resort |

### 5. Running Development Server
```bash
npm run dev
```
API runs on: **[http://localhost:5000](http://localhost:5000)**  
Health check: **[http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)**

---

## 🧪 Automated Testing

Run the automated tenant isolation and authentication test suite:
```bash
npm run test:tenancy
```
*Expected: 13 passed, 0 failed.*

---

## 📡 API Contract (Phase 1)

### Authentication (`/api/v1/auth`)
* `POST /login` — Authenticate user and receive access token + refresh cookie.
* `POST /refresh` — Refresh access token via `HttpOnly` cookie.
* `POST /logout` — Invalidate refresh cookie.
* `GET  /me` — Return current authenticated user profile and active hotel membership.

### Super Admin (`/api/v1/admin`) — Guarded: `SUPER_ADMIN`
* `GET  /stats` — Platform counts (total hotels, users, properties).
* `GET  /hotels` — List all registered hotel tenants.

### Hotel Portal (`/api/v1/portal`) — Guarded: `HOTEL_ADMIN`, `HOTEL_STAFF`, `tenantGuard`
* `GET  /hotel/me` — Return active hotel details for the caller.
* `GET  /properties` — Return properties belonging to the active hotel.
* `GET  /hotels/:hotelId` — Return specific hotel details (blocks cross-tenant access).
