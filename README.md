# Hotel Booking API — Multi-Tenant Hospitality, Marketplace & Agentic RAG Engine

> **Repository:** [hotel-booking-api](https://github.com/abanchaudry/hotel-booking-api)  
> **Status:** Production-Ready • Automated QA & RAG Stress Tests Passing (100%)  
> **Core Stack:** Node.js • Express • TypeScript • MongoDB (Mongoose) • Pinecone Vector DB • OpenAI API (`gpt-4o`, `gpt-4o-mini`) • Multer • JWT • Zod • Bcrypt

---

## 📖 Overview

The **Hotel Booking API** is an enterprise-grade hospitality, marketplace, and agentic AI engine designed for boutique hotel groups, multi-property operators, and guest commerce. It integrates:
1. **Multi-Tenant Hotel Operations:** Tenant isolation, PMS inventory controls, 14-day tape chart availability matrix, dynamic rate plans, promo codes, front-desk reservations lifecycle, verified review moderation, and hotel knowledge base management.
2. **Super Admin Platform Console:** Global platform analytics, hotel onboarding wizard, tenant credential administration, audit logging, marketplace destination curation, Pinecone vector index health governance, and real-time client chat surveillance.
3. **Public Marketplace & Guest Commerce:** Geo-targeted home feeds, Airbnb-grade search & filtering, real-time rate quotation, idempotent booking pipeline, digital stay vouchers, synchronized wishlists, and a verified AI Concierge.
4. **Agentic 3-Tier RAG Pipeline:** Fully grounded AI guest concierge powered by OpenAI and Pinecone, featuring hierarchical chunking, hybrid retrieval (dense vectors + lexical full-text search with entity-aware RRF), multi-signal evidence gating, and strict anti-hallucination citation suppression.

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
* **Single Authoritative Knowledge Architecture:** Unified, grounded knowledge base eliminating competing truth datasets; hotel admins control property policies, while Super Admin governs global master documents and platform-wide vector health.

---

## 🤖 Agentic 3-Tier RAG Architecture

The platform features an advanced Retrieval-Augmented Generation (RAG) pipeline engineered for verified, zero-hallucination guest interactions:

```
Guest Query ──► [Preflight Router (gpt-4o-mini)]
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
  SMALL_TALK     OUT_OF_SCOPE    PROPERTY_INQUIRY
  (Instant)      (Deflection)          │
                                       ▼
                         [Conversational Coreference &
                             Query Entity Expansion]
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             [Pinecone Vector Search]        [MongoDB Lexical FTS]
             (Dense Embeddings / Schema)     (Full-Text Exact Search)
                      └────────────────┬────────────────┘
                                       ▼
                       [Entity-Aware RRF Fusion (k=50)]
                       (+0.25 Exact Match Bonus for Codes,
                             Dates, Prices & Numbers)
                                       │
                                       ▼
                       [Parent Context Hydration]
                       (Small ~150t ➔ Medium ~400t ➔ Large ~1000t)
                                       │
                                       ▼
                       [Multi-Signal Evidence Gate]
                       (Signal 1: Exact Match | Signal 2: Hybrid | Signal 3: RRF)
                                       │
                       ┌───────────────┴───────────────┐
                       ▼ (Pass)                        ▼ (Fail)
               [Pass 1: gpt-4o]                [Pass 2 Retry with
               (Confidence: HIGH)               Expanded TopK=12]
                       │                               │
                       └───────────────┬───────────────┘
                                       ▼
                      [Concierge Anti-Hallucination &
                        Citation Suppression Engine]
                                       │
                                       ▼
                      [MongoDB ChatSession Persistence]
                      (IP, User Agent, Route, Confidence,
                           Latency & Citations Audit)
```

### Pipeline Subsystems:
1. **Content Cleaner (`content-cleaner.service.ts`):** Normalizes whitespace and strips PDF page headers, recurring footer boilerplate, and legal disclaimers.
2. **3-Tier Tree Chunker (`tree-chunker.service.ts`):** Deconstructs documents hierarchically into **Large (~1000 tokens)** structural chapters, **Medium (~400 tokens)** section rules, and **Small (~150 tokens)** vectorized policy facts with parent/grandparent linkage.
3. **Hybrid Retriever (`hybrid-retriever.service.ts`):** Combines Pinecone vector similarity with MongoDB `$text` lexical search via Reciprocal Rank Fusion ($k=50$, Lexical 1.10x weight, Vector 1.00x weight) with exact match boosts for dates, prices, percentages, and alphanumeric codes.
4. **Parent Context Hydration:** Small chunks retrieved by Pinecone are automatically hydrated with their parent Medium or Large context from MongoDB before feeding the LLM, eliminating chunk truncation.
5. **Evidence Gate (`evidence-gate.service.ts`):** Multi-signal confidence gating with automatic Pass 2 retry on borderline retrieval scores.
6. **Luxury Concierge Generator (`rag-generator.service.ts`):** Generates warm, first-person hospitality responses with strict anti-meta language bans, flexible refusal detection, and verified citation suppression (zero citations attached on fallback/refusal).

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
| **`RatePlan`** | Dynamic pricing | `propertyId`, `roomTypeId`, `name`, `type`, `adjustmentType`, `validFrom`, `validTo`, `daysOfWeek`, `minNights`, `isActive` |
| **`PromoCode`** | Discount codes | `hotelAccountId`, `propertyId`, `code`, `discountType`, `discountValue`, `validFrom`, `validTo`, `minSpend`, `usageLimit`, `usedCount`, `isActive` |
| **`Booking`** | Reservations | `bookingReference`, `propertyId`, `hotelAccountId`, `roomTypeId`, `guest`, `checkIn`, `checkOut`, `nights`, `rooms`, `pricing`, `status`, `paymentStatus`, `source`, `idempotencyKey` |
| **`Review`** | Verified feedback | `propertyId`, `bookingId`, `guestId`, `ratings` (6 categories), `overallRating`, `title`, `comment`, `hotelReply`, `status` |
| **`KnowledgeDocument`**| Ingested policy files | `hotelAccountId`, `propertyId`, `title`, `filename`, `fileType`, `fileSize`, `status` (`PROCESSING`, `INDEXED`, `FAILED`), `stats` (`totalTokens`, `vectorCount`, chunk counts), `uploadedBy` |
| **`KnowledgeChunk`** | 3-Tier chunk store | `documentId`, `hotelAccountId`, `propertyId`, `tier` (`LARGE`, `MEDIUM`, `SMALL`), `chunkIndex`, `parentId`, `grandParentId`, `title`, `text`, `tokenCount`, `pineconeVectorId` |
| **`ChatSession`** | Guest chat surveillance | `sessionId`, `guestId`, `guestEmail`, `guestName`, `propertyId`, `hotelAccountId`, `ipAddress`, `userAgent`, `status` (`ACTIVE`, `RESOLVED`, `FLAGGED`), `flagReason`, `messages` (with route, confidence, citations, latency), `messageCount`, `lastActivityAt` |
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

### 3. Super Admin AI Governance & Surveillance (`/api/v1/admin/knowledge`) — Guarded: `SUPER_ADMIN`
* `POST   /global` — Ingest global platform master policy document (`.txt` or `.pdf`).
* `GET    /documents` — Cross-tenant document audit table with pagination and status filters.
* `GET    /health` — Pinecone vector index health metrics, connection state, dimensions, and MongoDB record counts.
* `DELETE /documents/:id` — Platform-wide document deletion and Pinecone vector purge.
* `GET    /chat-sessions` — Real-time surveillance feed of guest chat sessions with client IP, user agent, turns, and status.
* `GET    /chat-sessions/:id` — Complete session audit transcript with question routes, latency, confidence, and verified citations.
* `PATCH  /chat-sessions/:id/status` — Update session surveillance classification (`ACTIVE`, `RESOLVED`, `FLAGGED`) and flag reason.
* `DELETE /chat-sessions/:id` — Delete guest chat surveillance session.

### 4. Hotel Operations Portal (`/api/v1/portal`) — Guarded: `HOTEL_ADMIN`, `HOTEL_STAFF`, `tenantGuard`
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

### 5. Hotel AI Knowledge Base (`/api/v1/portal/knowledge`) — Guarded: `HOTEL_ADMIN`, `tenantGuard`
* `POST   /upload` — Ingest property or hotel-wide policy document (`.txt` or searchable `.pdf`). Runs 3-tier chunking and Pinecone vector upsert.
* `GET    /documents` — List uploaded knowledge documents with chunk and token counts.
* `GET    /documents/:id/chunks` — Inspect hierarchical 3-tier chunks (Large, Medium, Small) with parent IDs and Pinecone vector mappings.
* `DELETE /documents/:id` — Delete document, purge MongoDB chunks, and delete Pinecone vectors.
* `POST   /test-query` — Interactive simulator playground query to test RAG retrieval and confidence before publishing.

### 6. Public Marketplace (`/api/v1/marketplace`) — Public Access
* `GET  /home-feed` — Geo-resolved destination cards, spotlight hotel banner, and popular stays.
* `GET  /cities` — Indexed cities with live property counts for search autocomplete.
* `GET  /properties` — Search catalog with multi-factor filters (city, dates, guests, price, rating, amenities).
* `GET  /properties/:slug` — Full property detail, 5-photo bento box, amenities, and policies.
* `GET  /properties/:slug/rooms` — Sellable room types with live rates for requested dates and occupancy.
* `GET  /properties/:slug/availability` — Real-time availability calendar endpoint returning booked date ranges and unit allocations.
* `GET  /properties/:slug/reviews` — Verified guest reviews with Airbnb 6-category ratings summary.
* `POST /promo/validate` — Validate promo code against dates, property, and cart value.
* `POST /check-rates` — Real-time rate calculation engine with taxes, fees, and add-ons.
* `POST /bookings` — Create reservation with idempotency key (`201 CREATED`).
* `POST /properties/:propertyId/ask` — Public AI concierge endpoint. Answers guest inquiries grounded in property policies, returns verified citations, and persists chat session with IP surveillance tracking.

### 7. Guest Accounts & Wishlist (`/api/v1/guest`) — Guarded: `GUEST`
* `POST   /register` — Public guest account registration.
* `GET    /bookings` — Guest reservation history.
* `GET    /bookings/:id` — Guest booking detail and printable digital voucher.
* `POST   /bookings/:id/cancel` — Policy-compliant guest cancellation with refund calculation and voucher restoral.
* `POST   /bookings/:bookingId/review` — Submit 6-category verified review after checkout.
* `GET    /saved-properties` — List guest wishlist favorites.
* `POST   /saved-properties/:propertyId` — Add property to wishlist.
* `DELETE /saved-properties/:propertyId` — Remove property from wishlist.

---

## 🧪 Comprehensive Automated QA Suites

### 1. Full-System Hospitality Lifecycle QA (`npm run test:qa`)
```bash
npm run test:qa
```
* **Coverage:** 85/85 automated assertions covering tenant isolation, PMS availability tape charts, dynamic rate plans, promo codes, idempotency, review moderation, and full booking lifecycle.

### 2. End-to-End RAG Pipeline & Multi-Tier Chunking QA (`npm run test:rag`)
```bash
npm run test:rag
```
* **Coverage:** Connects to live MongoDB and Pinecone; ingests house rules document; validates 3-tier chunk counts; tests fast-path small talk preflight; tests out-of-scope deflection; validates multi-topic grounded policy retrieval; verifies anti-hallucination citation suppression; executes clean document and vector teardown.

### 3. Exhaustive RAG Stress Test (`npx tsx src/scripts/test-rag-stress.ts`)
```bash
npx tsx src/scripts/test-rag-stress.ts
```
* **Coverage:** 17 comprehensive test cases evaluating:
  * **Dates & Seasons (4/4 Passed):** Annual maintenance closures, Ramadan calendar dates, Iftar times, and holiday voucher blackout dates.
  * **Prices & Penalties (3/3 Passed):** Rollaway adult beds, complimentary infant cribs, sedan vs passenger van transfer rates, and security deposit amounts.
  * **Alphanumeric Codes (3/3 Passed):** Wi-Fi SSID and passkey (`Heritage@Stay2026!`), summer promo code (`SUMMER2026`), and security lost-baggage reference (`SEC-REF-902`).
  * **Conditional Constraints (2/2 Passed):** Early check-in arrival cost calculations at 9:30 AM, and flexible 36-hour cancellation penalty calculation (50%).
  * **Multi-Turn Coreference (2/2 Passed):** Resolving pronouns and follow-up inquiries across conversational turns.
  * **Anti-Hallucination Guardrails (3/3 Passed):** Grounded refusal for prohibited exotic pets (snakes), and citation-suppressed refusals for non-existent amenities (Tesla Level 3 Superchargers, Bitcoin payments).
* **Result: 17/17 passed (100% success rate)**

### 4. Super Admin Surveillance & Observability QA (`npx tsx src/scripts/test-api-surveillance.ts`)
```bash
npx tsx src/scripts/test-api-surveillance.ts
```
* **Coverage:** Authenticates Super Admin via JWT; verifies `GET /admin/knowledge/chat-sessions`; verifies `GET /admin/knowledge/chat-sessions/:id` transcript retrieval; verifies `PATCH` status updates (`FLAGGED`, `RESOLVED`, `ACTIVE`).

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher
- **MongoDB:** Running instance on `mongodb://localhost:27017/ai_hotel_agent` or MongoDB Atlas
- **Pinecone Vector Database:** API key and index (`hotel-knowledge`)
- **OpenAI API:** API key with access to `gpt-4o` and `gpt-4o-mini`

### 2. Environment Configuration
Create a `.env` file in `backend/`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/ai_hotel_agent
JWT_ACCESS_SECRET=super_secret_access_jwt_key_2026_hotel_agent
JWT_REFRESH_SECRET=super_secret_refresh_jwt_key_2026_hotel_agent
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=hotel-knowledge
```

### 3. Database & Knowledge Seeding
To populate the database and vector index with the exact same data, 20 published properties, and rich knowledge manuals:

```bash
# One-command full turnkey setup (Seeds Users, 20 Properties, Rooms, Inventory, Curation & Knowledge):
npm run seed:all

# Or run individual seed steps:
npm run seed              # Seed base users and admin accounts
npm run seed:expanded     # Seed 20 domestic & international luxury properties
npm run seed:knowledge    # Seed Super Admin global policies & all 20 property manuals into Mongo + Pinecone
```

### 4. Running Verification Test Suites
Verify that data and retrieval are fully operational:

```bash
# Run 10-Case Retrieval & Grounding Quality Benchmark:
npm run test:retrieval

# Run 6-Case LangGraph Booking Agent Test Suite:
npm run test:agent
```

### 5. Running Development & Production Server
```bash
# Hot-reloading development server:
npm run dev

# Production build and run:
npm run build
npm start
```
* API Server: **`http://localhost:5000`**
* Health Check: **`http://localhost:5000/api/v1/health`**
