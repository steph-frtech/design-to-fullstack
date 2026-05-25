// compile-backend.ts — Read-only compilation of the backend contract.
// Reads Entity/Resource/Operation/Policy/AuthMethod from the DB and returns
// a structured BackendContractObj in memory. Nothing is persisted.

import { prisma } from "../../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteEntry = {
	method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
	path: string;
	operationRef?: string;
	resourceRef?: string;
	schemaRef?: string;
	middlewares: string[];
	description: string;
};

export type SchemaEntry = {
	name: string;
	entityName: string;
	fields: { name: string; type: string; required: boolean; unique: boolean }[];
};

export type MiddlewareEntry = {
	name: string;
	policyName: string;
	scope: string;
	effect: string;
	applyTo: string[];
};

export type AuthEntry = {
	provider: string;
	basePath: string;
	methods: { name: string; kind: string }[];
};

export type BackendContractObj = {
	apiBasePath: string;
	routes: RouteEntry[];
	schemas: SchemaEntry[];
	middlewares: MiddlewareEntry[];
	auth: AuthEntry;
	errors: { code: string; message: string }[];
	generatedFrom: {
		entities: number;
		resources: number;
		operations: number;
		policies: number;
		authMethods: number;
	};
};

// ─── FieldType → TS type string mapping ──────────────────────────────────────

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

// ─── compileBackendContract ───────────────────────────────────────────────────

export async function compileBackendContract(projectId: string): Promise<BackendContractObj> {
	const [entities, resources, operations, policies, authMethods] = await Promise.all([
		prisma.entity.findMany({
			where: { projectId },
			include: { attributes: true },
		}),
		prisma.resource.findMany({ where: { projectId } }),
		prisma.operation.findMany({ where: { projectId } }),
		prisma.policy.findMany({ where: { projectId } }),
		prisma.authMethod.findMany({ where: { projectId } }),
	]);

	const entityById = new Map(entities.map((e) => [e.id, e]));

	// ── Schemas (one input+output schema per entity) ──────────────────────────
	const schemas: SchemaEntry[] = entities.map((entity) => ({
		name: entity.name,
		entityName: entity.name,
		fields: entity.attributes.map((attr) => ({
			name: attr.name,
			type: fieldTypeToTs(attr.type),
			required: attr.required,
			unique: attr.unique,
		})),
	}));

	// ── Routes from Resources ─────────────────────────────────────────────────
	const routes: RouteEntry[] = [];

	for (const resource of resources) {
		const entity = entityById.get(resource.entityId);
		const entityName = entity?.name ?? resource.name;
		const basePath = `/api/${resource.name}`;
		const exposedOps = Array.isArray(resource.exposedOps)
			? (resource.exposedOps as string[])
			: [];

		// Find policies scoped to this resource
		const resourcePolicies = policies.filter(
			(p) => p.resourceId === resource.id || p.scope === "RESOURCE",
		);
		const policyMiddlewares = resourcePolicies.map((p) => `guard:${p.name}`);

		if (exposedOps.includes("list")) {
			routes.push({
				method: "GET",
				path: basePath,
				resourceRef: resource.name,
				schemaRef: entityName,
				middlewares: policyMiddlewares,
				description: `List ${entityName} records`,
			});
		}
		if (exposedOps.includes("read")) {
			routes.push({
				method: "GET",
				path: `${basePath}/:id`,
				resourceRef: resource.name,
				schemaRef: entityName,
				middlewares: policyMiddlewares,
				description: `Read one ${entityName} by id`,
			});
		}
		if (exposedOps.includes("create")) {
			routes.push({
				method: "POST",
				path: basePath,
				resourceRef: resource.name,
				schemaRef: entityName,
				middlewares: policyMiddlewares,
				description: `Create a new ${entityName}`,
			});
		}
		if (exposedOps.includes("update")) {
			routes.push({
				method: "PATCH",
				path: `${basePath}/:id`,
				resourceRef: resource.name,
				schemaRef: entityName,
				middlewares: policyMiddlewares,
				description: `Update ${entityName} by id`,
			});
		}
		if (exposedOps.includes("delete")) {
			routes.push({
				method: "DELETE",
				path: `${basePath}/:id`,
				resourceRef: resource.name,
				schemaRef: entityName,
				middlewares: policyMiddlewares,
				description: `Delete ${entityName} by id`,
			});
		}
	}

	// ── Routes from explicit Operations ──────────────────────────────────────
	for (const op of operations) {
		const opPolicies = policies.filter((p) => p.operationId === op.id);
		const middlewares = opPolicies.map((p) => `guard:${p.name}`);
		const method = op.kind === "QUERY" ? "GET" : "POST";
		routes.push({
			method,
			path: `/api/operations/${op.name}`,
			operationRef: op.name,
			middlewares,
			description: `${op.kind} operation: ${op.name}`,
		});
	}

	// ── Middlewares from Policies ─────────────────────────────────────────────
	const middlewares: MiddlewareEntry[] = policies.map((p) => {
		const applyTo: string[] = [];
		if (p.resourceId) applyTo.push(`resource:${p.resourceId}`);
		if (p.operationId) applyTo.push(`operation:${p.operationId}`);
		if (p.entityId) applyTo.push(`entity:${p.entityId}`);
		return {
			name: `guard:${p.name}`,
			policyName: p.name,
			scope: p.scope,
			effect: p.effect,
			applyTo,
		};
	});

	// ── Auth from AuthMethod ──────────────────────────────────────────────────
	const auth: AuthEntry = {
		provider: authMethods.find((m) => m.isDefault)?.name ?? "better-auth",
		basePath: "/api/auth",
		methods: authMethods.map((m) => ({ name: m.name, kind: m.kind })),
	};

	// ── Standard error codes ──────────────────────────────────────────────────
	const errors = [
		{ code: "NOT_FOUND", message: "Resource not found" },
		{ code: "UNAUTHORIZED", message: "Authentication required" },
		{ code: "FORBIDDEN", message: "Insufficient permissions" },
		{ code: "VALIDATION_FAILED", message: "Input validation failed" },
		{ code: "CONFLICT", message: "Unique constraint violation" },
	];

	return {
		apiBasePath: "/api",
		routes,
		schemas,
		middlewares,
		auth,
		errors,
		generatedFrom: {
			entities: entities.length,
			resources: resources.length,
			operations: operations.length,
			policies: policies.length,
			authMethods: authMethods.length,
		},
	};
}
