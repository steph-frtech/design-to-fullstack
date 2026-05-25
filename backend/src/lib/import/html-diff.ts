// Phase 14 — HTML diff against ScreenSpec.
// Compares an HtmlAnalysis to the components/dataNeeds/actions from a ScreenSpec
// and returns a structured delta: what each side has that the other lacks.

import type { HtmlAnalysis, FormAnalysis, ActionRef, AssetRef } from "./html-analyze";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DeltaItem = {
	kind: "field" | "action" | "component" | "asset" | "form";
	name: string;
	source: "html" | "spec";
	detail?: string;
};

export type MatchedItem = {
	kind: "field" | "action" | "component" | "form";
	name: string;
	htmlDetail?: string;
	specDetail?: string;
};

export type UiDelta = {
	/** Present in HTML but absent from the ScreenSpec. */
	missingInSpec: DeltaItem[];
	/** Declared in ScreenSpec but absent from the HTML. */
	missingInHtml: DeltaItem[];
	/** Found on both sides (fuzzy name match). */
	matched: MatchedItem[];
	/** Textual suggestions derived from the delta. */
	suggestions: string[];
};

// ─── ScreenSpec shape (subset we read) ──────────────────────────────────────

type ScreenSpecLike = {
	components?: unknown;
	fields?: unknown;
	actions?: unknown;
	dataNeeds?: unknown;
};

function toStringArray(val: unknown): string[] {
	if (!Array.isArray(val)) return [];
	return val.map((v) => {
		if (typeof v === "string") return v;
		if (v && typeof v === "object") {
			const obj = v as Record<string, unknown>;
			return (obj.name ?? obj.kind ?? obj.label ?? "") as string;
		}
		return "";
	}).filter(Boolean);
}

// ─── Fuzzy name normalization ─────────────────────────────────────────────────

function normalize(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ─── Main diff ───────────────────────────────────────────────────────────────

export function diffHtmlAgainstScreenSpec(
	analysis: HtmlAnalysis,
	screenSpec: ScreenSpecLike,
): UiDelta {
	const missingInSpec: DeltaItem[] = [];
	const missingInHtml: DeltaItem[] = [];
	const matched: MatchedItem[] = [];
	const suggestions: string[] = [];

	// ── Fields ─────────────────────────────────────────────────────────────────
	const htmlFieldNames = analysis.forms.flatMap((f: FormAnalysis) => f.fields.map((fi) => fi.name)).filter(Boolean);
	const specFieldNames = toStringArray(screenSpec.fields);

	const htmlFieldSet = new Map(htmlFieldNames.map((n) => [normalize(n), n]));
	const specFieldSet = new Map(specFieldNames.map((n) => [normalize(n), n]));

	for (const [norm, name] of htmlFieldSet) {
		if (specFieldSet.has(norm)) {
			matched.push({ kind: "field", name, htmlDetail: name, specDetail: specFieldSet.get(norm) });
		} else {
			missingInSpec.push({ kind: "field", name, source: "html", detail: `Found in HTML form(s)` });
		}
	}
	for (const [norm, name] of specFieldSet) {
		if (!htmlFieldSet.has(norm)) {
			missingInHtml.push({ kind: "field", name, source: "spec", detail: `Declared in ScreenSpec.fields` });
		}
	}

	// ── Actions ────────────────────────────────────────────────────────────────
	const htmlActionLabels = analysis.actions
		.map((a: ActionRef) => a.label ?? a.href ?? "")
		.filter(Boolean);
	const specActionNames = toStringArray(screenSpec.actions);

	const htmlActionSet = new Map(htmlActionLabels.map((n) => [normalize(n), n]));
	const specActionSet = new Map(specActionNames.map((n) => [normalize(n), n]));

	for (const [norm, name] of htmlActionSet) {
		if (specActionSet.has(norm)) {
			matched.push({ kind: "action", name, htmlDetail: name, specDetail: specActionSet.get(norm) });
		} else {
			missingInSpec.push({ kind: "action", name, source: "html", detail: `HTML button/link` });
		}
	}
	for (const [norm, name] of specActionSet) {
		if (!htmlActionSet.has(norm)) {
			missingInHtml.push({ kind: "action", name, source: "spec", detail: `Declared in ScreenSpec.actions` });
		}
	}

	// ── Components ─────────────────────────────────────────────────────────────
	const htmlComponentNames = [
		...analysis.forms.map((f: FormAnalysis) => f.id ?? "form"),
		...analysis.tables.map((t) => t.id ?? "table"),
		...analysis.sections.map((s) => s.tag),
	];
	const specComponentNames = toStringArray(screenSpec.components);

	const htmlCompSet = new Map(htmlComponentNames.map((n) => [normalize(n), n]));
	const specCompSet = new Map(specComponentNames.map((n) => [normalize(n), n]));

	for (const [norm, name] of htmlCompSet) {
		if (specCompSet.has(norm)) {
			matched.push({ kind: "component", name, htmlDetail: name, specDetail: specCompSet.get(norm) });
		} else {
			missingInSpec.push({ kind: "component", name, source: "html" });
		}
	}
	for (const [norm, name] of specCompSet) {
		if (!htmlCompSet.has(norm)) {
			missingInHtml.push({ kind: "component", name, source: "spec", detail: `Declared in ScreenSpec.components` });
		}
	}

	// ── Assets ─────────────────────────────────────────────────────────────────
	for (const asset of analysis.assets) {
		const label = asset.alt ?? asset.src ?? asset.tag;
		missingInSpec.push({ kind: "asset", name: label, source: "html", detail: `<${asset.tag}> ${asset.src ?? ""}` });
	}

	// ── Forms ──────────────────────────────────────────────────────────────────
	if (analysis.forms.length > 0 && specComponentNames.length === 0) {
		suggestions.push(`HTML has ${analysis.forms.length} form(s) — consider adding form components to ScreenSpec.`);
	}
	if (missingInHtml.filter((i) => i.kind === "field").length > 0) {
		suggestions.push(`Some ScreenSpec fields are not present in the HTML — verify form completeness.`);
	}
	if (missingInSpec.filter((i) => i.kind === "action").length > 0) {
		suggestions.push(`HTML has actions not described in ScreenSpec — update actions[] list.`);
	}

	return { missingInSpec, missingInHtml, matched, suggestions };
}
