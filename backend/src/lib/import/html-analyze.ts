// Phase 14 — Deterministic HTML structural analyzer.
// NO LLM calls — pure parsing of semantic HTML elements.
// Dependency: node-html-parser (pure-JS, no postinstall).

import { parse } from "node-html-parser";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AttributeType =
	| "TEXT"
	| "TEXTAREA"
	| "EMAIL"
	| "PASSWORD"
	| "NUMBER"
	| "DATE"
	| "DATETIME"
	| "TIME"
	| "CHECKBOX"
	| "RADIO"
	| "SELECT"
	| "MULTISELECT"
	| "FILE"
	| "HIDDEN"
	| "COLOR"
	| "RANGE"
	| "CUSTOM";

export type FieldAnalysis = {
	name: string;
	htmlType: string; // raw HTML input type
	attributeType: AttributeType; // mapped to Control Plane FieldType
	required: boolean;
	label?: string;
	placeholder?: string;
	multiple?: boolean;
};

export type FormAnalysis = {
	id?: string;
	action?: string;
	method?: string;
	fields: FieldAnalysis[];
};

export type HeadingEntry = {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	text: string;
};

export type SectionEntry = {
	tag: string; // header, nav, main, section, aside, footer, article
	id?: string;
	className?: string;
};

export type ComponentAnalysis = {
	tag: string;
	id?: string;
	className?: string;
	text?: string;
};

export type AssetRef = {
	tag: string; // img, svg, video, audio
	src?: string;
	alt?: string;
	mimeType?: string; // best-effort from extension
};

export type ActionRef = {
	kind: "submit" | "button" | "link" | "nav-link";
	label?: string;
	href?: string;
	htmlType?: string;
};

export type TableAnalysis = {
	id?: string;
	headers: string[];
	rowCount: number;
};

export type HtmlAnalysis = {
	title?: string;
	headings: HeadingEntry[];
	sections: SectionEntry[];
	forms: FormAnalysis[];
	components: ComponentAnalysis[];
	tables: TableAnalysis[];
	assets: AssetRef[];
	actions: ActionRef[];
	stats: {
		totalForms: number;
		totalFields: number;
		totalActions: number;
		totalAssets: number;
		totalHeadings: number;
		totalSections: number;
	};
};

// ─── HTML input type → Control Plane AttributeType ───────────────────────────

const INPUT_TYPE_MAP: Record<string, AttributeType> = {
	text: "TEXT",
	search: "TEXT",
	tel: "TEXT",
	url: "TEXT",
	email: "EMAIL",
	password: "PASSWORD",
	number: "NUMBER",
	date: "DATE",
	datetime: "DATETIME",
	"datetime-local": "DATETIME",
	time: "TIME",
	month: "DATE",
	week: "DATE",
	checkbox: "CHECKBOX",
	radio: "RADIO",
	file: "FILE",
	color: "COLOR",
	range: "RANGE",
	hidden: "HIDDEN",
	textarea: "TEXTAREA",
	select: "SELECT",
	"select-multiple": "MULTISELECT",
};

function mapInputType(htmlType: string, multiple?: boolean): AttributeType {
	if (htmlType === "select" && multiple) return "MULTISELECT";
	return INPUT_TYPE_MAP[htmlType.toLowerCase()] ?? "CUSTOM";
}

// ─── Mime type guess from extension ──────────────────────────────────────────

function guessMimeType(src?: string): string | undefined {
	if (!src) return undefined;
	const ext = src.split(".").pop()?.toLowerCase();
	const map: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		mp4: "video/mp4",
		webm: "video/webm",
		mp3: "audio/mpeg",
		wav: "audio/wav",
	};
	return ext ? map[ext] : undefined;
}

// ─── Label resolution ─────────────────────────────────────────────────────────

function resolveLabel(root: ReturnType<typeof parse>, inputEl: { id?: string; closest?: (sel: string) => ReturnType<typeof parse> | null }): string | undefined {
	const rawId = (inputEl as unknown as { getAttribute?: (a: string) => string | null }).getAttribute?.("id");
	if (rawId) {
		const labelEl = root.querySelector(`label[for="${rawId}"]`);
		if (labelEl) return labelEl.text.trim() || undefined;
	}
	return undefined;
}

// ─── Main analyzer ────────────────────────────────────────────────────────────

export function analyzeHtml(html: string): HtmlAnalysis {
	const root = parse(html, { comment: false, blockTextElements: { script: false, style: false } });

	// Title
	const titleEl = root.querySelector("title");
	const title = titleEl?.text?.trim() || undefined;

	// Headings
	const headings: HeadingEntry[] = [];
	for (const level of [1, 2, 3, 4, 5, 6] as const) {
		for (const el of root.querySelectorAll(`h${level}`)) {
			const text = el.text.trim();
			if (text) headings.push({ level, text });
		}
	}

	// Sections
	const sections: SectionEntry[] = [];
	for (const tag of ["header", "nav", "main", "section", "aside", "footer", "article"]) {
		for (const el of root.querySelectorAll(tag)) {
			sections.push({
				tag,
				id: el.getAttribute("id") ?? undefined,
				className: el.getAttribute("class") ?? undefined,
			});
		}
	}

	// Forms
	const forms: FormAnalysis[] = [];
	for (const formEl of root.querySelectorAll("form")) {
		const fields: FieldAnalysis[] = [];

		// Inputs
		for (const inputEl of formEl.querySelectorAll("input")) {
			const htmlType = (inputEl.getAttribute("type") ?? "text").toLowerCase();
			if (htmlType === "submit" || htmlType === "reset" || htmlType === "button") continue;
			const name = inputEl.getAttribute("name") ?? inputEl.getAttribute("id") ?? "";
			const required = inputEl.hasAttribute("required");
			const placeholder = inputEl.getAttribute("placeholder") ?? undefined;
			const labelRaw = resolveLabel(root, inputEl as unknown as Parameters<typeof resolveLabel>[1])
				?? (inputEl.closest("label")?.text?.replace(/\s+/g, " ").trim() || undefined);
			const label = labelRaw ?? undefined;

			fields.push({
				name,
				htmlType,
				attributeType: mapInputType(htmlType),
				required,
				label: label ?? undefined,
				placeholder,
			});
		}

		// Textareas
		for (const el of formEl.querySelectorAll("textarea")) {
			const name = el.getAttribute("name") ?? el.getAttribute("id") ?? "";
			const required = el.hasAttribute("required");
			const labelRawTa = resolveLabel(root, el as unknown as Parameters<typeof resolveLabel>[1])
				?? (el.closest("label")?.text?.replace(/\s+/g, " ").trim() || undefined);
			const label = labelRawTa ?? undefined;
			fields.push({
				name,
				htmlType: "textarea",
				attributeType: "TEXTAREA",
				required,
				label: label ?? undefined,
			});
		}

		// Selects
		for (const el of formEl.querySelectorAll("select")) {
			const name = el.getAttribute("name") ?? el.getAttribute("id") ?? "";
			const required = el.hasAttribute("required");
			const multiple = el.hasAttribute("multiple");
			const labelRawSel = resolveLabel(root, el as unknown as Parameters<typeof resolveLabel>[1])
				?? (el.closest("label")?.text?.replace(/\s+/g, " ").trim() || undefined);
			const label = labelRawSel ?? undefined;
			fields.push({
				name,
				htmlType: multiple ? "select-multiple" : "select",
				attributeType: mapInputType("select", multiple),
				required,
				label: label ?? undefined,
				multiple,
			});
		}

		forms.push({
			id: formEl.getAttribute("id") ?? undefined,
			action: formEl.getAttribute("action") ?? undefined,
			method: formEl.getAttribute("method") ?? undefined,
			fields,
		});
	}

	// Actions (buttons + submit inputs + role=button links)
	const actions: ActionRef[] = [];
	for (const el of root.querySelectorAll("button")) {
		const htmlType = (el.getAttribute("type") ?? "submit").toLowerCase();
		actions.push({
			kind: htmlType === "submit" ? "submit" : "button",
			label: el.text.trim() || undefined,
			htmlType,
		});
	}
	for (const el of root.querySelectorAll('input[type="submit"]')) {
		actions.push({
			kind: "submit",
			label: el.getAttribute("value") ?? "Submit",
			htmlType: "submit",
		});
	}
	for (const el of root.querySelectorAll('a[role="button"]')) {
		actions.push({
			kind: "button",
			label: el.text.trim() || undefined,
			href: el.getAttribute("href") ?? undefined,
			htmlType: "a[role=button]",
		});
	}
	// Navigation links (a[href] not role=button)
	for (const el of root.querySelectorAll("a[href]")) {
		if (el.getAttribute("role") === "button") continue;
		const href = el.getAttribute("href") ?? "";
		// Only include non-trivial hrefs (skip anchors-only, empty)
		if (!href || href === "#") continue;
		actions.push({
			kind: href.startsWith("http") ? "link" : "nav-link",
			label: el.text.trim() || undefined,
			href,
		});
	}

	// Assets
	const assets: AssetRef[] = [];
	for (const el of root.querySelectorAll("img")) {
		const src = el.getAttribute("src") ?? undefined;
		assets.push({
			tag: "img",
			src,
			alt: el.getAttribute("alt") ?? undefined,
			mimeType: guessMimeType(src),
		});
	}
	for (const el of root.querySelectorAll("svg")) {
		assets.push({ tag: "svg", mimeType: "image/svg+xml" });
	}
	for (const el of root.querySelectorAll("video")) {
		const src = el.getAttribute("src") ??
			el.querySelector("source")?.getAttribute("src") ?? undefined;
		assets.push({ tag: "video", src, mimeType: guessMimeType(src) ?? "video/*" });
	}
	for (const el of root.querySelectorAll("audio")) {
		const src = el.getAttribute("src") ??
			el.querySelector("source")?.getAttribute("src") ?? undefined;
		assets.push({ tag: "audio", src, mimeType: guessMimeType(src) ?? "audio/*" });
	}

	// Tables
	const tables: TableAnalysis[] = [];
	for (const el of root.querySelectorAll("table")) {
		const headers: string[] = [];
		for (const th of el.querySelectorAll("th")) {
			headers.push(th.text.trim());
		}
		const rowCount = el.querySelectorAll("tr").length;
		tables.push({
			id: el.getAttribute("id") ?? undefined,
			headers,
			rowCount,
		});
	}

	// Generic interactive components (role=dialog, role=tab, etc.)
	const components: ComponentAnalysis[] = [];
	for (const role of ["dialog", "tab", "tabpanel", "listbox", "combobox", "grid"]) {
		for (const el of root.querySelectorAll(`[role="${role}"]`)) {
			components.push({
				tag: el.tagName?.toLowerCase() ?? "div",
				id: el.getAttribute("id") ?? undefined,
				className: el.getAttribute("class") ?? undefined,
				text: el.text.trim().slice(0, 80) || undefined,
			});
		}
	}

	return {
		title,
		headings,
		sections,
		forms,
		components,
		tables,
		assets,
		actions,
		stats: {
			totalForms: forms.length,
			totalFields: forms.reduce((n, f) => n + f.fields.length, 0),
			totalActions: actions.length,
			totalAssets: assets.length,
			totalHeadings: headings.length,
			totalSections: sections.length,
		},
	};
}
