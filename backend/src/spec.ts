import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "./db";
import { BEHAVIOR_CATALOGUE, describeCatalogue } from "./lib/behaviors";
import { expandBehaviorsToDelta } from "./lib/behavior-expand-db";
import type { BehaviorKind } from "./lib/behaviors";
import { policyRuleSchema } from "./lib/dsl/policy";
import { operationStepsSchema, validateOperationSteps } from "./lib/dsl/steps";
import { validationHook } from "./lib/validation-hook";

// ─── /api/behaviors — catalogue (no projectId required) ────────────
export const behaviorsCatalogueRoutes = new Hono().get("/", (c) => {
	return c.json({ behaviors: describeCatalogue() });
});

// ─── /api/projects/:id/spec* — per-project ─────────────────────────
export const specRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id") as string;
		const spec = await getSpec(projectId);
		if (!spec) return c.json({ error: "not_found" }, 404);
		return c.json({ spec });
	})
	.get("/.md", async (c) => {
		const projectId = c.req.param("id") as string;
		const spec = await getSpec(projectId);
		if (!spec) return c.json({ error: "not_found" }, 404);
		return c.text(renderSpecMd(spec));
	})
	.post(
		"/validate",
		zValidator(
			"json",
			z.object({
				operations: z
					.array(
						z.object({
							name: z.string(),
							steps: operationStepsSchema,
						}),
					)
					.optional(),
				policies: z
					.array(z.object({ name: z.string(), rule: policyRuleSchema }))
					.optional(),
			}),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const proposal = c.req.valid("json");
			const result = await validateProposal(projectId, proposal);
			return c.json(result);
		},
	)
	.post("/expand-behaviors", async (c) => {
		const projectId = c.req.param("id") as string;
		const expansion = await expandBehaviors(projectId);
		if (!expansion) return c.json({ error: "not_found" }, 404);
		return c.json({ expansion });
	})
	.post(
		"/expand-behaviors/delta",
		zValidator(
			"json",
			z.object({
				entities: z
					.array(
						z.object({
							name: z.string().min(1),
							behaviors: z.array(z.string()).min(1),
							config: z.record(z.unknown()).optional(),
						}),
					)
					.optional(),
			}).optional(),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const body = c.req.valid("json") ?? {};
			const entities = body?.entities?.map((e) => ({
				name: e.name,
				behaviors: e.behaviors as BehaviorKind[],
				config: e.config as Partial<Record<BehaviorKind, unknown>> | undefined,
			}));
			const result = await expandBehaviorsToDelta(projectId, entities ? { entities } : {});
			if (!result) return c.json({ error: "not_found" }, 404);
			return c.json(result);
		},
	);

// ─── getSpec ───────────────────────────────────────────────────────
export async function getSpec(projectId: string) {
	const p = await prisma.project.findUnique({
		where: { id: projectId },
		include: {
			defaultLocale: true,
			locales: { include: { locale: true } },
			theme: true,
			entities: {
				include: { attributes: { orderBy: { name: "asc" } } },
			},
			entityRelations: true,
			resources: true,
			operations: { orderBy: { name: "asc" } },
			policies: true,
			integrations: true,
			triggers: true,
			behaviors: true,
			screens: {
				include: {
					components: {
						include: {
							form: { include: { fields: { include: { options: true } } } },
						},
					},
				},
			},
			textKeys: { include: { translations: { include: { locale: true } } } },
		},
	});
	return p;
}

// ─── renderSpecMd ──────────────────────────────────────────────────
export function renderSpecMd(spec: Awaited<ReturnType<typeof getSpec>>): string {
	if (!spec) return "";
	const lines: string[] = [];
	const p = spec;

	lines.push(`# Project \`${p.slug}\``);
	lines.push("");
	lines.push(
		`- defaultLocale: \`${p.defaultLocale.code}\` (${p.defaultLocale.name})`,
	);
	lines.push(`- locales: ${p.locales.map((l) => `\`${l.locale.code}\``).join(", ")}`);
	if (p.localPath) lines.push(`- localPath: \`${p.localPath}\``);
	if (p.githubRepo) lines.push(`- githubRepo: \`${p.githubRepo}\``);
	if (p.enabledScreenTypes && p.enabledScreenTypes.length > 0) {
		lines.push(`- enabledScreenTypes: ${p.enabledScreenTypes.join(", ")}`);
	}
	lines.push(`- version: \`v${p.currentVersion}\` · updatedAt: \`${p.updatedAt.toISOString()}\``);
	lines.push("");

	// Summary table
	lines.push("## Summary");
	lines.push("");
	lines.push("| Concept | Count |");
	lines.push("| ------- | ----- |");
	lines.push(`| Entities | ${p.entities.length} |`);
	lines.push(`| EntityRelations | ${p.entityRelations.length} |`);
	lines.push(`| Resources | ${p.resources.length} |`);
	lines.push(`| Operations | ${p.operations.length} |`);
	lines.push(`| Policies | ${p.policies.length} |`);
	lines.push(`| Integrations | ${p.integrations.length} |`);
	lines.push(`| Triggers | ${p.triggers.length} |`);
	lines.push(`| Behaviors | ${p.behaviors.length} |`);
	lines.push(`| Screens | ${p.screens.length} |`);
	lines.push(`| TextKeys | ${p.textKeys.length} |`);
	lines.push("");

	// Entities
	lines.push("## Entities");
	lines.push("");
	for (const e of p.entities) {
		lines.push(`### \`${e.name}\``);
		if (e.attributes.length === 0) lines.push("_no attributes_");
		else {
			lines.push("| Attribute | Type | Required | Unique |");
			lines.push("| --------- | ---- | -------- | ------ |");
			for (const a of e.attributes) {
				lines.push(`| \`${a.name}\` | ${a.type} | ${a.required} | ${a.unique} |`);
			}
		}
		lines.push("");
	}

	// EntityRelations
	if (p.entityRelations.length > 0) {
		lines.push("## EntityRelations");
		lines.push("");
		lines.push("| From | To | Name | Kind | Required |");
		lines.push("| ---- | -- | ---- | ---- | -------- |");
		const byId = new Map(p.entities.map((e) => [e.id, e.name]));
		for (const r of p.entityRelations) {
			lines.push(
				`| \`${byId.get(r.fromEntityId) ?? r.fromEntityId}\` | \`${byId.get(r.toEntityId) ?? r.toEntityId}\` | \`${r.name}\` | ${r.kind} | ${r.required} |`,
			);
		}
		lines.push("");
	}

	// Resources
	if (p.resources.length > 0) {
		lines.push("## Resources");
		lines.push("");
		for (const r of p.resources) {
			const entity = p.entities.find((e) => e.id === r.entityId)?.name ?? r.entityId;
			lines.push(`### \`${r.name}\` (over \`${entity}\`)`);
			lines.push(`- exposedOps: \`${JSON.stringify(r.exposedOps)}\``);
			if (r.queryConfig)
				lines.push(`- queryConfig: \`${JSON.stringify(r.queryConfig)}\``);
			lines.push("");
		}
	}

	// Operations
	if (p.operations.length > 0) {
		lines.push("## Operations");
		lines.push("");
		for (const o of p.operations) {
			lines.push(`### \`${o.name}\` (${o.kind})`);
			lines.push("");
			lines.push("```json");
			lines.push("// inputSchema");
			lines.push(JSON.stringify(o.inputSchema, null, 2));
			lines.push("");
			lines.push("// steps");
			lines.push(JSON.stringify(o.steps, null, 2));
			lines.push("```");
			if (o.bodyHint) {
				lines.push(`_${o.bodyHint}_`);
			}
			lines.push("");
		}
	}

	// Policies
	if (p.policies.length > 0) {
		lines.push("## Policies");
		lines.push("");
		for (const pol of p.policies) {
			lines.push(`### \`${pol.name}\` (${pol.scope}, ${pol.effect})`);
			lines.push("```json");
			lines.push(JSON.stringify(pol.rule, null, 2));
			lines.push("```");
			lines.push("");
		}
	}

	// Integrations
	if (p.integrations.length > 0) {
		lines.push("## Integrations");
		lines.push("");
		for (const i of p.integrations) {
			lines.push(
				`- **\`${i.key}\`** — provider \`${i.provider}\`, capabilities: \`${JSON.stringify(i.capabilities)}\``,
			);
		}
		lines.push("");
	}

	// Triggers
	if (p.triggers.length > 0) {
		lines.push("## Triggers");
		lines.push("");
		for (const t of p.triggers) {
			lines.push(`- \`${t.name}\` (${t.kind}) → operation \`${t.operationId}\``);
			lines.push(`  - source: \`${JSON.stringify(t.source)}\``);
		}
		lines.push("");
	}

	// Behaviors
	if (p.behaviors.length > 0) {
		lines.push("## Behaviors");
		lines.push("");
		const byId = new Map(p.entities.map((e) => [e.id, e.name]));
		for (const b of p.behaviors) {
			lines.push(
				`- \`${b.kind}\` on \`${byId.get(b.entityId) ?? b.entityId}\` — config: \`${JSON.stringify(b.config)}\``,
			);
		}
		lines.push("");
	}

	// Screens
	if (p.screens.length > 0) {
		lines.push("## Screens");
		lines.push("");
		for (const s of p.screens) {
			lines.push(
				`### \`${s.path}\`${s.type ? ` (${s.type})` : ""}`,
			);
			lines.push(`- components: ${s.components.length}`);
			lines.push("");
		}
	}

	return lines.join("\n");
}

// ─── validateProposal ──────────────────────────────────────────────
export async function validateProposal(
	projectId: string,
	proposal: {
		operations?: { name: string; steps: unknown }[];
		policies?: { name: string; rule: unknown }[];
	},
): Promise<{ ok: boolean; errors: string[] }> {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: {
			entities: { select: { name: true } },
			policies: { select: { name: true } },
			integrations: { select: { key: true, capabilities: true } },
		},
	});
	if (!project) return { ok: false, errors: ["project_not_found"] };

	const entityNames = new Set(project.entities.map((e) => e.name));
	const policyNames = new Set(project.policies.map((p) => p.name));
	const integrationKeys = new Map(
		project.integrations.map((i) => [
			i.key,
			new Set((i.capabilities as string[]) ?? []),
		]),
	);

	// Include proposed policies in the known set (forward refs in same proposal).
	for (const p of proposal.policies ?? []) policyNames.add(p.name);

	const errors: string[] = [];

	for (const op of proposal.operations ?? []) {
		const r = validateOperationSteps(op.steps, {
			entityNames,
			policyNames,
			integrationKeys,
		});
		if (!r.ok) errors.push(...r.errors.map((e) => `operation ${op.name}: ${e}`));
	}

	for (const pol of proposal.policies ?? []) {
		const r = policyRuleSchema.safeParse(pol.rule);
		if (!r.success)
			errors.push(
				...r.error.issues.map(
					(i) => `policy ${pol.name}: ${i.path.join(".")}: ${i.message}`,
				),
			);
	}

	return { ok: errors.length === 0, errors };
}

// ─── expandBehaviors ───────────────────────────────────────────────
// Preview-only — computes what each Behavior would add (no DB write).
export async function expandBehaviors(projectId: string) {
	const p = await prisma.project.findUnique({
		where: { id: projectId },
		include: {
			behaviors: true,
			entities: { select: { id: true, name: true } },
		},
	});
	if (!p) return null;

	const byId = new Map(p.entities.map((e) => [e.id, e.name]));

	const expansion: {
		entity: string;
		behavior: string;
		config: unknown;
		adds: string[];
	}[] = [];

	for (const b of p.behaviors) {
		const entry = BEHAVIOR_CATALOGUE[b.kind];
		if (!entry) {
			expansion.push({
				entity: byId.get(b.entityId) ?? b.entityId,
				behavior: b.kind,
				config: b.config,
				adds: [`unknown behavior kind "${b.kind}"`],
			});
			continue;
		}
		let parsedConfig: unknown;
		try {
			parsedConfig = entry.parseConfig(b.config);
		} catch (err) {
			expansion.push({
				entity: byId.get(b.entityId) ?? b.entityId,
				behavior: b.kind,
				config: b.config,
				adds: [`invalid config: ${(err as Error).message}`],
			});
			continue;
		}
		expansion.push({
			entity: byId.get(b.entityId) ?? b.entityId,
			behavior: b.kind,
			config: parsedConfig,
			adds: entry.adds,
		});
	}

	return expansion;
}
