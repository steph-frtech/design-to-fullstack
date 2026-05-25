// Phase 6 — PlatformSpec Proposal synthesizer.
//
// Read-only step: synthesize what the Control Plane SHOULD look like for a
// given feature, given Phase 1-5 inputs. The agent reads the skeleton,
// enriches it (e.g. fills Step DSL bodies for proposed Operations), then
// persists via the CRUD endpoint. NO Control Plane write happens here.

import { prisma } from "../db";

export type WarningSeverity = "info" | "warn" | "error";

export type ProposalWarning = {
	code: string;
	message: string;
	target?: string;
	severity: WarningSeverity;
};

export type ProposalAssumption = {
	statement: string;
	confidence: "LOW" | "MEDIUM" | "HIGH";
};

export type ProposalOpenQuestion = {
	question: string;
	blockedBy?: string[];
};

export type ProposalContents = {
	entities?: Array<{ name: string; description?: string; behaviors?: string[] }>;
	attributes?: Array<{
		entity: string;
		name: string;
		type: string;
		required?: boolean;
		unique?: boolean;
		config?: Record<string, unknown>;
	}>;
	relations?: Array<{
		from: string;
		to: string;
		name: string;
		kind: "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_MANY";
		fromField?: string;
		required?: boolean;
	}>;
	resources?: Array<{
		entity: string;
		name?: string;
		exposedOps: string[];
		queryConfig?: Record<string, unknown>;
	}>;
	operations?: Array<{
		name: string;
		kind: "QUERY" | "COMMAND";
		inputSchema: Record<string, unknown>;
		outputSchema?: Record<string, unknown>;
		reads?: string[];
		writes?: string[];
		steps: unknown[];
		bodyHint?: string;
	}>;
	policies?: Array<{
		name: string;
		scope: "RESOURCE" | "OPERATION" | "ENTITY" | "FIELD";
		resource?: string;
		operation?: string;
		entity?: string;
		fieldName?: string;
		effect?: "ALLOW" | "DENY";
		rule: unknown;
	}>;
	screens?: Array<{ path: string; type?: string; titleKey?: string }>;
	components?: Array<{
		kind: string;
		screenPath?: string;
		parentRef?: string;
		config?: Record<string, unknown>;
	}>;
	forms?: Array<{
		componentRef: string;
		operationName?: string;
		inputMapping?: Record<string, unknown>;
	}>;
	fields?: Array<{
		formRef: string;
		name: string;
		type: string;
		required?: boolean;
		labelKey?: string;
	}>;
	actions?: Array<{
		kind: string;
		componentRef?: string;
		targetType: string;
		targetId?: string;
		data?: Record<string, unknown>;
	}>;
	dataBindings?: Array<{
		componentRef?: string;
		source: Record<string, unknown>;
		query?: Record<string, unknown>;
	}>;
	assets?: Array<{
		mimeType: string;
		entity?: string;
		attributeName?: string;
		note?: string;
	}>;
	authMethods?: Array<{
		name: string;
		kind: "SESSION" | "BEARER" | "HMAC" | "APIKEY";
		config: Record<string, unknown>;
	}>;
	events?: Array<{ name: string; payloadSchema?: Record<string, unknown> }>;
	testScenarios?: Array<{
		name: string;
		operation?: string;
		screen?: string;
		inputs?: Record<string, unknown>;
		expected?: Record<string, unknown>;
	}>;
	workflows?: Array<{
		name: string;
		inputSchema: Record<string, unknown>;
		steps: unknown[];
	}>;
	triggers?: Array<{
		name: string;
		kind: "EVENT" | "SCHEDULE" | "WEBHOOK";
		source: Record<string, unknown>;
		operationName?: string;
	}>;
	integrations?: Array<{
		key: string;
		provider: string;
		capabilities: string[];
		configSchema?: Record<string, unknown>;
	}>;
	behaviors?: Array<{ entity: string; kind: string; config?: Record<string, unknown> }>;
};

export type ProposalEnvelope = {
	proposal: ProposalContents;
	warnings: ProposalWarning[];
	assumptions: ProposalAssumption[];
	openQuestions: ProposalOpenQuestion[];
	confidenceScore: number;
};

// ─── Skeleton synthesizer ─────────────────────────────────────────
// Reads Phases 1-5 state for the project (filtered by featureKey when
// possible) and produces a starter envelope. The agent fills in the
// real bodies (Step DSL, PolicyRule, etc.).

export async function buildProposalSkeleton(opts: {
	projectId: string;
	featureKey?: string;
}): Promise<ProposalEnvelope> {
	const { projectId, featureKey } = opts;

	// Existing Control Plane snapshot (existing entities help us know
	// what NOT to propose creating).
	const existingEntities = await prisma.entity.findMany({
		where: { projectId },
		select: { id: true, name: true },
	});
	const existingEntityNames = new Set(existingEntities.map((e) => e.name));

	// In-scope Requirements (no mapping = candidate for "to create").
	const requirements = await prisma.requirement.findMany({
		where: { projectId },
		include: { mappings: true },
	});

	// ScreenSpecs not yet mapped to a Screen (Phase 5 may have left some).
	const screenSpecs = await prisma.screenSpec.findMany({
		where: { projectId },
	});

	const proposal: ProposalContents = {};
	const warnings: ProposalWarning[] = [];
	const assumptions: ProposalAssumption[] = [];
	const openQuestions: ProposalOpenQuestion[] = [];

	// Walk unmapped Requirements — surface them as "to-clarify".
	for (const r of requirements) {
		const inScope =
			(r.priority &&
				["MUST", "HIGH", "CRITICAL"].includes(r.priority)) ||
			r.status === "ACCEPTED" ||
			r.status === "MAPPED";
		if (!inScope) continue;
		if (r.mappings.length > 0) continue;
		openQuestions.push({
			question: `${r.key} (${r.priority ?? "?"}) — "${r.title}" — what platform target should this map to ?`,
		});
	}

	// Mention the screens that exist as ScreenSpec but not yet as Screen.
	for (const ss of screenSpecs) {
		warnings.push({
			code: "screen_spec_unmapped",
			message: `ScreenSpec "${ss.name}" has no corresponding Screen. Consider adding a Screen + Components + DataBindings.`,
			target: ss.id,
			severity: "info",
		});
	}

	if (existingEntityNames.size === 0) {
		warnings.push({
			code: "no_entities_yet",
			message: "Project has zero Entities. The proposal will likely need to declare them all under entities[].",
			severity: "info",
		});
	}

	// Confidence : start neutral. Agent revises.
	const confidenceScore = 0.5;

	return {
		proposal,
		warnings,
		assumptions,
		openQuestions,
		confidenceScore,
	};
}
