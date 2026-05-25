// DB-backed wrapper for behavior expansion.
// Separated from behavior-expand.ts so that pure-function tests do not
// require DATABASE_URL.

import { prisma } from "../db";
import type { BehaviorKind } from "./behaviors";
import { expandToDelta } from "./behavior-expand";
import type { EntityBehaviorRequest, BehaviorExpandResult } from "./behavior-expand";

export type { EntityBehaviorRequest, BehaviorExpandResult };

export type ExpandBehaviorsDeltaOpts = {
	/** If provided, override the behaviors fetched from the DB. */
	entities?: EntityBehaviorRequest[];
};

/**
 * Load entity→behavior pairs from the DB (for a given project) then call
 * expandToDelta. Opts.entities overrides the DB lookup (useful for ad-hoc
 * requests not yet stored as Behavior rows).
 *
 * ALWAYS dry-run — never persists anything.
 */
export async function expandBehaviorsToDelta(
	projectId: string,
	opts: ExpandBehaviorsDeltaOpts = {},
): Promise<BehaviorExpandResult | null> {
	let entityRequests: EntityBehaviorRequest[];

	if (opts.entities && opts.entities.length > 0) {
		entityRequests = opts.entities;
	} else {
		const project = await prisma.project.findUnique({
			where: { id: projectId },
			include: {
				behaviors: true,
				entities: { select: { id: true, name: true } },
			},
		});
		if (!project) return null;

		const nameById = new Map(project.entities.map((e) => [e.id, e.name]));

		// Group behaviors by entity
		const grouped = new Map<
			string,
			{ name: string; behaviors: BehaviorKind[]; config: Partial<Record<BehaviorKind, unknown>> }
		>();
		for (const b of project.behaviors) {
			const name = nameById.get(b.entityId);
			if (!name) continue;
			if (!grouped.has(name)) {
				grouped.set(name, { name, behaviors: [], config: {} });
			}
			const entry = grouped.get(name)!;
			entry.behaviors.push(b.kind as BehaviorKind);
			entry.config[b.kind as BehaviorKind] = b.config;
		}

		entityRequests = Array.from(grouped.values());
	}

	return expandToDelta(entityRequests);
}
