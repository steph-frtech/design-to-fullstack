// Validates a ProductSpec row against the "must have" checklist the user
// asked for : title, description, targetUsers, goals, businessObjects,
// businessRules, userJourneys, openQuestions, assumptions.
//
// Returns a per-field status so the agent / UI can show exactly what's missing.

export type ProductSpecCheckStatus = "ok" | "missing" | "empty";

export type ProductSpecCheck = {
	field: string;
	status: ProductSpecCheckStatus;
	required: boolean;
	message?: string;
};

const REQUIRED = [
	"title",
	"description",
	"targetUsers",
	"goals",
	"businessObjects",
	"businessRules",
	"userJourneys",
	"openQuestions",
	"assumptions",
] as const;

const OPTIONAL = [
	"domain",
	"nonGoals",
	"personas",
	"glossary",
] as const;

type Spec = Record<string, unknown>;

function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === "string") return value.trim().length === 0;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === "object")
		return Object.keys(value as object).length === 0;
	return false;
}

export function validateProductSpec(spec: Spec): ProductSpecCheck[] {
	const out: ProductSpecCheck[] = [];

	for (const field of REQUIRED) {
		const present = field in spec;
		const value = (spec as Record<string, unknown>)[field];
		if (!present) {
			out.push({
				field,
				status: "missing",
				required: true,
				message: `Required field "${field}" is not set.`,
			});
		} else if (isEmpty(value)) {
			out.push({
				field,
				status: "empty",
				required: true,
				message: `Required field "${field}" is present but empty.`,
			});
		} else {
			out.push({ field, status: "ok", required: true });
		}
	}

	for (const field of OPTIONAL) {
		const value = (spec as Record<string, unknown>)[field];
		out.push({
			field,
			status: isEmpty(value) ? "missing" : "ok",
			required: false,
		});
	}

	return out;
}

export function isComplete(checks: ProductSpecCheck[]): boolean {
	return checks.every((c) => !c.required || c.status === "ok");
}
