// Clarification gate — checks that no OpenQuestion / Assumption is still
// in status "OPEN" before the project is allowed to generate a DeltaSpec.
//
// V1 semantics:
//   blocked = true  ↔  at least one OpenQuestion OR Assumption with status="OPEN"
//
// Statuses that do NOT block:
//   OpenQuestion : ANSWERED, DEFERRED
//   Assumption   : ACCEPTED, REJECTED

import { prisma } from "../db";

export type GateOpenQuestion = {
	id: string;
	scope: string;
	question: string;
	targetId: string | null;
};
export type GateAssumption = {
	id: string;
	scope: string;
	text: string;
	targetId: string | null;
};

export type GateResult = {
	blocked: boolean;
	openQuestions: GateOpenQuestion[];
	openAssumptions: GateAssumption[];
};

export async function checkClarificationGate(
	projectId: string,
): Promise<GateResult> {
	const [openQs, openAs] = await Promise.all([
		prisma.openQuestion.findMany({
			where: { projectId, status: "OPEN" },
			select: { id: true, scope: true, question: true, targetId: true },
			orderBy: { createdAt: "asc" },
		}),
		prisma.assumption.findMany({
			where: { projectId, status: "OPEN" },
			select: { id: true, scope: true, text: true, targetId: true },
			orderBy: { createdAt: "asc" },
		}),
	]);
	return {
		blocked: openQs.length > 0 || openAs.length > 0,
		openQuestions: openQs,
		openAssumptions: openAs,
	};
}
