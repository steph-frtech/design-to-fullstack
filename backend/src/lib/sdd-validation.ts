// Validates that the SDD artifacts for a project / feature are complete.

import { prisma } from "../db";

export type SddCheckStatus = "ok" | "missing" | "empty";

export type SddCheck = {
	kind: string;
	required: boolean;
	status: SddCheckStatus;
	featureKey: string | null;
	message?: string;
};

const PROJECT_REQUIRED: string[] = ["constitution"];
const FEATURE_REQUIRED: string[] = ["spec", "plan", "tasks"];
const FEATURE_OPTIONAL: string[] = [
	"research",
	"data-model",
	"quickstart",
	"platform-mapping",
	"contracts",
];

function isEmpty(content: string | null | undefined): boolean {
	return !content || content.trim().length === 0;
}

export async function validateSddArtifacts(
	projectId: string,
	featureKey?: string,
): Promise<{ checks: SddCheck[]; complete: boolean }> {
	const checks: SddCheck[] = [];

	// Project-level (constitution)
	for (const kind of PROJECT_REQUIRED) {
		const row = await prisma.specArtifact.findFirst({
			where: { projectId, kind, featureKey: null },
			orderBy: { updatedAt: "desc" },
		});
		if (!row)
			checks.push({
				kind,
				required: true,
				status: "missing",
				featureKey: null,
				message: `Project-wide artifact "${kind}" is missing.`,
			});
		else if (isEmpty(row.content))
			checks.push({
				kind,
				required: true,
				status: "empty",
				featureKey: null,
				message: `Project-wide artifact "${kind}" exists but is empty.`,
			});
		else checks.push({ kind, required: true, status: "ok", featureKey: null });
	}

	if (!featureKey) {
		return {
			checks,
			complete: checks.every((c) => !c.required || c.status === "ok"),
		};
	}

	// Feature-level
	for (const kind of FEATURE_REQUIRED) {
		const row = await prisma.specArtifact.findFirst({
			where: { projectId, kind, featureKey },
			orderBy: { updatedAt: "desc" },
		});
		if (!row)
			checks.push({
				kind,
				required: true,
				status: "missing",
				featureKey,
				message: `Feature "${featureKey}" artifact "${kind}" is missing.`,
			});
		else if (isEmpty(row.content))
			checks.push({
				kind,
				required: true,
				status: "empty",
				featureKey,
				message: `Feature "${featureKey}" artifact "${kind}" exists but is empty.`,
			});
		else checks.push({ kind, required: true, status: "ok", featureKey });
	}
	for (const kind of FEATURE_OPTIONAL) {
		const row = await prisma.specArtifact.findFirst({
			where: { projectId, kind, featureKey },
			orderBy: { updatedAt: "desc" },
		});
		checks.push({
			kind,
			required: false,
			status: !row || isEmpty(row.content) ? "missing" : "ok",
			featureKey,
		});
	}

	return {
		checks,
		complete: checks.every((c) => !c.required || c.status === "ok"),
	};
}
