# Software Development, Operation and Maintenance Report Proposal

This file is a proposal and blueprint for the final course report. It is not the final report. Its purpose is to challenge the structure, select the strongest evidence, prevent overclaiming, and guide a final report that is balanced across software development, operation, and maintenance.

## 1. Executive Summary

The final report should tell one coherent engineering story: SoLi Food is not only a food-ordering application, but a maintained software product with requirements traceability, modular architecture, tested business workflows, CI/CD automation, deployment infrastructure, runtime observability, and an honest maintenance roadmap.

Recommended thesis:

> From requirements to maintainable operations: SoLi Food is a modular-monolith food delivery platform whose critical workflows are implemented through bounded contexts, transactional persistence, Redis runtime state, event-driven collaboration, CI/CD validation gates, Docker/Render deployment, and operational telemetry across API, web, admin, and mobile surfaces.

The final report should target 80-120 pages, with about 100 pages preferred. The increase from the previous draft should come from deeper evidence, diagrams, scenarios, implementation excerpts, validation results, operational runbooks, and trade-off analysis, not filler.

Recommended balance:

| Area                              | Weight | Reason                                                                                     |
| --------------------------------- | -----: | ------------------------------------------------------------------------------------------ |
| Product context and requirements  |    14% | Establishes what the platform is supposed to do, who uses it, and how scope is controlled. |
| Architecture and design decisions |    20% | Shows the five primary views, official ADRs, engineering decisions, and trade-offs.        |
| Implementation evidence           |    22% | Proves that the architecture exists in code and is not only documentation.                 |
| Verification and validation       |    14% | Shows tests, lint, typecheck, build, audit, E2E, and recent defect fixes.                  |
| Operation and deployment          |    16% | Covers CI/CD, Docker, GHCR, Render, Terraform, secrets, health checks, and observability.  |
| Maintenance and evolution         |    14% | Shows supportability, operability, risks, known gaps, and planned improvements.            |

Important honesty constraints:

| Topic                  | Proposal position                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend core workflows | Strong enough to be the center of the final report: checkout, payment, promotion, notification, review, restaurant catalog, order lifecycle, and API tests.                                                                       |
| Web/admin/mobile apps  | Functional application surfaces with lint/typecheck/build validation, but automated tests are currently placeholders or limited. Treat this as a maintenance gap.                                                                 |
| UC-22 review           | Current source code shows ReviewModule and SubmitReviewHandler are implemented. Older documents that describe UC-22 as planned should be treated as stale.                                                                        |
| Observability          | API telemetry, JSON logs, request IDs, route grouping, Grafana Cloud export configuration, web Faro, mobile Sentry, and PostHog are report strengths. Do not claim full production alert maturity unless final evidence is added. |
| Admin/governance scope | Use admin audit and order-status audit trails as maintenance evidence, but distinguish implemented governance from roadmap items.                                                                                                 |
| Shipper/reporting gaps | Present incomplete shipper onboarding, reporting, backup, load testing, and UI automation as roadmap items, not delivered core capabilities.                                                                                      |

Executive recommendation: build the final report around a small number of evidence-rich workflows rather than trying to cover every use case equally. The strongest core story is checkout, VNPay IPN, Submit Rating & Review, notification delivery, CI/CD, observability, testing, and maintenance governance.

## 2. Recommended Report Structure

Use an 8-chapter report with front matter. Keep the report close to 100 pages. If the final writing grows beyond 120 pages, move raw tables, logs, and long code excerpts into appendices.

Recommended page allocation:

| Part         | Title                                                                                   | Purpose                                                                                                               | Suggested pages |
| ------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------: |
| Front matter | Cover page, declaration, abstract, Project Contribution Matrix, contents, abbreviations | Helps the lecturer navigate the report quickly and assess team participation transparently.                           |               5 |
| 1            | Introduction and Project Context                                                        | Problem domain, stakeholders, report scope, technology overview, and System Context Diagram.                          |              10 |
| 2            | Requirements and Scope Traceability                                                     | Business goals, user roles, use-case groups, business rules, acceptance criteria, implemented/partial/missing matrix. |              12 |
| 3            | Architecture and Design Decisions                                                       | Five primary views, official ADRs, significant engineering decisions, quality-attribute design rationale.             |              16 |
| 4            | Implementation Evidence by Subsystem                                                    | Ordering, payment, promotion, notification, review, catalog, admin, web, mobile, and infrastructure evidence.         |              17 |
| 5            | Verification and Validation                                                             | Unit tests, E2E tests, lint, typecheck, audit, build, CI gates, and defect analysis.                                  |              12 |
| 6            | Operation, Deployment, and Observability                                                | Docker, GitHub Actions, Turbo affected validation, GHCR, Render, Terraform, health checks, telemetry, runbook.        |              14 |
| 7            | Maintenance, Risks, and Evolution Plan                                                  | Maintainability, test gaps, supportability, operability, known risks, roadmap, technical debt.                        |              10 |
| 8            | Conclusion and Demonstration Package                                                    | Summary, Technical Lessons Learned, demo script, evidence checklist, final roadmap.                                   |               4 |
| Total        | Preferred final report size                                                             | Fits the requested 80-120 page window while aiming near 100 pages.                                                    |             100 |

### Front Matter Enhancement: Project Contribution Matrix

The final report should include a dedicated Front Matter section titled `Project Contribution Matrix`.

Recommended placement:

- immediately after Cover Page
- immediately after Declaration
- immediately after Abstract
- before Table of Contents

Why this section is important:

- It makes team responsibilities explicit instead of leaving contribution claims scattered across the report.
- It helps lecturers evaluate participation fairly by linking each member to concrete responsibilities and deliverables.
- It strengthens the Software Development and Maintenance story because it shows ownership boundaries, execution scope, and accountability.

Recommended structure:

| Team Member | Responsibilities   | Main Deliverables      |
| ----------- | ------------------ | ---------------------- |
| Member A    | Ordering, Payment  | Checkout, VNPay        |
| Member B    | Restaurant Catalog | Menu, Search           |
| Member C    | Mobile App         | Android Client         |
| Member D    | Testing & DevOps   | Unit Tests, E2E, CI/CD |

Use placeholders in the proposal and replace them with actual names only in the final report. If the team has more or fewer members, expand or reduce the rows but preserve the same structure.

Recommendation for the final report: keep the matrix concise, usually about half a page to one page, and focus on responsibilities plus tangible deliverables rather than vague labels such as "backend support" or "helped testing".

### Chapter 8 Enhancement: Technical Lessons Learned

The current outline already includes a lessons-learned subsection, but it should be expanded and renamed as `Technical Lessons Learned` to demonstrate engineering maturity rather than simply list technologies used.

Within the existing Chapter 8 page budget, reserve about 1.5-2 pages for this subsection and make the writing reflective, evidence-based, and improvement-oriented.

Recommended lesson categories:

| Category     | Example themes to discuss                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Architecture | Modular Monolith trade-offs, Bounded Context design, event-driven collaboration, Ports & Adapters.              |
| Development  | CQRS adoption, code organization, refactoring challenges, team collaboration and ownership boundaries.          |
| Testing      | Unit testing strategy, E2E testing strategy, mocking pitfalls, regression prevention.                           |
| Operation    | CI/CD experience, Docker deployment, environment management, observability setup.                               |
| Maintenance  | Technical debt discovery, refactoring opportunities, monitoring production issues, maintaining large codebases. |

Recommended reflection format for each category:

| Reflection field      | What the final report should capture                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Challenge encountered | What problem, friction, or failure the team faced.                                              |
| Solution adopted      | What design change, process improvement, test strategy, or operational practice was introduced. |
| Outcome               | What improved in quality, speed, confidence, maintainability, or reliability.                   |
| Future improvement    | What should still be refined in the next iteration.                                             |

The key recommendation is to avoid writing this section as a technology inventory. The stronger approach is to explain what was difficult, how the team responded, what result was achieved, and what should be improved next.

### Chapter 1 Must Include 1.x System Context Diagram

Move the Context View recommendation into Chapter 1 as an orientation artifact, not as a deep architecture artifact. Recommended subsection:

`1.6 System Context Diagram`

The diagram should show the system boundary and the external actors/systems before the report dives into architecture. It should include:

| Element                  | Role in the context diagram                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Customer                 | Discovers restaurants, manages cart, places orders, pays, tracks status, submits rating/review.                        |
| Restaurant Owner         | Manages restaurant profile, menu, availability, promotions, and order acceptance.                                      |
| Shipper                  | Receives pickup/delivery responsibilities and updates delivery state.                                                  |
| Admin                    | Governs approvals, operational monitoring, partner actions, and policy controls.                                       |
| Food Delivery Platform   | The SoLi system boundary containing API, web/admin/mobile clients, persistence, runtime state, and business workflows. |
| VNPay                    | External online payment gateway for payment redirect and authoritative IPN confirmation.                               |
| Cloudinary               | External image storage/CDN for restaurant and menu media.                                                              |
| Notification Providers   | External FCM/email providers plus in-app WebSocket delivery path.                                                      |
| Hosting / Infrastructure | Render, PostgreSQL, Redis, GHCR images, GitHub Actions, Terraform-managed resources, and observability backends.       |

This Context View should not show NestJS modules, database tables, or internal components. It exists to orient the reader: who interacts with SoLi, which external systems matter, and what boundary the report covers.

Recommended implementation completeness matrix:

| Area                     | Current evidence                                                                                                   | Report treatment                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Ordering and checkout    | Redis cart, checkout lock, idempotency key, ACL snapshots, Drizzle transaction, promotion/payment ports.           | Core success case.                         |
| VNPay payment            | HMAC verification before state mutation, amount checking, terminal-state idempotency, optimistic locking, events.  | Reliability and external-integration case. |
| Notification             | In-app/email/push abstraction, preferences, quiet hours, WebSocket gateway, Noop/Stub fallback, delivery logs.     | Hidden gem and operations case.            |
| Review UC-22             | ReviewModule, eligibility port, duplicate protection, rating projection, ReviewSubmittedEvent, owner notification. | Completed traceability case.               |
| API testing              | Unit tests and E2E tests exercise high-risk business rules with PostgreSQL/Redis in CI.                            | Validation strength.                       |
| Web/admin/mobile testing | Lint/typecheck/build exist; automated tests are not yet mature.                                                    | QA gap and roadmap item.                   |
| Admin governance         | Role checks, order status logs, admin analytics, audit-oriented docs and partial implementation.                   | Traceability and maintenance evidence.     |
| Shipper/reporting flows  | Some lifecycle states exist, but onboarding/reporting are partial or planned.                                      | Future work.                               |

## 3. Recommended Architectural Views and Supporting Artifacts

The final report should explicitly recommend five primary views. Keep them consistent with the course architecture material, but use them to support the Software Development, Operation and Maintenance story rather than turning the report into a pure SAD.

### Five Primary Views

| View                     | Recommended location                               | Main question answered                                                                  | Evidence source                                                                              |
| ------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| View 1: Context View     | Chapter 1, subsection `1.6 System Context Diagram` | Who uses the platform and which external systems interact with it?                      | BRD, Vision & Scope, Use Case Specification, app manifests, deployment docs.                 |
| View 2: Logical View     | Chapter 3                                          | What business capabilities and bounded contexts make up the backend?                    | AppModule, OrderingModule, PaymentModule, NotificationModule, ReviewModule, ADD/SAD.         |
| View 3: Data View        | Chapter 3 and Chapter 4                            | What data is durable, what is transient, and which context owns each table or snapshot? | Drizzle schemas, Redis usage, ACL snapshot repositories, ADR-003, ADR-005, ADR-006, ADR-008. |
| View 4: Development View | Chapter 3, Chapter 5, Chapter 7                    | How is the code organized for development, testing, and future maintenance?             | pnpm workspace, Turborepo, NestJS modules, tests, CI workflows, coding boundaries.           |
| View 5: Deployment View  | Chapter 6                                          | How is the system built, packaged, deployed, configured, and observed?                  | Dockerfiles, GitHub Actions, GHCR, Render Terraform, docker-compose, observability docs.     |

### Supporting Artifacts

These supporting artifacts should be included only where they clarify evidence. Do not overload the report with every possible diagram.

| Supporting artifact           | Include?                     | Purpose                                                                                                                                                          |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container Diagram             | Required                     | Shows API, web, admin, mobile, PostgreSQL, Redis, GHCR, Render, VNPay, Cloudinary, notification providers, and observability backends.                           |
| Component Diagram             | Required                     | Use focused component diagrams for API core, Ordering, Payment, Notification, and Review. Avoid a giant all-class diagram.                                       |
| Observability Diagram         | Required                     | Shows API telemetry/logs/metrics, Grafana Cloud export, request IDs, route grouping, web Faro, mobile Sentry/PostHog, redaction, and dashboard/runbook evidence. |
| Test Architecture Diagram     | Required                     | Shows unit tests, E2E tests, real AppModule setup, PostgreSQL/Redis services, mock auth/test helpers, CI gates, and known frontend/mobile gaps.                  |
| State Machine Diagram         | Strongly recommended         | Shows order lifecycle transitions, actor roles, terminal states, refund transitions, and audit logs.                                                             |
| Data Ownership Diagram        | Strongly recommended         | Shows PostgreSQL table groups, Redis runtime state, ACL snapshot tables, event projectors, and durable vs transient data.                                        |
| Notification Pipeline Diagram | Optional supporting artifact | Shows event handlers, templates, preferences, quiet hours, delivery logs, and channel adapters.                                                                  |

Recommended C4/UML choices:

| Artifact type         | Include?          | Note                                                                     |
| --------------------- | ----------------- | ------------------------------------------------------------------------ |
| C1/System Context     | Yes, in Chapter 1 | Orientation only; do not put internal module details here.               |
| C2/Container          | Yes               | Essential for operation/deployment discussion.                           |
| C3/Component          | Yes, focused      | Use for API core, Ordering, Payment, Notification, and Review.           |
| Full class diagram    | No                | Too large and low signal for this report.                                |
| Sequence diagrams     | Yes               | Use only the mandatory primary workflows plus optional supporting flows. |
| State machine diagram | Yes               | Best representation for order lifecycle correctness.                     |
| Deployment diagram    | Yes               | Important for the operation theme.                                       |

## 4. ADR Strategy and Engineering Decision Records

Do not replace repository ADRs, do not renumber them, and do not invent a new ADR to force every engineering choice into the ADR format. The final report should distinguish official repository ADRs from significant engineering decisions.

### Official ADRs to Retain

Retain the official ADRs below as architectural decisions. The previous proposal's invented NestJS + TypeScript ADR has been removed; NestJS + TypeScript belongs under Significant Engineering Decisions instead.

| Official ADR | Decision                                   | How to use it in the report                                                                                |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| ADR-001      | Adopt Modular Monolith Architecture        | Explain why a single deployable with domain modules fits team size, CI, deployment, and future extraction. |
| ADR-003      | Use Database per BC Ownership              | Explain logical data ownership inside one PostgreSQL database.                                             |
| ADR-004      | Use In-process EventBus Communication      | Explain local domain events and why no message broker is used for the MVP baseline.                        |
| ADR-005      | Adopt ACL Snapshot Pattern                 | Explain checkout safety without direct cross-context reads from Restaurant Catalog.                        |
| ADR-006      | Use Redis Runtime Layer                    | Explain cart state, checkout lock, idempotency keys, presence/runtime data, and cache-ready design.        |
| ADR-007      | Use Ports and Adapters Integration Pattern | Explain Payment, Promotion, Notification, and Review integration without concrete cross-context coupling.  |
| ADR-008      | Adopt Drizzle Type-safe Persistence Layer  | Explain schema ownership, type-safe SQL, migrations, and transaction-oriented business workflows.          |

### Significant Engineering Decisions, Not ADRs

These are important, but they should not replace the repository ADRs. Present them as report-level decision records or implementation strategy notes.

| ID    | Engineering decision        | Why it matters                                                                                                                                          | Evidence to cite                                                                   |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| SD-01 | NestJS + TypeScript Backend | Gives module boundaries, dependency injection, typed DTOs, CQRS support, and test ergonomics.                                                           | API package, AppModule, module roots, controller/service/handler tests.            |
| SD-02 | Hybrid CQRS Strategy        | Uses command handlers for high-risk writes like checkout, payment IPN, review submission, and order transitions while keeping simpler services lean.    | PlaceOrderHandler, ProcessIpnHandler, SubmitReviewHandler, TransitionOrderHandler. |
| SD-03 | Testing Strategy            | Prioritizes risk-driven unit tests and API E2E around money, state machines, auth, checkout, payment, review, and notifications.                        | Unit testing summary, API specs, review E2E, CI validate workflow.                 |
| SD-04 | CI/CD Strategy              | Uses pnpm/Turborepo affected tasks, lint, typecheck, audit, test, build, database push, E2E, Docker packaging, GHCR, and Render deploy hooks.           | CICD.md, ci-validate.yml, pipeline workflows, Dockerfiles.                         |
| SD-05 | Observability Strategy      | Uses API telemetry/logging/request IDs/route groups, Grafana Cloud export configuration, web Faro, mobile Sentry/PostHog, health checks, and redaction. | OBSERVABILITY.md, docs/observability.md, telemetry files, dashboard JSON.          |

Recommended decision-record format:

1. Context: What problem forced the decision?
2. Decision: What was chosen?
3. Alternatives considered: What was rejected?
4. Consequences: Benefits and trade-offs.
5. Evidence: Which docs, tests, workflows, or source files prove the decision is real?

## 5. Recommended Quality Attributes

Replace the previous quality-attribute set with seven primary QAs. Each QA should receive about 2-3 pages in the final report. The report can still mention payment integrity, validation, redaction, performance, and access control as supporting concerns, but the primary QA set should be exactly these seven: Maintainability, Testability, Reliability, Manageability, Flexibility, Supportability, and Operability.

| QA                   | Recommended pages | Scenario                                                                                                                               | Architectural response                                                                                                                     | Implementation evidence                                                                                               | Trade-offs to discuss                                                                                                                       |
| -------------------- | ----------------: | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 Maintainability |               2-3 | A new workflow such as Submit Rating & Review is added without rewriting checkout or notification internals.                           | Modular monolith, bounded contexts, ports/adapters, shared events, module-owned schemas, focused handlers.                                 | ReviewModule, SubmitReviewHandler, ORDER_ELIGIBILITY_PORT, ReviewSubmittedEvent, Notification handler.                | Logical boundaries need discipline because they are not process-enforced.                                                                   |
| QA-2 Testability     |               2-3 | A PR changes checkout, VNPay IPN, or review behavior and must be validated deterministically before merge.                             | Dependency injection, command handlers, provider tokens, controllable mocks, real AppModule E2E, PostgreSQL/Redis CI services.             | Unit testing summary, place-order specs, process-ipn specs, review E2E, ci-validate.yml.                              | API tests are strong; web/admin/mobile automated tests remain a maintenance backlog.                                                        |
| QA-3 Reliability     |               2-3 | A customer retries checkout or VNPay retries IPN and the system must not create duplicate orders or duplicate payment transitions.     | Redis idempotency, checkout lock, DB uniqueness, ACID transactions, terminal-state checks, optimistic locking, post-commit events.         | PlaceOrderHandler, ProcessIpnHandler, payment transaction schema, order lifecycle tests.                              | Redis adds operational dependency; in-process events are simple but need care before multi-instance/event-broker evolution.                 |
| QA-4 Manageability   |               2-3 | Operators/admins need to control partner approval, order lifecycle, CI releases, environment variables, and operational configuration. | Admin role checks, order state machine, environment validation, GitHub Actions, Render/Terraform ownership, health endpoints.              | Admin analytics, order_status_logs, env schema, workflows, Render Terraform, Docker Compose.                          | Some governance/reporting workflows are partial and should be shown as managed roadmap items.                                               |
| QA-5 Flexibility     |               2-3 | The platform needs to change payment, notification, promotion, or provider behavior without rewriting checkout.                        | Ports/adapters, provider interfaces, channel dispatcher, promotion application port, VNPay adapter boundary, Cloudinary adapter.           | PAYMENT_INITIATION_PORT, PROMOTION_APPLICATION_PORT, notification providers, ChannelDispatcherService, image module.  | More interfaces mean more contracts to test and document; do not abstract low-risk CRUD prematurely.                                        |
| QA-6 Supportability  |               2-3 | A production issue occurs in payment, order status, notification, or review, and developers must reconstruct what happened.            | Order status logs, payment transaction state, notification delivery logs, structured logging, request IDs, E2E evidence, incident runbook. | order_status_logs, payment_transactions, notification_delivery_logs, docs/observability.md, review notification test. | Current supportability is strong for core flows, but backup/restore drills, alert policy, and audit query UI should be improved.            |
| QA-7 Operability     |               2-3 | The team deploys and monitors the system across API, web, admin, mobile, database, Redis, and external providers.                      | CI/CD pipelines, Docker images, GHCR, Render deploy hooks, Terraform, readiness/liveness endpoints, telemetry, dashboards, redaction.      | CICD.md, pipeline workflows, Dockerfiles, infra/render, OBSERVABILITY.md, dashboard JSON.                             | Telemetry is designed/configurable, but the final report should not claim mature SLOs or alert coverage unless configured and demonstrated. |

Recommended QA writing pattern for each 2-3 page subsection:

1. Quality scenario table: source, stimulus, environment, artifact, response, response measure.
2. Architectural tactics: the mechanisms used to satisfy the scenario.
3. Implementation evidence: code, schema, workflow, test, or document evidence.
4. Trade-offs: what the solution improves and what it makes harder.
5. Maintenance implication: what should be monitored, tested, or improved next.

## 6. Recommended Sequence Diagrams

Retain exactly three mandatory primary sequence diagrams. These are the best evidence for business correctness and engineering maturity.

### Mandatory Primary Sequence Diagrams

| Primary | Sequence diagram                      | Why it belongs                                                      | Must show                                                                                                                                                                              |
| ------: | ------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|       1 | Place Order                           | Core transaction and strongest reliability story.                   | Customer, API, Cart/Redis, idempotency key, checkout lock, ACL snapshots, Promotion port, Payment port, Drizzle transaction, OrderPlacedEvent, cart cleanup.                           |
|       2 | VNPay Payment Confirmation (IPN Flow) | Best external-integration and provider-retry story.                 | VNPay IPN, signature verification before DB mutation, transaction lookup, amount validation, terminal-state idempotency, optimistic lock update, PaymentConfirmed/PaymentFailed event. |
|       3 | Submit Rating & Review                | Best requirements-to-implementation story after recent code review. | Customer, Review API, order eligibility port, duplicate pre-check, transaction inserting review and updating rating projection, ReviewSubmittedEvent, owner notification.              |

### Optional Secondary Sequence Diagrams

Use these only if page budget allows after the three primary diagrams are strong.

| Optional | Sequence diagram               | Why it may belong                                                                                                                                     |
| -------: | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
|        A | Restaurant Accept/Reject Order | Shows order lifecycle state machine, actor authorization, note requirement, refund-triggering transitions, and order_status_logs.                     |
|        B | Notification Delivery Pipeline | Shows event handler, template resolution, preferences, quiet hours, in-app/email/push dispatch, provider fallback, delivery logs, and WebSocket path. |
|        C | CI/CD Release Flow             | Useful in Chapter 6 if the operation story needs a visual pipeline from PR validation to GHCR and Render.                                             |
|        D | Observability Incident Flow    | Useful in Chapter 7 if the maintenance story needs request ID, Grafana, Render logs, Sentry/Faro, and runbook flow.                                   |

Diagram refinement rules:

- Keep each diagram to one page and limit lifelines to the systems that teach the workflow.
- Preserve alternate paths only when they prove a business rule or QA tactic.
- Add a paragraph below each diagram covering business rule, design decision, QA scenario, implementation evidence, and test evidence.
- For UC-22, use the current implementation behavior: ReviewModule exists, rating projection updates transactionally, and ReviewSubmittedEvent triggers owner notification.

## 7. Hidden Gems Worth Highlighting

These details can raise the final report above a generic CRUD project. Use them as evidence moments in Chapters 3-7.

| Hidden gem                                 | Why it is valuable                                                                                                        | Where to use it                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Redis checkout lock plus idempotency key   | Handles duplicate clicks, network retries, and concurrent checkout attempts.                                              | Reliability QA, Place Order sequence, checkout implementation. |
| ACL snapshot pattern                       | Preserves checkout correctness without direct cross-context reads from Restaurant Catalog.                                | Logical View, Data View, Maintainability, checkout evidence.   |
| VNPay IPN-first authority                  | Avoids trusting browser return URLs for payment state.                                                                    | VNPay sequence, Reliability, Operability.                      |
| Terminal-state idempotency                 | Handles provider retry storms without duplicate state transitions.                                                        | Payment implementation, payment tests.                         |
| Optimistic locking                         | Prevents concurrent state mutations in payment and order lifecycle flows.                                                 | Reliability, state machine, VNPay IPN.                         |
| Notification architecture                  | In-app, email, and push are replaceable channels with preferences, quiet hours, provider fallback, and delivery logs.     | Flexibility, Supportability, Notification pipeline.            |
| CI-safe Noop/Stub providers                | Allows tests and CI to run without real SMTP/FCM side effects.                                                            | Testability, CI/CD, operations.                                |
| Review workflow                            | Shows eligibility port, duplicate protection, transactional rating projection, post-commit event, and owner notification. | UC-22 sequence, requirements traceability.                     |
| Integer ratingSum projection               | Avoids floating-point drift in aggregate restaurant ratings.                                                              | Review implementation evidence.                                |
| Real AppModule E2E setup                   | Tests real HTTP, DB, Redis, events, and repositories while simplifying auth.                                              | Verification chapter.                                          |
| Observability redaction and route grouping | Shows operational care around useful diagnostics and sensitive data minimization.                                         | Operability, Supportability, runbook.                          |
| Turborepo affected validation              | Reduces CI cost while preserving merge confidence.                                                                        | CI/CD maturity.                                                |
| Terraform plus deploy-hook split           | Separates infrastructure ownership from image promotion.                                                                  | Deployment view, operation chapter.                            |
| Admin governance audit                     | Turns partial governance/admin features into a professional maintenance roadmap.                                          | Manageability, Supportability, risk analysis.                  |

Example wording for final report:

> The checkout workflow uses Redis for transient cart state, a checkout lock for concurrency control, and an idempotency key for retry safety. This design improves reliability while keeping the platform inside a modular monolith rather than forcing premature service distribution.

## 8. Lecturer WOW Factors

The final report should make it easy for a lecturer to see engineering maturity. Keep the WOW factors evidence-backed and connect them to course concepts.

| WOW factor                   | Course concept demonstrated               | How to present it                                                                                                                                      |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI/CD maturity               | Software operation and release quality    | Show GitHub Actions, pnpm/Turborepo affected tasks, lint, typecheck, audit, tests, build, DB push, Docker image publishing, GHCR, Render deploy hooks. |
| Observability                | Runtime maintenance and incident response | Show API request IDs, route grouping, telemetry export, Grafana dashboard, web Faro, mobile Sentry/PostHog, health checks, and runbook steps.          |
| Testing Program              | Verification and validation               | Show risk-driven unit tests, API E2E with real AppModule/PostgreSQL/Redis, recent defect analysis, and remaining UI test backlog.                      |
| Redis checkout lock          | Reliability tactic                        | Show concurrent checkout prevention and retry behavior in Place Order.                                                                                 |
| ACL Snapshot                 | Maintainability and data ownership        | Show how Ordering validates checkout using local snapshots instead of direct Catalog coupling.                                                         |
| VNPay reliability mechanisms | External integration robustness           | Show HMAC verification, amount validation, terminal-state idempotency, optimistic locking, and timeout handling.                                       |
| Notification architecture    | Flexibility and Supportability            | Show provider adapters, delivery logs, preferences, quiet hours, Noop/Stub fallback, WebSocket gateway, and new_review notification.                   |
| Review workflow              | Requirements traceability                 | Show UC-22 from requirement to handler, rating projection, duplicate protection, E2E test, and notification.                                           |
| Admin governance audit       | Manageability and maintenance planning    | Show role checks, order status logs, partial admin scope, and a roadmap rather than hiding incomplete work.                                            |

Avoid generic claims such as "enterprise-grade" unless tied to concrete evidence. The stronger strategy is to say the system contains specific mechanisms that improve reliability, maintainability, testability, manageability, flexibility, supportability, and operability, then prove each mechanism.

## 9. Final Recommended Report Outline and Quality Gate

Use this outline as the final report blueprint.

### Front Matter

- Cover page
- Declaration
- Abstract
- Project Contribution Matrix
- Table of contents
- List of figures and tables
- Abbreviations: ADR, ASR, ADD, SAD, SRS, CI/CD, CQRS, ACL, E2E, IPN, OTLP

### Chapter 1: Introduction and Project Context

1.1 Problem statement and motivation

1.2 Stakeholders and user roles: Customer, Restaurant Owner, Shipper, Admin, Platform Operator

1.3 Product scope and boundaries

1.4 Repository and system overview: API, web, admin, mobile, infrastructure

1.5 Technology stack summary

1.6 System Context Diagram: Customer, Restaurant Owner, Shipper, Admin, Food Delivery Platform, VNPay, Cloudinary, Notification Providers, Hosting / Infrastructure

1.7 Report method: documentation review, code review, test/CI evidence, operation evidence

### Chapter 2: Requirements and Scope Traceability

2.1 Business objectives from BRD and Vision & Scope

2.2 Major use-case groups: customer ordering, restaurant operations, payment, notification, review, administration

2.3 Business rules and acceptance criteria summary

2.4 Implemented vs partial vs missing use-case matrix

2.5 Requirements traceability for Place Order, VNPay IPN, Submit Rating & Review, Notification, Admin Governance

2.6 Scope limitations and assumptions

### Chapter 3: Architecture and Design Decisions

3.1 Five primary views: Context View, Logical View, Data View, Development View, Deployment View

3.2 Logical View: modular monolith and bounded contexts

3.3 Data View: PostgreSQL, Drizzle, Redis runtime data, ACL snapshots, durable vs transient state

3.4 Development View: monorepo, modules, tests, CI contracts, code ownership

3.5 Deployment View: containers, Render, GHCR, Terraform, external providers

3.6 Supporting artifacts: Container Diagram, Component Diagram, Observability Diagram, Test Architecture Diagram

3.7 Official ADRs retained: ADR-001, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007, ADR-008

3.8 Significant Engineering Decisions: SD-01 to SD-05

3.9 Architecture trade-offs and consequences

### Chapter 4: Implementation Evidence by Subsystem

4.1 Restaurant catalog and ACL projection

4.2 Cart and checkout workflow

4.3 Order lifecycle state machine and audit logs

4.4 VNPay payment workflow and IPN reliability

4.5 Promotion engine and checkout integration

4.6 Notification multi-channel delivery

4.7 Submit Rating & Review implementation

4.8 Admin governance implementation and gaps

4.9 Web, admin, and mobile application surfaces

### Chapter 5: Verification and Validation

5.1 Testing strategy overview

5.2 Unit test coverage by module and risk area

5.3 E2E architecture: real AppModule, PostgreSQL, Redis, mock auth/test helpers

5.4 CI validation: lint, typecheck, audit, unit, build, DB push, E2E

5.5 Recent defect analysis: async Promise mock and deterministic RV-110 notification query

5.6 Quality gates and remaining test gaps

### Chapter 6: Operation, Deployment, and Observability

6.1 Local runtime dependencies: Docker Compose PostgreSQL and Redis

6.2 GitHub Actions workflow inventory

6.3 Turborepo task graph and affected validation

6.4 Docker image packaging and GHCR publishing

6.5 Render deployment and deploy hooks

6.6 Terraform-managed infrastructure shape

6.7 Secrets and environment management

6.8 Health checks and readiness behavior

6.9 Observability: API telemetry/logging, Grafana Cloud, Faro, Sentry, PostHog, dashboard

6.10 Redaction, route grouping, request IDs, and operational metadata

6.11 Incident runbook and rollback strategy

### Chapter 7: Maintenance, Risks, and Evolution Plan

7.1 Maintainability mechanisms: modules, ports, adapters, tests, ADRs

7.2 Known gaps and technical debt

7.3 Admin UC-27 to UC-35 roadmap

7.4 Frontend/mobile/admin automated test roadmap

7.5 Shipper and reporting feature roadmap

7.6 Backup, restore, alerting, load testing, and multi-instance validation plan

7.7 Supportability and operability improvement plan

7.8 Refactoring and migration strategy

### Chapter 8: Conclusion and Demonstration Package

8.1 Summary of delivered capabilities

8.2 Technical Lessons Learned

8.2.1 Architecture lessons learned

8.2.2 Development lessons learned

8.2.3 Testing lessons learned

8.2.4 Operation lessons learned

8.2.5 Maintenance lessons learned

8.3 Evidence checklist for lecturer review

8.4 Demo script: happy path and failure paths

8.5 Future work

### Appendices

- Appendix A: Requirements traceability matrix
- Appendix B: Official ADR excerpts and engineering decision records
- Appendix C: Mandatory primary sequence diagrams
- Appendix D: CI/CD workflow summary
- Appendix E: Test inventory and selected test results
- Appendix F: Deployment and observability configuration checklist
- Appendix G: Known gaps and maintenance backlog

### Iterative Review - Challenge - Improve - Re-review

| Pass                                | Challenge                                                                                                                        | Improvement made                                                                                                                       | Result |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Review 1: Structure                 | The old proposal was too architecture-heavy and too short for a 100-page Software Development, Operation and Maintenance report. | Rebalanced page allocation to about 100 pages and expanded operation, validation, and maintenance chapters.                            | PASS   |
| Challenge 1: Context View placement | Context View was previously treated as an architecture artifact instead of an introductory orientation artifact.                 | Moved System Context Diagram into Chapter 1 and defined exact actors/providers.                                                        | PASS   |
| Improve 1: View model               | The report needed a small, explicit view set instead of many scattered diagrams.                                                 | Defined five primary views: Context View, Logical View, Data View, Development View, Deployment View.                                  | PASS   |
| Re-review 1: ADR strategy           | The old draft invented an ADR for NestJS/TypeScript and blurred ADRs with strategy decisions.                                    | Retained official ADR-001, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007, ADR-008 and separated SD-01 to SD-05.                          | PASS   |
| Review 2: QA set                    | The old QA set did not match the final requested seven QAs.                                                                      | Replaced it with Maintainability, Testability, Reliability, Manageability, Flexibility, Supportability, Operability.                   | PASS   |
| Challenge 2: Sequence diagrams      | UC-22 was not clearly mandatory and optional diagrams competed with primary flows.                                               | Retained three mandatory primary sequence diagrams and moved Restaurant Accept/Reject plus Notification Delivery Pipeline to optional. | PASS   |
| Improve 2: Evidence depth           | The proposal needed stronger lecturer WOW factors without overclaiming.                                                          | Strengthened CI/CD, observability, testing, Redis lock, ACL snapshot, VNPay, notification, review, and admin governance evidence.      | PASS   |
| Re-review 2: Honesty                | Some docs are planned/partial and could make the final report overstate readiness.                                               | Added explicit constraints for UI tests, alerting, backups, load testing, shipper/reporting, and governance gaps.                      | PASS   |
| Review 3: Contribution visibility   | The proposal needed a clearer recommendation for showing team responsibilities and deliverables.                                 | Added a Front Matter `Project Contribution Matrix` recommendation with placement, purpose, and placeholder structure.                  | PASS   |
| Re-review 3: Lessons-learned depth  | The previous lessons-learned guidance was too brief to demonstrate engineering maturity.                                         | Expanded Chapter 8 guidance into `Technical Lessons Learned` across architecture, development, testing, operation, and maintenance.    | PASS   |

### Final Quality Gate

| Required check                                                                                                                                                   | Status |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Context View moved to Chapter 1 as System Context Diagram                                                                                                        | PASS   |
| Context diagram is orientation artifact, not deep architecture artifact                                                                                          | PASS   |
| Context diagram includes Customer, Restaurant Owner, Shipper, Admin, Food Delivery Platform, VNPay, Cloudinary, Notification Providers, Hosting / Infrastructure | PASS   |
| Five primary views clearly defined                                                                                                                               | PASS   |
| Supporting artifacts include Container Diagram, Component Diagram, Observability Diagram, Test Architecture Diagram                                              | PASS   |
| Three mandatory primary sequence diagrams retained                                                                                                               | PASS   |
| Restaurant Accept/Reject Order and Notification Delivery Pipeline marked optional                                                                                | PASS   |
| Official ADRs preserved without replacement                                                                                                                      | PASS   |
| Significant Engineering Decisions separated from ADRs                                                                                                            | PASS   |
| Seven requested QAs selected                                                                                                                                     | PASS   |
| Each QA includes scenario, architectural response, implementation evidence, trade-offs, and 2-3 page recommendation                                              | PASS   |
| Final report adjusted to 80-120 pages, preferred about 100 pages                                                                                                 | PASS   |
| Lecturer WOW factors strengthened                                                                                                                                | PASS   |
| Project Contribution Matrix recommendation is included                                                                                                           | PASS   |
| Technical Lessons Learned recommendation is included                                                                                                             | PASS   |
| New enhancements fit naturally into the existing report structure                                                                                                | PASS   |
| No duplicated content introduced                                                                                                                                 | PASS   |
| Page allocation remains reasonable for a report near 100 pages                                                                                                   | PASS   |
| Recommendations remain aligned with Software Development, Operation and Maintenance                                                                              | PASS   |
| Recommendations grounded in code/docs and explicit about gaps                                                                                                    | PASS   |

Final recommendation: write the final report as an evidence-backed lifecycle story. Lead with context and scope, prove the architecture through the five views, prove implementation through three primary workflows, prove quality through seven scenario-based QAs, prove operation through CI/CD and observability, and close with a credible maintenance roadmap.
