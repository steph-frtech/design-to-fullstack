// Phase 14 — Convert HtmlAnalysis → ProposalContents (Phase 6 format).
// Read-only: returns the envelope, does NOT persist anything.
// All inferred elements are tagged with source: "html-import".

import type { HtmlAnalysis, FormAnalysis, FieldAnalysis } from "./html-analyze";
import type { ProposalContents, ProposalEnvelope } from "../platform-proposal";

// ─── Options ─────────────────────────────────────────────────────────────────

export type HtmlToProposalOpts = {
	projectId: string;
	featureKey?: string;
	screenSpecId?: string;
	/** Override the inferred screen path. Defaults to "/html-import". */
	screenPath?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toEntityName(str: string): string {
	// camelCase the form id or a generic "ImportedForm"
	if (!str || str === "form") return "ImportedEntity";
	// Capitalize first letter, strip non-alphanumeric
	return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
		.replace(/^(.)/, (c: string) => c.toUpperCase());
}

// ─── Main converter ───────────────────────────────────────────────────────────

export function htmlAnalysisToProposal(
	analysis: HtmlAnalysis,
	opts: HtmlToProposalOpts,
): ProposalEnvelope {
	const screenPath = opts.screenPath ?? "/html-import";
	const screenTitle = analysis.title ?? "HTML Import";

	const proposal: ProposalContents = {};

	// ── Screen ─────────────────────────────────────────────────────────────────
	proposal.screens = [
		{
			path: screenPath,
			type: "web",
			titleKey: screenTitle,
		},
	];

	// ── Components (one per section tag, one per form) ─────────────────────────
	proposal.components = [];

	for (const section of analysis.sections) {
		proposal.components.push({
			kind: section.tag,
			screenPath,
			config: {
				id: section.id,
				className: section.className,
				source: "html-import",
			},
		});
	}

	// ── Entities + Attributes inferred from forms ──────────────────────────────
	proposal.entities = [];
	proposal.attributes = [];
	proposal.forms = [];
	proposal.fields = [];
	proposal.actions = [];

	for (let i = 0; i < analysis.forms.length; i++) {
		const form = analysis.forms[i] as FormAnalysis;
		const entityNameBase = form.id ?? (analysis.title ? analysis.title.replace(/\s+/g, "") : "");
		const entityName = toEntityName(entityNameBase || `Form${i + 1}`);
		const formRef = `${screenPath}#form-${i}`;

		// Entity candidate
		proposal.entities.push({
			name: entityName,
			description: `Entity inferred from HTML form${form.id ? ` #${form.id}` : ""}. Source: html-import.`,
		});

		// Component for the form itself
		proposal.components.push({
			kind: "form",
			screenPath,
			config: {
				formIndex: i,
				htmlId: form.id,
				source: "html-import",
			},
		});

		// ProposalContents.forms entry
		proposal.forms.push({
			componentRef: formRef,
			inputMapping: {},
		});

		// Attributes + Fields per form field
		for (const field of form.fields as FieldAnalysis[]) {
			if (!field.name) continue;

			// Attribute candidate
			proposal.attributes.push({
				entity: entityName,
				name: field.name,
				type: field.attributeType,
				required: field.required,
				config: { source: "html-import", label: field.label },
			});

			// Form field
			proposal.fields.push({
				formRef,
				name: field.name,
				type: field.attributeType,
				required: field.required,
				labelKey: field.label ?? field.name,
			});
		}
	}

	// ── Actions (buttons + links) ─────────────────────────────────────────────
	for (const action of analysis.actions) {
		const isNav = action.kind === "nav-link" || action.kind === "link";
		proposal.actions.push({
			kind: action.kind === "submit" ? "submit" : isNav ? "navigate" : "button",
			componentRef: screenPath,
			targetType: isNav ? "Url" : "Operation",
			targetId: action.href ?? undefined,
			data: {
				label: action.label,
				source: "html-import",
			},
		});
	}

	// ── Assets ────────────────────────────────────────────────────────────────
	proposal.assets = analysis.assets.map((a) => ({
		mimeType: a.mimeType ?? (a.tag === "video" ? "video/*" : "image/*"),
		note: `<${a.tag}> ${a.src ?? ""} (alt: ${a.alt ?? "none"}) — source: html-import`,
	}));

	// ── DataBindings inferred from dataNeeds in forms ─────────────────────────
	if (analysis.forms.length > 0) {
		proposal.dataBindings = analysis.forms.map((_form, i) => ({
			componentRef: `${screenPath}#form-${i}`,
			source: { kind: "Entity", ref: toEntityName(_form.id ?? `Form${i + 1}`), note: "html-import" },
		}));
	}

	// ── Warnings + Assumptions ────────────────────────────────────────────────
	const warnings = [];
	const assumptions = [];
	const openQuestions = [];

	if (analysis.forms.length === 0) {
		warnings.push({
			code: "no_forms",
			message: "HTML has no <form> elements — no entities were inferred.",
			severity: "info" as const,
		});
	}
	if (analysis.assets.length > 0) {
		warnings.push({
			code: "assets_unbound",
			message: `${analysis.assets.length} asset(s) found — review and link to Entity attributes manually.`,
			severity: "info" as const,
		});
	}

	assumptions.push({
		statement: `Each HTML <form> maps to one Entity candidate. Field names become Attribute names.`,
		confidence: "MEDIUM" as const,
	});
	assumptions.push({
		statement: `Input types are mapped deterministically: text→TEXT, email→EMAIL, checkbox→CHECKBOX, etc.`,
		confidence: "HIGH" as const,
	});

	if (analysis.forms.some((f) => f.fields.some((fi) => !fi.name))) {
		openQuestions.push({
			question: `Some form inputs have no name attribute — they were skipped. Verify HTML completeness.`,
		});
	}

	return {
		proposal,
		warnings,
		assumptions,
		openQuestions,
		confidenceScore: analysis.forms.length > 0 ? 0.7 : 0.3,
	};
}
