// Static lint for a ProposalEnvelope — no DB writes. Surfaces missing
// references inside the proposal itself (e.g. an Operation reads an entity
// that's neither in existing Entities nor in proposal.entities).

import type { ProposalEnvelope } from "./platform-proposal";

export type ProposalCheck = {
	kind:
		| "empty"
		| "missing_entity"
		| "missing_operation"
		| "duplicate_name"
		| "low_confidence"
		| "low_count"
		| "ok";
	status: "info" | "warn" | "error";
	target?: string;
	bucket?: string;
	message: string;
};

export function validateProposalEnvelope(
	envelope: ProposalEnvelope,
	existingEntityNames: Set<string> = new Set(),
	existingOperationNames: Set<string> = new Set(),
): ProposalCheck[] {
	const out: ProposalCheck[] = [];
	const p = envelope.proposal;
	const proposedEntities = new Set(
		(p.entities ?? []).map((e) => e.name).filter(Boolean),
	);
	const proposedOps = new Set(
		(p.operations ?? []).map((o) => o.name).filter(Boolean),
	);

	const totalCreates =
		(p.entities?.length ?? 0) +
		(p.operations?.length ?? 0) +
		(p.policies?.length ?? 0) +
		(p.screens?.length ?? 0);
	if (totalCreates === 0)
		out.push({
			kind: "empty",
			status: "warn",
			message: "Proposal has zero creates across entities/operations/policies/screens.",
		});

	// Duplicate names within a bucket
	const checkDupes = <T>(arr: T[] | undefined, key: (x: T) => string, bucket: string) => {
		if (!arr) return;
		const seen = new Set<string>();
		for (const item of arr) {
			const k = key(item);
			if (!k) continue;
			if (seen.has(k))
				out.push({
					kind: "duplicate_name",
					status: "error",
					bucket,
					target: k,
					message: `duplicate ${bucket} "${k}" in proposal`,
				});
			seen.add(k);
		}
	};
	checkDupes(p.entities, (e) => e.name, "entities");
	checkDupes(p.operations, (o) => o.name, "operations");
	checkDupes(p.policies, (po) => po.name, "policies");
	checkDupes(p.screens, (s) => s.path, "screens");

	// Operation refs that reference unknown entities
	for (const op of p.operations ?? []) {
		const refs = [...(op.reads ?? []), ...(op.writes ?? [])];
		for (const r of refs) {
			if (!existingEntityNames.has(r) && !proposedEntities.has(r))
				out.push({
					kind: "missing_entity",
					status: "error",
					target: r,
					bucket: "operations",
					message: `Operation "${op.name}" references unknown entity "${r}".`,
				});
		}
	}

	// Triggers that reference unknown operations
	for (const t of p.triggers ?? []) {
		if (!t.operationName) continue;
		if (
			!existingOperationNames.has(t.operationName) &&
			!proposedOps.has(t.operationName)
		)
			out.push({
				kind: "missing_operation",
				status: "error",
				target: t.operationName,
				bucket: "triggers",
				message: `Trigger "${t.name}" references unknown operation "${t.operationName}".`,
			});
	}

	// Attribute entity refs
	for (const a of p.attributes ?? []) {
		if (
			!existingEntityNames.has(a.entity) &&
			!proposedEntities.has(a.entity)
		)
			out.push({
				kind: "missing_entity",
				status: "error",
				target: a.entity,
				bucket: "attributes",
				message: `Attribute "${a.name}" references unknown entity "${a.entity}".`,
			});
	}

	// Confidence
	if (envelope.confidenceScore < 0.3)
		out.push({
			kind: "low_confidence",
			status: "warn",
			message: `confidenceScore is ${envelope.confidenceScore} — low. Review carefully before accept.`,
		});

	if (out.length === 0)
		out.push({ kind: "ok", status: "info", message: "All static checks passed." });

	return out;
}
