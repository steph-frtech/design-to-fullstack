// Phase 14 — Figma design analysis.
// Two flows:
//   1. figmaJson provided in body → deterministic tree walk (no API call).
//   2. fileKey provided + FIGMA_TOKEN env present → fetch from Figma REST API.
//   3. Neither → error figma_not_configured.
// NO LLM calls.

import type { ProposalEnvelope } from "../platform-proposal";
import { htmlAnalysisToProposal } from "./html-to-proposal";
import type { HtmlToProposalOpts } from "./html-to-proposal";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DesignTextNode = {
	id: string;
	name: string;
	text: string;
	style?: Record<string, unknown>;
};

export type DesignComponentNode = {
	id: string;
	name: string;
	kind: string; // "FRAME" | "COMPONENT" | "INSTANCE" | "RECTANGLE" | "GROUP" | ...
	children: DesignComponentNode[];
};

export type DesignImageRef = {
	id: string;
	name: string;
	kind: string; // "RECTANGLE" (with fills), "VECTOR", "ELLIPSE" ...
};

export type DesignAnalysis = {
	fileName?: string;
	frames: DesignComponentNode[];
	texts: DesignTextNode[];
	images: DesignImageRef[];
	components: DesignComponentNode[];
	stats: {
		totalFrames: number;
		totalTexts: number;
		totalImages: number;
		totalComponents: number;
	};
};

export type FigmaError = {
	error: "figma_not_configured" | "figma_fetch_failed" | "figma_invalid_json";
	hint: string;
};

// ─── Figma node walker ────────────────────────────────────────────────────────

function walkNode(
	node: Record<string, unknown>,
	acc: { frames: DesignComponentNode[]; texts: DesignTextNode[]; images: DesignImageRef[]; components: DesignComponentNode[] },
): void {
	if (!node || typeof node !== "object") return;

	const type = node.type as string | undefined;
	const id = (node.id ?? "") as string;
	const name = (node.name ?? "") as string;

	if (type === "TEXT") {
		acc.texts.push({
			id,
			name,
			text: (node.characters as string) ?? "",
			style: (node.style as Record<string, unknown>) ?? undefined,
		});
	}

	if (type === "FRAME" || type === "GROUP") {
		const comp: DesignComponentNode = {
			id,
			name,
			kind: type,
			children: [],
		};
		acc.frames.push(comp);
		// recurse into children
		const children = Array.isArray(node.children) ? node.children as Record<string, unknown>[] : [];
		for (const child of children) {
			walkNode(child, acc);
		}
		return;
	}

	if (type === "COMPONENT" || type === "INSTANCE") {
		const comp: DesignComponentNode = {
			id,
			name,
			kind: type,
			children: [],
		};
		acc.components.push(comp);
	}

	// Images: RECTANGLE nodes with fills that contain IMAGE type
	if (type === "RECTANGLE" || type === "ELLIPSE" || type === "VECTOR") {
		const fills = Array.isArray(node.fills) ? node.fills as Record<string, unknown>[] : [];
		const hasImageFill = fills.some((f) => f.type === "IMAGE");
		if (hasImageFill) {
			acc.images.push({ id, name, kind: type });
		}
	}

	// Walk children for any other node type
	const children = Array.isArray(node.children) ? node.children as Record<string, unknown>[] : [];
	for (const child of children) {
		walkNode(child, acc);
	}
}

// ─── Core analyzer (from parsed JSON) ────────────────────────────────────────

export function analyzeFigma(figmaJson: unknown): DesignAnalysis | FigmaError {
	if (!figmaJson || typeof figmaJson !== "object") {
		return {
			error: "figma_invalid_json",
			hint: "Provide a valid Figma export JSON (document tree from GET /v1/files/:key).",
		};
	}

	const doc = figmaJson as Record<string, unknown>;

	// Support both top-level document and a direct node
	const root = (doc.document ?? doc) as Record<string, unknown>;
	const fileName = (doc.name as string | undefined) ?? undefined;

	const acc = {
		frames: [] as DesignComponentNode[],
		texts: [] as DesignTextNode[],
		images: [] as DesignImageRef[],
		components: [] as DesignComponentNode[],
	};

	// Walk the root's children (pages) or the node directly
	const pages = Array.isArray(root.children) ? root.children as Record<string, unknown>[] : [];
	if (pages.length > 0) {
		for (const page of pages) {
			const pageChildren = Array.isArray(page.children) ? page.children as Record<string, unknown>[] : [];
			for (const child of pageChildren) {
				walkNode(child, acc);
			}
		}
	} else {
		// Direct node (e.g., a single frame or component)
		walkNode(root, acc);
	}

	return {
		fileName,
		frames: acc.frames,
		texts: acc.texts,
		images: acc.images,
		components: acc.components,
		stats: {
			totalFrames: acc.frames.length,
			totalTexts: acc.texts.length,
			totalImages: acc.images.length,
			totalComponents: acc.components.length,
		},
	};
}

// ─── Figma API fetch (requires FIGMA_TOKEN) ───────────────────────────────────

export async function fetchFigmaFile(
	fileKey: string,
	token: string,
): Promise<Record<string, unknown> | FigmaError> {
	try {
		const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
			headers: { "X-Figma-Token": token },
		});
		if (!res.ok) {
			return {
				error: "figma_fetch_failed",
				hint: `Figma API returned ${res.status} — check your FIGMA_TOKEN and file key.`,
			};
		}
		return (await res.json()) as Record<string, unknown>;
	} catch (err) {
		return {
			error: "figma_fetch_failed",
			hint: `Network error: ${(err as Error).message}`,
		};
	}
}

// ─── Combined entry point ─────────────────────────────────────────────────────

export async function resolveFigmaAnalysis(opts: {
	figmaJson?: unknown;
	fileKey?: string;
}): Promise<DesignAnalysis | FigmaError> {
	const { figmaJson, fileKey } = opts;
	const token = process.env.FIGMA_TOKEN;

	if (figmaJson) {
		return analyzeFigma(figmaJson);
	}

	if (fileKey && token) {
		const raw = await fetchFigmaFile(fileKey, token);
		if ("error" in raw) return raw as FigmaError;
		return analyzeFigma(raw);
	}

	return {
		error: "figma_not_configured",
		hint: "Provide figmaJson in body, or set FIGMA_TOKEN env var and pass fileKey.",
	};
}

// ─── DesignAnalysis → ProposalContents ───────────────────────────────────────
// Reuses the html-to-proposal logic by mapping DesignAnalysis to a near-equivalent
// HtmlAnalysis shape.

export function designAnalysisToProposal(
	analysis: DesignAnalysis,
	opts: HtmlToProposalOpts,
): ProposalEnvelope {
	// Build a synthetic HtmlAnalysis from the DesignAnalysis
	const syntheticHtmlAnalysis = {
		title: analysis.fileName,
		headings: analysis.texts
			.filter((t) => {
				const style = t.style as Record<string, unknown> | undefined;
				return style && typeof style.fontSize === "number" && (style.fontSize as number) >= 18;
			})
			.map((t) => ({ level: 1 as const, text: t.text })),
		sections: analysis.frames.map((f) => ({
			tag: "section" as const,
			id: f.id,
			className: f.name,
		})),
		forms: [], // No forms in a pure design file — components handle it
		components: [
			...analysis.frames.map((f) => ({ tag: "frame", id: f.id, text: f.name })),
			...analysis.components.map((c) => ({ tag: c.kind.toLowerCase(), id: c.id, text: c.name })),
		],
		tables: [],
		assets: analysis.images.map((img) => ({
			tag: "img" as const,
			src: img.id,
			alt: img.name,
			mimeType: "image/*",
		})),
		actions: analysis.texts
			.filter((t) => {
				const lower = t.name.toLowerCase();
				return lower.includes("button") || lower.includes("cta") || lower.includes("submit");
			})
			.map((t) => ({
				kind: "button" as const,
				label: t.text,
			})),
		stats: {
			totalForms: 0,
			totalFields: 0,
			totalActions: 0,
			totalAssets: analysis.images.length,
			totalHeadings: 0,
			totalSections: analysis.frames.length,
		},
	};

	return htmlAnalysisToProposal(syntheticHtmlAnalysis, opts);
}
