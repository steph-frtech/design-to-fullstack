// Validates a ScreenSpec against the Phase 2 required-fields checklist.
//
// Required (must be non-empty):
//   name, description, actor, purpose, components, dataNeeds, actions,
//   openQuestions, assumptions
// Optional:
//   userIntent, layoutHint, fields, businessRules, emptyStates, errorStates

export type ScreenSpecCheckStatus = "ok" | "missing" | "empty";

export type ScreenSpecCheck = {
	field: string;
	status: ScreenSpecCheckStatus;
	required: boolean;
	message?: string;
};

const REQUIRED = [
	"name",
	"description",
	"actor",
	"purpose",
	"components",
	"dataNeeds",
	"actions",
	"openQuestions",
	"assumptions",
] as const;

const OPTIONAL = [
	"userIntent",
	"layoutHint",
	"fields",
	"businessRules",
	"emptyStates",
	"errorStates",
] as const;

function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === "string") return value.trim().length === 0;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === "object")
		return Object.keys(value as object).length === 0;
	return false;
}

export function validateScreenSpec(
	spec: Record<string, unknown>,
): ScreenSpecCheck[] {
	const out: ScreenSpecCheck[] = [];

	for (const field of REQUIRED) {
		const present = field in spec;
		const value = spec[field];
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
		const value = spec[field];
		out.push({
			field,
			status: isEmpty(value) ? "missing" : "ok",
			required: false,
		});
	}

	return out;
}

export function isComplete(checks: ScreenSpecCheck[]): boolean {
	return checks.every((c) => !c.required || c.status === "ok");
}
