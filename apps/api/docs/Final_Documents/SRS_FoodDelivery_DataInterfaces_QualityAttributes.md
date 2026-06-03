# Software Requirements Specification — Continued

## SoLi / UITFood Food Delivery Platform

> **Scope of this document.** This file completes the Software Requirements Specification (SRS) for the platform. It supplements [`SRS_FoodDelivery.md`](./SRS_FoodDelivery.md), which contains Section 1 (Introduction), Section 2 (Functional Requirements — Use Cases UC-1 … UC-35) and Section 3 (Appendix — Message List). The sections below continue the numbering from Section 4 onward: data requirements, external interfaces, quality attributes, internationalization, other requirements, glossary, and analysis models.
>
> Requirement identifiers are provided so that each statement is individually traceable and verifiable. Targets are stated quantitatively where they can be measured.

---

## 4. Data Acquisition, Integrity, Retention, and Disposal

The platform is data-centric: it manages user accounts, restaurant catalogs, orders, payments, and delivery records. Authoritative business data lives in **PostgreSQL 18** (accessed through **Drizzle ORM**); transient and cache data live in **Redis**; binary media lives in **Cloudinary**.

### 4.1 Data Acquisition

| ID | Requirement |
|---|---|
| DATA-1 | Account, profile, restaurant, menu, address, and delivery-zone data **shall** be acquired through validated forms in the web, admin, and mobile clients. Every payload **shall** be validated server-side with DTO validation (class-validator) and client-side with Zod before persistence. |
| DATA-2 | Dish and restaurant images **shall** be acquired via **signed, direct-to-Cloudinary uploads**; the API issues a short-lived signature and never proxies the binary itself. Each stored image record **shall** capture `ownerId` and `ownerType`. |
| DATA-3 | Geographic coordinates for restaurant storefronts and delivery zones **shall** be acquired from the **Photon geocoding API** and stored as latitude/longitude; delivery reachability is computed via Haversine/PostGIS distance. |
| DATA-4 | Payment outcomes **shall** be acquired from **VNPay** through both the browser return URL and the server-to-server IPN callback; the IPN callback is treated as authoritative. |
| DATA-5 | Push-notification device tokens (FCM) **shall** be acquired from the mobile client on login and refreshed when the OS rotates them. |
| DATA-6 | Operational telemetry (traces, metrics, logs, RUM events) **shall** be acquired automatically by OpenTelemetry (API), Grafana Faro (web), and Sentry (mobile), without capturing payment card data or passwords. |

### 4.2 Data Integrity

| ID | Requirement |
|---|---|
| INT-1 | All multi-row business operations (order placement, payment settlement, refunds, status transitions) **shall** execute inside **PostgreSQL ACID transactions**; a failed step **shall** roll the whole operation back. |
| INT-2 | The database schema **shall** be evolved exclusively through **versioned Drizzle migrations** (`drizzle/out/`); ad-hoc production schema edits are prohibited. Referential integrity **shall** be enforced with foreign keys and unique constraints. |
| INT-3 | **Price snapshotting** — at checkout, the order **shall** persist a snapshot of every line-item price. Historical orders **shall** remain accurate even if the menu price later changes. |
| INT-4 | **Silent price-increase prevention** — if an Anti-Corruption-Layer (ACL) snapshot price exceeds the price held in the cart at checkout, the system **shall** reject placement with a conflict error rather than silently charging more. |
| INT-5 | **ACL snapshots** — the Ordering and Notification bounded contexts **shall** mirror the Restaurant/Menu data they depend on locally, so cross-context changes cannot corrupt in-flight orders. |
| INT-6 | VNPay callbacks **shall** be verified with the gateway **HMAC secure-hash** before any state change, and **shall** be processed idempotently so a duplicated callback cannot double-settle or double-refund an order. |
| INT-7 | Image deletion **shall** require ownership verification (`@Session()` matching `ownerId`) before the Cloudinary asset and its database record are removed. |
| INT-8 | Order-lifecycle state transitions **shall** be guarded so that only legal transitions occur (e.g., an order cannot move from `delivered` back to `preparing`). |

### 4.3 Backups, Checkpointing, and Mirroring

| ID | Requirement |
|---|---|
| BAK-1 | The managed **Render PostgreSQL** instance **shall** have automated backups enabled with point-in-time recovery (PITR); the recovery point objective (RPO) target is **≤ 24 hours** and the recovery time objective (RTO) target is **≤ 4 hours**. |
| BAK-2 | Redis **shall** be treated as a rebuildable cache and transient store (carts, sessions, rate-limit counters). It is **not** the system of record; loss of Redis **shall** degrade but not destroy business data. |
| BAK-3 | Cloudinary acts as the durable store and CDN for media; the application **shall not** keep a second authoritative copy of image binaries. |
| BAK-4 | Infrastructure shape **shall** be reproducible from Terraform (`infra/render/`) with remote state in HCP Terraform; runtime secrets are excluded from state. |

### 4.4 Data Retention

| ID | Requirement |
|---|---|
| RET-1 | **Financial and order records** (orders, payments, refunds, payout history) **shall** be retained for the period required by Vietnamese commercial and tax law (minimum **10 years** for accounting documents) and **shall not** be hard-deleted by ordinary user actions. |
| RET-2 | **Carts** are transient and **shall** be stored in Redis with a bounded **time-to-live (TTL)** and evicted automatically when abandoned. |
| RET-3 | **Authentication sessions** (better-auth cookies) **shall** expire after their configured lifetime; expired sessions **shall** be purged. |
| RET-4 | **Deleted menu items** referenced by historical orders **shall** be preserved logically through order snapshots (RET-1) even after they are removed from the live catalog. |
| RET-5 | **Notification records and audit logs** **shall** be retained for at least **12 months** to support dispute resolution and compliance. |
| RET-6 | **Telemetry** retention is governed by the Grafana Cloud / Sentry / PostHog plans and **shall not** retain personally identifying payloads beyond what those policies allow. |

### 4.5 Data Disposal

| ID | Requirement |
|---|---|
| DIS-1 | When a user requests account deletion, the platform **shall** delete or irreversibly anonymize personal data (name, contact details, addresses, device tokens) while retaining legally required transactional records in anonymized form. |
| DIS-2 | Image disposal **shall** remove both the Cloudinary asset and its database record, and **shall** be blocked for non-owners (INT-7). |
| DIS-3 | Residual data — orphaned cache entries, expired sessions, abandoned carts — **shall** be removed by TTL expiry or scheduled cleanup. |
| DIS-4 | Local copies and interim artifacts (CI build outputs, Docker layers, Turborepo cache) **shall not** contain production secrets and **shall** be disposable. |
| DIS-5 | Backup rotation **shall** ensure superseded backups are purged on the provider's retention schedule so disposed data is not indefinitely recoverable. |

---

## 5. External Interface Requirements

### 5.1 User Interfaces

The platform presents **three** distinct user-facing surfaces plus auto-generated API documentation.

| Surface | Audience | Stack |
|---|---|---|
| **Web restaurant portal** (`apps/web`) | Restaurant owners/managers | Vite 7 + React 19 + Tailwind v4 + shadcn/ui, served by nginx |
| **Admin panel** (`apps/admin`) | Platform administrators | Same as web (without RUM/product analytics) |
| **Mobile customer app** (`apps/mobile`) | Customers | Expo SDK 55 + React Native 0.83 + NativeWind v4 |

| ID | Requirement |
|---|---|
| UI-1 | All web/admin screens **shall** follow the shared **"Stitch" design system**: an `oklch` color palette (green primary, amber secondary), Plus Jakarta Sans headings + Inter body, Material Symbols iconography, and the documented glass/gradient/shadow utilities. |
| UI-2 | Layouts **shall** be responsive across the standard breakpoints (mobile ≥ 360 px through desktop ≥ 1280 px) and **shall** support light and dark themes via design tokens. |
| UI-3 | Every screen **shall** provide explicit **loading** (skeletons, not bare spinners), **empty**, and **error** states; transient failures use inline messages or toasts, never silent failure. |
| UI-4 | Form fields **shall** show the label above the input, helper text where useful, and validation errors below the field; placeholders **shall not** be used as the only label. |
| UI-5 | Interactive controls **shall** be keyboard-accessible and meet **WCAG 2.1 AA** contrast (≥ 4.5:1 body text, ≥ 3:1 large text); primary actions provide a visible focus ring and an active/pressed state. |
| UI-6 | A consistent global navigation (sidebar on web/admin, bottom tab bar on mobile) and a consistent primary call-to-action label per intent **shall** be used across the product. |
| UI-7 | Detailed visual specifications are maintained separately in the design system / `design.md`; this SRS references them rather than duplicating pixel-level detail. |

### 5.2 Software Interfaces

The API (`apps/api`, NestJS 11 on Node 22, listening on port 3000) is the integration hub. It exposes REST + WebSocket and consumes several managed services.

| ID | Interface | Direction | Purpose / Format / Notes |
|---|---|---|---|
| SI-1 | **REST API (HTTP/JSON)** | Clients → API | All CRUD and command operations. JSON request/response. Interactive contract published via **Swagger / Scalar at `/api/docs`**. Authenticated with better-auth cookies (`withCredentials`). |
| SI-2 | **WebSocket (Socket.IO)** | API ↔ Clients | Real-time order-status and notification events (new order to restaurant, status changes to customer/shipper). Event-based JSON messages. |
| SI-3 | **PostgreSQL 18** (via Drizzle ORM) | API ↔ DB | System of record. Connection via `DATABASE_URL`; access only through Drizzle repositories. |
| SI-4 | **Redis** (ioredis) | API ↔ Cache | Transient cart, session assistance, rate-limit counters, ephemeral state. Connection via `REDIS_URL`/`REDIS_HOST`. |
| SI-5 | **Cloudinary** (REST + signed upload) | Clients → Cloudinary, API → Cloudinary | Image storage, transformation, and CDN delivery. API issues signed upload params; deletion via API with ownership check. |
| SI-6 | **VNPay payment gateway** | API ↔ VNPay | Online payment. Browser redirect to VNPay + server-side **IPN** callback. HMAC `vnp_SecureHash` verification mandatory. Currency in VND. |
| SI-7 | **Photon geocoding API** | API → Photon | Address → coordinate resolution for storefronts and delivery zones. REST/JSON. |
| SI-8 | **Firebase Cloud Messaging (FCM)** | API → FCM → Devices | Push notifications to the mobile app. Device tokens managed per device. |
| SI-9 | **SMTP email service** | API → SMTP | Transactional email (verification, status, receipts). Configured via `SMTP_*`. |
| SI-10 | **better-auth** | API + Clients | Authentication/session management (cookie-based on web/admin, `@better-auth/expo` on mobile), role utilities (`user`, `restaurant`, `shipper`, `admin`). |
| SI-11 | **Grafana Cloud (OTLP)** | API → Grafana | Traces, metrics, logs over OpenTelemetry Protocol. |
| SI-12 | **Grafana Faro / PostHog / Sentry** | Clients → SaaS | Web RUM + product analytics (web), crash/perf monitoring (mobile). |

| ID | Cross-cutting interface requirement |
|---|---|
| SI-13 | Communication between bounded contexts **shall** follow the documented patterns: **ACL snapshots** for core domains (Ordering, Notification) and the **public-API/interface-symbol pattern** for support domains (Payment, IAM, Image). Contexts **shall not** read or write another context's tables directly. |
| SI-14 | Money amounts crossing any interface **shall** be expressed as **integer VND** (đồng, no fractional units). |
| SI-15 | Outbound calls to third-party services (VNPay, Photon, Cloudinary, FCM, SMTP) **shall** apply timeouts and, where the operation is user-visible (notifications), a **background retry** with backoff on failure. |
| SI-16 | The API **shall** restrict cross-origin requests to the configured client origins (CORS allowlist) and require credentials for authenticated routes. |

### 5.3 Hardware Interfaces

The platform is cloud-hosted software with no proprietary hardware; the relevant hardware interactions are on client devices.

| ID | Requirement |
|---|---|
| HW-1 | The mobile app **shall** access the device **GPS/location** services to determine the customer's delivery position and to support shipper navigation; permission **shall** be requested at point of use. |
| HW-2 | The mobile app **shall** access the device **camera/photo library** (where a feature requires an image) and the **notification subsystem** for FCM push delivery. |
| HW-3 | Web/admin clients require only a standard input device (keyboard/pointer or touch) and a modern browser; no specialized peripherals are required. |
| HW-4 | Server components run on the cloud provider's virtualized compute (Render); no direct physical-hardware interface requirements apply to the backend. |

### 5.4 Communications Interfaces

| ID | Requirement |
|---|---|
| COM-1 | All client-server traffic **shall** use **HTTPS/TLS 1.2+**; WebSocket traffic **shall** use **WSS**. Plain HTTP is permitted only for local development. |
| COM-2 | Session cookies **shall** be issued with `Secure`, `HttpOnly`, and an appropriate `SameSite` policy; cross-site authenticated requests require `credentials: 'include'`. |
| COM-3 | Email **shall** be sent over authenticated SMTP (TLS); push **shall** be delivered over FCM's HTTPS transport. |
| COM-4 | The VNPay redirect and IPN exchange **shall** carry the HMAC secure hash; the API **shall** reject any message whose signature does not validate. |
| COM-5 | Real-time delivery (WebSocket) **shall** target an end-to-end event latency of **≤ 2 seconds** under nominal load and **shall** reconnect automatically after transient disconnects. |
| COM-6 | Telemetry export **shall** use OTLP over HTTPS to Grafana Cloud; failures to export telemetry **shall not** block or degrade business request handling. |

---

## 6. Quality Attributes

### 6.1 Usability

| ID | Requirement |
|---|---|
| USE-1 | A new restaurant owner **shall** be able to register, create a profile, add a first menu item (with photo), and define a delivery zone **without external assistance**, guided by in-product flows. |
| USE-2 | The product **shall** conform to the Stitch design system (UI-1) for visual and interaction consistency, minimizing relearning across screens. |
| USE-3 | The UI **shall** meet **WCAG 2.1 AA** accessibility (contrast, keyboard operability, focus visibility, semantic structure). |
| USE-4 | Destructive actions (delete menu item, cancel order, suspend account) **shall** require explicit confirmation and **shall** be recoverable or clearly final by design. |
| USE-5 | All user-facing currency, dates, and numbers **shall** be formatted per the customer locale (see Section 7). |

### 6.2 Performance

| ID | Requirement |
|---|---|
| PERF-1 | For read endpoints under nominal load, the API **shall** return a response with a **p95 latency ≤ 300 ms** and **p99 ≤ 800 ms**, excluding third-party gateway time. |
| PERF-2 | Write/command endpoints (place order, accept order) **shall** complete with a **p95 ≤ 700 ms**, excluding external payment gateway round-trips. |
| PERF-3 | Web pages **shall** target Core Web Vitals of **LCP ≤ 2.5 s**, **INP ≤ 200 ms**, and **CLS ≤ 0.1** on a mid-range device over a typical 4G connection. |
| PERF-4 | Real-time order/notification events **shall** be delivered within **≤ 2 s** (COM-5). |
| PERF-5 | The system **shall** sustain at least **500 concurrent active users** and **50 order placements per minute** without breaching PERF-1/PERF-2, scaling horizontally if exceeded. |
| PERF-6 | Hot read paths (restaurant lists, menus, carts) **shall** use Redis caching and database indexing to meet PERF-1. |

### 6.3 Security

| ID | Requirement |
|---|---|
| SEC-1 | Authentication **shall** be handled by **better-auth**; passwords **shall** be stored only as salted one-way hashes, never in plaintext or reversibly. |
| SEC-2 | Authorization **shall** be role-based using the global `AuthGuard` and `@Roles([...])` decorators for the roles `user`, `restaurant`, `shipper`, `admin`; every protected endpoint **shall** enforce both authentication and the correct role. |
| SEC-3 | Resource-level ownership **shall** be enforced (e.g., a restaurant can only mutate its own menu; an image can only be deleted by its owner). |
| SEC-4 | All input **shall** be validated and sanitized server-side; the ORM **shall** be used in a way that prevents SQL injection (parameterized queries only). |
| SEC-5 | Secrets (`BETTER_AUTH_SECRET`, `CLOUDINARY_*`, `VNPAY_*`, `SMTP_*`, DB/Redis credentials) **shall** be stored in Render service settings / environment groups and **shall never** be committed to the repository or Terraform state. |
| SEC-6 | Payment integrity **shall** be protected by VNPay HMAC verification and idempotent settlement (INT-6); the platform **shall not** store raw card data. |
| SEC-7 | Transport **shall** be encrypted end-to-end (COM-1); CORS **shall** be restricted to known origins (SI-16). |
| SEC-8 | The platform **shall** apply rate limiting / abuse protection on authentication and ordering endpoints. |
| SEC-9 | The product **shall** align with **OWASP Top 10** mitigations and with Vietnam's Personal Data Protection Decree (PDPD 13/2023) for handling of personal data. |

### 6.4 Safety

The product is commerce software and is not life-critical, but it manages money, food, and field workers.

| ID | Requirement |
|---|---|
| SAF-1 | The system **shall** prevent financial harm by guaranteeing payment correctness: no double-charge, no double-refund, and no charge without a corresponding confirmed order (INT-6, INT-3). |
| SAF-2 | Where dietary or allergen information is provided by a restaurant, the system **shall** display it accurately on the item detail screen and **shall not** silently drop it. |
| SAF-3 | The system **shall not** instruct or require shippers to perform unsafe actions; navigation and assignment features are advisory and **shall** respect driver acceptance/availability controls. |
| SAF-4 | Administrative suspension/reactivation of partner accounts **shall** take effect immediately to allow rapid response to unsafe or fraudulent behavior. |

### 6.5 Other Quality Attributes

| ID | Attribute | Requirement |
|---|---|---|
| AVL-1 | **Availability** | Target service availability of **≥ 99.5%** monthly for the API and web portal, supported by provider health checks and automatic restart; telemetry failures **shall not** affect availability. |
| REL-1 | **Reliability** | Critical asynchronous actions (notifications) **shall** use a self-healing background retry; failed FCM/SMTP sends **shall** be retried with backoff. |
| SCA-1 | **Scalability** | The API **shall** be stateless (shared state in Postgres/Redis) so it can scale horizontally behind the provider's load balancing. |
| MNT-1 | **Maintainability / Modifiability** | The codebase **shall** preserve DDD bounded-context boundaries (Section 5.2, SI-13) and pass lint, type-check, unit, and E2E gates in CI before merge. |
| OBS-1 | **Observability** | The system **shall** emit traces, metrics, and logs (OpenTelemetry → Grafana Cloud), web RUM (Faro), and mobile crash reporting (Sentry). |
| INT-OP-1 | **Interoperability** | External integration **shall** use standard REST/JSON, WebSocket, OTLP, and SMTP so components can be replaced without bespoke protocols. |
| PORT-1 | **Portability** | Backend and frontends **shall** be containerized (Docker, GHCR images) so they can be deployed to any compatible container host. |

> **Priority note:** when attributes conflict, the resolution order is **Security and data Integrity > Reliability/Availability > Performance > convenience/Usability polish**. For example, payment-integrity checks (INT-6) take precedence over shaving latency (PERF-2).

---

## 7. Internationalization and Localization Requirements

The platform's primary market is **Vietnam**.

| ID | Requirement |
|---|---|
| I18N-1 | **Currency** — all monetary values **shall** be Vietnamese đồng (VND), stored and transmitted as **integers** (no decimal subunit) and displayed with thousands separators and the `₫` symbol (e.g., `135,000 ₫`). |
| I18N-2 | **Language** — the product **shall** support **Vietnamese (primary)** and **English (secondary)** user-facing text, with full **UTF-8** support for Vietnamese diacritics in names, addresses, and dish titles. |
| I18N-3 | **Dates & times** — timestamps **shall** be stored in UTC and presented in the **Asia/Ho_Chi_Minh (UTC+7)** timezone using locale-appropriate date/number formats. |
| I18N-4 | **Names** — the system **shall** accommodate Vietnamese name ordering (family name first) and **shall not** assume a Western given-name/surname split that would corrupt display. |
| I18N-5 | **Addresses & phone numbers** — address capture **shall** follow Vietnamese conventions (ward/district/province) and phone numbers **shall** accept the `+84` / local `0…` formats. |
| I18N-6 | **Units** — distances and delivery radii **shall** use the **metric** system (kilometers); measurements **shall** be metric throughout. |
| I18N-7 | **Localization isolation** — user-facing strings **shall** be externalized so additional locales can be added without code changes to business logic. |

---

## 8. Other Requirements

### 8.1 Legal, Regulatory, and Compliance

| ID | Requirement |
|---|---|
| LEG-1 | The platform **shall** comply with Vietnam's **Personal Data Protection Decree (PDPD 13/2023/ND-CP)** regarding consent, access, and deletion of personal data (supports DIS-1). |
| LEG-2 | Online payment **shall** be conducted through the licensed **VNPay** gateway in conformance with State Bank of Vietnam payment regulations; the platform itself **shall not** become a card data processor. |
| LEG-3 | Order and payment records **shall** be retained for the legally mandated accounting period (RET-1) to support tax and audit obligations. |
| LEG-4 | E-commerce operation **shall** observe Vietnam's decrees on e-commerce activity (information disclosure, dispute handling). |

### 8.2 Installation, Configuration, Startup, and Shutdown

| ID | Requirement |
|---|---|
| OPS-1 | Local infrastructure (PostgreSQL 18 + Redis) **shall** be brought up via `docker compose up -d`; applications run via Turborepo (`pnpm dev`). |
| OPS-2 | Configuration **shall** be supplied through environment variables (`.env`), documented in `ARCHITECTURE.md`; no environment-specific values **shall** be hard-coded. |
| OPS-3 | Database schema **shall** be applied via migrations (`pnpm --filter api db:migrate` / `db:push` in CI) before the API serves traffic. |
| OPS-4 | The API **shall** bootstrap OpenTelemetry **before** the application (`node --require ./dist/telemetry dist/main`) so startup is fully traced. |
| OPS-5 | Deployment **shall** be automated through GitHub Actions → GHCR Docker images → Render deploy hooks, with infrastructure shape governed by Terraform. |

### 8.3 Logging, Monitoring, and Audit Trail

| ID | Requirement |
|---|---|
| LOG-1 | The API **shall** emit structured logs and distributed traces correlating a request across bounded contexts. |
| LOG-2 | **Administrative actions** (approvals, suspensions, manual cancellations/refunds, role changes) **shall** be recorded in an audit trail capturing actor, action, target, and timestamp, retained per RET-5. |
| LOG-3 | Logs and telemetry **shall not** record secrets, passwords, full payment credentials, or unnecessary personal data. |
| LOG-4 | Platform health (order volume, error rates, restaurant online/offline) **shall** be observable through dashboards for administrators (supports UC-30/UC-34). |

---

## 9. Glossary

| Term | Definition |
|---|---|
| **ACL (Anti-Corruption Layer)** | A pattern where a bounded context keeps a local snapshot/translation of another context's data to avoid direct coupling. |
| **Admin** | Platform-staff role with governance privileges (approvals, suspensions, reports). |
| **ASR** | Architecturally Significant Requirement. |
| **Bounded Context (BC)** | A DDD boundary owning its own model and tables (e.g., Ordering, Payment, Notification). |
| **CDN** | Content Delivery Network (Cloudinary serves media via CDN). |
| **CORS** | Cross-Origin Resource Sharing; the API restricts which web origins may call it. |
| **CQRS** | Command Query Responsibility Segregation; separating write commands from read queries. |
| **DDD** | Domain-Driven Design. |
| **DTO** | Data Transfer Object; validated request/response shape. |
| **FCM** | Firebase Cloud Messaging; Google's push-notification transport. |
| **GMV** | Gross Merchandise Value; total order value flowing through the platform. |
| **HMAC** | Hash-based Message Authentication Code; used to verify VNPay messages. |
| **IAM** | Identity and Access Management. |
| **IPN** | Instant Payment Notification; VNPay's server-to-server callback. |
| **OTLP** | OpenTelemetry Protocol; transport for traces/metrics/logs. |
| **PDPD** | Personal Data Protection Decree (Vietnam, 13/2023/ND-CP). |
| **PITR** | Point-In-Time Recovery for databases. |
| **RPO / RTO** | Recovery Point Objective / Recovery Time Objective. |
| **RUM** | Real-User Monitoring (Grafana Faro on the web client). |
| **Shipper** | Delivery-driver role responsible for picking up and delivering orders. |
| **SPA** | Single-Page Application (the web and admin clients). |
| **SRS** | Software Requirements Specification (this document family). |
| **TTL** | Time-To-Live; expiry duration for transient data (carts, sessions). |
| **VND (đồng)** | Vietnamese currency; integer-only amounts in this system. |
| **VNPay** | Vietnamese online payment gateway integrated for online payments. |
| **WCAG** | Web Content Accessibility Guidelines (target level AA). |
| **WSS** | WebSocket Secure (TLS-encrypted WebSocket). |

---

## 10. Analysis Models

The following models support and illustrate the requirements above. They are maintained as separate artifacts and incorporated here by reference.

| Model | Artifact | Describes |
|---|---|---|
| **System / API architecture** | [`docs/api-architecture.mmd`](../../../../docs/api-architecture.mmd) | Bounded contexts, modules, and their communication patterns (ACL vs public-API). |
| **Repository / project structure** | [`docs/project-structure.mmd`](../../../../docs/project-structure.mmd) | Monorepo layout of `apps/` and `infra/`. |
| **Local dev environment** | [`docs/docker-dev-environment.mmd`](../../../../docs/docker-dev-environment.mmd) | Compose topology (Postgres + Redis). |
| **Sequence diagrams** | [`SRS_SequenceDiagrams.md`](./SRS_SequenceDiagrams.md) | Interaction flows for key use cases (ordering, payment, delivery). |
| **Use-case diagrams** | [`UC diagrams/`](./UC%20diagrams/) | Actor-to-use-case relationships for UC-1 … UC-35. |
| **Bounded-context model** | [`bounded-context.md`](../bounded-context.md) | Context map and ownership of domain concepts. |
| **Data model (ERD)** | `apps/api/src/drizzle/schema.ts` | Authoritative entity/relationship definitions in Drizzle ORM. |
| **Quality-attribute (utility) tree** | [`Utility-Tree-ASRs.md`](./Utility-Tree-ASRs.md) | Architecturally significant requirements and their scenarios. |

---

*End of SRS continuation. Sections 1–3 are in [`SRS_FoodDelivery.md`](./SRS_FoodDelivery.md).*
