// Diff two ChangeSets: identify Revisions only in A, only in B, and those
// touching the same entity in both (with field-level comparison).
//
// V1: textual comparison of Revision.diff objects.

import type { ExtendedPrismaClient } from "../versioning";

export type RevisionSummary = {
	entityType: string;
	entityId: string;
	op: string;
	version: number;
	message: string | null;
};

export type CommonChanged = {
	entityType: string;
	entityId: string;
	/** Fields touched in CS A (from diff JSON keys) */
	fieldsA: string[];
	/** Fields touched in CS B */
	fieldsB: string[];
};

export type DiffResult = {
	onlyInA: RevisionSummary[];
	onlyInB: RevisionSummary[];
	commonChanged: CommonChanged[];
};

function summaryKey(rev: { entityType: string; entityId: string }): string {
	return `${rev.entityType}:${rev.entityId}`;
}

function extractFields(diff: unknown): string[] {
	if (!diff || typeof diff !== "object") return [];
	return Object.keys(diff as Record<string, unknown>);
}

export async function diffChangeSets(
	prisma: ExtendedPrismaClient,
	csIdA: string,
	csIdB: string,
): Promise<DiffResult> {
	const [revsA, revsB] = await Promise.all([
		(prisma as unknown as {
			revision: {
				findMany: (a: unknown) => Promise<{
					id: string;
					entityType: string;
					entityId: string;
					op: string;
					version: number;
					diff: unknown;
					message: string | null;
				}[]>;
			};
		}).revision.findMany({
			where: { changeSetId: csIdA },
			orderBy: { version: "asc" },
		}),
		(prisma as unknown as {
			revision: {
				findMany: (a: unknown) => Promise<{
					id: string;
					entityType: string;
					entityId: string;
					op: string;
					version: number;
					diff: unknown;
					message: string | null;
				}[]>;
			};
		}).revision.findMany({
			where: { changeSetId: csIdB },
			orderBy: { version: "asc" },
		}),
	]);

	const mapA = new Map<string, (typeof revsA)[number]>();
	const mapB = new Map<string, (typeof revsB)[number]>();

	for (const r of revsA) mapA.set(summaryKey(r), r);
	for (const r of revsB) mapB.set(summaryKey(r), r);

	const onlyInA: RevisionSummary[] = [];
	const onlyInB: RevisionSummary[] = [];
	const commonChanged: CommonChanged[] = [];

	for (const [key, revA] of mapA) {
		const revB = mapB.get(key);
		if (!revB) {
			onlyInA.push({
				entityType: revA.entityType,
				entityId: revA.entityId,
				op: revA.op,
				version: revA.version,
				message: revA.message,
			});
		} else {
			commonChanged.push({
				entityType: revA.entityType,
				entityId: revA.entityId,
				fieldsA: extractFields(revA.diff),
				fieldsB: extractFields(revB.diff),
			});
		}
	}

	for (const [key, revB] of mapB) {
		if (!mapA.has(key)) {
			onlyInB.push({
				entityType: revB.entityType,
				entityId: revB.entityId,
				op: revB.op,
				version: revB.version,
				message: revB.message,
			});
		}
	}

	return { onlyInA, onlyInB, commonChanged };
}
