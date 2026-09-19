# Hotel Booking API — Multi-Tenant Hospitality Engine

> **Repository:** [hotel-booking-api](https://github.com/abanchaudry/hotel-booking-api)  
> **Status:** Phase 1 (Phase A) Complete — 49/49 Automated Tests Passing  
> **Core Stack:** Node.js • Express • TypeScript • MongoDB (Mongoose) • Multer • JWT • Zod

---

## 📖 Overview

The **Hotel Booking API** is an enterprise-grade, multi-tenant backend engine designed for high-end hospitality groups and hotel commerce. It serves as the authoritative source of truth for hotel accounts, physical properties, luxury room inventories, structured policies, media assets, activity auditing, and AI concierge pipelines.

---

## 🏛 Architecture & Multi-Tenancy

The API enforces strict **server-side tenant isolation** across all data operations:
* **Tenant Root (`HotelAccount`):** Each hotel organization is an isolated tenant with its own timezone, currency, contact details, and status (`ONBOARDING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`).
* **Membership Bridge (`HotelMembership`):** Links users to hotel accounts with role-based permissions (`HOTEL_ADMIN`, `HOTEL_STAFF`).
* **Tenant Isolation Guard (`tenantGuard`):** Validates request-level hotel boundaries to prevent cross-tenant leakage (`403 CROSS_TENANT_ACCESS_DENIED`).
* **Dual-Token Authentication:**
  * **Access Token:** Short-lived (15 minutes), passed via `Authorization: Bearer <token>`.
  * **Refresh Token:** Long-lived (7 days), stored securely in an `HttpOnly`, `SameSite=Strict` cookie.
* **Audit Logging Engine (`ActivityLog`):** Non-blocking, fail-safe tracking of all administrative and tenant actions.

---

## 🏆 Phase 1 Completed Milestones

### A1 — Foundation & Multi-Tenant Access
- Dual-token JWT authentication flow with silent refresh and secure cookies.
- Tenant root models (`HotelAccount`, `HotelMembership`, `User`).
- Middleware security pipeline (`requireAuth`, `requireRole`, `tenantGuard`, `errorHandler`).

### A2 — Hotel Onboarding & Tenant Lifecycle
- Super Admin onboarding API with unique route-safe slug generation (`utils/slugify.ts`).
- Full tenant lifecycle states: `ONBOARDING` ➔ `ACTIVE` ➔ `SUSPENDED` ➔ `ARCHIVED`.
- Suspension enforcement: immediately blocks suspended hotel admins and staff at both auth and middleware layers.

### A3 — Properties & Operating Content
- Property CRUD with address coordinates, amenities taxonomy, and cover imagery.
- Default structured operating policy generation (cancellation terms, deadline hours, pet policies, smoking policies, children policies).

### A4 — Room Catalog & Publication Validator
- Sellable room type catalog with capacity rules, bed setups, and inventory controls.
- Publication readiness validator: requires valid address, at least one room type, positive unit count, and cancellation policy before a property can go live.

### Phase A Enhancements (Production Parity)
- **Super Admin Hotel Management**: Dedicated endpoints for resetting hotel admin passwords, updating admin emails, and editing primary administrator profile details (`PATCH /api/v1/admin/hotels/:id/admin-profile`).
- **Media Upload Pipeline**: Express `multer` pipeline accepting JPEG, PNG, WebP, GIF, and AVIF up to 5MB, with static serving at `/uploads`.
- **Luxury Room Catalog Attributes**: Expanded `RoomType` schema to match Four Seasons, Marriott, and Mews PMS standards (room tiers, view types, outdoor spaces, dual sqm/sqft dimensions, luxury bathroom specifications, bedding flexibility with cribs/rollaway beds, extra adult/child pricing, and meal plans).
- **Activity Audit Trail**: Tenant and platform-level audit logging with queryable endpoints (`/api/v1/admin/hotels/:id/activity`).
- **Enriched Platform Analytics**: Aggregated metrics for active/onboarding hotels, published/draft properties, and total room types.

---

## 🗄 Core Data Schemas

| Model | Purpose | Key Attributes |
| :--- | :--- | :--- |
| **`User`** | System actors | `email`, `passwordHash`, `fullName`, `role`, `status` |
| **`HotelAccount`** | Tenant boundary | `name`, `slug`, `status`, `contactEmail`, `contactPhone`, `country`, `currency`, `timezone`, `primaryAdminUserId` |
| **`HotelMembership`** | User-to-Tenant link | `hotelAccountId`, `userId`, `role`, `status` |
| **`Property`** | Physical hotel location | `hotelAccountId`, `name`, `slug`, `propertyType`, `status`, `address`, `coverImage`, `gallery`, `amenities` |
| **`Policy`** | Operating rules | `propertyId`, `hotelAccountId`, `cancellationPolicy`, `cancellationDeadlineHours`, `petPolicy`, `smokingPolicy`, `childPolicy` |
| **`RoomType`** | Sellable inventory | `propertyId`, `hotelAccountId`, `name`, `code`, `category`, `viewType`, `outdoorSpace`, `maxOccupancy`, `bedding`, `bathroom`, `roomSizeSqm`, `roomSizeSqft`, `totalUnits`, `basePricePerNight`, `pricing`, `mealPlan`, `images` |
| **`ActivityLog`** | Audit trail | `tenantId`, `actorId`, `actorRole`, `action`, `targetType`, `targetId`, `metadata`, `createdAt` |

---

## 📡 API Reference

### 1. Authentication (`/api/v1/auth`)
* `POST /login` — Authenticate with email/password; returns access token + sets refresh cookie.
* `POST /refresh` — Refresh access token via `HttpOnly` cookie.
* `POST /logout` — Clear refresh cookie.
* `GET  /me` — Return authenticated user profile and active hotel membership.

### 2. Super Admin (`/api/v1/admin`) — Guarded: `SUPER_ADMIN`
* `GET   /stats` — Platform counts (total/active/onboarding hotels, users, properties, room types, recent activity).
* `GET   /hotels` — List all registered hotel accounts.
* `POST  /hotels` — Onboard a new hotel and primary administrator.
* `GET   /hotels/:id` — Get hotel details, property counts, and recent activity.
* `PATCH /hotels/:id` — Update hotel metadata (name, contact info, region).
* `PATCH /hotels/:id/status` — Change status (`ACTIVE`, `SUSPENDED`, `ONBOARDING`, `ARCHIVED`).
* `PATCH /hotels/:id/admin-password` — Direct password reset for hotel administrator.
* `PATCH /hotels/:id/admin-email` — Update hotel administrator login email.
* `PATCH /hotels/:id/admin-profile` — Update hotel administrator full name and account status.
* `GET   /hotels/:id/activity` — Get tenant activity audit log.

### 3. Hotel Portal (`/api/v1/portal`) — Guarded: `HOTEL_ADMIN`, `HOTEL_STAFF`, `tenantGuard`
* `POST   /upload` — Upload media image (JPEG/PNG/WebP, max 5MB).
* `GET    /amenities` — Global hotel amenities catalog.
* `GET    /hotel/me` — Scoped hotel tenant details and inventory metrics.
* `PATCH  /hotel/me` — Update hotel profile (name, contact email, contact phone).
* `POST   /account/password` — Self-service password change (requires current password).
* `POST   /account/email` — Self-service email change (requires current password).
* `GET    /properties` — List properties belonging to the active hotel.
* `POST   /properties` — Create a new property (defaults to `DRAFT`).
* `GET    /properties/:id` — Get property details with room types and policy.
* `PATCH  /properties/:id` — Update property details and media gallery.
* `DELETE /properties/:id` — Soft-archive property.
* `POST   /properties/:id/publish` — Validate and publish property to marketplace.
* `POST   /properties/:id/unpublish` — Revert property to draft status.
* `GET    /properties/:id/policies` — Retrieve property operating policies.
* `PUT    /properties/:id/policies` — Update operating policies.
* `GET    /properties/:id/rooms` — List room types for property.
* `POST   /properties/:id/rooms` — Create luxury room type.
* `PATCH  /rooms/:roomId` — Update room type attributes.
* `DELETE /rooms/:roomId` — Soft-deactivate room type.

---

## 🧪 Automated Testing

The backend includes comprehensive, isolated regression test suites:

```bash
# Test Milestone A2: Onboarding & Tenant Suspension Lifecycle
npm run test:a2
# Result: 16 passed, 0 failed

# Test Milestones A3 & A4: Properties, Policies, Rooms & Publication Validator
npm run test:a3-a4
# Result: 24 passed, 0 failed

# Test Phase A Enhancements: Admin Profile, Password Reset, Image Upload, Audit Logs
npm run test:enhancements
# Result: 9 passed, 0 failed

# Combined: 49/49 automated tests passing
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

### 3. Environment Variables (`.env`)
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
```bash
npm run seed
```

#### Default Seed Accounts:
| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@hotelagent.com` | `Admin123!` | Platform-wide |
| **Hotel A Admin** | `admin@heritagehotel.com` | `Heritage123!` | The Grand Heritage Lahore |
| **Hotel B Admin** | `admin@sereneresort.com` | `Oasis123!` | Serene Oasis Resort |

### 5. Running Server
```bash
npm run dev
```
API runs on: `http://localhost:5000`  
Static uploads served at: `http://localhost:5000/uploads/`
