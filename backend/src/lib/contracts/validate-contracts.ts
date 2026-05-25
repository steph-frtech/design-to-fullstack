// validate-contracts.ts — Cross-contract consistency checks.
// Compiles all three contracts and verifies coherence. Read-only.

import { compileBackendContract } from "./compile-backend";
import { compileFrontendContract } from "./compile-frontend";
import { compileSharedContract } from "./compile-shared";

export type ContractValidationError = {
	code: string;
	contract: "backend" | "frontend" | "shared" | "cross";
	message: string;
};

export type ContractValidationResult = {
	ok: boolean;
	errors: ContractValidationError[];
	summary: {
		backendRoutes: number;
		frontendPages: number;
		sharedTypes: number;
		checks: number;
		passed: number;
	};
};

export async function validateContracts(projectId: string): Promise<ContractValidationResult> {
	const [backend, frontend, shared] = await Promise.all([
		compileBackendContract(projectId),
		compileFrontendContract(projectId),
		compileSharedContract(projectId),
	]);

	const errors: ContractValidationError[] = [];
	let checks = 0;

	// ── Check 1: Every schema in backend is covered by a shared type ──────────
	const sharedTypeNames = new Set(shared.types.map((t) => t.name));
	for (const schema of backend.schemas) {
		checks++;
		if (!sharedTypeNames.has(schema.name)) {
			errors.push({
				code: "missing_shared_type",
				contract: "cross",
				message: `Backend schema "${schema.name}" has no corresponding shared type`,
			});
		}
	}

	// ── Check 2: Each backend route has a schema ref OR operation ref ─────────
	for (const route of backend.routes) {
		checks++;
		if (!route.schemaRef && !route.operationRef) {
			errors.push({
				code: "route_missing_schema",
				contract: "backend",
				message: `Route ${route.method} ${route.path} has no schema or operation reference`,
			});
		}
	}

	// ── Check 3: Each frontend page has a corresponding route ─────────────────
	const backendPaths = new Set(backend.routes.map((r) => r.path));
	const frontendRoutes = new Set(frontend.routes.map((r) => r.path));

	// Frontend pages with data bindings should have backend routes
	const frontendDataPaths = new Set(
		frontend.dataBindings
			.map((db) => {
				const src = typeof db.source === "object" && db.source !== null
					? (db.source as Record<string, unknown>)
					: {};
				return src.ref as string | undefined;
			})
			.filter(Boolean),
	);
	for (const ref of frontendDataPaths) {
		checks++;
		if (ref && !backendPaths.has(`/api/${ref}`) && !backendPaths.has(ref)) {
			errors.push({
				code: "unresolved_data_binding",
				contract: "cross",
				message: `DataBinding references "${ref}" which has no matching backend route`,
			});
		}
	}

	// ── Check 4: No orphan policies (scope=OPERATION but operation not in routes) ─
	for (const mw of backend.middlewares) {
		checks++;
		if (mw.scope === "OPERATION" && mw.applyTo.length === 0) {
			errors.push({
				code: "orphan_policy",
				contract: "backend",
				message: `Policy middleware "${mw.policyName}" (scope=OPERATION) has no target`,
			});
		}
	}

	// ── Check 5: Shared types cover all entity schemas ─────────────────────────
	const entitySchemaNames = new Set(backend.schemas.map((s) => s.entityName));
	for (const name of entitySchemaNames) {
		checks++;
		if (!sharedTypeNames.has(name)) {
			errors.push({
				code: "entity_not_in_shared",
				contract: "shared",
				message: `Entity "${name}" has no shared type — frontend cannot reference it`,
			});
		}
	}

	// ── Check 6: Frontend pages exist (nb screens > 0 if screens were defined) ─
	checks++;
	if (frontend.generatedFrom.screens > 0 && frontend.pages.length === 0) {
		errors.push({
			code: "no_frontend_pages",
			contract: "frontend",
			message: "Screens exist in the DB but no pages were compiled",
		});
	}

	// ── Check 7: Frontend routes match page count ──────────────────────────────
	checks++;
	if (frontend.routes.length !== frontend.pages.length) {
		errors.push({
			code: "route_page_mismatch",
			contract: "frontend",
			message: `Frontend has ${frontend.routes.length} routes but ${frontend.pages.length} pages`,
		});
	}

	void backendPaths;
	void frontendRoutes;

	const passed = checks - errors.length;

	return {
		ok: errors.length === 0,
		errors,
		summary: {
			backendRoutes: backend.routes.length,
			frontendPages: frontend.pages.length,
			sharedTypes: shared.types.length,
			checks,
			passed,
		},
	};
}
