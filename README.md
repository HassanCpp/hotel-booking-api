# Hotel Booking API — Multi-Tenant Hospitality & Marketplace Engine

> **Repository:** [hotel-booking-api](https://github.com/abanchaudry/hotel-booking-api)  
> **Status:** Production-Ready • 85/85 Automated QA Tests Passing (100%)  
> **Core Stack:** Node.js • Express • TypeScript • MongoDB (Mongoose) • Multer • JWT • Zod • Bcrypt

---

## 📖 Overview

The **Hotel Booking API** is an enterprise-grade hospitality and marketplace engine designed for boutique hotel groups, multi-property operators, and guest commerce. It combines:
1. **Multi-Tenant Hotel Operations:** Tenant isolation, PMS inventory controls, 14-day tape chart availability matrix, dynamic rate plans, promo codes, front-desk reservations lifecycle, and verified review moderation.
2. **Super Admin Platform Console:** Global platform analytics, hotel onboarding wizard, tenant credential administration, audit logging, and marketplace curation.
3. **Public Marketplace & Guest Commerce:** Geo-targeted home feeds, Airbnb-grade search & filtering, real-time rate quotation, idempotent booking pipeline, digital stay vouchers, and synchronized wishlists.

---

## 🏛 Architecture & Tenancy Security

* **Tenant Isolation (`HotelAccount`):** Every hotel organization is an isolated tenant with its own timezone, currency, contact details, and lifecycle states (`ONBOARDING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`).
* **Tenant Isolation Guard (`tenantGuard`):** Request-level boundaries strictly prevent cross-tenant data access (`403 CROSS_TENANT_ACCESS_DENIED`).
* **Dual-Token Authentication:**
  * **Access Token:** Short-lived (15 minutes), passed via `Authorization: Bearer <token>`.
  * **Refresh Token:** Long-lived (7 days), stored securely in an `HttpOnly`, `SameSite=Strict` cookie.
* **Role-Based Access Control:** Strict role segregation for `SUPER_ADMIN`, `HOTEL_ADMIN`, `HOTEL_STAFF`, and `GUEST`.
* **Idempotent Reservations Engine:** Front-ends submit a UUID idempotency key; duplicate submissions safely return existing booking without double charges or inventory overbooking.
* **Audit Trail Engine (`ActivityLog`):** Non-blocking, fail-safe logging of all platform and tenant mutations.

---

## 🗄 Core Data Schemas

| Model | Purpose | Key Attributes |
| :--- | :--- | :--- |
| **`User`** | Actors & guests | `email`, `passwordHash`, `fullName`, `role` (`SUPER_ADMIN` \| `HOTEL_ADMIN` \| `HOTEL_STAFF` \| `GUEST`), `savedProperties`, `status` |
| **`HotelAccount`** | Tenant boundary | `name`, `slug`, `status`, `contactEmail`, `contactPhone`, `country`, `currency`, `timezone`, `primaryAdminUserId` |
| **`HotelMembership`**| User-to-Tenant link | `hotelAccountId`, `userId`, `role`, `status` |
| **`Property`** | Physical hotel | `hotelAccountId`, `name`, `slug`, `propertyType`, `status`, `address`, `coverImage`, `gallery`, `amenities`, `averageRating`, `reviewCount`, `isFeaturedOnHome`, `featuredPriority` |
| **`RoomType`** | Sellable inventory | `propertyId`, `hotelAccountId`, `name`, `code`, `category`, `viewType`, `outdoorSpace`, `maxOccupancy`, `bedding`, `bathroom`, `roomSizeSqm`, `totalUnits`, `basePricePerNight`, `pricing`, `mealPlan` |
| **`Availability`** | Tape chart calendar | `propertyId`, `roomTypeId`, `date`, `totalUnits`, `bookedUnits`, `blockedUnits`, `availableUnits`, `stopSell`, `closedToArrival`, `closedToDeparture` |
| **`RatePlan`** | Dynamic pricing | `propertyId`, `roomTypeId`, `name`, `type` (`STANDARD` \| `WEEKEND` \| `EARLY_BIRD` \| `LAST_MINUTE` \| `SEASONAL`), `adjustmentType` (`PERCENTAGE_DISCOUNT` \| `PERCENTAGE_SURGE` \| `FIXED_DISCOUNT`), `validFrom`, `validTo`, `daysOfWeek`, `minNights`, `isActive` |
| **`PromoCode`** | Discount codes | `hotelAccountId`, `propertyId`, `code`, `discountType` (`PERCENTAGE` \| `FIXED_AMOUNT`), `discountValue`, `validFrom`, `validTo`, `minSpend`, `usageLimit`, `usedCount`, `isActive` |
| **`Booking`** | Reservations | `bookingReference` (`BK-HOTEL-YYMM-XXXX`), `propertyId`, `hotelAccountId`, `roomTypeId`, `guest`, `checkIn`, `checkOut`, `nights`, `rooms`, `pricing`, `status` (`PENDING` \| `CONFIRMED` \| `CHECKED_IN` \| `CHECKED_OUT` \| `CANCELLED`), `paymentStatus`, `source`, `idempotencyKey` |
| **`Review`** | Verified feedback | `propertyId`, `bookingId`, `guestId`, `ratings` (6 categories: cleanliness, accuracy, checkIn, communication, location, value), `overallRating`, `title`, `comment`, `hotelReply`, `status` (`PUBLISHED` \| `HIDDEN`) |
| **`FeaturedDestination`** | Geo discovery | `city`, `country`, `countryCode`, `subtitle`, `coverImage`, `displayOrder`, `targetCountries`, `isActive`, `isPopular` |
| **`Policy`** | Operating rules | `propertyId`, `cancellationPolicy`, `cancellationDeadlineHours`, `petPolicy`, `smokingPolicy`, `childPolicy` |
| **`ActivityLog`** | Audit trail | `tenantId`, `actorId`, `actorRole`, `action`, `targetType`, `targetId`, `metadata`, `createdAt` |

---

## 📡 Complete API Reference

### 1. Authentication (`/api/v1/auth`)
* `POST /login` — Authenticate user; returns JWT token + sets `refreshToken` cookie.
* `POST /refresh` — Refresh expired access token using HTTP-only cookie.
* `POST /logout` — Clear session cookies.
* `GET  /me` — Return current session, role, and active tenant profile.

### 2. Super Admin (`/api/v1/admin`) — Guarded: `SUPER_ADMIN`
* `GET    /stats` — Platform KPI metrics, tenant counts, room counts, and recent activity.
* `GET    /hotels` — List all registered hotel organizations.
* `POST   /hotels` — Onboard a new hotel tenant and primary administrator.
* `GET    /hotels/:id` — Get hotel details, property inventory, and activity audit logs.
* `PATCH  /hotels/:id` — Update hotel identity and regional settings.
* `PATCH  /hotels/:id/status` — Change tenant status (`ACTIVE`, `SUSPENDED`, `ONBOARDING`, `ARCHIVED`).
* `PATCH  /hotels/:id/admin-password` — Direct password reset for hotel administrator.
* `PATCH  /hotels/:id/admin-email` — Update hotel administrator login email.
* `PATCH  /hotels/:id/admin-profile` — Update administrator profile and account state.
* `GET    /hotels/:id/activity` — Retrieve tenant activity audit trail.
* `GET    /destinations` — List curated marketplace destinations.
* `POST   /destinations` — Create a featured destination card.
* `PATCH  /destinations/:id` — Update destination order, imagery, or target countries.
* `DELETE /destinations/:id` — Remove featured destination.
* `PATCH  /properties/:id/feature` — Spotlight property on marketplace home feed.

### 3. Hotel Operations Portal (`/api/v1/portal`) — Guarded: `HOTEL_ADMIN`, `HOTEL_STAFF`, `tenantGuard`
* `GET    /amenities` — Global hotel amenities catalog.
* `POST   /upload` — Upload property and room imagery (max 5MB).
* `GET    /hotel/me` — Current hotel tenant metadata and overview metrics.
* `PATCH  /hotel/me` — Update hotel profile (name, contact email, contact phone).
* `POST   /account/password` — Change administrator password.
* `POST   /account/email` — Change administrator email.
* `GET    /properties` — List hotel properties.
* `POST   /properties` — Create new property draft.
* `GET    /properties/:id` — Retrieve property with rooms and operating policies.
* `PATCH  /properties/:id` — Update property details and media galleries.
* `DELETE /properties/:id` — Soft-archive property.
* `POST   /properties/:id/publish` — Validate checklist and publish property.
* `POST   /properties/:id/unpublish` — Revert property to draft.
* `GET    /properties/:id/policies` — Retrieve cancellation and house rules.
* `PUT    /properties/:id/policies` — Update property operating policies.
* `GET    /properties/:id/rooms` — List room catalog for property.
* `POST   /properties/:id/rooms` — Create luxury room type.
* `PATCH  /rooms/:roomId` — Update room type specifications and pricing.
* `DELETE /rooms/:roomId` — Soft-deactivate room type.
* `GET    /availability/:propertyId` — 14-day tape chart inventory matrix.
* `PATCH  /availability/override` — Bulk update unit blocks, stop-sells, and arrival restrictions.
* `GET    /rate-plans` — List dynamic rate plans.
* `POST   /rate-plans` — Create seasonal/weekend rate rule.
* `PATCH  /rate-plans/:id` — Update rate plan.
* `DELETE /rate-plans/:id` — Delete rate plan.
* `GET    /promo-codes` — List promotional coupon codes.
* `POST   /promo-codes` — Create promo code with spend thresholds and usage limits.
* `PATCH  /promo-codes/:id` — Update promo code status.
* `DELETE /promo-codes/:id` — Delete promo code.
* `GET    /bookings/today` — Front-desk operations board (arrivals, departures, in-house).
* `GET    /bookings` — Reservation ledger with search and status filters.
* `GET    /bookings/:id` — Booking detail with guest history and voucher metrics.
* `POST   /bookings/:id/confirm` — Transition booking `PENDING` ➔ `CONFIRMED`.
* `POST   /bookings/:id/check-in` — Transition booking `CONFIRMED` ➔ `CHECKED_IN`.
* `POST   /bookings/:id/check-out` — Transition booking `CHECKED_IN` ➔ `CHECKED_OUT`.
* `POST   /bookings/:id/cancel` — Hotel cancel booking.
* `GET    /reviews` — Property reviews with rating distributions.
* `POST   /reviews/:reviewId/reply` — Submit public management reply to verified review.

### 4. Public Marketplace (`/api/v1/marketplace`) — Public Access
* `GET  /home-feed` — Geo-resolved destination cards, spotlight hotel banner, and popular stays.
* `GET  /cities` — Indexed cities with live property counts for search autocomplete.
* `GET  /properties` — Search catalog with multi-factor filters (city, dates, guests, price, rating, amenities). Excludes hotels with zero available units on requested dates.
* `GET  /properties/:slug` — Full property detail, 5-photo bento box, amenities, and policies.
* `GET  /properties/:slug/rooms` — Sellable room types with live rates for requested dates and occupancy.
* `GET  /properties/:slug/availability` — Real-time availability calendar endpoint returning booked date ranges, unavailable nights, and unit allocations.
* `GET  /properties/:slug/reviews` — Verified guest reviews with Airbnb 6-category ratings summary.
* `POST /promo/validate` — Validate promo code against dates, property, and cart value.
* `POST /check-rates` — Real-time rate calculation engine with taxes, fees, and add-ons.
* `POST /bookings` — Create reservation with idempotency key (`201 CREATED`). Supports optional JWT auth to link booking to guest profile.

### 5. Guest Accounts & Wishlist (`/api/v1/guest`) — Guarded: `GUEST`
* `POST   /register` — Public guest account registration.
* `GET    /bookings` — Guest reservation history.
* `GET    /bookings/:id` — Guest booking detail and printable digital voucher.
* `POST   /bookings/:id/cancel` — Policy-compliant guest cancellation with automatic refund calculation and voucher restoral.
* `POST   /bookings/:bookingId/review` — Submit 6-category verified review after checkout.
* `GET    /saved-properties` — List guest wishlist favorites (null-safe against unpublished hotels).
* `POST   /saved-properties/:propertyId` — Add property to wishlist.
* `DELETE /saved-properties/:propertyId` — Remove property from wishlist.

---

## 🛡 Real-Time Inventory & Booking Lifecycle Engine

1. **Atomic Inventory Reservation with Rollback Protection:**
   * Atomically locks units night-by-night (`$inc: { bookedUnits: rooms }`) subject to `totalUnits`.
   * If any night fails in a multi-night reservation, a compensating rollback loop automatically reverses previously incremented nights, preventing ghost locks on standalone MongoDB instances.
2. **Availability Calendar Endpoint (`GET /properties/:slug/availability`):**
   * Cross-references `Availability` records and active `Booking` entries (`PENDING`, `CONFIRMED`, `CHECKED_IN`).
   * Feeds the 2-month side-by-side interactive calendar widget with booked date spans and unavailable dates.
3. **Automated Expiration Sweeper (`bookingExpiry.ts`):**
   * Automatically sweeps and cancels abandoned `PENDING` bookings older than 24 hours (or past check-in), releasing held units back to the marketplace.
4. **Multi-Tenant Tape Chart & Override Isolation:**
   * Strict tenant boundary checks prevent hotel admins from viewing or overriding other hotels' availability matrices or rate plans.
5. **Early Check-Out Unused Nights Release:**
   * Checking out before the scheduled departure date frees remaining unused nights (`[today, scheduledCheckOut)`), immediately returning inventory to the market.
6. **Strict Pricing & Occupancy Guards:**
   * Rejects bookings where guest count exceeds room capacity (`MAX_OCCUPANCY_EXCEEDED`).
   * Enforces date order (`checkOut > checkIn`) and minimum stays.
   * Enforces strict promo code validation (rejects invalid/expired codes instead of silently dropping discounts).

---

## 🧪 Comprehensive Automated QA Suite

The backend includes an exhaustive, automated end-to-end QA test suite covering the entire multi-tenant system lifecycle:

```bash
# Run the complete 85-step QA regression suite:
npm run test:qa
```

### What `npm run test:qa` Verifies:
1. **Section 1: Authentication & RBAC:** Super Admin, Hotel Admin, and Guest token flows; invalid credential rejection; cross-role permission guards.
2. **Section 2: Super Admin Platform Oversight:** KPI statistics, hotel onboarding, password resets, admin email updates, destination curation CRUD, and homepage property spotlighting.
3. **Section 3: Hotel Operations Portal:** Scoped hotel profile, amenities catalog, room creation, availability tape chart calculation, rate plans, promo codes, today's operations board, and reviews ledger.
4. **Section 4: Marketplace Discovery & Search:** Geo-targeted home feed resolution (default `PK` vs timezone `AE`), city auto-suggest, multi-filter search, property details, room availability, Airbnb 6-category reviews, promo validation, and live rate quotes.
5. **Section 5: End-to-End Booking & Review Lifecycle:** Idempotent booking creation, status progression (`PENDING` ➔ `CONFIRMED` ➔ `CHECKED_IN` ➔ `CHECKED_OUT`), verified guest review submission, management reply publication, and guest wishlist toggle lifecycle (`POST` / `GET` / `DELETE`).
6. **Section 6: Error Handling & Security:** 404 handling on invalid slugs, 404 on expired promos, and Zod 400 validation on malformed payloads.
7. **Section 7: Self-Cleaning Teardown:** Ephemeral test bookings, reviews, and test users are cleanly expunged, and unit availability is automatically restored.

**Result: 85 passed, 0 failed (100% passing)**

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher
- **MongoDB:** A running MongoDB instance on `localhost:27017` or MongoDB Atlas

### 2. Environment Setup
```bash
# Copy environment configuration:
cp .env.example .env
```

Ensure `.env` contains:
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

### 3. Database Seeding (`npm run seed`)
Populate the database with luxury hotels, published properties, room types, tape chart availability, rate plans, promo codes, curated destinations, sample bookings, verified reviews, and a pre-configured guest wishlist:

```bash
npm run seed
```

#### Pre-Configured Seeded Accounts:
| Role | Email | Password | Scope & Key Features |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@hotelagent.com` | `Admin123!` | Hotel onboarding, audit logs, marketplace curation |
| **Hotel A Admin** | `admin@heritagehotel.com` | `Heritage123!` | *The Grand Heritage Mall Road*, Lahore (Boutique) |
| **Hotel B Admin** | `admin@sereneresort.com` | `Oasis123!` | *Serene Oasis Beach & Spa*, Karachi (Resort) |
| **Demo Guest** | `guest@hotelai.com` | `Guest123!` | Wishlist pre-seeded, bookings history, review author |

### 4. Running the Server
```bash
# Development mode with hot-reloading:
npm run dev

# Production build and run:
npm run build
npm start
```

* API Endpoint: **`http://localhost:5000`**
* Health Check: **`http://localhost:5000/api/v1/health`**
* Static Uploads: **`http://localhost:5000/uploads/`**
