// Compile a ProposalContents (Phase 6) into a DeltaSpec (Phase 7).
//
// Read-only transform: only creates, no updates or deletes.
// Name-based refs (entity.name, operation.name, etc.) are preserved as-is —
// the apply step resolves them to real ids.

import type { ProposalContents } from "./platform-proposal";
import type { DeltaSpec } from "./dsl/delta-spec";

export function compileProposalToDelta(proposal: ProposalContents): DeltaSpec {
	const delta: DeltaSpec = {};

	// ─── Entities ──────────────────────────────────────────────────────
	if (proposal.entities?.length) {
		delta.entities = {
			create: proposal.entities.map((e) => ({
				name: e.name,
				nameKey: undefined,
			})),
		};
	}

	// ─── Attributes ────────────────────────────────────────────────────
	if (proposal.attributes?.length) {
		delta.attributes = {
			create: proposal.attributes.map((a) => ({
				entityName: a.entity,
				name: a.name,
				type: a.type,
				required: a.required,
				unique: a.unique,
				config: a.config,
			})),
		};
	}

	// ─── EntityRelations ───────────────────────────────────────────────
	if (proposal.relations?.length) {
		delta.relations = {
			create: proposal.relations.map((r) => ({
				fromEntityName: r.from,
				toEntityName: r.to,
				name: r.name,
				kind: r.kind,
				fromField: r.fromField,
				required: r.required,
			})),
		};
	}

	// ─── Resources ─────────────────────────────────────────────────────
	if (proposal.resources?.length) {
		delta.resources = {
			create: proposal.resources.map((r) => ({
				entityName: r.entity,
				name: r.name ?? `${r.entity.toLowerCase()}s`,
				exposedOps: r.exposedOps,
				queryConfig: r.queryConfig,
			})),
		};
	}

	// ─── Operations ────────────────────────────────────────────────────
	if (proposal.operations?.length) {
		delta.operations = {
			create: proposal.operations.map((op) => ({
				name: op.name,
				kind: op.kind,
				inputSchema: op.inputSchema,
				outputSchema: op.outputSchema,
				reads: op.reads,
				writes: op.writes,
				steps: op.steps,
				bodyHint: op.bodyHint,
			})),
		};
	}

	// ─── Policies ──────────────────────────────────────────────────────
	if (proposal.policies?.length) {
		delta.policies = {
			create: proposal.policies.map((p) => ({
				name: p.name,
				scope: p.scope,
				entityName: p.entity,
				fieldName: p.fieldName,
				effect: p.effect,
				rule: p.rule,
			})),
		};
	}

	// ─── Workflows ─────────────────────────────────────────────────────
	if (proposal.workflows?.length) {
		delta.workflows = {
			create: proposal.workflows.map((w) => ({
				name: w.name,
				inputSchema: w.inputSchema,
				steps: w.steps,
			})),
		};
	}

	// ─── Triggers ──────────────────────────────────────────────────────
	if (proposal.triggers?.length) {
		delta.triggers = {
			create: proposal.triggers.map((t) => ({
				name: t.name,
				kind: t.kind,
				source: t.source,
				operationName: t.operationName,
			})),
		};
	}

	// ─── Integrations ──────────────────────────────────────────────────
	if (proposal.integrations?.length) {
		delta.integrations = {
			create: proposal.integrations.map((i) => ({
				key: i.key,
				provider: i.provider,
				capabilities: i.capabilities,
				configSchema: i.configSchema,
			})),
		};
	}

	// ─── AuthMethods ───────────────────────────────────────────────────
	if (proposal.authMethods?.length) {
		delta.authMethods = {
			create: proposal.authMethods.map((a) => ({
				name: a.name,
				kind: a.kind,
				config: a.config,
			})),
		};
	}

	// ─── Assets ────────────────────────────────────────────────────────
	if (proposal.assets?.length) {
		delta.assets = {
			create: proposal.assets.map((a) => ({
				storage: { kind: "placeholder", note: a.note ?? "" },
				mimeType: a.mimeType,
				attributeName: a.attributeName,
				metadata: a.note ? { note: a.note } : undefined,
			})),
		};
	}

	// ─── Screens ───────────────────────────────────────────────────────
	if (proposal.screens?.length) {
		delta.screens = {
			create: proposal.screens.map((s) => ({
				path: s.path,
				type: s.type,
				titleKey: s.titleKey,
			})),
		};
	}

	// ─── Components ────────────────────────────────────────────────────
	if (proposal.components?.length) {
		delta.components = {
			create: proposal.components.map((c) => ({
				type: c.kind,
				screenPath: c.screenPath,
				config: c.config,
			})),
		};
	}

	// ─── Forms ─────────────────────────────────────────────────────────
	if (proposal.forms?.length) {
		delta.forms = {
			create: proposal.forms.map((f) => ({
				componentRef: f.componentRef,
				operationName: f.operationName,
				inputMapping: f.inputMapping,
			})),
		};
	}

	// ─── Fields ────────────────────────────────────────────────────────
	if (proposal.fields?.length) {
		delta.fields = {
			create: proposal.fields.map((f) => ({
				formRef: f.formRef,
				name: f.name,
				type: f.type,
				required: f.required,
				labelKey: f.labelKey,
			})),
		};
	}

	// ─── Actions ───────────────────────────────────────────────────────
	if (proposal.actions?.length) {
		delta.actions = {
			create: proposal.actions.map((a) => ({
				kind: a.kind,
				componentRef: a.componentRef,
				targetType: a.targetType,
				targetId: a.targetId,
				data: a.data,
			})),
		};
	}

	// ─── DataBindings ──────────────────────────────────────────────────
	if (proposal.dataBindings?.length) {
		delta.dataBindings = {
			create: proposal.dataBindings.map((d) => ({
				componentRef: d.componentRef,
				source: d.source,
				query: d.query,
			})),
		};
	}

	// ─── TestScenarios ─────────────────────────────────────────────────
	if (proposal.testScenarios?.length) {
		delta.testScenarios = {
			create: proposal.testScenarios.map((t) => ({
				name: t.name,
				operationName: t.operation,
				screenPath: t.screen,
				inputs: t.inputs,
				expected: t.expected,
			})),
		};
	}

	return delta;
}
