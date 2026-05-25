// V3 — not implemented. Pure runtime-roadmap descriptor.
// No DB access, no LLM call, no side effects.

export type { RuntimeConcept } from "./types";
export { RUNTIME_CONCEPTS } from "./types";
export type {
	Job,
	Schedule,
	WebhookEndpoint,
	NotificationTemplate,
	SearchIndex,
	Tenant,
	Subscription,
	BillingPlan,
	RuntimeMetric,
} from "./types";

// ─── Roadmap ──────────────────────────────────────────────────────────────────

export interface RuntimeRoadmapEntry {
	/** The V3 capability name. */
	capability: string;
	/** Always "planned" — none of these are implemented. */
	status: "planned";
	/** Runtime concept names involved in this capability. */
	concepts: string[];
	/** Other capabilities that must exist first. */
	dependsOn: string[];
	/** Short rationale / design notes. */
	notes: string;
}

/**
 * Returns the static V3 runtime roadmap.
 * Pure and deterministic — safe to call anywhere, including tests.
 */
export function describeRuntimeRoadmap(): RuntimeRoadmapEntry[] {
	return [
		{
			capability: "Temporal workflows",
			status: "planned",
			concepts: ["Job"],
			dependsOn: [],
			notes:
				"Long-running, durable workflows orchestrated by Temporal.io. Each workflow step maps to an Operation invocation. Requires a Temporal cluster and worker process alongside the Hono server.",
		},
		{
			capability: "jobs",
			status: "planned",
			concepts: ["Job"],
			dependsOn: [],
			notes:
				"Short-lived async background tasks with retry semantics. Could be implemented with BullMQ (Redis) or pg-boss (Postgres). Jobs are persisted until confirmed successful.",
		},
		{
			capability: "scheduled triggers",
			status: "planned",
			concepts: ["Schedule", "Job"],
			dependsOn: ["jobs", "Temporal workflows"],
			notes:
				"Cron-based recurring invocations of an Operation. Depends on a job runner (pg-boss or Temporal schedules). Schedule rows define the cron expression and static payload.",
		},
		{
			capability: "webhooks",
			status: "planned",
			concepts: ["WebhookEndpoint"],
			dependsOn: [],
			notes:
				"Inbound HTTP endpoints registered per project. Payload is HMAC-verified then forwarded to the mapped Operation. Secrets are stored encrypted (future secrets-store integration).",
		},
		{
			capability: "event bus",
			status: "planned",
			concepts: ["Job"],
			dependsOn: ["jobs"],
			notes:
				"Internal pub/sub layer. emitEvent steps (already in the Operation DSL) publish to the bus; Trigger rows with kind=EVENT subscribe. Initial implementation: in-process emitter; later: NATS or Redis Streams.",
		},
		{
			capability: "notifications",
			status: "planned",
			concepts: ["NotificationTemplate"],
			dependsOn: ["event bus"],
			notes:
				"Email, push, SMS, and in-app notifications driven by NotificationTemplate rows. Dispatch is triggered by the event bus or directly from an Operation step. Integration keys map to existing Integration rows (sendgrid, twilio, etc.).",
		},
		{
			capability: "realtime",
			status: "planned",
			concepts: [],
			dependsOn: ["event bus"],
			notes:
				"Server-Sent Events or WebSocket push to connected frontend clients. The event bus feeds a per-connection stream filtered by projectId + tenantId. No new concept model required — piggybacked on the event bus.",
		},
		{
			capability: "search indexing",
			status: "planned",
			concepts: ["SearchIndex"],
			dependsOn: [],
			notes:
				"Full-text (Postgres tsvector) and vector (pgvector) indexes over Entity rows. SearchIndex rows configure which attributes to index and the embedding model. Index sync is triggered on mutate steps.",
		},
		{
			capability: "multi-tenant",
			status: "planned",
			concepts: ["Tenant"],
			dependsOn: [],
			notes:
				"Row-Level Security (RLS) policies in Postgres scoped by tenantId. Tenant rows own resources; Policy rules gain a tenant context root ($tenant). Requires a migration to add tenantId FK to all project tables. Depends on future RLS codegen in governance.",
		},
		{
			capability: "billing",
			status: "planned",
			concepts: ["Subscription", "BillingPlan", "Tenant"],
			dependsOn: ["multi-tenant"],
			notes:
				"Stripe-backed subscription management. BillingPlan defines tiers and entitlements; Subscription links a Tenant to a plan and tracks Stripe webhook events. Feature-flag enforcement checks Tenant.featureFlags at middleware level.",
		},
		{
			capability: "deployment automation",
			status: "planned",
			concepts: [],
			dependsOn: [],
			notes:
				"One-click infrastructure provisioning (Railway, Fly.io, Vercel). The codegen phase already emits a manifest; deployment automation interprets that manifest and pushes to a hosting provider via API. No new concept model — driven by CodegenSpec + project.localPath.",
		},
		{
			capability: "monitoring",
			status: "planned",
			concepts: ["RuntimeMetric"],
			dependsOn: [],
			notes:
				"Structured observability: Operation latency, error rates, job throughput. RuntimeMetric rows are emitted by a middleware wrapper around every Operation handler. Sink: OpenTelemetry collector → Prometheus / Grafana. Dashboards are per-project.",
		},
	];
}
