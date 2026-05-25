// Produce a human-readable Markdown summary of a DeltaSpec.

import type { DeltaSpec } from "./dsl/delta-spec";

type BucketSummary = {
	bucket: string;
	creates: number;
	updates: number;
	deletes: number;
	topNames: string[];
};

function nameOf(item: unknown): string {
	if (item && typeof item === "object") {
		const o = item as Record<string, unknown>;
		return (
			(o.name as string) ??
			(o.key as string) ??
			(o.title as string) ??
			(o.path as string) ??
			(o.id as string) ??
			"?"
		);
	}
	return "?";
}

function summarise(
	bucket: string,
	block:
		| { create?: unknown[]; update?: unknown[]; delete?: unknown[] }
		| undefined,
): BucketSummary | null {
	if (!block) return null;
	const creates = block.create?.length ?? 0;
	const updates = block.update?.length ?? 0;
	const deletes = block.delete?.length ?? 0;
	if (creates + updates + deletes === 0) return null;
	const topNames = (block.create ?? [])
		.slice(0, 3)
		.map(nameOf)
		.filter((n) => n !== "?");
	return { bucket, creates, updates, deletes, topNames };
}

export function explainDeltaSpec(deltaSpec: DeltaSpec): string {
	const summaries: BucketSummary[] = [];

	const buckets: Array<[string, keyof DeltaSpec]> = [
		["ProductSpecs", "productSpecs"],
		["ScreenSpecs", "screenSpecs"],
		["Requirements", "requirements"],
		["Entities", "entities"],
		["Attributes", "attributes"],
		["Relations", "relations"],
		["Resources", "resources"],
		["Operations", "operations"],
		["Policies", "policies"],
		["Workflows", "workflows"],
		["Triggers", "triggers"],
		["Integrations", "integrations"],
		["Assets", "assets"],
		["AuthMethods", "authMethods"],
		["Screens", "screens"],
		["Components", "components"],
		["Forms", "forms"],
		["Fields", "fields"],
		["Actions", "actions"],
		["DataBindings", "dataBindings"],
		["TestScenarios", "testScenarios"],
	];

	for (const [label, key] of buckets) {
		const s = summarise(label, deltaSpec[key] as never);
		if (s) summaries.push(s);
	}

	const totalCreates = summaries.reduce((acc, s) => acc + s.creates, 0);
	const totalUpdates = summaries.reduce((acc, s) => acc + s.updates, 0);
	const totalDeletes = summaries.reduce((acc, s) => acc + s.deletes, 0);

	const lines: string[] = [];
	lines.push("# DeltaSpec — Summary");
	lines.push("");
	lines.push(
		`**Total:** ${totalCreates} create(s), ${totalUpdates} update(s), ${totalDeletes} delete(s) across ${summaries.length} bucket(s).`,
	);
	lines.push("");

	if (summaries.length === 0) {
		lines.push("_(empty spec — no changes declared)_");
		return lines.join("\n");
	}

	lines.push("## Buckets");
	lines.push("");

	for (const s of summaries) {
		const parts: string[] = [];
		if (s.creates > 0) parts.push(`${s.creates} create${s.creates > 1 ? "s" : ""}`);
		if (s.updates > 0) parts.push(`${s.updates} update${s.updates > 1 ? "s" : ""}`);
		if (s.deletes > 0) parts.push(`${s.deletes} delete${s.deletes > 1 ? "s" : ""}`);
		const summary = parts.join(", ");
		const names =
			s.topNames.length > 0 ? ` — e.g. \`${s.topNames.join("`, `")}\`` : "";
		lines.push(`### ${s.bucket}`);
		lines.push(`${summary}${names}`);
		lines.push("");
	}

	lines.push("## Apply order");
	lines.push("");
	lines.push(
		"Entities → Attributes → Relations → Policies → Integrations → Operations → Resources → Triggers → Workflows → AuthMethods → Screens → Components → Forms → Fields → Actions → DataBindings → TestScenarios",
	);
	lines.push("");
	lines.push("## Pipeline");
	lines.push("");
	lines.push("```");
	lines.push("DeltaSpec → validate_spec → apply_spec → ChangeSet");
	lines.push("```");

	return lines.join("\n");
}
