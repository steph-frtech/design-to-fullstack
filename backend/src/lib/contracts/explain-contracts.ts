// explain-contracts.ts — Human-readable summary of the compiled contracts.
// Produces a Markdown string. Read-only.

import { compileBackendContract } from "./compile-backend";
import { compileFrontendContract } from "./compile-frontend";
import { compileSharedContract } from "./compile-shared";
import { validateContracts } from "./validate-contracts";

export type ExplainContractsResult = {
	markdown: string;
};

export async function explainContracts(projectId: string): Promise<ExplainContractsResult> {
	const [backend, frontend, shared, validation] = await Promise.all([
		compileBackendContract(projectId),
		compileFrontendContract(projectId),
		compileSharedContract(projectId),
		validateContracts(projectId),
	]);

	const lines: string[] = [];

	lines.push("# Contracts Summary");
	lines.push("");

	// ── Backend ───────────────────────────────────────────────────────────────
	lines.push("## Backend Contract");
	lines.push("");
	lines.push(`- **Routes**: ${backend.routes.length}`);
	lines.push(`- **Schemas**: ${backend.schemas.length}`);
	lines.push(`- **Middlewares**: ${backend.middlewares.length}`);
	lines.push(`- **Auth methods**: ${backend.auth.methods.length}`);
	lines.push(`- **Generated from**: ${backend.generatedFrom.entities} entities, ${backend.generatedFrom.resources} resources, ${backend.generatedFrom.operations} operations, ${backend.generatedFrom.policies} policies`);
	lines.push("");

	if (backend.routes.length > 0) {
		lines.push("### Routes");
		lines.push("");
		// Group by resource/operation
		const byMethod = backend.routes.slice(0, 10);
		for (const r of byMethod) {
			lines.push(`- \`${r.method} ${r.path}\` — ${r.description}`);
		}
		if (backend.routes.length > 10) {
			lines.push(`- … and ${backend.routes.length - 10} more`);
		}
		lines.push("");
	}

	if (backend.schemas.length > 0) {
		lines.push("### Schemas");
		lines.push("");
		for (const s of backend.schemas) {
			lines.push(`- **${s.name}** (${s.fields.length} fields)`);
		}
		lines.push("");
	}

	// ── Frontend ──────────────────────────────────────────────────────────────
	lines.push("## Frontend Contract");
	lines.push("");
	lines.push(`- **Pages**: ${frontend.pages.length}`);
	lines.push(`- **Components**: ${frontend.components.length}`);
	lines.push(`- **Forms**: ${frontend.forms.length}`);
	lines.push(`- **Data Bindings**: ${frontend.dataBindings.length}`);
	lines.push(`- **Actions**: ${frontend.actions.length}`);
	lines.push(`- **Auth Guards**: ${frontend.authGuards.length}`);
	lines.push("");

	if (frontend.pages.length > 0) {
		lines.push("### Pages");
		lines.push("");
		for (const p of frontend.pages) {
			const typeTag = p.type ? ` (${p.type})` : "";
			lines.push(`- \`${p.path}\` → \`app/${p.nextRoute}/page.tsx\`${typeTag} — ${p.componentCount} component(s)`);
		}
		lines.push("");
	}

	// ── Shared ────────────────────────────────────────────────────────────────
	lines.push("## Shared Contract");
	lines.push("");
	lines.push(`- **Types**: ${shared.types.length}`);
	lines.push(`- **Zod Schemas**: ${shared.schemas.length}`);
	lines.push(`- **API Client operations**: ${shared.apiClient.operations.length}`);
	lines.push(`- **Events**: ${shared.events.length}`);
	lines.push("");

	// Group types by kind
	const byKind = shared.types.reduce<Record<string, number>>((acc, t) => {
		acc[t.kind] = (acc[t.kind] ?? 0) + 1;
		return acc;
	}, {});
	if (Object.keys(byKind).length > 0) {
		lines.push("### Type breakdown");
		lines.push("");
		for (const [kind, count] of Object.entries(byKind)) {
			lines.push(`- ${kind}: ${count}`);
		}
		lines.push("");
	}

	// ── Validation ────────────────────────────────────────────────────────────
	lines.push("## Validation");
	lines.push("");
	lines.push(`- **Status**: ${validation.ok ? "PASS" : "FAIL"}`);
	lines.push(`- **Checks**: ${validation.summary.checks} total, ${validation.summary.passed} passed`);

	if (validation.errors.length > 0) {
		lines.push("");
		lines.push("### Gaps / Issues");
		lines.push("");
		for (const err of validation.errors) {
			lines.push(`- \`${err.code}\` [${err.contract}] ${err.message}`);
		}
	} else {
		lines.push("- All checks passed — contracts are coherent.");
	}

	lines.push("");

	// ── Coverage ──────────────────────────────────────────────────────────────
	lines.push("## Coverage");
	lines.push("");
	const entityCoverage = backend.generatedFrom.entities > 0
		? Math.round((backend.schemas.length / backend.generatedFrom.entities) * 100)
		: 100;
	lines.push(`- Entity schema coverage: ${entityCoverage}% (${backend.schemas.length}/${backend.generatedFrom.entities})`);
	const screenCoverage = frontend.generatedFrom.screens > 0
		? Math.round((frontend.pages.length / frontend.generatedFrom.screens) * 100)
		: 100;
	lines.push(`- Screen page coverage: ${screenCoverage}% (${frontend.pages.length}/${frontend.generatedFrom.screens})`);
	lines.push("");

	return { markdown: lines.join("\n") };
}
