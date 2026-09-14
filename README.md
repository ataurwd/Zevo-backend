# NEXORA Backend API Server

> High-performance, production-grade Modular Monolith API powering the NEXORA Multi-Vendor Commerce and Hyperlocal Logistics platform. Built with Express.js, TypeScript, MongoDB Native Driver, Redis, BullMQ, and Socket.IO.

---

## 🏛️ System Architecture

The backend follows a **Modular Monolith** architecture where each domain is encapsulated inside `src/modules/<domain>` with clean separation between Controllers, Services, Repositories, Validators (Zod), and Types.

```
src/
├── app.ts                  # Express application setup, security middlewares, routing
├── server.ts               # HTTP & Socket.IO server initialization & graceful shutdown
├── routes/                 # Master router aggregation
├── modules/                # Domain-Driven Feature Modules
│   ├── analytics/          # Multi-tenant business intelligence & aggregation pipelines
│   ├── audit/              # Security-critical forensic audit trails
│   ├── auth/               # Identity, JWT, password reset, rate-limiting
│   ├── cart/               # Redis-primary cart with guest-to-user merging
│   ├── categories/         # Hierarchical category trees
│   ├── chat/               # Real-time WebSocket messaging between participants
│   ├── coupons/            # Vendor promotion engines with atomic usage limits
│   ├── delivery/           # Hyperlocal driver assignment, geospatial telematics
│   ├── health/             # Liveness, readiness, and Prometheus `/metrics` exporter
│   ├── inventory/          # SKU tracking with atomic reservation & rollback
│   ├── notifications/      # In-app notifications with TTL expiration
│   ├── orders/             # Multi-vendor split orders & state machine
│   ├── payments/           # Stripe Connect, webhook idempotency, refunds
│   ├── products/           # Catalog management with variants & moderation
│   ├── reviews/            # Verified-purchase ratings with atomic stat recalculation
│   ├── sellers/            # Merchant verification & Stripe Connect onboarding
│   ├── stores/             # Vendor storefront profiles
│   ├── users/              # Profiles, avatar uploads, and address books
│   └── withdrawals/        # Seller payout request ledger & treasury review
├── infrastructure/         # External service drivers & singletons
│   ├── db/                 # MongoDB native client & connection pool
│   ├── redis/              # ioredis client & centralized key patterns
│   ├── queue/              # BullMQ queue instances & background workers
│   ├── socket/             # Socket.IO gateway, JWT authentication, and rooms
│   ├── services/           # Stripe & third-party integrations
│   └── metrics.ts          # Prometheus metrics registry (prom-client)
├── shared/                 # Common middlewares, errors, response wrappers, and utilities
└── tests/                  # 20 Automated Vitest test suites (Unit, Integration, Security)
```

---

## 🚀 Key Technical Highlights

1. **Two-Phase Inventory Reservation:** Prevents overselling during high-traffic drops. Atomic conditional updates (`$inc: { reserved_quantity }`) reserve stock during order creation, and commit upon payment confirmation or release on expiration/cancellation.
2. **Multi-Vendor Sub-Order Splitting:** A single customer checkout atomically splits into distinct vendor sub-orders with independent status lifecycles, commission deductions, and automated rider dispatch.
3. **Hyperlocal Geospatial Dispatch:** Drivers broadcast GPS coordinates into Redis (`GEOADD`). BullMQ proximity workers search nearby riders within a 5km–15km radius using Redis `GEORADIUS` / `GEOSEARCH` with distributed locks (`lock:assignment:${riderId}`).
4. **Resilient Real-time Socket.IO Gateway:** Handshake JWT validation with granular room segmentation (`user:{id}`, `order:{id}`, `delivery:{id}`, `admin:room`, `riders:active`).
5. **Observability & Metrics:** Built-in Prometheus metrics exporter at `GET /metrics` and `GET /api/v1/health/metrics` exposing HTTP request latencies, active orders gauge, BullMQ job processing times, and Redis cache hit/miss counters.
6. **Hardened Security:** OWASP Top 10 mitigations, Helmet security headers, CORS origin whitelisting, Zod input validation preventing NoSQL operator injection, and IDOR protection verifying resource ownership.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 20.0.0
- MongoDB 7.0+ (Replica Set required for transactions)
- Redis 7.2+

### Installation & Development
```bash
# Install dependencies
npm install

# Start development server with hot-reload (tsx)
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Execute Vitest test suites
npm test -- --run
```

---

## 📊 Environment Variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | API listen port | `5000` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `MONGODB_URI` | MongoDB Connection String | `mongodb://localhost:27017/nexora?replicaSet=rs0` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | 32+ char secret for Access Tokens | `your-32-char-access-secret-key` |
| `JWT_REFRESH_SECRET` | 32+ char secret for Refresh Tokens | `your-32-char-refresh-secret-key` |
| `STRIPE_SECRET_KEY` | Stripe Secret API Key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Signing Secret | `whsec_...` |
| `CORS_ORIGIN` | Allowed CORS Origins | `http://localhost:3000,https://nexora.com` |

---

## 🧪 Test Suite Summary

The backend contains **20 comprehensive Vitest test suites** with **96 passing automated tests**:

```bash
✓ src/tests/password.test.ts
✓ src/tests/jwt.test.ts
✓ src/tests/health.test.ts
✓ src/tests/auth.test.ts
✓ src/tests/users.test.ts
✓ src/tests/sellers.test.ts
✓ src/tests/stores.test.ts
✓ src/tests/categories.test.ts
✓ src/tests/products.test.ts
✓ src/tests/inventory.test.ts
✓ src/tests/cart.test.ts
✓ src/tests/orders.test.ts
✓ src/tests/payments.test.ts
✓ src/tests/notifications.test.ts
✓ src/tests/delivery.test.ts
✓ src/tests/chat.test.ts
✓ src/tests/reviews.test.ts
✓ src/tests/coupons.test.ts
✓ src/tests/analytics.test.ts
✓ src/tests/withdrawals.test.ts
✓ src/tests/security.test.ts

Test Files  20 passed (20)
     Tests  96 passed (96)
```
