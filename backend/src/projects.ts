import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { z, type ZodError } from "zod";
import { prisma } from "./db";
import { changeSetMiddleware } from "./lib/changeset-middleware";
import { behaviorsRoutes } from "./concepts/behaviors";
import { integrationsRoutes } from "./concepts/integrations";
import { operationsRoutes } from "./concepts/operations";
import { policiesRoutes } from "./concepts/policies";
import { relationsRoutes } from "./concepts/relations";
import { resourcesRoutes } from "./concepts/resources";
import { triggersRoutes } from "./concepts/triggers";
import { changeSetsRoutes, revisionRevertRoutes } from "./changesets";
import { assumptionsRoutes } from "./concepts/assumptions";
import { openQuestionsRoutes } from "./concepts/open-questions";
import { productSpecsRoutes } from "./concepts/product-specs";
import { screenSpecsRoutes } from "./concepts/screen-specs";
import { platformProposalsRoutes } from "./concepts/platform-proposals";
import { requirementsRoutes } from "./concepts/requirements";
import { requirementMappingsRoutes } from "./concepts/requirement-mappings";
import { sddArtifactsRoutes } from "./concepts/sdd-artifacts";
import { deltaSpecRoutes } from "./concepts/delta-spec";
import { exprRoutes } from "./concepts/expr";
import { operationDslRoutes } from "./concepts/operation-dsl";
import { policyDslRoutes } from "./concepts/policy-dsl";
import { importRoutes } from "./concepts/import";
import { contractsRoutes } from "./concepts/contracts";
import { checkClarificationGate } from "./lib/clarification-gate";
import { checkCoverageGate } from "./lib/coverage-gate";
import { specRoutes, getSpec, renderSpecMd } from "./spec";
import {
	generateApp,
	planCodegen,
	checkGeneratedProject,
	typecheckGeneratedProject,
	type CodegenLayer,
} from "./codegen/codegen";
import { runGovernanceChecks } from "./lib/governance/governance-check";
import { emitAuditEvent } from "./lib/governance/audit";

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const localeCodeRe = /^[a-z]{2}(?:-[A-Z]{2})?$/;

// zValidator hook → returns a clean { error, issues } shape on validation
// failure so the frontend can render readable messages.
function validationHook<T>(
	result: { success: true; data: T } | { success: false; error: ZodError },
	c: Context,
) {
	if (!result.success) {
		return c.json(
			{
				error: "validation_failed",
				issues: result.error.issues.map((i) => ({
					path: i.path.join("."),
					message: i.message,
				})),
			},
			400,
		);
	}
}

export const projectsRoutes = new Hono()
	// Auto ChangeSet wrapping for any write under /:id/*.
	.use("/:id/*", changeSetMiddleware)
	.get("/", async (c) => {
		const projects = await prisma.project.findMany({
			orderBy: { updatedAt: "desc" },
			include: {
				defaultLocale: true,
				_count: { select: { screens: true, entities: true } },
			},
		});
		return c.json({ projects });
	})

	.post(
		"/",
		zValidator(
			"json",
			z.object({
				slug: z
					.string()
					.min(2)
					.max(64)
					.regex(slugRe, "lowercase letters, digits, hyphens"),
				localeCode: z
					.string()
					.regex(localeCodeRe, 'use a code like "en" or "fr-FR"')
					.default("en"),
				localeName: z.string().min(1).max(64).default("English"),
				extraLocales: z
					.array(
						z.object({
							code: z
								.string()
								.regex(localeCodeRe, 'use a code like "en" or "fr-FR"'),
							name: z.string().min(1).max(64),
						}),
					)
					.default([]),
				// Wizard metadata (side effects are already done by prepare-identity)
				localPath: z.string().min(1).max(512).optional(),
				github: z
					.object({
						owner: z.string().min(1).max(64),
						name: z.string().min(1).max(128),
					})
					.optional(),
				screenTypes: z
					.array(z.enum(["web", "mobile", "desktop"]))
					.default([]),
			}),
			validationHook,
		),
		async (c) => {
			const {
				slug,
				localeCode,
				localeName,
				extraLocales,
				localPath,
				github,
				screenTypes,
			} = c.req.valid("json");

			const existing = await prisma.project.findUnique({ where: { slug } });
			if (existing) return c.json({ error: "slug_taken" }, 409);

			const defaultLocale = await prisma.locale.upsert({
				where: { code: localeCode },
				update: {},
				create: { code: localeCode, name: localeName, isDefault: true },
			});

			const extras = await Promise.all(
				extraLocales
					.filter((l) => l.code !== localeCode)
					.map((l) =>
						prisma.locale.upsert({
							where: { code: l.code },
							update: {},
							create: { code: l.code, name: l.name },
						}),
					),
			);

			// TEMP owner — replace once auth is wired in the UI.
			const owner = await prisma.user.upsert({
				where: { email: "demo@design-to-fullstack.local" },
				update: {},
				create: {
					id: "demo-user",
					email: "demo@design-to-fullstack.local",
					name: "Demo User",
				},
			});

			// Side effects (mkdir, gh repo create) are no longer done here —
			// they're executed by POST /api/system/prepare-identity at the
			// step 1 → step 2 transition of the wizard. By the time we reach
			// this endpoint, localPath is already the resolved absolute path.
			const project = await prisma.project.create({
				data: {
					slug,
					ownerId: owner.id,
					defaultLocaleId: defaultLocale.id,
					localPath: localPath ?? null,
					githubRepo: github ? `${github.owner}/${github.name}` : null,
					enabledScreenTypes: screenTypes,
					locales: {
						create: [
							{ localeId: defaultLocale.id },
							...extras.map((l) => ({ localeId: l.id })),
						],
					},
				},
				include: { defaultLocale: true },
			});

			return c.json({ project }, 201);
		},
	)

	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const project = await prisma.project.findUnique({
			where: { id },
			include: {
				defaultLocale: true,
				locales: { include: { locale: true } },
				theme: true,
				entities: {
					include: { _count: { select: { attributes: true, records: true } } },
				},
				screens: {
					orderBy: { order: "asc" },
					include: { _count: { select: { components: true } } },
				},
			},
		});
		if (!project) return c.json({ error: "not_found" }, 404);
		return c.json({ project });
	})

	.get("/:id/screens/:screenId", async (c) => {
		const { id, screenId } = c.req.param();
		const screen = await prisma.screen.findFirst({
			where: { id: screenId, projectId: id },
			include: {
				components: {
					orderBy: { order: "asc" },
					include: {
						children: { orderBy: { order: "asc" } },
						form: {
							include: {
								fields: {
									orderBy: { order: "asc" },
									include: { options: { orderBy: { order: "asc" } } },
								},
							},
						},
					},
				},
			},
		});
		if (!screen) return c.json({ error: "not_found" }, 404);
		return c.json({ screen });
	})

	.get("/:id/translations", async (c) => {
		const projectId = c.req.param("id");
		const localeCode = c.req.query("locale");
		const translations = await prisma.translation.findMany({
			where: {
				textKey: { projectId },
				...(localeCode ? { locale: { code: localeCode } } : {}),
			},
			include: { textKey: true, locale: true },
			orderBy: { textKey: { namespace: "asc" } },
		});
		return c.json({ translations });
	})

	// ─── Manage project locales ────────────────────────────────────────
	.post(
		"/:id/locales",
		zValidator(
			"json",
			z.object({
				localeCode: z
					.string()
					.regex(localeCodeRe, 'use a code like "en" or "fr-FR"'),
				localeName: z.string().min(1).max(64),
			}),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const { localeCode, localeName } = c.req.valid("json");

			const project = await prisma.project.findUnique({
				where: { id: projectId },
			});
			if (!project) return c.json({ error: "project_not_found" }, 404);

			const locale = await prisma.locale.upsert({
				where: { code: localeCode },
				update: {},
				create: { code: localeCode, name: localeName },
			});

			await prisma.projectLocale.upsert({
				where: { projectId_localeId: { projectId, localeId: locale.id } },
				update: {},
				create: { projectId, localeId: locale.id },
			});

			return c.json({ locale }, 201);
		},
	)

	.delete("/:id/locales/:localeId", async (c) => {
		const { id: projectId, localeId } = c.req.param();

		const project = await prisma.project.findUnique({
			where: { id: projectId },
		});
		if (!project) return c.json({ error: "project_not_found" }, 404);
		if (project.defaultLocaleId === localeId) {
			return c.json({ error: "cannot_remove_default_locale" }, 400);
		}

		await prisma.projectLocale.delete({
			where: { projectId_localeId: { projectId, localeId } },
		});
		return c.json({ ok: true });
	})

	// ─── Upsert a translation value ────────────────────────────────────
	.put(
		"/:id/translations",
		zValidator(
			"json",
			z.object({
				namespace: z.string().min(1).max(256),
				localeCode: z
					.string()
					.regex(localeCodeRe, 'use a code like "en" or "fr-FR"'),
				value: z.string().max(10_000),
			}),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const { namespace, localeCode, value } = c.req.valid("json");

			const locale = await prisma.locale.findUnique({
				where: { code: localeCode },
			});
			if (!locale) return c.json({ error: "locale_not_found" }, 404);

			// Ensure locale is linked to project
			await prisma.projectLocale.upsert({
				where: {
					projectId_localeId: { projectId, localeId: locale.id },
				},
				update: {},
				create: { projectId, localeId: locale.id },
			});

			const textKey = await prisma.textKey.upsert({
				where: {
					projectId_namespace: { projectId, namespace },
				},
				update: {},
				create: { projectId, namespace },
			});

			const translation = await prisma.translation.upsert({
				where: {
					textKeyId_localeId: { textKeyId: textKey.id, localeId: locale.id },
				},
				update: { value },
				create: { textKeyId: textKey.id, localeId: locale.id, value },
				include: { textKey: true, locale: true },
			});

			return c.json({ translation });
		},
	)

	// ─── Control Plane V1 — concept CRUD mounts ─────────────────────
	.route("/:id/resources", resourcesRoutes)
	.route("/:id/operations", operationsRoutes)
	.route("/:id/policies", policiesRoutes)
	.route("/:id/integrations", integrationsRoutes)
	.route("/:id/triggers", triggersRoutes)
	.route("/:id/behaviors", behaviorsRoutes)
	.route("/:id/relations", relationsRoutes)
	.route("/:id/product-specs", productSpecsRoutes)
	.route("/:id/screen-specs", screenSpecsRoutes)
	.route("/:id/open-questions", openQuestionsRoutes)
	.route("/:id/assumptions", assumptionsRoutes)
	.route("/:id/sdd-artifacts", sddArtifactsRoutes)
	.route("/:id/requirements", requirementsRoutes)
	.route("/:id/requirement-mappings", requirementMappingsRoutes)
	.route("/:id/platform-proposals", platformProposalsRoutes)
	.route("/:id/delta-spec", deltaSpecRoutes)
	.route("/:id/expr", exprRoutes)
	.route("/:id/operation-dsl", operationDslRoutes)
	.route("/:id/policy-dsl", policyDslRoutes)
	.route("/:id/import", importRoutes)
	.route("/:id/contracts", contractsRoutes)
	.get("/:id/coverage-gate", async (c) => {
		const projectId = c.req.param("id");
		const result = await checkCoverageGate(projectId);
		return c.json(result);
	})
	.get("/:id/clarification-gate", async (c) => {
		const projectId = c.req.param("id");
		const result = await checkClarificationGate(projectId);
		return c.json(result);
	})

	// ─── ChangeSets API ─────────────────────────────────────────────
	.route("/:id/changesets", changeSetsRoutes)

	// ─── Spec endpoints (project) ───────────────────────────────────
	.route("/:id/spec", specRoutes)

	// ─── Codegen ────────────────────────────────────────────────────────
	// POST /:id/codegen — generate app skeleton (dryRun=true by default)
	// Supports layer?: "all"|"database"|"shared"|"auth"|"backend"|"frontend"|"sdk"|"tests"
	.post(
		"/:id/codegen",
		zValidator(
			"json",
			z.object({
				dryRun: z.boolean().optional(),
				outDir: z.string().optional(),
				trackArtifacts: z.boolean().optional(),
				layer: z
					.enum(["all", "database", "shared", "auth", "backend", "frontend", "sdk", "tests"])
					.optional(),
			}).optional(),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const body = c.req.valid("json") ?? {};
			const dryRun = (body as { dryRun?: boolean }).dryRun !== false; // default true
			const outDir = (body as { outDir?: string }).outDir;
			const trackArtifacts = (body as { trackArtifacts?: boolean }).trackArtifacts;
			const layer = (body as { layer?: CodegenLayer }).layer ?? "all";

			// ─── Governance checks for non-dryRun codegen ──────────────
			if (!dryRun) {
				const govReport = await runGovernanceChecks(projectId, {}, {
					codegen: { dryRun, trackArtifacts },
					checkClarificationGate: true,
				});
				if (!govReport.ok) {
					return c.json({ error: "governance_violation", violations: govReport.violations }, 422);
				}
			}

			try {
				const result = await generateApp(projectId, { dryRun, layer, ...(outDir ? { outDir } : {}) });
				// Audit non-dryRun codegen (best-effort)
				if (!dryRun) {
					void emitAuditEvent({ projectId, action: "generate_app", target: { outDir, layer }, metadata: { fileCount: result.files?.length } });
				}
				return c.json(result);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				if (message.includes("not found") || message.includes("not_found")) {
					return c.json({ error: "not_found" }, 404);
				}
				if (
					message.includes("meta-platform") ||
					message.includes("traversal") ||
					message.includes("allowed location")
				) {
					return c.json({ error: "sandbox_violation", detail: message }, 400);
				}
				return c.json({ error: "codegen_failed", detail: message }, 500);
			}
		},
	)

	// POST /:id/codegen/plan — return order + what would be generated
	.post("/:id/codegen/plan", async (c) => {
		const projectId = c.req.param("id") as string;
		try {
			const plan = await planCodegen(projectId);
			return c.json({ plan });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json({ error: "plan_failed", detail: message }, 500);
		}
	})

	// POST /:id/codegen/check — verify structure of generated output
	.post(
		"/:id/codegen/check",
		zValidator(
			"json",
			z.object({ outDir: z.string().min(1) }),
			validationHook,
		),
		async (c) => {
			const { outDir } = c.req.valid("json");
			try {
				const result = checkGeneratedProject(outDir);
				return c.json(result);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return c.json({ error: "check_failed", detail: message }, 500);
			}
		},
	)

	// POST /:id/codegen/typecheck — best-effort tsc --noEmit
	.post(
		"/:id/codegen/typecheck",
		zValidator(
			"json",
			z.object({ outDir: z.string().min(1) }),
			validationHook,
		),
		async (c) => {
			const { outDir } = c.req.valid("json");
			const result = await typecheckGeneratedProject(outDir);
			return c.json(result);
		},
	)
	// ─── Canonical alias routes (plan.md §HTTP Control Plane) ───────

	// GET /:id/spec.json — canonical alias for GET /:id/spec
	.get("/:id/spec.json", async (c) => {
		const projectId = c.req.param("id");
		const spec = await getSpec(projectId);
		if (!spec) return c.json({ error: "not_found" }, 404);
		return c.json({ spec });
	})

	// GET /:id/spec.md — canonical alias for GET /:id/spec/.md
	.get("/:id/spec.md", async (c) => {
		const projectId = c.req.param("id");
		const spec = await getSpec(projectId);
		if (!spec) return c.json({ error: "not_found" }, 404);
		return c.text(renderSpecMd(spec), 200, { "content-type": "text/markdown; charset=utf-8" });
	})

	// GET /:id/revision-at — alias for /:id/changesets/spec-at
	// Query: ?version=<n>|latest  OR  ?changeSetId=<csid>
	.get("/:id/revision-at", async (c) => {
		const projectId = c.req.param("id");
		const versionParam = c.req.query("version") ?? "latest";
		const atVersion: number | "latest" =
			versionParam === "latest" ? "latest" : Number(versionParam);
		if (versionParam !== "latest" && Number.isNaN(atVersion as number)) {
			return c.json({ error: "invalid_version" }, 400);
		}
		const { getSpecAt } = await import("./lib/spec-snapshot");
		const spec = await getSpecAt(prisma, projectId, atVersion);
		return c.json({ spec });
	})

	// GET /:id/diff — alias for /:id/changesets/diff
	// Query: ?from=<csId>&to=<csId>  OR  ?a=<csId>&b=<csId>
	.get("/:id/diff", async (c) => {
		const a = c.req.query("a") ?? c.req.query("from");
		const b = c.req.query("b") ?? c.req.query("to");
		if (!a || !b) return c.json({ error: "missing_a_or_b_or_from_to" }, 400);
		const { diffChangeSets } = await import("./lib/changeset-diff");
		const result = await diffChangeSets(prisma, a, b);
		return c.json(result);
	})

	// POST /:id/delta/from-proposal — alias for /:id/delta-spec/from-proposal
	.post("/:id/delta/from-proposal", zValidator("json", z.object({ proposalId: z.string().min(1) }), validationHook), async (c) => {
		const projectId = c.req.param("id");
		const { proposalId } = c.req.valid("json");
		const proposal = await prisma.platformSpecProposal.findFirst({
			where: { id: proposalId, projectId },
		});
		if (!proposal) return c.json({ error: "not_found" }, 404);
		const { compileProposalToDelta } = await import("./lib/delta-spec-compile");
		const contents = (proposal.proposal ?? {}) as import("./lib/platform-proposal").ProposalContents;
		const deltaSpec = compileProposalToDelta(contents);
		return c.json({ deltaSpec });
	})

	// POST /:id/validate — alias for /:id/delta-spec/validate (deltaSpec lint)
	.post("/:id/validate", zValidator("json", z.object({ deltaSpec: z.record(z.unknown()) }), validationHook), async (c) => {
		const projectId = c.req.param("id");
		const { deltaSpec } = c.req.valid("json");
		const [existingEntities, existingOperations] = await Promise.all([
			prisma.entity.findMany({ where: { projectId }, select: { name: true } }),
			prisma.operation.findMany({ where: { projectId }, select: { name: true } }),
		]);
		const { validateDeltaSpec } = await import("./lib/delta-spec-validation");
		const result = validateDeltaSpec(deltaSpec, {
			existingEntityNames: new Set(existingEntities.map((e) => e.name)),
			existingOperationNames: new Set(existingOperations.map((o) => o.name)),
		});
		return c.json(result);
	})

	// POST /:id/apply — alias for /:id/delta-spec/apply (one-shot apply)
	.post("/:id/apply", zValidator("json", z.object({
		deltaSpec: z.record(z.unknown()),
		message: z.string().min(1).max(512).default("apply delta spec"),
		confirmDeletes: z.boolean().optional(),
	}), validationHook), async (c) => {
		const projectId = c.req.param("id") as string;
		const { deltaSpec: raw, message, confirmDeletes } = c.req.valid("json");

		// ─── Governance checks (pre-apply) ──────────────────────────────
		const govReport = await runGovernanceChecks(projectId, raw, {
			apply: { confirmDeletes },
		});
		if (!govReport.ok) {
			return c.json({ error: "governance_violation", violations: govReport.violations }, 422);
		}

		const { deltaSpecSchema } = await import("./lib/dsl/delta-spec");
		const { applyDeltaSpec } = await import("./lib/delta-spec-apply");
		const parsed = deltaSpecSchema.passthrough().safeParse(raw);
		if (!parsed.success) return c.json({ ok: false, errors: parsed.error.issues }, 400);
		const cs = await prisma.changeSet.create({
			data: { projectId, message, status: "DRAFT" },
		});
		const result = await applyDeltaSpec(prisma, parsed.data, { projectId, changeSetId: cs.id });
		if (!result.ok) {
			return c.json({ ok: false, changeSetId: cs.id, errors: result.errors }, 422);
		}
		await prisma.changeSet.update({
			where: { id: cs.id },
			data: { status: "APPLIED", appliedAt: new Date() },
		});
		// Audit (best-effort)
		void emitAuditEvent({ projectId, action: "apply_delta", target: { changeSetId: cs.id, message }, metadata: { appliedCount: result.appliedCount } });
		return c.json({ ok: true, changeSetId: cs.id, applied: result.appliedCount, createdIds: result.createdIds, skipped: result.errors ?? [] });
	})

	// POST /:id/product-spec/from-prompt — 501: use MCP tool or agent
	// Accepts structured payload to create a ProductSpec directly (no LLM call).
	// The "from-prompt" name is preserved for API surface parity; use the MCP
	// agent dtfs-product-analyst to generate the structured payload from NL.
	.post("/:id/product-spec/from-prompt", async (c) => {
		return c.json({
			error: "not_implemented_without_llm",
			hint: "Use MCP tool dtfs__create_product_spec or agent dtfs-product-analyst to generate structured output, then POST /api/projects/:id/product-specs with the result.",
		}, 501);
	})

	// POST /:id/screen-spec/from-prompt — 501: use MCP tool or agent
	.post("/:id/screen-spec/from-prompt", async (c) => {
		return c.json({
			error: "not_implemented_without_llm",
			hint: "Use MCP tool dtfs__create_screen_spec or agent dtfs-screen-spec-writer to generate structured output, then POST /api/projects/:id/screen-specs with the result.",
		}, 501);
	})

	// POST /:id/sdd/generate — 501: use MCP tool or agent
	.post("/:id/sdd/generate", async (c) => {
		return c.json({
			error: "not_implemented_without_llm",
			hint: "Use agent dtfs-sdd-writer to generate SDD artifacts, then POST /api/projects/:id/sdd-artifacts/generate with the structured payload.",
		}, 501);
	})

	// POST /:id/platform/propose — 501: use MCP tool or agent
	.post("/:id/platform/propose", async (c) => {
		return c.json({
			error: "not_implemented_without_llm",
			hint: "Use agent dtfs-platform-mapper to generate a platform proposal, then POST /api/projects/:id/platform-proposals with the structured payload.",
		}, 501);
	});

export const revisionsRoutes = new Hono()
	.get("/", async (c) => {
		const entityType = c.req.query("entityType");
		const entityId = c.req.query("entityId");
		if (!entityType || !entityId) {
			return c.json({ error: "entityType and entityId are required" }, 400);
		}
		const revisions = await prisma.revision.findMany({
			where: { entityType, entityId },
			orderBy: { version: "desc" },
			include: { actor: { select: { id: true, name: true, email: true } } },
		});
		return c.json({ revisions });
	})
	.route("/", revisionRevertRoutes);

