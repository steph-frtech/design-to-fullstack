// V3 — not implemented. These are type-level stubs only.
// No DB model, no migration, no runtime execution.
// They describe the shape of future concepts for documentation and tooling purposes.

// ─── Future concepts ──────────────────────────────────────────────────────────

/** V3 — not implemented. Represents an async background job with retry semantics. */
export interface Job {
	id: string;
	projectId: string;
	name: string;
	/** Identifier of the Operation to invoke. */
	operationName: string;
	/** JSON payload passed to the operation as input. */
	payload: Record<string, unknown>;
	/** One of: queued | running | succeeded | failed | cancelled */
	status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
	attempts: number;
	maxAttempts: number;
	/** ISO-8601 timestamp at which the job should first execute (nullable = immediate). */
	scheduledAt: string | null;
	startedAt: string | null;
	finishedAt: string | null;
	error: string | null;
	createdAt: string;
}

/** V3 — not implemented. Cron or interval rule that fires a Job on a recurring basis. */
export interface Schedule {
	id: string;
	projectId: string;
	name: string;
	/** Cron expression (UTC) e.g. "0 9 * * 1-5". */
	cron: string;
	/** Operation to invoke on each tick. */
	operationName: string;
	/** Static payload merged with runtime context. */
	payload: Record<string, unknown>;
	enabled: boolean;
	/** ISO-8601 of last successful run. */
	lastRunAt: string | null;
	/** ISO-8601 of next scheduled run. */
	nextRunAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/** V3 — not implemented. Inbound HTTP endpoint that maps to an Operation on arrival. */
export interface WebhookEndpoint {
	id: string;
	projectId: string;
	name: string;
	/** URL-safe slug, becomes the webhook path segment. */
	slug: string;
	/** Operation invoked when the webhook fires. */
	operationName: string;
	/** Signing secret for HMAC verification (stored encrypted). */
	secretRef: string;
	/** How to validate the payload signature: "hmac-sha256" | "none". */
	signatureAlgorithm: "hmac-sha256" | "none";
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

/** V3 — not implemented. Parameterised template for an outbound notification (email, push, SMS). */
export interface NotificationTemplate {
	id: string;
	projectId: string;
	name: string;
	/** Channel: "email" | "push" | "sms" | "in-app". */
	channel: "email" | "push" | "sms" | "in-app";
	/** Handlebars/Liquid template string for the subject (email only). */
	subject: string | null;
	/** Handlebars/Liquid template string for the body. */
	body: string;
	/** Variables expected by the template (for docs + validation). */
	variables: string[];
	/** Integration key used to send (e.g. "sendgrid", "twilio"). */
	integrationKey: string;
	createdAt: string;
	updatedAt: string;
}

/** V3 — not implemented. Descriptor for a full-text or vector search index over an Entity. */
export interface SearchIndex {
	id: string;
	projectId: string;
	name: string;
	/** Entity whose records are indexed. */
	entityName: string;
	/** Attribute names included in the index. */
	fields: string[];
	/** "fulltext" (Postgres tsvector) | "vector" (pgvector). */
	kind: "fulltext" | "vector";
	/** Embedding model key for vector indexes (nullable for fulltext). */
	embeddingModel: string | null;
	/** Provider-specific config (languages, weights, dimensions…). */
	config: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

/** V3 — not implemented. Isolated tenant in a multi-tenant deployment (maps to RLS row ownership). */
export interface Tenant {
	id: string;
	/** Human-readable name. */
	name: string;
	/** URL-safe slug used in subdomain / path routing. */
	slug: string;
	/** Stripe customer id (nullable until billing is activated). */
	stripeCustomerId: string | null;
	/** Active Subscription id (nullable). */
	subscriptionId: string | null;
	/** JSON bag for per-tenant feature flags. */
	featureFlags: Record<string, unknown>;
	/** Tier tag ("free" | "pro" | "enterprise" | …). */
	plan: string;
	createdAt: string;
	updatedAt: string;
}

/** V3 — not implemented. Active billing subscription linking a Tenant to a BillingPlan. */
export interface Subscription {
	id: string;
	tenantId: string;
	billingPlanId: string;
	/** "active" | "past_due" | "cancelled" | "trialing". */
	status: "active" | "past_due" | "cancelled" | "trialing";
	/** ISO-8601. */
	currentPeriodStart: string;
	currentPeriodEnd: string;
	/** Provider-specific id (e.g. Stripe subscription id). */
	providerSubscriptionId: string;
	cancelledAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/** V3 — not implemented. Billing plan tier with entitlements and pricing. */
export interface BillingPlan {
	id: string;
	/** Display name e.g. "Pro". */
	name: string;
	/** URL-safe slug e.g. "pro". */
	slug: string;
	/** Monthly price in smallest currency unit (cents). */
	priceMonthlyUnit: number;
	/** Currency code e.g. "USD". */
	currency: string;
	/** Provider product/price id (e.g. Stripe price_xxx). */
	providerPriceId: string;
	/** Structured entitlements: resource limits, feature flags. */
	entitlements: Record<string, unknown>;
	/** Whether new sign-ups can select this plan. */
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

/** V3 — not implemented. Observability metric emitted by a running application instance. */
export interface RuntimeMetric {
	id: string;
	projectId: string;
	/** Metric family name e.g. "operation.duration_ms". */
	name: string;
	/** "counter" | "gauge" | "histogram". */
	kind: "counter" | "gauge" | "histogram";
	/** Numeric value at sample time. */
	value: number;
	/** Dimension tags for grouping (e.g. { operation: "createUser", status: "ok" }). */
	labels: Record<string, string>;
	/** ISO-8601 sample timestamp. */
	sampledAt: string;
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

/** Union of all V3 runtime concept interfaces. */
export type RuntimeConcept =
	| Job
	| Schedule
	| WebhookEndpoint
	| NotificationTemplate
	| SearchIndex
	| Tenant
	| Subscription
	| BillingPlan
	| RuntimeMetric;

/** Ordered list of the 9 V3 runtime concept names. */
export const RUNTIME_CONCEPTS: readonly string[] = [
	"Job",
	"Schedule",
	"WebhookEndpoint",
	"NotificationTemplate",
	"SearchIndex",
	"Tenant",
	"Subscription",
	"BillingPlan",
	"RuntimeMetric",
] as const;
