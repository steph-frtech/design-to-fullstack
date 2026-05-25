// compile-shared.ts — Read-only compilation of the shared contract.
// Reads Entity/Operation/Policy/EventDefinition and returns a SharedContractObj
// in memory. Nothing is persisted.

import { prisma } from "../../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SharedTypeEntry = {
	name: string;
	kind: "entity" | "operation-input" | "operation-output" | "error" | "auth" | "role";
	fields?: { name: string; type: string; required: boolean }[];
	description?: string;
};

export type SharedSchemaEntry = {
	name: string;
	zodSchema: string;
};

export type SharedContractObj = {
	types: SharedTypeEntry[];
	schemas: SharedSchemaEntry[];
	apiClient: {
		baseUrl: string;
		operations: { name: string; method: string; path: string; inputType: string; outputType: string }[];
	};
	errors: { code: string; message: string; httpStatus: number }[];
	events: { name: string; payloadSchema: unknown }[];
};

// ─── FieldType → TS ──────────────────────────────────────────────────────────

function fieldTypeToTs(ft: string): string {
	const map: Record<string, string> = {
		TEXT: "string",
		TEXTAREA: "string",
		EMAIL: "string",
		PASSWORD: "string",
		NUMBER: "number",
		DATE: "string",
		DATETIME: "string",
		TIME: "string",
		CHECKBOX: "boolean",
		RADIO: "string",
		SELECT: "string",
		MULTISELECT: "string[]",
		FILE: "string",
		RICHTEXT: "string",
		COLOR: "string",
		RANGE: "number",
		HIDDEN: "string",
		CUSTOM: "unknown",
	};
	return map[ft] ?? "unknown";
}

function fieldTypeToZod(ft: string): string {
	const map: Record<string, string> = {
		TEXT: "z.string()",
		TEXTAREA: "z.string()",
		EMAIL: "z.string().email()",
		PASSWORD: "z.string()",
		NUMBER: "z.number()",
		DATE: "z.string()",
		DATETIME: "z.string()",
		TIME: "z.string()",
		CHECKBOX: "z.boolean()",
		RADIO: "z.string()",
		SELECT: "z.string()",
		MULTISELECT: "z.array(z.string())",
		FILE: "z.string()",
		RICHTEXT: "z.string()",
		COLOR: "z.string()",
		RANGE: "z.number()",
		HIDDEN: "z.string()",
		CUSTOM: "z.unknown()",
	};
	return map[ft] ?? "z.unknown()";
}

// ─── compileSharedContract ────────────────────────────────────────────────────

export async function compileSharedContract(projectId: string): Promise<SharedContractObj> {
	const [entities, operations, policies, eventDefs, appRoles] = await Promise.all([
		prisma.entity.findMany({
			where: { projectId },
			include: { attributes: true },
		}),
		prisma.operation.findMany({ where: { projectId } }),
		prisma.policy.findMany({ where: { projectId } }),
		// Select only base columns. schema/description are phase_10 additions.
		prisma.eventDefinition.findMany({
			where: { projectId },
			select: { id: true, projectId: true, name: true, payloadSchema: true, createdAt: true, updatedAt: true },
		}),
		// Select only base columns. name/description are phase_10 additions.
		prisma.appRole.findMany({
			where: { projectId },
			select: { id: true, projectId: true, key: true, label: true, permissions: true, createdAt: true, updatedAt: true },
		}),
	]);

	const types: SharedTypeEntry[] = [];
	const schemas: SharedSchemaEntry[] = [];

	// ── Entity DTOs ───────────────────────────────────────────────────────────
	for (const entity of entities) {
		types.push({
			name: entity.name,
			kind: "entity",
			fields: entity.attributes.map((a) => ({
				name: a.name,
				type: fieldTypeToTs(a.type),
				required: a.required,
			})),
			description: `DTO for ${entity.name}`,
		});

		// Zod schema
		const fieldZods = entity.attributes.map((a) => {
			const z = fieldTypeToZod(a.type);
			return `  ${a.name}: ${z}${a.required ? "" : ".optional()"}`;
		});
		schemas.push({
			name: `${entity.name}Schema`,
			zodSchema: `z.object({\n${fieldZods.join(",\n")}\n})`,
		});

		// Create input (no id)
		types.push({
			name: `Create${entity.name}Input`,
			kind: "operation-input",
			fields: entity.attributes.map((a) => ({
				name: a.name,
				type: fieldTypeToTs(a.type),
				required: a.required,
			})),
		});

		// Update input (all optional)
		types.push({
			name: `Update${entity.name}Input`,
			kind: "operation-input",
			fields: entity.attributes.map((a) => ({
				name: a.name,
				type: fieldTypeToTs(a.type),
				required: false,
			})),
		});
	}

	// ── Operation types ───────────────────────────────────────────────────────
	for (const op of operations) {
		const inputSchema = op.inputSchema as Record<string, unknown>;
		const outputSchema = op.outputSchema as Record<string, unknown> | null;
		types.push({
			name: `${op.name}Input`,
			kind: "operation-input",
			description: `Input type for operation ${op.name}`,
			fields: Object.keys(inputSchema?.properties ?? {}).map((k) => ({
				name: k,
				type: "unknown",
				required: Array.isArray(inputSchema?.required) && (inputSchema.required as string[]).includes(k),
			})),
		});
		if (outputSchema) {
			types.push({
				name: `${op.name}Output`,
				kind: "operation-output",
				description: `Output type for operation ${op.name}`,
				fields: Object.keys(outputSchema?.properties ?? {}).map((k) => ({
					name: k,
					type: "unknown",
					required: Array.isArray(outputSchema?.required) && (outputSchema.required as string[]).includes(k),
				})),
			});
		}
	}

	// ── Auth session + role types ─────────────────────────────────────────────
	types.push({
		name: "AuthSession",
		kind: "auth",
		fields: [
			{ name: "userId", type: "string", required: true },
			{ name: "email", type: "string", required: true },
			{ name: "role", type: "string", required: false },
		],
		description: "Better Auth session shape",
	});

	if (appRoles.length > 0) {
		types.push({
			name: "AppRole",
			kind: "role",
			description: `Role enum: ${appRoles.map((r) => r.key).join(" | ")}`,
		});
	}

	// ── Error types ───────────────────────────────────────────────────────────
	const errors = [
		{ code: "NOT_FOUND", message: "Resource not found", httpStatus: 404 },
		{ code: "UNAUTHORIZED", message: "Authentication required", httpStatus: 401 },
		{ code: "FORBIDDEN", message: "Insufficient permissions", httpStatus: 403 },
		{ code: "VALIDATION_FAILED", message: "Input validation failed", httpStatus: 422 },
		{ code: "CONFLICT", message: "Unique constraint violation", httpStatus: 409 },
		{ code: "INTERNAL_ERROR", message: "Internal server error", httpStatus: 500 },
	];

	// Add error types
	types.push({
		name: "ApiError",
		kind: "error",
		fields: [
			{ name: "code", type: "string", required: true },
			{ name: "message", type: "string", required: true },
			{ name: "httpStatus", type: "number", required: true },
		],
	});

	// ── Events ────────────────────────────────────────────────────────────────
	const events = eventDefs.map((e) => ({
		name: e.name,
		payloadSchema: e.payloadSchema ?? {},
	}));

	// ── API client manifest ───────────────────────────────────────────────────
	const apiClientOperations = operations.map((op) => ({
		name: op.name,
		method: op.kind === "QUERY" ? "GET" : "POST",
		path: `/api/operations/${op.name}`,
		inputType: `${op.name}Input`,
		outputType: `${op.name}Output`,
	}));

	// Void the policies variable to avoid TS unused-var; it's used for future policy types
	void policies;

	return {
		types,
		schemas,
		apiClient: {
			baseUrl: "/api",
			operations: apiClientOperations,
		},
		errors,
		events,
	};
}
