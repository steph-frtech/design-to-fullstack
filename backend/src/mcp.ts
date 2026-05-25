// MCP server — exposes the Control Plane to LLMs (Claude Code etc.).
// Each tool wraps a single backend operation. Keep them small and typed.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "./db";
import { runInChangeSet } from "./lib/changeset-context";
import { describeCatalogue } from "./lib/behaviors";
import {
	type ProductSpecCheck,
	isComplete,
	validateProductSpec,
} from "./lib/product-spec-validation";
import {
	type ScreenSpecCheck,
	isComplete as isScreenComplete,
	validateScreenSpec,
} from "./lib/screen-spec-validation";
import { checkClarificationGate } from "./lib/clarification-gate";
import { checkCoverageGate } from "./lib/coverage-gate";
import { buildProposalSkeleton } from "./lib/platform-proposal";
import { validateProposalEnvelope } from "./lib/platform-proposal-validation";
import { compileProposalToDelta } from "./lib/delta-spec-compile";
import { validateDeltaSpec } from "./lib/delta-spec-validation";
import { explainDeltaSpec } from "./lib/delta-spec-explain";
import { deltaSpecSchema } from "./lib/dsl/delta-spec";
import { EXPR_FUNCTIONS, exprSchema } from "./lib/dsl/expr-ast";
import { validateExpr } from "./lib/dsl/expr-validate";
import { evalExpr } from "./lib/dsl/expr-eval";
import { collectExprCalls, collectExprRefs, inferExprType } from "./lib/dsl/expr-analyze";
import {
	collectOperationEntities,
	collectOperationEvents,
	collectOperationIntegrations,
	collectOperationPolicies,
} from "./lib/dsl/operation-analyze";
import { operationBodySchema, OPERATION_STEP_KINDS } from "./lib/dsl/operation-dsl";
import { validateOperationBody } from "./lib/dsl/operation-validate";
import { policyRuleSchema, POLICY_RULE_OPS } from "./lib/dsl/policy-dsl";
import { evalPolicyRule } from "./lib/dsl/policy-eval";
import { validatePolicyRule } from "./lib/dsl/policy-validate";
import type { ProposalContents } from "./lib/platform-proposal";
import { validateSddArtifacts } from "./lib/sdd-validation";
import { pathForKind, sha256, syncFromDisk, syncToDisk } from "./lib/spec-kit-sync";
import { revertField, revertOne, revertChangeSet } from "./lib/revert";
import { applyDeltaSpec } from "./lib/delta-spec-apply";
import { getSpecAt } from "./lib/spec-snapshot";
import { diffChangeSets } from "./lib/changeset-diff";
import { expandBehaviors, getSpec, renderSpecMd, validateProposal } from "./spec";
import { expandBehaviorsToDelta } from "./lib/behavior-expand-db";
import type { BehaviorKind } from "./lib/behaviors";
import { analyzeHtml } from "./lib/import/html-analyze";
import { diffHtmlAgainstScreenSpec } from "./lib/import/html-diff";
import { htmlAnalysisToProposal } from "./lib/import/html-to-proposal";
import { resolveFigmaAnalysis, designAnalysisToProposal } from "./lib/import/figma-analyze";
import { asJson } from "./lib/prisma-json";
import {
	generateApp,
	generateDatabaseSchema,
	generateSharedSdk,
	generateAuthRuntime,
	generateBackendApi,
	generateFrontendNext,
	generateTests,
	planCodegen,
	checkGeneratedProject,
	typecheckGeneratedProject,
	runGeneratedTests,
	diffGeneratedArtifacts,
} from "./codegen/codegen";
import { emitPrismaSchema, emitHonoRoutes, emitOperationHandlers, emitNextPages, generateLegacyFiles } from "./codegen/index";
import type { CodegenSpec } from "./codegen/types";
import { runGovernanceChecks } from "./lib/governance/governance-check";
import { readAuditLog } from "./lib/governance/audit";
import { describeRuntimeRoadmap } from "./runtime/index";
import { getRuntimeTarget, setRuntimeTarget } from "./lib/contracts/runtime-target";
import { compileBackendContract } from "./lib/contracts/compile-backend";
import { compileFrontendContract } from "./lib/contracts/compile-frontend";
import { compileSharedContract } from "./lib/contracts/compile-shared";
import { validateContracts } from "./lib/contracts/validate-contracts";
import { explainContracts } from "./lib/contracts/explain-contracts";

const CONCEPT_DOCS: Record<string, string> = {
	Entity:
		"Data shape. Has a name + Attributes. Doesn't expose anything by itself — see Resource for the API surface.",
	Attribute:
		"Field on an Entity. type ∈ {TEXT, EMAIL, NUMBER, …}. required + unique + config (per-type).",
	EntityRelation:
		"Asymmetric link between two Entities. Modeled separately because relations drive FK + cascade.",
	Resource:
		"REST exposure of an Entity. exposedOps list ∈ [list, read, create, update, delete] + queryConfig (pagination/filter/sort/search).",
	Operation:
		"Backend verb. kind ∈ {QUERY, COMMAND}. Has typed input/output, reads/writes lists, and a Step DSL body.",
	Policy:
		"Authorization rule. scope ∈ {RESOURCE, OPERATION, ENTITY, FIELD}. rule = PolicyRule expression tree. Compiles to middleware + Prisma where (+ RLS later).",
	Integration:
		"Named connection to an external service. Provider (stripe, sendgrid, ...) + capabilities. Secrets via secretRefs (env or store).",
	Trigger:
		"Non-human cause that fires an Operation. kind ∈ {EVENT, SCHEDULE, WEBHOOK}.",
	Behavior:
		"Composable macro on an Entity (ownable, soft-deletable, publishable, …). Expanded before codegen — see /api/projects/:id/expand-behaviors.",
	ChangeSet:
		"Logical group of Revisions, git-commit style. Tracks revert history (revertOfId, revertedById).",
	Revision:
		"Atomic per-row mutation snapshot + diff. Linked to a ChangeSet for grouping.",
	Expr:
		"Step DSL expressions are JSONata strings (e.g. `$.input.title`, `$lowercase($.input.title)`). Available roots: $.input, $.auth.user, $.record, $.system, $.env, plus any `as: ...` from prior steps.",
};

export function createMcpServer() {
	const server = new McpServer({
		name: "design-to-fullstack",
		version: "0.1.0",
	});

	// ─── Spec & introspection ──────────────────────────────────────
	server.tool(
		"dtfs__list_projects",
		"List all projects (id + slug + counts).",
		{},
		async () => {
			const projects = await prisma.project.findMany({
				orderBy: { updatedAt: "desc" },
				select: {
					id: true,
					slug: true,
					updatedAt: true,
					_count: { select: { entities: true, screens: true, operations: true } },
				},
			});
			return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__get_project_spec",
		"Return the full nested spec of a project, JSON or markdown.",
		{
			projectId: z.string(),
			format: z.enum(["json", "md"]).default("json"),
		},
		async ({ projectId, format }) => {
			const spec = await getSpec(projectId);
			if (!spec)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const text = format === "md" ? renderSpecMd(spec) : JSON.stringify(spec, null, 2);
			return { content: [{ type: "text", text }] };
		},
	);

	server.tool(
		"dtfs__describe_concept",
		"Return the high-level documentation of a Control Plane concept.",
		{
			concept: z.enum([
				"Entity",
				"Attribute",
				"EntityRelation",
				"Resource",
				"Operation",
				"Policy",
				"Integration",
				"Trigger",
				"Behavior",
				"ChangeSet",
				"Revision",
				"Expr",
			]),
		},
		async ({ concept }) => {
			return {
				content: [{ type: "text", text: CONCEPT_DOCS[concept] ?? "(no docs)" }],
			};
		},
	);

	server.tool(
		"dtfs__list_behaviors",
		"Return the V1 frozen catalogue of Behaviors with their expansion descriptions.",
		{},
		async () => {
			return {
				content: [
					{ type: "text", text: JSON.stringify(describeCatalogue(), null, 2) },
				],
			};
		},
	);

	server.tool(
		"dtfs__expand_behaviors",
		"Preview what Behaviors on a project would expand to (dry run, no DB write). Pass asDelta:true to also receive the canonical DeltaSpec (Phase 7). Pass entities:[{name,behaviors}] to override the DB lookup.",
		{
			projectId: z.string(),
			asDelta: z.boolean().optional(),
			entities: z
				.array(
					z.object({
						name: z.string().min(1),
						behaviors: z.array(z.string()).min(1),
						config: z.record(z.unknown()).optional(),
					}),
				)
				.optional(),
		},
		async ({ projectId, asDelta, entities }) => {
			// Rétro-compat: if asDelta absent or false, return V1 preview only
			if (!asDelta && !entities) {
				const expansion = await expandBehaviors(projectId);
				if (!expansion)
					return {
						content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
					};
				return {
					content: [{ type: "text", text: JSON.stringify(expansion, null, 2) }],
				};
			}
			// asDelta=true or entities override → return DeltaSpec
			const entityRequests = entities?.map((e) => ({
				name: e.name,
				behaviors: e.behaviors as BehaviorKind[],
				config: e.config as Partial<Record<BehaviorKind, unknown>> | undefined,
			}));
			const result = await expandBehaviorsToDelta(
				projectId,
				entityRequests ? { entities: entityRequests } : {},
			);
			if (!result)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__expand_behaviors_to_delta",
		"Expand (entity, behavior[]) pairs into a canonical DeltaSpec (Phase 7). Always dry-run — no DB write. Use entities to specify ad-hoc pairs or omit to use the project's stored Behavior rows.",
		{
			projectId: z.string(),
			entities: z
				.array(
					z.object({
						name: z.string().min(1),
						behaviors: z.array(z.string()).min(1),
						config: z.record(z.unknown()).optional(),
					}),
				)
				.optional(),
		},
		async ({ projectId, entities }) => {
			const entityRequests = entities?.map((e) => ({
				name: e.name,
				behaviors: e.behaviors as BehaviorKind[],
				config: e.config as Partial<Record<BehaviorKind, unknown>> | undefined,
			}));
			const result = await expandBehaviorsToDelta(
				projectId,
				entityRequests ? { entities: entityRequests } : {},
			);
			if (!result)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__validate_spec",
		"Lint a proposed deltaSpec (operations + policies) against project context.",
		{
			projectId: z.string(),
			operations: z
				.array(z.object({ name: z.string(), steps: z.array(z.record(z.unknown())) }))
				.optional(),
			policies: z
				.array(z.object({ name: z.string(), rule: z.record(z.unknown()) }))
				.optional(),
		},
		async ({ projectId, operations, policies }) => {
			const result = await validateProposal(projectId, {
				operations: operations as unknown as { name: string; steps: unknown }[] | undefined,
				policies: policies as unknown as { name: string; rule: unknown }[] | undefined,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// ─── History / ChangeSets ──────────────────────────────────────
	server.tool(
		"dtfs__begin_changeset",
		"Open a DRAFT ChangeSet to group subsequent mutations. Returns its id.",
		{ projectId: z.string(), message: z.string().min(1) },
		async ({ projectId, message }) => {
			const cs = await prisma.changeSet.create({
				data: { projectId, message, status: "DRAFT" },
			});
			return {
				content: [{ type: "text", text: JSON.stringify({ changeSetId: cs.id }) }],
			};
		},
	);

	server.tool(
		"dtfs__commit_changeset",
		"Commit a DRAFT ChangeSet (mark APPLIED).",
		{ changeSetId: z.string() },
		async ({ changeSetId }) => {
			const cs = await prisma.changeSet.update({
				where: { id: changeSetId },
				data: { status: "APPLIED", appliedAt: new Date() },
			});
			return {
				content: [{ type: "text", text: JSON.stringify({ ok: true, status: cs.status }) }],
			};
		},
	);

	server.tool(
		"dtfs__discard_changeset",
		"Discard a DRAFT (delete + its Revisions). Errors on non-DRAFT.",
		{ changeSetId: z.string() },
		async ({ changeSetId }) => {
			const cs = await prisma.changeSet.findUnique({ where: { id: changeSetId } });
			if (!cs)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			if (cs.status !== "DRAFT")
				return {
					content: [
						{ type: "text", text: JSON.stringify({ error: "not_draft", status: cs.status }) },
					],
				};
			await prisma.revision.deleteMany({ where: { changeSetId } });
			await prisma.changeSet.delete({ where: { id: changeSetId } });
			return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
		},
	);

	server.tool(
		"dtfs__revert_changeset",
		"Revert an APPLIED ChangeSet — creates a new APPLIED CS with inverse Revisions.",
		{ changeSetId: z.string() },
		async ({ changeSetId }) => {
			const original = await prisma.changeSet.findUnique({
				where: { id: changeSetId },
				include: { revisions: { orderBy: { createdAt: "asc" } } },
			});
			if (!original)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			if (original.status !== "APPLIED")
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: "not_applied", status: original.status }),
						},
					],
				};
			const newCs = await prisma.changeSet.create({
				data: {
					projectId: original.projectId,
					message: `revert of "${original.message}"`,
					status: "APPLIED",
					appliedAt: new Date(),
					revertOfId: original.id,
				},
			});
			const entries = [] as unknown[];
			await runInChangeSet(
				{ changeSetId: newCs.id, projectId: original.projectId, origin: "explicit" },
				async () => {
					for (const rev of [...original.revisions].reverse()) {
						entries.push(await revertOne(prisma, rev));
					}
				},
			);
			await prisma.changeSet.update({
				where: { id: original.id },
				data: { status: "REVERTED", revertedAt: new Date(), revertedById: newCs.id },
			});
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ revertChangeSetId: newCs.id, entries }, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"dtfs__apply_delta_spec",
		"Apply a DeltaSpec within an open DRAFT ChangeSet. Use dryRun:true for preview (no DB write).",
		{
			projectId: z.string(),
			changeSetId: z.string(),
			deltaSpec: z.record(z.unknown()),
			dryRun: z.boolean().optional(),
		},
		async ({ projectId, changeSetId, deltaSpec, dryRun }) => {
			const { deltaSpecSchema: schema } = await import("./lib/dsl/delta-spec");
			const parsed = schema.passthrough().safeParse(deltaSpec);
			if (!parsed.success) {
				return {
					content: [{ type: "text", text: JSON.stringify({ ok: false, errors: parsed.error.issues }) }],
				};
			}
			const result = await applyDeltaSpec(prisma, parsed.data, {
				projectId,
				changeSetId,
				dryRun,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	// Alias: canonical plan name → same impl
	server.tool(
		"dtfs__apply_spec",
		"Alias for dtfs__apply_delta_spec — apply a DeltaSpec within an open DRAFT ChangeSet.",
		{
			projectId: z.string(),
			changeSetId: z.string(),
			deltaSpec: z.record(z.unknown()),
			dryRun: z.boolean().optional(),
		},
		async ({ projectId, changeSetId, deltaSpec, dryRun }) => {
			const { deltaSpecSchema: schema } = await import("./lib/dsl/delta-spec");
			const parsed = schema.passthrough().safeParse(deltaSpec);
			if (!parsed.success) {
				return {
					content: [{ type: "text", text: JSON.stringify({ ok: false, errors: parsed.error.issues }) }],
				};
			}
			const result = await applyDeltaSpec(prisma, parsed.data, {
				projectId,
				changeSetId,
				dryRun,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__get_spec_at",
		"Reconstruct the Control Plane spec (entities, attributes, operations) at a given Revision version. Use 'latest' for current state.",
		{ projectId: z.string(), atVersion: z.union([z.number().int().positive(), z.literal("latest")]) },
		async ({ projectId, atVersion }) => {
			const spec = await getSpecAt(prisma, projectId, atVersion);
			return {
				content: [{ type: "text", text: JSON.stringify({ spec }, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__diff_changesets",
		"Diff two ChangeSets: returns revisions only in A, only in B, and those touching the same entity.",
		{ csIdA: z.string(), csIdB: z.string() },
		async ({ csIdA, csIdB }) => {
			const result = await diffChangeSets(prisma, csIdA, csIdB);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__list_history",
		"List recent ChangeSets for a project, latest first.",
		{ projectId: z.string(), limit: z.number().int().positive().max(200).default(50) },
		async ({ projectId, limit }) => {
			const items = await prisma.changeSet.findMany({
				where: { projectId },
				orderBy: { createdAt: "desc" },
				take: limit,
				include: {
					actor: { select: { id: true, name: true } },
					_count: { select: { revisions: true } },
				},
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__describe_changeset",
		"Detail of a ChangeSet including its Revisions.",
		{ changeSetId: z.string() },
		async ({ changeSetId }) => {
			const cs = await prisma.changeSet.findUnique({
				where: { id: changeSetId },
				include: {
					revisions: { orderBy: { createdAt: "asc" } },
					actor: { select: { id: true, name: true, email: true } },
				},
			});
			if (!cs)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return { content: [{ type: "text", text: JSON.stringify(cs, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__revert_revision",
		"Atomic revert of one Revision. Creates a new APPLIED ChangeSet wrapping the inverse.",
		{ revisionId: z.string() },
		async ({ revisionId }) => {
			const rev = await prisma.revision.findUnique({ where: { id: revisionId } });
			if (!rev)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const cs = rev.changeSetId
				? await prisma.changeSet.findUnique({ where: { id: rev.changeSetId } })
				: null;
			if (!cs)
				return {
					content: [
						{ type: "text", text: JSON.stringify({ error: "no_owning_changeset" }) },
					],
				};
			const newCs = await prisma.changeSet.create({
				data: {
					projectId: cs.projectId,
					message: `revert revision ${rev.id}`,
					status: "APPLIED",
					appliedAt: new Date(),
				},
			});
			let entry: unknown = null;
			await runInChangeSet(
				{ changeSetId: newCs.id, projectId: cs.projectId, origin: "explicit" },
				async () => {
					entry = await revertOne(prisma, rev);
				},
			);
			return {
				content: [
					{ type: "text", text: JSON.stringify({ changeSetId: newCs.id, entry }, null, 2) },
				],
			};
		},
	);

	server.tool(
		"dtfs__revert_field",
		"Ultra-fine revert: bring back ONE field of one UPDATE Revision.",
		{ revisionId: z.string(), field: z.string() },
		async ({ revisionId, field }) => {
			const rev = await prisma.revision.findUnique({ where: { id: revisionId } });
			if (!rev)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const cs = rev.changeSetId
				? await prisma.changeSet.findUnique({ where: { id: rev.changeSetId } })
				: null;
			if (!cs)
				return {
					content: [
						{ type: "text", text: JSON.stringify({ error: "no_owning_changeset" }) },
					],
				};
			const newCs = await prisma.changeSet.create({
				data: {
					projectId: cs.projectId,
					message: `revert field ${field} of revision ${rev.id}`,
					status: "APPLIED",
					appliedAt: new Date(),
				},
			});
			let entry: unknown = null;
			await runInChangeSet(
				{ changeSetId: newCs.id, projectId: cs.projectId, origin: "explicit" },
				async () => {
					entry = await revertField(prisma, rev, field);
				},
			);
			return {
				content: [
					{ type: "text", text: JSON.stringify({ changeSetId: newCs.id, entry }, null, 2) },
				],
			};
		},
	);

	// ─── Phase 1 — ProductSpec ──────────────────────────────────────
	server.tool(
		"dtfs__list_product_specs",
		"List all ProductSpec rows for a project (latest first).",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const items = await prisma.productSpec.findMany({
				where: { projectId },
				orderBy: { updatedAt: "desc" },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__get_product_spec",
		"Fetch one ProductSpec by id.",
		{ productSpecId: z.string() },
		async ({ productSpecId }) => {
			const item = await prisma.productSpec.findUnique({
				where: { id: productSpecId },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	const productSpecInput = {
		projectId: z.string(),
		title: z.string().min(1),
		description: z.string().min(1),
		domain: z.string().optional(),
		targetUsers: z.array(z.any()),
		goals: z.array(z.any()),
		nonGoals: z.array(z.any()).optional(),
		personas: z.array(z.any()).optional(),
		userJourneys: z.array(z.any()).optional(),
		businessObjects: z.array(z.any()).optional(),
		businessRules: z.array(z.any()).optional(),
		glossary: z.array(z.any()).optional(),
		assumptions: z.array(z.any()).optional(),
		openQuestions: z.array(z.any()).optional(),
	};

	server.tool(
		"dtfs__create_product_spec",
		"Persist a fully-extracted ProductSpec (call this AFTER the agent has structured the natural-language input).",
		productSpecInput,
		async (input) => {
			const { projectId, ...rest } = input;
			const item = await prisma.productSpec.create({
				data: {
					projectId,
					title: rest.title,
					description: rest.description,
					domain: rest.domain,
					targetUsers: rest.targetUsers as never,
					goals: rest.goals as never,
					nonGoals: (rest.nonGoals ?? undefined) as never,
					personas: (rest.personas ?? undefined) as never,
					userJourneys: (rest.userJourneys ?? undefined) as never,
					businessObjects: (rest.businessObjects ?? undefined) as never,
					businessRules: (rest.businessRules ?? undefined) as never,
					glossary: (rest.glossary ?? undefined) as never,
					assumptions: (rest.assumptions ?? undefined) as never,
					openQuestions: (rest.openQuestions ?? undefined) as never,
				},
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	// Alias: canonical plan name → same impl
	server.tool(
		"dtfs__create_product_spec_from_prompt",
		"Alias for dtfs__create_product_spec — persist a fully-extracted ProductSpec from a natural-language prompt.",
		productSpecInput,
		async (input) => {
			const { projectId, ...rest } = input;
			const item = await prisma.productSpec.create({
				data: {
					projectId,
					title: rest.title,
					description: rest.description,
					domain: rest.domain,
					targetUsers: rest.targetUsers as never,
					goals: rest.goals as never,
					nonGoals: (rest.nonGoals ?? undefined) as never,
					personas: (rest.personas ?? undefined) as never,
					userJourneys: (rest.userJourneys ?? undefined) as never,
					businessObjects: (rest.businessObjects ?? undefined) as never,
					businessRules: (rest.businessRules ?? undefined) as never,
					glossary: (rest.glossary ?? undefined) as never,
					assumptions: (rest.assumptions ?? undefined) as never,
					openQuestions: (rest.openQuestions ?? undefined) as never,
				},
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__update_product_spec",
		"Patch fields on a ProductSpec.",
		{
			productSpecId: z.string(),
			patch: z.record(z.any()),
		},
		async ({ productSpecId, patch }) => {
			const item = await prisma.productSpec.update({
				where: { id: productSpecId },
				data: patch as never,
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_product_spec",
		"Check whether a ProductSpec passes the required-fields checklist.",
		{ productSpecId: z.string() },
		async ({ productSpecId }) => {
			const item = await prisma.productSpec.findUnique({
				where: { id: productSpecId },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const checks: ProductSpecCheck[] = validateProductSpec(
				item as unknown as Record<string, unknown>,
			);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ complete: isComplete(checks), checks },
							null,
							2,
						),
					},
				],
			};
		},
	);

	// ─── Phase 2 — ScreenSpec ───────────────────────────────────────
	server.tool(
		"dtfs__list_screen_specs",
		"List all ScreenSpec rows for a project (latest first).",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const items = await prisma.screenSpec.findMany({
				where: { projectId },
				orderBy: { updatedAt: "desc" },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__get_screen_spec",
		"Fetch one ScreenSpec by id.",
		{ screenSpecId: z.string() },
		async ({ screenSpecId }) => {
			const item = await prisma.screenSpec.findUnique({
				where: { id: screenSpecId },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	const screenSpecInput = {
		projectId: z.string(),
		productSpecId: z.string().optional(),
		name: z.string().min(1),
		description: z.string().min(1),
		actor: z.string().optional(),
		purpose: z.string().optional(),
		userIntent: z.string().optional(),
		layoutHint: z.string().optional(),
		components: z.array(z.any()).optional(),
		fields: z.array(z.any()).optional(),
		actions: z.array(z.any()).optional(),
		dataNeeds: z.array(z.any()).optional(),
		businessRules: z.array(z.any()).optional(),
		emptyStates: z.array(z.any()).optional(),
		errorStates: z.array(z.any()).optional(),
		assumptions: z.array(z.any()).optional(),
		openQuestions: z.array(z.any()).optional(),
	};

	server.tool(
		"dtfs__create_screen_spec",
		"Persist a ScreenSpec extracted by the agent from a natural-language screen description.",
		screenSpecInput,
		async (input) => {
			const { projectId, ...rest } = input;
			const data: Record<string, unknown> = { projectId };
			for (const [k, v] of Object.entries(rest)) {
				if (v === undefined) continue;
				data[k] = v;
			}
			const item = await prisma.screenSpec.create({ data: data as never });
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	// Alias: canonical plan name → same impl
	server.tool(
		"dtfs__create_screen_spec_from_prompt",
		"Alias for dtfs__create_screen_spec — persist a ScreenSpec extracted from a natural-language screen description.",
		screenSpecInput,
		async (input) => {
			const { projectId, ...rest } = input;
			const data: Record<string, unknown> = { projectId };
			for (const [k, v] of Object.entries(rest)) {
				if (v === undefined) continue;
				data[k] = v;
			}
			const item = await prisma.screenSpec.create({ data: data as never });
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__update_screen_spec",
		"Patch fields on a ScreenSpec.",
		{
			screenSpecId: z.string(),
			patch: z.record(z.any()),
		},
		async ({ screenSpecId, patch }) => {
			const item = await prisma.screenSpec.update({
				where: { id: screenSpecId },
				data: patch as never,
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_screen_spec",
		"Check whether a ScreenSpec passes the required-fields checklist.",
		{ screenSpecId: z.string() },
		async ({ screenSpecId }) => {
			const item = await prisma.screenSpec.findUnique({
				where: { id: screenSpecId },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const checks: ScreenSpecCheck[] = validateScreenSpec(
				item as unknown as Record<string, unknown>,
			);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ complete: isScreenComplete(checks), checks },
							null,
							2,
						),
					},
				],
			};
		},
	);

	// ─── Phase 3 — Clarification ────────────────────────────────────
	server.tool(
		"dtfs__list_open_questions",
		"List open questions for a project. Filter by status if given.",
		{
			projectId: z.string(),
			status: z.enum(["OPEN", "ANSWERED", "DEFERRED"]).optional(),
		},
		async ({ projectId, status }) => {
			const items = await prisma.openQuestion.findMany({
				where: { projectId, ...(status ? { status } : {}) },
				orderBy: { createdAt: "desc" },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__create_open_question",
		"Create a new OpenQuestion (status defaults to OPEN).",
		{
			projectId: z.string(),
			scope: z.string().min(1),
			question: z.string().min(1),
			targetId: z.string().optional(),
		},
		async ({ projectId, scope, question, targetId }) => {
			const item = await prisma.openQuestion.create({
				data: { projectId, scope, question, targetId },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__answer_open_question",
		"Record an answer to an OpenQuestion; sets status to ANSWERED.",
		{ openQuestionId: z.string(), answer: z.string().min(1) },
		async ({ openQuestionId, answer }) => {
			const item = await prisma.openQuestion.update({
				where: { id: openQuestionId },
				data: { answer, status: "ANSWERED" },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__defer_open_question",
		"Mark an OpenQuestion as DEFERRED (we'll come back to it later).",
		{ openQuestionId: z.string() },
		async ({ openQuestionId }) => {
			const item = await prisma.openQuestion.update({
				where: { id: openQuestionId },
				data: { status: "DEFERRED" },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__list_assumptions",
		"List assumptions for a project. Filter by status if given.",
		{
			projectId: z.string(),
			status: z.enum(["OPEN", "ACCEPTED", "REJECTED"]).optional(),
		},
		async ({ projectId, status }) => {
			const items = await prisma.assumption.findMany({
				where: { projectId, ...(status ? { status } : {}) },
				orderBy: { createdAt: "desc" },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__create_assumption",
		"Create a new Assumption (status defaults to OPEN).",
		{
			projectId: z.string(),
			scope: z.string().min(1),
			text: z.string().min(1),
			targetId: z.string().optional(),
		},
		async ({ projectId, scope, text, targetId }) => {
			const item = await prisma.assumption.create({
				data: { projectId, scope, text, targetId },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__accept_assumption",
		"Mark an Assumption as ACCEPTED (validated by the user).",
		{ assumptionId: z.string() },
		async ({ assumptionId }) => {
			const item = await prisma.assumption.update({
				where: { id: assumptionId },
				data: { status: "ACCEPTED" },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__reject_assumption",
		"Mark an Assumption as REJECTED. Optionally append a reason to the text.",
		{ assumptionId: z.string(), reason: z.string().optional() },
		async ({ assumptionId, reason }) => {
			const existing = await prisma.assumption.findUnique({
				where: { id: assumptionId },
			});
			if (!existing)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const newText = reason
				? `${existing.text}\n\n[REJECTED] ${reason}`
				: existing.text;
			const item = await prisma.assumption.update({
				where: { id: assumptionId },
				data: { status: "REJECTED", text: newText },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__check_clarification_gate",
		"Check whether the project has any blocking OpenQuestion or Assumption (status=OPEN). Required before generating a DeltaSpec.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const result = await checkClarificationGate(projectId);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ─── Phase 4 — Spec Kit / SDD artifacts ─────────────────────────
	server.tool(
		"dtfs__list_sdd_artifacts",
		"List SDD artifacts (constitution / spec / plan / tasks / …) for a project. Filter by kind and/or featureKey.",
		{
			projectId: z.string(),
			kind: z.string().optional(),
			featureKey: z.string().optional(),
		},
		async ({ projectId, kind, featureKey }) => {
			const items = await prisma.specArtifact.findMany({
				where: {
					projectId,
					...(kind ? { kind } : {}),
					...(featureKey !== undefined ? { featureKey } : {}),
				},
				orderBy: { updatedAt: "desc" },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__read_sdd_artifact",
		"Read one SDD artifact by (projectId, kind, optional featureKey). Returns the latest version.",
		{
			projectId: z.string(),
			kind: z.string(),
			featureKey: z.string().optional(),
		},
		async ({ projectId, kind, featureKey }) => {
			const item = await prisma.specArtifact.findFirst({
				where: {
					projectId,
					kind,
					featureKey: featureKey ?? null,
				},
				orderBy: { updatedAt: "desc" },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__generate_sdd_artifacts",
		"Bulk upsert SDD artifacts (constitution, spec, plan, tasks, …). The agent provides the content for each kind ; backend persists.",
		{
			projectId: z.string(),
			featureKey: z.string().optional(),
			source: z.enum(["generated", "speckit", "manual"]).default("generated"),
			artifacts: z
				.array(
					z.object({
						kind: z.string(),
						content: z.string(),
						path: z.string().optional(),
					}),
				)
				.min(1),
		},
		async ({ projectId, featureKey, source, artifacts }) => {
			const upserted: { id: string; kind: string; featureKey: string | null }[] = [];
			for (const a of artifacts) {
				const fk = a.kind === "constitution" ? null : featureKey ?? null;
				const resolvedPath = a.path ?? pathForKind(a.kind, fk);
				const existing = await prisma.specArtifact.findFirst({
					where: { projectId, kind: a.kind, featureKey: fk },
					orderBy: { updatedAt: "desc" },
				});
				const hash = sha256(a.content);
				const row = existing
					? await prisma.specArtifact.update({
							where: { id: existing.id },
							data: {
								content: a.content,
								contentHash: hash,
								source,
								path: resolvedPath,
							},
						})
					: await prisma.specArtifact.create({
							data: {
								projectId,
								kind: a.kind,
								featureKey: fk,
								path: resolvedPath,
								content: a.content,
								contentHash: hash,
								source,
							},
						});
				upserted.push({ id: row.id, kind: row.kind, featureKey: row.featureKey });
			}
			return { content: [{ type: "text", text: JSON.stringify({ upserted }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__sync_speckit_artifacts",
		"Sync SDD artifacts between DB and the project's localPath directory. Direction 'to-disk' overwrites files ; 'from-disk' upserts DB.",
		{
			projectId: z.string(),
			direction: z.enum(["to-disk", "from-disk"]),
			featureKey: z.string().optional(),
		},
		async ({ projectId, direction, featureKey }) => {
			const result =
				direction === "to-disk"
					? await syncToDisk({ projectId, featureKey })
					: await syncFromDisk({ projectId, featureKey });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_sdd_artifacts",
		"Check whether the required SDD artifacts exist and are non-empty for a project / feature.",
		{ projectId: z.string(), featureKey: z.string().optional() },
		async ({ projectId, featureKey }) => {
			const result = await validateSddArtifacts(projectId, featureKey);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ─── Phase 5 — Requirements + Platform Mapping ─────────────────
	server.tool(
		"dtfs__list_requirements",
		"List Requirements for a project. Filter by status / priority / productSpecId.",
		{
			projectId: z.string(),
			status: z.enum(["DRAFT", "ACCEPTED", "MAPPED", "REJECTED"]).optional(),
			priority: z.string().optional(),
			productSpecId: z.string().optional(),
		},
		async ({ projectId, status, priority, productSpecId }) => {
			const items = await prisma.requirement.findMany({
				where: {
					projectId,
					...(status ? { status } : {}),
					...(priority ? { priority } : {}),
					...(productSpecId ? { productSpecId } : {}),
				},
				orderBy: { key: "asc" },
				include: { _count: { select: { mappings: true } } },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__get_requirement",
		"Fetch one Requirement with its mappings.",
		{ requirementId: z.string() },
		async ({ requirementId }) => {
			const item = await prisma.requirement.findUnique({
				where: { id: requirementId },
				include: { mappings: true },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__extract_requirements",
		"Bulk upsert Requirements extracted from SDD artifacts. Agent supplies the parsed list.",
		{
			projectId: z.string(),
			featureKey: z.string(),
			source: z
				.enum(["natural", "speckit", "imported", "manual"])
				.default("speckit"),
			requirements: z
				.array(
					z.object({
						key: z.string().min(1),
						title: z.string().min(1),
						description: z.string().min(1),
						priority: z.string().optional(),
						acceptanceCriteria: z.array(z.any()).optional(),
					}),
				)
				.min(1),
		},
		async ({ projectId, source, requirements }) => {
			const upserted: { id: string; key: string; created: boolean }[] = [];
			for (const r of requirements) {
				const existing = await prisma.requirement.findUnique({
					where: { projectId_key: { projectId, key: r.key } },
				});
				if (existing) {
					const updated = await prisma.requirement.update({
						where: { id: existing.id },
						data: {
							title: r.title,
							description: r.description,
							priority: r.priority,
							acceptanceCriteria: r.acceptanceCriteria as never,
							source,
						},
					});
					upserted.push({ id: updated.id, key: updated.key, created: false });
				} else {
					const created = await prisma.requirement.create({
						data: {
							projectId,
							key: r.key,
							title: r.title,
							description: r.description,
							priority: r.priority,
							acceptanceCriteria: r.acceptanceCriteria as never,
							source,
						},
					});
					upserted.push({ id: created.id, key: created.key, created: true });
				}
			}
			return { content: [{ type: "text", text: JSON.stringify({ upserted }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__accept_requirement",
		"Mark a Requirement as ACCEPTED (in scope, awaiting mapping).",
		{ requirementId: z.string() },
		async ({ requirementId }) => {
			const item = await prisma.requirement.update({
				where: { id: requirementId },
				data: { status: "ACCEPTED" },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__reject_requirement",
		"Mark a Requirement as REJECTED (out of scope).",
		{ requirementId: z.string() },
		async ({ requirementId }) => {
			const item = await prisma.requirement.update({
				where: { id: requirementId },
				data: { status: "REJECTED" },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__map_requirements_to_platform",
		"Bulk upsert RequirementMappings. Each mapping points a Requirement to one platform target (Entity, Operation, Policy, Screen, Field, TestScenario, …).",
		{
			projectId: z.string(),
			mappings: z
				.array(
					z.object({
						requirementId: z.string(),
						targetType: z.string(),
						targetId: z.string(),
						confidence: z.number().min(0).max(1).optional(),
						rationale: z.string().optional(),
					}),
				)
				.min(1),
		},
		async ({ projectId, mappings }) => {
			const created: { id: string; requirementId: string; targetType: string; targetId: string }[] = [];
			for (const m of mappings) {
				const req = await prisma.requirement.findFirst({
					where: { id: m.requirementId, projectId },
				});
				if (!req) continue;
				const existing = await prisma.requirementMapping.findFirst({
					where: {
						projectId,
						requirementId: m.requirementId,
						targetType: m.targetType,
						targetId: m.targetId,
					},
				});
				if (existing) continue;
				const row = await prisma.requirementMapping.create({
					data: { projectId, ...m },
				});
				created.push({
					id: row.id,
					requirementId: row.requirementId,
					targetType: row.targetType,
					targetId: row.targetId,
				});
				// Auto-transition
				const cnt = await prisma.requirementMapping.count({
					where: { requirementId: m.requirementId },
				});
				if (cnt > 0 && req.status !== "MAPPED" && req.status !== "REJECTED") {
					await prisma.requirement.update({
						where: { id: m.requirementId },
						data: { status: "MAPPED" },
					});
				}
			}
			return { content: [{ type: "text", text: JSON.stringify({ created }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__list_requirement_mappings",
		"List RequirementMappings for a project. Filter by requirementId / targetType.",
		{
			projectId: z.string(),
			requirementId: z.string().optional(),
			targetType: z.string().optional(),
		},
		async ({ projectId, requirementId, targetType }) => {
			const items = await prisma.requirementMapping.findMany({
				where: {
					projectId,
					...(requirementId ? { requirementId } : {}),
					...(targetType ? { targetType } : {}),
				},
				orderBy: { createdAt: "desc" },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_requirement_coverage",
		"Check that every in-scope Requirement (priority MUST/HIGH/CRITICAL OR status ACCEPTED) has at least one mapping.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const result = await checkCoverageGate(projectId);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ─── Phase 6 — PlatformSpec Proposal ────────────────────────────
	server.tool(
		"dtfs__propose_platform_spec",
		"Synthesize a read-only PlatformSpecProposal skeleton from the project's current state (ProductSpec + ScreenSpecs + Requirements + Mappings). Stores it as DRAFT and returns the row id.",
		{ projectId: z.string(), featureKey: z.string().optional() },
		async ({ projectId, featureKey }) => {
			const envelope = await buildProposalSkeleton({ projectId, featureKey });
			const row = await prisma.platformSpecProposal.create({
				data: {
					projectId,
					featureKey,
					proposal: envelope.proposal as never,
					warnings: envelope.warnings as never,
					assumptions: envelope.assumptions as never,
					openQuestions: envelope.openQuestions as never,
					confidenceScore: envelope.confidenceScore,
				},
			});
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ id: row.id, envelope }, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"dtfs__map_screens_to_platform",
		"For each ScreenSpec in the project (optionally filtered by featureKey), surface unmapped surfaces and propose Screen/Component/Form/DataBinding creates. Returns a JSON list; the agent decides how to fold it into a PlatformSpecProposal.",
		{ projectId: z.string(), featureKey: z.string().optional() },
		async ({ projectId, featureKey }) => {
			const screenSpecs = await prisma.screenSpec.findMany({
				where: { projectId },
			});
			const existingScreens = await prisma.screen.findMany({
				where: { projectId },
				select: { id: true, path: true },
			});
			const existingPaths = new Set(existingScreens.map((s) => s.path));
			const proposals = screenSpecs.map((ss) => ({
				screenSpecId: ss.id,
				name: ss.name,
				actor: ss.actor,
				purpose: ss.purpose,
				suggestedScreen: {
					path: `/${ss.name.toLowerCase().replace(/\s+/g, "-")}`,
					type: "web",
				},
				alreadyExists: existingPaths.has(
					`/${ss.name.toLowerCase().replace(/\s+/g, "-")}`,
				),
				components: ss.components,
				dataNeeds: ss.dataNeeds,
				actions: ss.actions,
			}));
			void featureKey;
			return { content: [{ type: "text", text: JSON.stringify({ proposals }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__list_platform_proposals",
		"List PlatformSpecProposal rows for a project. Filter by status.",
		{
			projectId: z.string(),
			status: z.enum(["DRAFT", "ACCEPTED", "REJECTED", "APPLIED"]).optional(),
		},
		async ({ projectId, status }) => {
			const items = await prisma.platformSpecProposal.findMany({
				where: { projectId, ...(status ? { status } : {}) },
				orderBy: { updatedAt: "desc" },
			});
			return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__get_platform_proposal",
		"Fetch one PlatformSpecProposal by id.",
		{ proposalId: z.string() },
		async ({ proposalId }) => {
			const item = await prisma.platformSpecProposal.findUnique({
				where: { id: proposalId },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__accept_platform_proposal",
		"Mark a PlatformSpecProposal as ACCEPTED (ready to be applied as DeltaSpec).",
		{ proposalId: z.string(), rationale: z.string().optional() },
		async ({ proposalId, rationale }) => {
			const item = await prisma.platformSpecProposal.update({
				where: { id: proposalId },
				data: { status: "ACCEPTED", rationale },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__reject_platform_proposal",
		"Mark a PlatformSpecProposal as REJECTED.",
		{ proposalId: z.string(), rationale: z.string().optional() },
		async ({ proposalId, rationale }) => {
			const item = await prisma.platformSpecProposal.update({
				where: { id: proposalId },
				data: { status: "REJECTED", rationale },
			});
			return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_platform_proposal",
		"Static lint of a PlatformSpecProposal — surfaces missing entity/operation refs, duplicates, low confidence.",
		{ proposalId: z.string() },
		async ({ proposalId }) => {
			const item = await prisma.platformSpecProposal.findUnique({
				where: { id: proposalId },
			});
			if (!item)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const existingEntities = await prisma.entity.findMany({
				where: { projectId: item.projectId },
				select: { name: true },
			});
			const existingOps = await prisma.operation.findMany({
				where: { projectId: item.projectId },
				select: { name: true },
			});
			const envelope = {
				proposal: (item.proposal ?? {}) as never,
				warnings: (item.warnings ?? []) as never,
				assumptions: (item.assumptions ?? []) as never,
				openQuestions: (item.openQuestions ?? []) as never,
				confidenceScore: item.confidenceScore ?? 0,
			};
			const checks = validateProposalEnvelope(
				envelope,
				new Set(existingEntities.map((e) => e.name)),
				new Set(existingOps.map((o) => o.name)),
			);
			return { content: [{ type: "text", text: JSON.stringify({ checks }, null, 2) }] };
		},
	);

	// ─── Phase 7 — DeltaSpec ────────────────────────────────────────
	server.tool(
		"dtfs__create_delta_from_platform_proposal",
		"Compile an existing PlatformSpecProposal into a DeltaSpec (read-only, no DB write). The proposal must belong to the project.",
		{ projectId: z.string(), proposalId: z.string() },
		async ({ projectId, proposalId }) => {
			const proposal = await prisma.platformSpecProposal.findFirst({
				where: { id: proposalId, projectId },
			});
			if (!proposal)
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			const contents = (proposal.proposal ?? {}) as ProposalContents;
			const deltaSpec = compileProposalToDelta(contents);
			return {
				content: [{ type: "text", text: JSON.stringify({ deltaSpec }, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__validate_delta_spec",
		"Static lint of a DeltaSpec — no DB write. Checks Zod structure + cross-refs (entity names, operation names).",
		{ projectId: z.string(), deltaSpec: z.record(z.unknown()) },
		async ({ projectId, deltaSpec }) => {
			const [existingEntities, existingOperations] = await Promise.all([
				prisma.entity.findMany({ where: { projectId }, select: { name: true } }),
				prisma.operation.findMany({ where: { projectId }, select: { name: true } }),
			]);
			const result = validateDeltaSpec(deltaSpec, {
				existingEntityNames: new Set(existingEntities.map((e) => e.name)),
				existingOperationNames: new Set(existingOperations.map((o) => o.name)),
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__explain_delta_spec",
		"Produce a Markdown summary of a DeltaSpec — counts creates/updates/deletes per bucket, lists top-3 names.",
		{ projectId: z.string(), deltaSpec: z.record(z.unknown()) },
		async ({ projectId: _projectId, deltaSpec }) => {
			const parsed = deltaSpecSchema.passthrough().safeParse(deltaSpec);
			const ds = parsed.success ? parsed.data : (deltaSpec as never);
			const markdown = explainDeltaSpec(ds);
			return {
				content: [{ type: "text", text: JSON.stringify({ markdown }, null, 2) }],
			};
		},
	);

	// ─── Phase 8 — Expr DSL ─────────────────────────────────────────
	server.tool(
		"dtfs__list_expr_functions",
		"Return the catalogue of all built-in Expr DSL functions: name, arity (args), and whether they are pure.",
		{},
		async () => {
			const functions = Object.entries(EXPR_FUNCTIONS).map(([name, meta]) => ({
				name,
				args: meta.args,
				pure: meta.pure,
			}));
			return { content: [{ type: "text", text: JSON.stringify({ functions }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_expr",
		"Validate a typed Expr AST node. Returns { ok, errors[] } with path/code/message per error.",
		{
			expr: z.record(z.unknown()),
			stepAliases: z.array(z.string()).optional(),
		},
		async ({ expr, stepAliases }) => {
			const result = validateExpr(expr, { availableStepAliases: stepAliases });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__eval_expr",
		"Evaluate a typed Expr AST against a scope object. Returns { value } or { error }.",
		{
			expr: z.record(z.unknown()),
			scope: z.record(z.unknown()).default({}),
		},
		async ({ expr, scope }) => {
			const parsed = exprSchema.safeParse(expr);
			if (!parsed.success) {
				const err = { error: "invalid_expr", issues: parsed.error.issues };
				return { content: [{ type: "text", text: JSON.stringify(err, null, 2) }] };
			}
			try {
				const value = evalExpr(parsed.data, scope as never);
				return { content: [{ type: "text", text: JSON.stringify({ value }, null, 2) }] };
			} catch (err) {
				return {
					content: [{ type: "text", text: JSON.stringify({ error: (err as Error).message }, null, 2) }],
				};
			}
		},
	);

	server.tool(
		"dtfs__analyze_expr",
		"Analyze a typed Expr AST: collect all $.refs, call names, and infer the top-level type.",
		{ expr: z.record(z.unknown()) },
		async ({ expr }) => {
			const parsed = exprSchema.safeParse(expr);
			if (!parsed.success) {
				const err = { error: "invalid_expr", issues: parsed.error.issues };
				return { content: [{ type: "text", text: JSON.stringify(err, null, 2) }] };
			}
			const result = {
				refs: collectExprRefs(parsed.data),
				calls: collectExprCalls(parsed.data),
				inferredType: inferExprType(parsed.data),
			};
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ─── Operation DSL ─────────────────────────────────────────────
	server.tool(
		"dtfs__list_operation_step_kinds",
		"Return the list of all valid OperationStep kinds with a short description.",
		{},
		async () => {
			const descriptions: Record<string, string> = {
				validate: "Validate the input against a JSON Schema.",
				authorize: "Check that the caller satisfies a named Policy.",
				read: "Fetch one or many records of an entity from the DB.",
				mutate: "Create, update, or delete a record of an entity.",
				callIntegration: "Invoke an external integration capability.",
				emitEvent: "Publish an internal event (consumed by Triggers).",
				branch: "Conditional fork — evaluates if, runs then or else.",
				assert: "Throw a runtime error if a condition is false.",
				log: "Emit a structured log entry (info/warn/error).",
				return: "Return a value from the operation.",
			};
			const kinds = OPERATION_STEP_KINDS.map((k) => ({
				kind: k,
				description: descriptions[k],
			}));
			return { content: [{ type: "text", text: JSON.stringify({ kinds }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_operation_body",
		"Validate an OperationBody (steps[]) against project context: entities, policies, integrations, events.",
		{
			projectId: z.string(),
			body: z.array(z.record(z.unknown())),
		},
		async ({ projectId, body }) => {
			const [entities, policies, integrations, events] = await Promise.all([
				prisma.entity.findMany({ where: { projectId }, select: { name: true } }),
				prisma.policy.findMany({ where: { projectId }, select: { name: true } }),
				prisma.integration.findMany({ where: { projectId }, select: { key: true } }),
				prisma.eventDefinition.findMany({ where: { projectId }, select: { name: true } }),
			]);
			const ctx = {
				entityNames: entities.map((e) => e.name),
				policyNames: policies.map((p) => p.name),
				integrationNames: integrations.map((i) => i.key),
				eventNames: events.map((e) => e.name),
			};
			const result = validateOperationBody(body, ctx);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__analyze_operation_body",
		"Extract the set of entities, policies, integrations, and events referenced by an OperationBody.",
		{ body: z.array(z.record(z.unknown())) },
		async ({ body: rawBody }) => {
			const parsed = operationBodySchema.safeParse(rawBody);
			if (!parsed.success) {
				const err = { error: "invalid_body", issues: parsed.error.issues };
				return { content: [{ type: "text", text: JSON.stringify(err, null, 2) }] };
			}
			const result = {
				entities: collectOperationEntities(parsed.data),
				policies: collectOperationPolicies(parsed.data),
				integrations: collectOperationIntegrations(parsed.data),
				events: collectOperationEvents(parsed.data),
			};
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__validate_policy_rule",
		"Validate a PolicyRule expression tree (Zod parse + Expr validation + regex check on matches).",
		{ rule: z.record(z.unknown()) },
		async ({ rule }) => {
			const result = validatePolicyRule(rule);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__list_policy_rule_ops",
		"Return the list of all valid PolicyRule operators.",
		{},
		async () => {
			return { content: [{ type: "text", text: JSON.stringify({ ops: POLICY_RULE_OPS }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__eval_policy_rule",
		"Evaluate a PolicyRule against a scope object. Returns { value: boolean }.",
		{
			rule: z.record(z.unknown()),
			scope: z.record(z.unknown()).default({}),
		},
		async ({ rule, scope }) => {
			const parsed = policyRuleSchema.safeParse(rule);
			if (!parsed.success) {
				const err = { error: "invalid_rule", issues: parsed.error.issues };
				return { content: [{ type: "text", text: JSON.stringify(err, null, 2) }] };
			}
			try {
				const value = evalPolicyRule(parsed.data, scope as never);
				return { content: [{ type: "text", text: JSON.stringify({ value }, null, 2) }] };
			} catch (err) {
				return {
					content: [{ type: "text", text: JSON.stringify({ error: (err as Error).message }, null, 2) }],
				};
			}
		},
	);

	// ─── Phase 14 — HTML / Figma Import ────────────────────────────────
	server.tool(
		"dtfs__analyze_html",
		"Deterministically parse an HTML string and return its structural analysis (forms, fields, actions, assets, headings, sections). No LLM, no DB write.",
		{ html: z.string().min(1) },
		async ({ html }) => {
			const analysis = analyzeHtml(html);
			return { content: [{ type: "text", text: JSON.stringify({ analysis }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__diff_html",
		"Compare an HTML structural analysis against an existing ScreenSpec to find mismatches (missing fields, actions, components).",
		{
			projectId: z.string(),
			screenSpecId: z.string(),
			html: z.string().min(1),
		},
		async ({ projectId, screenSpecId, html }) => {
			const screenSpec = await prisma.screenSpec.findFirst({
				where: { id: screenSpecId, projectId },
			});
			if (!screenSpec) {
				return { content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }] };
			}
			const analysis = analyzeHtml(html);
			const uiDelta = diffHtmlAgainstScreenSpec(analysis, screenSpec as unknown as Record<string, unknown>);
			return { content: [{ type: "text", text: JSON.stringify({ uiDelta }, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__import_html_proposal",
		"Analyze HTML and synthesize a PlatformSpecProposal (Phase 6 format). Persists as DRAFT. Does NOT apply entities — review before using dtfs__apply_delta_spec.",
		{
			projectId: z.string(),
			html: z.string().min(1),
			featureKey: z.string().optional(),
			screenSpecId: z.string().optional(),
		},
		async ({ projectId, html, featureKey, screenSpecId }) => {
			const analysis = analyzeHtml(html);
			const envelope = htmlAnalysisToProposal(analysis, {
				projectId,
				featureKey,
				screenSpecId,
				screenPath: analysis.title
					? `/${analysis.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
					: "/html-import",
			});
			const row = await prisma.platformSpecProposal.create({
				data: {
					projectId,
					featureKey,
					proposal: asJson(envelope.proposal),
					warnings: asJson(envelope.warnings),
					assumptions: asJson(envelope.assumptions),
					openQuestions: asJson(envelope.openQuestions),
					confidenceScore: envelope.confidenceScore,
					rationale: "Derived from HTML import (Phase 14). No entity has been created.",
				},
			});
			return {
				content: [{ type: "text", text: JSON.stringify({ id: row.id, proposal: envelope.proposal }, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__analyze_figma",
		"Analyze a Figma design. Provide figmaJson for an export JSON body, or fileKey + FIGMA_TOKEN env for API fetch. Returns DesignAnalysis or { error: figma_not_configured, hint }.",
		{
			figmaJson: z.record(z.unknown()).optional(),
			fileKey: z.string().optional(),
		},
		async ({ figmaJson, fileKey }) => {
			const result = await resolveFigmaAnalysis({ figmaJson, fileKey });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__import_design_proposal",
		"Analyze a Figma design and synthesize a PlatformSpecProposal. Persists as DRAFT. Provide figmaJson or fileKey (+ FIGMA_TOKEN env).",
		{
			projectId: z.string(),
			figmaJson: z.record(z.unknown()).optional(),
			fileKey: z.string().optional(),
			featureKey: z.string().optional(),
		},
		async ({ projectId, figmaJson, fileKey, featureKey }) => {
			const analysisResult = await resolveFigmaAnalysis({ figmaJson, fileKey });
			if ("error" in analysisResult) {
				return { content: [{ type: "text", text: JSON.stringify(analysisResult, null, 2) }] };
			}
			const envelope = designAnalysisToProposal(analysisResult, {
				projectId,
				featureKey,
				screenPath: analysisResult.fileName
					? `/${analysisResult.fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
					: "/design-import",
			});
			const row = await prisma.platformSpecProposal.create({
				data: {
					projectId,
					featureKey,
					proposal: asJson(envelope.proposal),
					warnings: asJson(envelope.warnings),
					assumptions: asJson(envelope.assumptions),
					openQuestions: asJson(envelope.openQuestions),
					confidenceScore: envelope.confidenceScore,
					rationale: "Derived from Figma/design import (Phase 14). No entity has been created.",
				},
			});
			return {
				content: [{ type: "text", text: JSON.stringify({ id: row.id, proposal: envelope.proposal }, null, 2) }],
			};
		},
	);

	// ─── Codegen tools ────────────────────────────────────────────────

	server.tool(
		"dtfs__generate_app",
		"Generate a full-stack app skeleton (Prisma schema, Hono routes, operation stubs, Next.js pages) from the project spec. dryRun=true (default) returns the manifest without writing to disk.",
		{
			projectId: z.string(),
			dryRun: z.boolean().optional(),
			outDir: z.string().optional(),
		},
		async ({ projectId, dryRun, outDir }) => {
			const result = await generateApp(projectId, {
				dryRun: dryRun !== false,
				outDir,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__preview_generated_file",
		"Preview the content of a single generated file for a project (regenerated in memory, nothing written to disk).",
		{
			projectId: z.string(),
			path: z.string(),
		},
		async ({ projectId, path: filePath }) => {
			// Run dryRun to get all files in memory, then return the one matching path
			const result = await generateApp(projectId, { dryRun: true });
			// Re-run generation in memory to get content (result only has manifest entries)
			// We need to actually generate the content. Use a helper approach:
			// generateApp with dryRun returns manifest (hashes + sizes) but not content.
			// To preview content, we re-generate with the emitters directly.

			// Load spec and re-emit
			const specFull = await getSpec(projectId);
			if (!specFull) {
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }],
				};
			}

			// Build minimal CodegenSpec from getSpec result
			const spec: CodegenSpec = {
				project: {
					id: specFull.id,
					slug: specFull.slug,
					localPath: specFull.localPath,
				},
				entities: specFull.entities.map((e) => ({
					id: e.id,
					name: e.name,
					attributes: e.attributes.map((a) => ({
						name: a.name,
						type: a.type as string,
						required: a.required,
						unique: a.unique,
					})),
				})),
				entityRelations: specFull.entityRelations.map((r) => ({
					id: r.id,
					fromEntityId: r.fromEntityId,
					toEntityId: r.toEntityId,
					name: r.name,
					kind: r.kind as string,
					required: r.required,
					fromField: r.fromField,
				})),
				resources: specFull.resources.map((r) => ({
					id: r.id,
					entityId: r.entityId,
					name: r.name,
					exposedOps: r.exposedOps,
				})),
				operations: specFull.operations.map((o) => ({
					id: o.id,
					name: o.name,
					kind: o.kind as string,
					inputSchema: o.inputSchema,
					outputSchema: o.outputSchema,
					steps: o.steps,
					bodyHint: o.bodyHint,
				})),
				screens: specFull.screens.map((s) => ({
					id: s.id,
					path: s.path,
					type: s.type,
					components: s.components.map((c) => ({
						id: c.id,
						type: c.type,
						config: c.config,
					})),
				})),
			};

			// Collect all files (legacy emitters for preview compatibility)
			const allFiles = generateLegacyFiles(spec);

			const found = allFiles.find((f) => f.path === filePath);
			if (!found) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								error: "file_not_found",
								available: allFiles.map((f) => f.path),
							}),
						},
					],
				};
			}

			return {
				content: [{ type: "text", text: found.content }],
			};
		},
	);


	// ─── Phase 28 — Granular codegen tools ─────────────────────────────────

	server.tool(
		"dtfs__plan_codegen",
		"Plan codegen: return the generation order and estimated file counts per layer, without writing anything.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const plan = await planCodegen(projectId);
			return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__generate_database_schema",
		"Generate only the Prisma database schema (prisma/schema.prisma). dryRun=true by default.",
		{
			projectId: z.string(),
			dryRun: z.boolean().optional(),
			outDir: z.string().optional(),
		},
		async ({ projectId, dryRun, outDir }) => {
			const result = await generateDatabaseSchema(projectId, { dryRun: dryRun !== false, outDir });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__generate_shared_sdk",
		"Generate the shared package (packages/shared): types, Zod schemas, errors, API contract, and typed SDK client. Contract-driven from SharedContract. dryRun=true by default.",
		{
			projectId: z.string(),
			dryRun: z.boolean().optional(),
			outDir: z.string().optional(),
		},
		async ({ projectId, dryRun, outDir }) => {
			const result = await generateSharedSdk(projectId, { dryRun: dryRun !== false, outDir });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__generate_auth_runtime",
		"Generate the Better Auth configuration stub (apps/api/src/auth.ts). Contract-driven from BackendContract.auth. dryRun=true by default.",
		{
			projectId: z.string(),
			dryRun: z.boolean().optional(),
			outDir: z.string().optional(),
		},
		async ({ projectId, dryRun, outDir }) => {
			const result = await generateAuthRuntime(projectId, { dryRun: dryRun !== false, outDir });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__generate_backend_api",
		"Generate the Hono backend API (apps/api/src: index.ts, routes/, operations/, middleware/, repositories/). Contract-driven from BackendContract. dryRun=true by default.",
		{
			projectId: z.string(),
			dryRun: z.boolean().optional(),
			outDir: z.string().optional(),
		},
		async ({ projectId, dryRun, outDir }) => {
			const result = await generateBackendApi(projectId, { dryRun: dryRun !== false, outDir });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__generate_frontend_next",
		"Generate the Next.js frontend (apps/web: app/, components/generated/, lib/). Contract-driven from FrontendContract. dryRun=true by default.",
		{
			projectId: z.string(),
			dryRun: z.boolean().optional(),
			outDir: z.string().optional(),
		},
		async ({ projectId, dryRun, outDir }) => {
			const result = await generateFrontendNext(projectId, { dryRun: dryRun !== false, outDir });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__generate_tests",
		"Generate test stubs (tests/api, tests/e2e, tests/contract). Contract-driven from BackendContract + SharedContract. dryRun=true by default.",
		{
			projectId: z.string(),
			dryRun: z.boolean().optional(),
			outDir: z.string().optional(),
		},
		async ({ projectId, dryRun, outDir }) => {
			const result = await generateTests(projectId, { dryRun: dryRun !== false, outDir });
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__check_generated_project",
		"Verify the structure of a generated project: checks that apps/api, apps/web, packages/shared exist and reads .dtfs-manifest.json for protected files. Returns { ok, issues }.",
		{ outDir: z.string() },
		async ({ outDir }) => {
			const result = checkGeneratedProject(outDir);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__typecheck_generated_project",
		"Best-effort typecheck of a generated project: runs tsc --noEmit if tsconfig.json is present, otherwise returns { skipped: true }.",
		{ outDir: z.string() },
		async ({ outDir }) => {
			const result = await typecheckGeneratedProject(outDir);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__run_generated_tests",
		"Run generated tests (V1 stub — always returns { skipped: true, reason: 'generated tests are stubs (V1)' }).",
		{ outDir: z.string() },
		async ({ outDir }) => {
			const result = runGeneratedTests(outDir);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool(
		"dtfs__diff_generated_artifacts",
		"Compare two generated manifest files by contentHash. Returns { added, removed, changed } file paths.",
		{
			projectId: z.string(),
			outDirA: z.string(),
			outDirB: z.string(),
		},
		async ({ projectId, outDirA, outDirB }) => {
			const result = diffGeneratedArtifacts(projectId, outDirA, outDirB);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ─── Phase 19 — Governance ────────────────────────────────────────

	server.tool(
		"dtfs__run_governance_checks",
		"Run the full set of governance guardrails against a DeltaSpec before apply. Returns { ok, violations, passed }. ok=false means at least one block-severity violation.",
		{
			projectId: z.string(),
			deltaSpec: z.record(z.unknown()),
			confirmDeletes: z.boolean().optional(),
		},
		async ({ projectId, deltaSpec, confirmDeletes }) => {
			const report = await runGovernanceChecks(projectId, deltaSpec, {
				apply: { confirmDeletes },
			});
			return {
				content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__read_audit_log",
		"Read recent audit events from the JSONL audit log. Filter by projectId and/or action. Returns events in reverse-chronological order.",
		{
			projectId: z.string().optional(),
			action: z.string().optional(),
			limit: z.number().int().positive().max(500).optional(),
		},
		async ({ projectId, action, limit }) => {
			const events = readAuditLog({ projectId, action, limit: limit ?? 50 });
			return {
				content: [{ type: "text", text: JSON.stringify({ events, count: events.length }, null, 2) }],
			};
		},
	);

	// ─── Phase 21 — Runtime Roadmap (V3 placeholder) ─────────────────────
	server.tool(
		"dtfs__describe_runtime_roadmap",
		"Return the static V3 runtime roadmap: 12 planned capabilities with their concepts, dependencies, and design notes. Read-only, no DB access.",
		{},
		async () => {
			const roadmap = describeRuntimeRoadmap();
			return {
				content: [{ type: "text", text: JSON.stringify({ roadmap }, null, 2) }],
			};
		},
	);

	server.tool(
		"echo",
		"Echo back a message — sanity check for MCP transport.",
		{ message: z.string() },
		async ({ message }) => ({
			content: [{ type: "text", text: `echo: ${message}` }],
		}),
	);

	// ─── Phase 26 — Contracts ─────────────────────────────────────────────────

	server.tool(
		"dtfs__get_runtime_target",
		"Return the RuntimeTarget for a project. If the migration is not applied, returns the DEFAULT hono-next target with source='default'. Never crashes.",
		{
			projectId: z.string(),
			name: z.string().optional(),
		},
		async ({ projectId, name }) => {
			const result = await getRuntimeTarget(projectId, name);
			return {
				content: [{ type: "text", text: JSON.stringify({ target: result, source: result.source }, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__set_runtime_target",
		"Upsert a RuntimeTarget for a project. If the migration is not applied, returns { ok:false, error:'runtime_target_table_not_migrated', hint }.",
		{
			projectId: z.string(),
			name: z.string().optional(),
			backend: z.record(z.unknown()).optional(),
			frontend: z.record(z.unknown()).optional(),
			auth: z.record(z.unknown()).optional(),
			database: z.record(z.unknown()).optional(),
			packageManager: z.string().optional(),
		},
		async ({ projectId, name, backend, frontend, auth, database, packageManager }) => {
			const result = await setRuntimeTarget(projectId, {
				name,
				backend: backend as never,
				frontend: frontend as never,
				auth: auth as never,
				database: database as never,
				packageManager,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__compile_backend_contract",
		"Compile the backend contract for a project in memory (read-only). Returns routes, schemas, middlewares, auth, and errors. Derived from Entity/Resource/Operation/Policy/AuthMethod.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const contract = await compileBackendContract(projectId);
			return {
				content: [{ type: "text", text: JSON.stringify({ contract }, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__compile_frontend_contract",
		"Compile the frontend contract for a project in memory (read-only). Returns pages, routes, forms, data bindings, actions, and auth guards. Derived from Screen/Component/Form/Action/DataBinding.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const contract = await compileFrontendContract(projectId);
			return {
				content: [{ type: "text", text: JSON.stringify({ contract }, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__compile_shared_contract",
		"Compile the shared contract for a project in memory (read-only). Returns shared types, Zod schemas, API client manifest, errors, and events. Derived from Entity/Operation/Policy/EventDefinition.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const contract = await compileSharedContract(projectId);
			return {
				content: [{ type: "text", text: JSON.stringify({ contract }, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__validate_contracts",
		"Validate cross-contract consistency for a project. Checks: backend schemas covered by shared types, routes have schema refs, data bindings resolve to backend routes, no orphan policies, entity coverage. Returns { ok, errors[], summary }.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const result = await validateContracts(projectId);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.tool(
		"dtfs__explain_contracts",
		"Return a human-readable Markdown summary of the compiled contracts: route count, page count, shared types, coverage, and any gaps.",
		{ projectId: z.string() },
		async ({ projectId }) => {
			const result = await explainContracts(projectId);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	return server;
}
