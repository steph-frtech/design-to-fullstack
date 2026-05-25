# Runtime Roadmap — V3 Placeholder

> Status: **planned** — none of the capabilities or concepts described here are implemented.
> This document is the authoritative reference for Phase 21 (Runtime avancé).

---

## Why V3?

The design-to-fullstack platform has two distinct layers:

- **Control Plane (V1/V2)** — describes *what* the application is: entities, operations,
  policies, screens, integrations, behaviors, requirements. This is what the platform
  implements today. It can generate Prisma schemas, Hono routes, and Next.js pages from
  a declarative spec.

- **Runtime (V3)** — *executes* the application at scale: background jobs, scheduled
  triggers, webhooks, multi-tenant isolation, billing, observability. This layer requires
  additional infrastructure (job queues, billing providers, RLS migrations, observability
  collectors) that goes beyond a single Hono process and a single Postgres database.

V3 is out of scope for V1 because:

1. The Control Plane must be stable and battle-tested before runtime complexity is added.
2. Each V3 capability requires its own migration, gated rollout, and infrastructure
   provisioning strategy.
3. Most V1 apps (internal tools, MVPs) do not need job queues or multi-tenancy on day one.

The placeholder exists so that the type system and MCP tooling can reference these
concepts, and so that future contributors have a clear map of what needs to be built.

---

## V3 Capabilities

The following 12 capabilities are planned. None have DB models or migrations; all are
purely documented here.

### 1. Temporal Workflows

**Depends on:** nothing (first-class dependency)
**Concepts involved:** `Job`

Long-running, durable workflows orchestrated by [Temporal.io](https://temporal.io).
Each workflow step maps to an Operation invocation inside a Temporal Activity. Requires
a Temporal cluster and a worker process running alongside the Hono API server.

### 2. Jobs

**Depends on:** nothing
**Concepts involved:** `Job`

Short-lived async background tasks with retry semantics. Candidate implementations:

- **pg-boss** — Postgres-native, zero additional infra, suitable for V3 early.
- **BullMQ** — Redis-backed, higher throughput, required if Temporal is not used.

Jobs are persisted until confirmed successful. A `Job` row tracks status, attempts,
scheduled time, and error payload.

### 3. Scheduled Triggers

**Depends on:** Jobs, Temporal Workflows
**Concepts involved:** `Schedule`, `Job`

Cron-based recurring invocations of an Operation. `Schedule` rows define:

- `cron` — UTC cron expression (e.g. `"0 9 * * 1-5"`)
- `operationName` — the Operation to call on each tick
- `payload` — static JSON merged with runtime context

Implementation: pg-boss schedules or Temporal Schedules API.

### 4. Webhooks

**Depends on:** nothing
**Concepts involved:** `WebhookEndpoint`

Inbound HTTP endpoints registered per project. Each `WebhookEndpoint` row:

- has a `slug` that becomes a path segment (`/webhooks/<slug>`)
- verifies the payload signature (HMAC-SHA256 or none)
- dispatches to the mapped `operationName`

Secrets are stored encrypted in a future secrets store (not in plaintext columns).

### 5. Event Bus

**Depends on:** Jobs
**Concepts involved:** `Job`

Internal pub/sub layer. `emitEvent` steps (already present in the Operation DSL) publish
events to the bus. `Trigger` rows with `kind = EVENT` subscribe.

Initial implementation: in-process EventEmitter (development/single-process).
Production: NATS JetStream or Redis Streams.

### 6. Notifications

**Depends on:** Event Bus
**Concepts involved:** `NotificationTemplate`

Email, push, SMS, and in-app notifications. `NotificationTemplate` rows store
Handlebars/Liquid templates with typed variable declarations. Dispatch:

- triggered by the event bus (a Trigger fires a notification operation)
- or invoked directly from an Operation step (`callIntegration` → sendgrid/twilio)

The `integrationKey` field references an existing `Integration` row.

### 7. Realtime

**Depends on:** Event Bus
**Concepts involved:** *(none — no new model required)*

Server-Sent Events (SSE) or WebSocket push to connected frontend clients. The event bus
feeds a per-connection stream filtered by `projectId` + `tenantId`. The Next.js frontend
subscribes via a `/api/stream` route. No new Prisma model is needed.

### 8. Search Indexing

**Depends on:** nothing
**Concepts involved:** `SearchIndex`

Full-text and vector search over Entity records:

| kind       | mechanism              | provider               |
|------------|------------------------|------------------------|
| `fulltext` | Postgres `tsvector`    | native, no extra infra |
| `vector`   | `pgvector` extension   | OpenAI/Cohere embedding |

`SearchIndex` rows configure which entity attributes to index, the embedding model key
(for vector), and provider config (language dictionaries, dimensions, weights).
Index sync is triggered on `mutate` steps via a post-write hook.

### 9. Multi-Tenant

**Depends on:** nothing (but enables billing)
**Concepts involved:** `Tenant`

Row-Level Security (RLS) in Postgres scoped by `tenantId`. Implementation:

1. Add `tenantId` FK to all project tables (future migration, gated behind a flag).
2. `Policy` rules gain a `$tenant` root in the expression scope.
3. RLS codegen emits `CREATE POLICY` statements per entity.

`Tenant` rows hold the plan slug, feature flags, and Stripe customer id.

### 10. Billing

**Depends on:** Multi-Tenant
**Concepts involved:** `Subscription`, `BillingPlan`, `Tenant`

Stripe-backed subscription management:

- `BillingPlan` defines tiers, pricing (in smallest currency unit), and entitlements.
- `Subscription` links a `Tenant` to a `BillingPlan` and mirrors Stripe subscription
  state via webhook sync.
- Middleware enforces feature flags from `Tenant.featureFlags` at the Hono router level.

### 11. Deployment Automation

**Depends on:** nothing
**Concepts involved:** *(none — driven by existing CodegenSpec)*

One-click infrastructure provisioning on Railway, Fly.io, or Vercel. The codegen phase
(Phase 20) already emits a file manifest; deployment automation interprets that manifest
and calls hosting-provider APIs. No new Prisma concept model is needed.

### 12. Monitoring

**Depends on:** nothing
**Concepts involved:** `RuntimeMetric`

Structured observability for running application instances:

- `RuntimeMetric` rows are emitted by a middleware wrapper around every Operation handler.
- Dimensions: `operation`, `status`, `tenantId`.
- Sink: OpenTelemetry collector → Prometheus → Grafana dashboards (one per project).
- Metric kinds: `counter` (invocations), `gauge` (active connections), `histogram`
  (duration).

---

## V3 Concept Reference

The following concepts are type-level stubs only. They live in
`backend/src/runtime/types.ts`. **No Prisma model exists for any of them.**

### Job

| Field          | Type                   | Notes                                |
|----------------|------------------------|--------------------------------------|
| `id`           | string                 | UUID                                 |
| `projectId`    | string                 |                                      |
| `name`         | string                 | Human label                          |
| `operationName`| string                 | Operation to invoke                  |
| `payload`      | Record<string, unknown>| Input JSON                           |
| `status`       | enum                   | queued/running/succeeded/failed/cancelled |
| `attempts`     | number                 | Current attempt count                |
| `maxAttempts`  | number                 | Retry ceiling                        |
| `scheduledAt`  | string \| null         | ISO-8601; null = immediate           |
| `startedAt`    | string \| null         | ISO-8601                             |
| `finishedAt`   | string \| null         | ISO-8601                             |
| `error`        | string \| null         | Last error message                   |
| `createdAt`    | string                 | ISO-8601                             |

### Schedule

| Field           | Type                   | Notes                           |
|-----------------|------------------------|---------------------------------|
| `id`            | string                 |                                 |
| `projectId`     | string                 |                                 |
| `name`          | string                 |                                 |
| `cron`          | string                 | UTC cron expression             |
| `operationName` | string                 |                                 |
| `payload`       | Record<string, unknown>|                                 |
| `enabled`       | boolean                |                                 |
| `lastRunAt`     | string \| null         |                                 |
| `nextRunAt`     | string \| null         |                                 |

### WebhookEndpoint

| Field                | Type   | Notes                               |
|----------------------|--------|-------------------------------------|
| `id`                 | string |                                     |
| `projectId`          | string |                                     |
| `name`               | string |                                     |
| `slug`               | string | URL path segment                    |
| `operationName`      | string |                                     |
| `secretRef`          | string | Encrypted signing secret            |
| `signatureAlgorithm` | enum   | "hmac-sha256" \| "none"            |
| `enabled`            | boolean|                                     |

### NotificationTemplate

| Field           | Type     | Notes                              |
|-----------------|----------|------------------------------------|
| `id`            | string   |                                    |
| `projectId`     | string   |                                    |
| `name`          | string   |                                    |
| `channel`       | enum     | email/push/sms/in-app              |
| `subject`       | string \| null | Email subject template       |
| `body`          | string   | Handlebars/Liquid template         |
| `variables`     | string[] | Expected template variables        |
| `integrationKey`| string   | Maps to Integration row            |

### SearchIndex

| Field            | Type                   | Notes                     |
|------------------|------------------------|---------------------------|
| `id`             | string                 |                           |
| `projectId`      | string                 |                           |
| `name`           | string                 |                           |
| `entityName`     | string                 |                           |
| `fields`         | string[]               | Indexed attribute names   |
| `kind`           | enum                   | "fulltext" \| "vector"    |
| `embeddingModel` | string \| null         | Null for fulltext         |
| `config`         | Record<string, unknown>| Provider config           |

### Tenant

| Field              | Type                   | Notes                    |
|--------------------|------------------------|--------------------------|
| `id`               | string                 |                          |
| `name`             | string                 |                          |
| `slug`             | string                 | Subdomain / path slug    |
| `stripeCustomerId` | string \| null         |                          |
| `subscriptionId`   | string \| null         |                          |
| `featureFlags`     | Record<string, unknown>|                          |
| `plan`             | string                 | Plan tier slug           |

### Subscription

| Field                   | Type   | Notes                               |
|-------------------------|--------|-------------------------------------|
| `id`                    | string |                                     |
| `tenantId`              | string |                                     |
| `billingPlanId`         | string |                                     |
| `status`                | enum   | active/past_due/cancelled/trialing   |
| `currentPeriodStart`    | string | ISO-8601                            |
| `currentPeriodEnd`      | string | ISO-8601                            |
| `providerSubscriptionId`| string | Stripe subscription id              |
| `cancelledAt`           | string \| null |                              |

### BillingPlan

| Field               | Type                   | Notes                        |
|---------------------|------------------------|------------------------------|
| `id`                | string                 |                              |
| `name`              | string                 | Display name e.g. "Pro"      |
| `slug`              | string                 | e.g. "pro"                   |
| `priceMonthlyUnit`  | number                 | Cents                        |
| `currency`          | string                 | e.g. "USD"                   |
| `providerPriceId`   | string                 | Stripe price_xxx             |
| `entitlements`      | Record<string, unknown>| Resource limits + flags      |
| `active`            | boolean                |                              |

### RuntimeMetric

| Field       | Type                  | Notes                           |
|-------------|-----------------------|---------------------------------|
| `id`        | string                |                                 |
| `projectId` | string                |                                 |
| `name`      | string                | e.g. "operation.duration_ms"    |
| `kind`      | enum                  | counter/gauge/histogram         |
| `value`     | number                |                                 |
| `labels`    | Record<string, string>| Dimension tags                  |
| `sampledAt` | string                | ISO-8601                        |

---

## Relationship to Phase 10 Placeholder Models

Phase 10 introduced a `Workflow` model as a placeholder (stored in Prisma as a
stub row). The `Workflow` model is the precursor to Temporal Workflows — it will be
extended in V3 to carry the `temporalWorkflowId` and execution history.

None of the 9 concepts above have Prisma models today. They will require:

1. New migration files (gated behind a feature flag in `prisma.config.ts`).
2. Prisma schema additions (datasource stays driverless, adapter-pg at runtime).
3. Corresponding Hono routes and MCP tools.
4. E2E tests using the existing ephemeral-project pattern.

---

## Implementation Order (Suggested)

When V3 becomes active:

1. **Jobs** (pg-boss, no extra infra) — unblocks everything else.
2. **Scheduled Triggers** — thin wrapper over Jobs.
3. **Webhooks** — self-contained, high value for integration workflows.
4. **Event Bus** — in-process first, Redis Streams when scale demands it.
5. **Notifications** — depends on Event Bus + existing Integration rows.
6. **Realtime** — depends on Event Bus, thin SSE layer in Next.js.
7. **Search Indexing** — parallel track, no dependency on above.
8. **Multi-Tenant** — requires careful RLS migration planning.
9. **Billing** — depends on Multi-Tenant + Stripe Integration.
10. **Temporal Workflows** — replaces or augments Jobs for complex flows.
11. **Deployment Automation** — depends on stable codegen (Phase 20).
12. **Monitoring** — parallel track, OpenTelemetry middleware.

---

*This document is generated from `backend/src/runtime/index.ts` — the
`describeRuntimeRoadmap()` function is the machine-readable source of truth.*
