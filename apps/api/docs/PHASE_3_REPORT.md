# Phase 3 — Extract Media Pilot (Implementation Report)

**Status:** Code and deployment boundaries implemented; typecheck, unit,
architecture, Gateway component E2E, builds, and Compose validation pass.
Remaining owner actions are the live Media database migration, staging data
backfill/cutover/rollback rehearsal, Terraform apply, and browser/mobile tests.
**Scope:** `apps/services/media`, `apps/gateway`, Media integration in
`apps/api`, `packages/contracts`, local Compose, CI/CD, and Render Terraform
**Date:** 2026-06-24
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 3

---

## 1. Objective

Extract Image metadata and Cloudinary signing into the first independently
deployable business service while preserving the public HTTP contract:

- `GET /api/images`
- `POST /api/images`
- `GET /api/cloudinary/signature`

The extraction uses the strangler controls required for a short write freeze:
Gateway and legacy route ownership are separate flags, allowing a safe forward
cutover and a safe reverse synchronization before rollback.

## 2. Resulting topology

```text
Browser / Admin / Mobile
          |
          v
      Edge Gateway
       |       |
       |       +-- all other routes --> legacy API
       |
       +-- /api/images, /api/cloudinary
                 |
                 v  Nest TCP RPC
          private Media service ------> Media PostgreSQL
                 |
                 +---------------------> Cloudinary

Restaurant Catalog -- IMAGE_MANAGEMENT_PORT --> Media TCP RPC
```

Media receives the Media database URL and its Cloudinary credentials. The
legacy API never receives the Media database URL and retains its Cloudinary copy
only through the rollback window; Gateway receives neither secret. The Render
configuration provisions Media as a paid private service because Render private
services do not support the free compute plan.

## 3. Implementation

### 3.1 Versioned TCP contracts

`packages/contracts/src/media.ts` adds Zod-validated request, response, and
error contracts for:

| Pattern                             | Purpose                          |
| ----------------------------------- | -------------------------------- |
| `media.image.list.v1`               | Paginated image metadata read    |
| `media.image.create.v1`             | Idempotent image metadata create |
| `media.cloudinary.signature.get.v1` | Signed direct-upload parameters  |

The contracts contain wire-safe ISO timestamps and a stable error envelope.
No Media persistence or Cloudinary implementation leaks into the shared
package.

### 3.2 Private Media service

`apps/services/media` is a separate Nest application with:

- a Nest TCP listener for business traffic;
- separate HTTP `/live` and `/ready` management endpoints;
- an owned Drizzle `images` schema and migration;
- an `idempotency_key` unique constraint;
- Cloudinary folder validation and signature generation;
- production and development Dockerfiles;
- unit and real TCP/Postgres E2E suites;
- a dedicated CI/CD workflow and GHCR/Render deploy path.

Image create uses insert-on-conflict semantics. Replaying the same key and
payload returns the original row; reusing a key for different metadata returns
a typed conflict. Gateway and Catalog derive the same SHA-256 key from the
Cloudinary public ID, so retries and the existing two-step browser/Catalog flow
cannot create duplicate metadata rows.

### 3.3 Catalog adapter

Restaurant and Menu modules no longer import `ImageModule`. They bind
`IMAGE_MANAGEMENT_PORT` through `MediaClientModule`, which uses
`ClientProxy.send()` with:

- the versioned create pattern;
- a stable idempotency key;
- a per-attempt timeout;
- at most two attempts by default;
- no retry for typed 4xx errors;
- fail-fast startup connection when `MEDIA_RPC_REQUIRED=true`.

The architecture allowlist entry that permitted Restaurant Catalog to import
the Image context was removed.

### 3.4 Gateway route ownership

Gateway now owns the three public Media routes when
`MEDIA_ROUTES_ENABLED=true`. When false, the byte-preserving monolith proxy
continues to own them.

Compatibility controls:

- The HTTP DTO fields, validation rules, status codes, and response shapes are
  unchanged.
- `GET /api/images` remains anonymous.
- Protected routes validate the existing cookie/bearer session through the
  monolith's Better Auth `get-session` endpoint. Phase 4 can replace this
  transitional check with the signed internal identity contract.
- JSON parsing and CORS are enabled only for Gateway-owned Media routes; all
  unrelated proxy bodies remain untouched.
- `/ready` includes Media readiness only after Media route ownership is
  enabled.
- TCP errors map to stable HTTP 4xx/503/504 responses.

### 3.5 Legacy rollback control

The legacy Image module remains compiled during the rollback window so the
current OpenAPI baseline and previous topology remain available. Its routes are
guarded by `LEGACY_MEDIA_ROUTES_ENABLED`.

At production cutover Terraform sets the legacy flag false. Cloudinary
credentials remain on the API only through the rollback window, then are
removed. The legacy Cloudinary provider tolerates missing credentials only
while the legacy routes are disabled. This prevents a direct API deployment
from silently serving stub signatures.

### 3.6 Data migration and verification

`apps/services/media/scripts/sync-images.ts` supports:

- `source-to-target` backfill/catch-up;
- `target-to-source` rollback synchronization;
- idempotent UUID-preserving upserts;
- bounded primary-key batches;
- UTC-normalized timestamps;
- deterministic row-count and SHA-256 verification;
- verify-only mode and a non-zero exit when fingerprints differ.

The local Postgres initializer creates a separate `uitfood_media` database and
credential and revokes public database access. Render provisions a separate
Media Postgres resource and injects its internal URL only into the private Media
service.

## 4. Cutover and rollback procedure

### Forward cutover

1. Provision the Media database/private service with
   `media_routes_enabled=false` and `legacy_media_routes_enabled=true`.
2. Apply the Media migration and run an online `source-to-target` backfill.
3. Enter the short write freeze by setting
   `legacy_media_routes_enabled=false` while Gateway Media routing remains
   false. Media requests now fail closed instead of writing either database.
4. Run the final `source-to-target` sync and require matching counts and hashes.
5. Set `media_routes_enabled=true`, smoke all three routes, and end the freeze.
6. Observe Gateway/Media errors, latency, database load, and data fingerprints.
7. Keep the legacy table/code for the agreed rollback window, but keep legacy
   routes and credentials disabled.

### Rollback

1. Freeze Media writes by setting `media_routes_enabled=false` while legacy
   routes remain disabled.
2. Run `target-to-source` synchronization and require matching counts/hashes.
3. Restore the legacy Cloudinary credentials and set
   `legacy_media_routes_enabled=true`.
4. Re-run browser/mobile route tests and monitor the legacy database.

Do not enable legacy writes before reverse synchronization completes.

## 5. Infrastructure and delivery changes

- Workspace discovery includes `apps/services/*`.
- Local Compose starts Media, Gateway, the separate logical Media database, and
  routes Web/Admin traffic through Gateway.
- `pipeline-media.yml` runs lint, typecheck, unit tests, build, Media migration,
  and the real TCP/Postgres E2E before image publication.
- The reusable Docker workflow accepts a nonstandard Dockerfile path for
  `apps/services/media`.
- Render Terraform adds `render_private_service.media` and
  `render_postgres.media`, Media-only environment variables, private host/port
  wiring for API/Gateway, and the two cutover flags.
- The Terraform delivery workflow resolves the Media image URL/tag and reads
  the current tag from `render_private_service` state.

## 6. Verification performed

| Check                                                                | Result                                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Contracts typecheck/build                                            | Pass                                                                                                |
| Media lint/typecheck/build                                           | Pass                                                                                                |
| Media unit tests                                                     | 2 suites, 6 tests pass                                                                              |
| Gateway typecheck/build                                              | Pass                                                                                                |
| Gateway proxy + Media route E2E                                      | 2 suites, 13 tests pass                                                                             |
| API typecheck/build                                                  | Pass                                                                                                |
| API full unit/architecture suite                                     | 57 suites, 669 tests pass                                                                           |
| Focused Media adapter + architecture tests after final retry changes | 2 suites, 8 tests pass                                                                              |
| `docker compose ... config --quiet`                                  | Pass                                                                                                |
| `git diff --check`                                                   | Pass                                                                                                |
| Media TCP/Postgres E2E runtime                                       | Authored and CI-wired; local execution blocked because this environment denied Docker daemon access |
| Terraform fmt/validate                                               | CI-wired; local Terraform binary unavailable                                                        |

The three application builds passed earlier in the verification cycle. A final
repeat on Windows could not delete already-generated `dist` files (`EPERM`);
final source changes are covered by clean typechecks and the focused/E2E suites.

## 7. Exit criteria status

| Phase 3 criterion                                            | Status                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Media owns image writes; monolith cannot modify Media tables | Implemented by separate database/resource credentials and adapters; deployment proof pending Terraform apply/cutover |
| Upload/signature/image flows pass browser, mobile, and E2E   | Gateway/component E2E implemented; deployed browser/mobile and real TCP/Postgres run pending                         |
| Route rollback rehearsed with synchronized data              | Bidirectional sync, hash verification, flags, and procedure implemented; staging rehearsal pending                   |
| Cloudinary secrets removed from legacy API                   | Media receives its own copy; remove the API copy with legacy code after rollback retention                           |

## 8. Owner actions

- Add `RENDER_MEDIA_DEPLOY_HOOK`.
- Set `media_image_tag` and the Media Cloudinary variables in HCP
  Terraform/Render; retain the API copy only through rollback retention.
- Run Terraform fmt/validate/plan and apply the new database/private service.
- Run the Media migration and the forward sync against staging data.
- Execute the forward cutover and reverse rollback procedure once in staging.
- Run Web/Admin/Mobile upload, signature, metadata, restaurant image, and menu
  image flows through the deployed Gateway.
- Record row counts/hashes, latency/error comparison, and rollback timestamps as
  phase-gate evidence.
- After the rollback window, delete the legacy Image runtime module and remove
  the legacy `images` schema from the unified API migration surface.
