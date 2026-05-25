// Coverage gate — checks that every "in-scope" Requirement has at least
// one RequirementMapping.
//
// A Requirement is in-scope (and therefore must be mapped) when:
//   - priority ∈ {"MUST", "HIGH", "CRITICAL"}    (strong word)
//   OR
//   - status === "ACCEPTED"                      (explicitly validated by user)
//
// Requirements in status DRAFT / REJECTED are NOT blocking.

import { prisma } from "../db";

const STRONG_PRIORITIES = new Set(["MUST", "HIGH", "CRITICAL"]);

export type CoverageEntry = {
	requirementId: string;
	key: string;
	title: string;
	priority: string | null;
	status: string;
	mappingsCount: number;
	blocked: boolean;
};

export type CoverageResult = {
	blocked: boolean;
	entries: CoverageEntry[];
};

export async function checkCoverageGate(
	projectId: string,
): Promise<CoverageResult> {
	const rows = await prisma.requirement.findMany({
		where: { projectId },
		include: { _count: { select: { mappings: true } } },
		orderBy: { key: "asc" },
	});

	const entries: CoverageEntry[] = rows.map((r) => {
		const inScope =
			(r.priority !== null && STRONG_PRIORITIES.has(r.priority)) ||
			r.status === "ACCEPTED" ||
			r.status === "MAPPED";
		const mappingsCount = r._count.mappings;
		const blocked = inScope && mappingsCount === 0;
		return {
			requirementId: r.id,
			key: r.key,
			title: r.title,
			priority: r.priority,
			status: r.status,
			mappingsCount,
			blocked,
		};
	});

	return {
		blocked: entries.some((e) => e.blocked),
		entries,
	};
}
