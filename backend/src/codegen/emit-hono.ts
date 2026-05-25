// emit-hono.ts — generates Hono CRUD route files, one per exposed Resource.
// Supports both legacy spec-based and contract-driven generation.

import type { CodegenSpec, GeneratedFile } from "./types.ts";
import type { BackendContractObj } from "../lib/contracts/compile-backend";

type ExposedOps = string[];

function parseExposedOps(raw: unknown): ExposedOps {
	if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
	return [];
}

function toPascalCase(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

function toCamelCase(name: string): string {
	return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Emit one Hono route file per Resource that has exposedOps, plus an index.ts
 * that mounts them all.
 */
export function emitHonoRoutes(spec: CodegenSpec): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	const entityById = new Map(spec.entities.map((e) => [e.id, e]));

	// Sort resources by name for determinism
	const sortedResources = [...spec.resources].sort((a, b) => a.name.localeCompare(b.name));

	const routeImports: string[] = [];
	const routeMounts: string[] = [];

	for (const resource of sortedResources) {
		const entity = entityById.get(resource.entityId);
		if (!entity) continue;

		const ops = parseExposedOps(resource.exposedOps);
		if (ops.length === 0) continue;

		const modelName = toPascalCase(entity.name);
		const varName = toCamelCase(entity.name);
		const routePath = `backend/src/routes/${resource.name}.ts`;

		const content = emitResourceFile(resource.name, modelName, varName, ops);
		files.push({ path: routePath, kind: "CODE", content });

		routeImports.push(
			`import { ${varName}Routes } from "./routes/${resource.name}.ts";`,
		);
		routeMounts.push(`  .route("/${resource.name}", ${varName}Routes)`);
	}

	// Generate the index / app entry
	const indexContent = emitAppIndex(routeImports, routeMounts, spec.project.slug);
	files.push({ path: "backend/src/app.ts", kind: "CODE", content: indexContent });

	return files;
}

function emitResourceFile(
	resourceName: string,
	modelName: string,
	varName: string,
	ops: ExposedOps,
): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated CRUD routes for resource: ${resourceName}`);
	lines.push(`// Do not edit — regenerate via dtfs__generate_app`);
	lines.push(``);
	lines.push(`import { Hono } from "hono";`);
	lines.push(`import { zValidator } from "@hono/zod-validator";`);
	lines.push(`import { z } from "zod";`);
	lines.push(`import { prisma } from "../db.ts";`);
	lines.push(``);
	lines.push(`export const ${varName}Routes = new Hono()`);

	if (ops.includes("list")) {
		lines.push(`  // GET /${resourceName} — list all`);
		lines.push(`  .get("/", async (c) => {`);
		lines.push(`    const records = await prisma.${varName}.findMany({`);
		lines.push(`      orderBy: { createdAt: "desc" },`);
		lines.push(`    });`);
		lines.push(`    return c.json({ ${varName}s: records });`);
		lines.push(`  })`);
	}

	if (ops.includes("read")) {
		lines.push(`  // GET /${resourceName}/:id — read one`);
		lines.push(`  .get("/:id", async (c) => {`);
		lines.push(`    const id = c.req.param("id");`);
		lines.push(`    const record = await prisma.${varName}.findUnique({ where: { id } });`);
		lines.push(`    if (!record) return c.json({ error: "not_found" }, 404);`);
		lines.push(`    return c.json({ ${varName}: record });`);
		lines.push(`  })`);
	}

	if (ops.includes("create")) {
		lines.push(`  // POST /${resourceName} — create`);
		lines.push(`  .post(`);
		lines.push(`    "/",`);
		lines.push(`    zValidator("json", z.record(z.unknown())),`);
		lines.push(`    async (c) => {`);
		lines.push(`      const data = c.req.valid("json");`);
		lines.push(`      const record = await prisma.${varName}.create({ data: data as never });`);
		lines.push(`      return c.json({ ${varName}: record }, 201);`);
		lines.push(`    },`);
		lines.push(`  )`);
	}

	if (ops.includes("update")) {
		lines.push(`  // PATCH /${resourceName}/:id — update`);
		lines.push(`  .patch(`);
		lines.push(`    "/:id",`);
		lines.push(`    zValidator("json", z.record(z.unknown())),`);
		lines.push(`    async (c) => {`);
		lines.push(`      const id = c.req.param("id");`);
		lines.push(`      const data = c.req.valid("json");`);
		lines.push(`      const record = await prisma.${varName}.update({ where: { id }, data: data as never });`);
		lines.push(`      return c.json({ ${varName}: record });`);
		lines.push(`    },`);
		lines.push(`  )`);
	}

	if (ops.includes("delete")) {
		lines.push(`  // DELETE /${resourceName}/:id — delete`);
		lines.push(`  .delete("/:id", async (c) => {`);
		lines.push(`    const id = c.req.param("id");`);
		lines.push(`    await prisma.${varName}.delete({ where: { id } });`);
		lines.push(`    return c.json({ ok: true });`);
		lines.push(`  })`);
	}

	lines.push(`;`);
	lines.push(``);
	return lines.join("\n");
}

function emitAppIndex(
	routeImports: string[],
	routeMounts: string[],
	projectSlug: string,
): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated Hono app entry — project: ${projectSlug}`);
	lines.push(``);
	lines.push(`import { Hono } from "hono";`);
	lines.push(`import { cors } from "hono/cors";`);
	for (const imp of routeImports) {
		lines.push(imp);
	}
	lines.push(``);
	lines.push(`export const app = new Hono()`);
	lines.push(`  .use("*", cors())`);
	lines.push(`  .get("/health", (c) => c.json({ ok: true }))`);
	for (const mount of routeMounts) {
		lines.push(mount);
	}
	lines.push(`;`);
	lines.push(``);
	lines.push(`export type AppType = typeof app;`);
	lines.push(``);
	return lines.join("\n");
}

// ─── Contract-driven backend API emission ─────────────────────────────────────

/**
 * Emit Hono backend API files from a BackendContractObj.
 * Target: apps/api/src/{index.ts, routes/, operations/, policies/, middleware/, repositories/}
 */
export function emitHonoBackendApi(contract: BackendContractObj): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// Group routes by resourceRef for route files
	const routesByResource = new Map<string, typeof contract.routes>();
	const operationRoutes: typeof contract.routes = [];

	for (const route of contract.routes) {
		if (route.resourceRef) {
			const list = routesByResource.get(route.resourceRef) ?? [];
			list.push(route);
			routesByResource.set(route.resourceRef, list);
		} else if (route.operationRef) {
			operationRoutes.push(route);
		}
	}

	// Route files
	const routeImports: string[] = [];
	const routeMounts: string[] = [];

	for (const [resourceName, routes] of routesByResource) {
		const varName = resourceName.charAt(0).toLowerCase() + resourceName.slice(1);
		const content = emitContractRouteFile(resourceName, varName, routes, contract.middlewares);
		files.push({ path: `apps/api/src/routes/${resourceName}.ts`, kind: "CODE", content });
		routeImports.push(`import { ${varName}Routes } from "./routes/${resourceName}";`);
		routeMounts.push(`  .route("/${resourceName}", ${varName}Routes)`);
	}

	// Operations handler file
	if (operationRoutes.length > 0) {
		files.push({
			path: "apps/api/src/operations/index.ts",
			kind: "CODE",
			content: emitContractOperationsFile(operationRoutes),
		});
		routeImports.push(`import { operationsRoutes } from "./operations/index";`);
		routeMounts.push(`  .route("/operations", operationsRoutes)`);
	}

	// Middleware file
	if (contract.middlewares.length > 0) {
		files.push({
			path: "apps/api/src/middleware/guards.ts",
			kind: "CODE",
			content: emitMiddlewareFile(contract.middlewares),
		});
	}

	// Repositories stubs (one per schema)
	for (const schema of contract.schemas) {
		const varName = schema.name.charAt(0).toLowerCase() + schema.name.slice(1);
		files.push({
			path: `apps/api/src/repositories/${varName}.repository.ts`,
			kind: "CODE",
			content: emitRepositoryStub(schema.name, schema),
		});
	}

	// Main app index
	files.push({
		path: "apps/api/src/index.ts",
		kind: "CODE",
		content: emitContractAppIndex(routeImports, routeMounts, contract),
	});

	return files;
}

type RouteEntry = BackendContractObj["routes"][number];
type MiddlewareEntry = BackendContractObj["middlewares"][number];
type SchemaEntry = BackendContractObj["schemas"][number];

function emitContractRouteFile(
	resourceName: string,
	varName: string,
	routes: RouteEntry[],
	middlewares: MiddlewareEntry[],
): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated routes for resource: ${resourceName} (contract-driven)`);
	lines.push(`// Regenerate via: dtfs__generate_backend_api`);
	lines.push(``);
	lines.push(`import { Hono } from "hono";`);
	lines.push(`import { zValidator } from "@hono/zod-validator";`);
	lines.push(`import { z } from "zod";`);
	lines.push(``);

	// Collect relevant middleware names
	const relevantMiddlewares = middlewares.filter((m) =>
		m.applyTo.some((t) => t.includes("resource:")),
	);
	if (relevantMiddlewares.length > 0) {
		lines.push(`// Middlewares: ${relevantMiddlewares.map((m) => m.name).join(", ")}`);
	}

	lines.push(``);
	lines.push(`export const ${varName}Routes = new Hono()`);

	// Sort routes: GETs before POSTs etc for readability
	const sorted = [...routes].sort((a, b) => a.path.localeCompare(b.path));

	for (const route of sorted) {
		const method = route.method.toLowerCase();
		const routePath = route.path.replace(`/api/${resourceName}`, "") || "/";

		lines.push(`  // ${route.method} ${route.path} — ${route.description}`);

		if (route.method === "GET" && routePath === "/") {
			lines.push(`  .get("/", async (c) => {`);
			lines.push(`    // TODO: implement list ${resourceName}`);
			lines.push(`    return c.json({ ${varName}s: [] });`);
			lines.push(`  })`);
		} else if (route.method === "GET" && routePath.includes(":id")) {
			lines.push(`  .get("/:id", async (c) => {`);
			lines.push(`    const id = c.req.param("id");`);
			lines.push(`    // TODO: implement read ${resourceName} by id`);
			lines.push(`    return c.json({ id, error: "not_implemented" }, 501);`);
			lines.push(`  })`);
		} else if (route.method === "POST") {
			lines.push(`  .post(`);
			lines.push(`    "/",`);
			lines.push(`    zValidator("json", z.record(z.unknown())),`);
			lines.push(`    async (c) => {`);
			lines.push(`      const data = c.req.valid("json");`);
			lines.push(`      // TODO: implement create ${resourceName}`);
			lines.push(`      return c.json({ created: true, data }, 201);`);
			lines.push(`    },`);
			lines.push(`  )`);
		} else if (route.method === "PATCH") {
			lines.push(`  .patch(`);
			lines.push(`    "/:id",`);
			lines.push(`    zValidator("json", z.record(z.unknown())),`);
			lines.push(`    async (c) => {`);
			lines.push(`      const id = c.req.param("id");`);
			lines.push(`      const data = c.req.valid("json");`);
			lines.push(`      // TODO: implement update ${resourceName} by id`);
			lines.push(`      return c.json({ id, updated: true, data });`);
			lines.push(`    },`);
			lines.push(`  )`);
		} else if (route.method === "DELETE") {
			lines.push(`  .delete("/:id", async (c) => {`);
			lines.push(`    const id = c.req.param("id");`);
			lines.push(`    // TODO: implement delete ${resourceName} by id`);
			lines.push(`    return c.json({ id, deleted: true });`);
			lines.push(`  })`);
		} else {
			lines.push(`  .${method}("${routePath}", async (c) => {`);
			lines.push(`    // TODO: implement ${route.method} ${route.path}`);
			lines.push(`    return c.json({ ok: true });`);
			lines.push(`  })`);
		}
	}

	lines.push(`;`);
	lines.push(``);
	return lines.join("\n");
}

function emitContractOperationsFile(routes: RouteEntry[]): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated operation routes (contract-driven)`);
	lines.push(`import { Hono } from "hono";`);
	lines.push(`import { zValidator } from "@hono/zod-validator";`);
	lines.push(`import { z } from "zod";`);
	lines.push(``);
	lines.push(`export const operationsRoutes = new Hono()`);

	for (const route of routes) {
		const opName = route.operationRef ?? "unknown";
		const method = route.method.toLowerCase();
		const routePath = `/${opName}`;
		lines.push(`  // ${route.method} /operations/${opName} — ${route.description}`);
		lines.push(`  .${method}("${routePath}", zValidator("json", z.record(z.unknown())), async (c) => {`);
		lines.push(`    // TODO: implement operation ${opName}`);
		lines.push(`    return c.json({ ok: true, operation: "${opName}" });`);
		lines.push(`  })`);
	}

	lines.push(`;`);
	lines.push(``);
	return lines.join("\n");
}

function emitMiddlewareFile(middlewares: MiddlewareEntry[]): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated policy guards middleware (contract-driven)`);
	lines.push(`import type { Context, Next } from "hono";`);
	lines.push(``);
	for (const mw of middlewares) {
		const fnName = mw.name.replace(/[^a-zA-Z0-9]/g, "_");
		lines.push(`// Policy: ${mw.policyName} (${mw.scope}, effect: ${mw.effect})`);
		lines.push(`export async function ${fnName}(c: Context, next: Next) {`);
		lines.push(`  // TODO: implement ${mw.policyName} guard`);
		lines.push(`  await next();`);
		lines.push(`}`);
		lines.push(``);
	}
	return lines.join("\n");
}

function emitRepositoryStub(entityName: string, schema: SchemaEntry): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated repository stub for ${entityName} (contract-driven)`);
	lines.push(`// Fields: ${schema.fields.map((f) => f.name).join(", ")}`);
	lines.push(``);
	lines.push(`export type ${entityName}Record = {`);
	for (const f of schema.fields) {
		const opt = f.required ? "" : "?";
		lines.push(`  ${f.name}${opt}: ${f.type};`);
	}
	lines.push(`};`);
	lines.push(``);
	lines.push(`// TODO: implement ${entityName} repository using Prisma or query builder`);
	lines.push(`export const ${entityName.charAt(0).toLowerCase() + entityName.slice(1)}Repository = {`);
	lines.push(`  async findMany(): Promise<${entityName}Record[]> { return []; },`);
	lines.push(`  async findById(_id: string): Promise<${entityName}Record | null> { return null; },`);
	lines.push(`  async create(_data: Partial<${entityName}Record>): Promise<${entityName}Record> { throw new Error("not implemented"); },`);
	lines.push(`  async update(_id: string, _data: Partial<${entityName}Record>): Promise<${entityName}Record> { throw new Error("not implemented"); },`);
	lines.push(`  async delete(_id: string): Promise<void> { throw new Error("not implemented"); },`);
	lines.push(`};`);
	lines.push(``);
	return lines.join("\n");
}

function emitContractAppIndex(
	routeImports: string[],
	routeMounts: string[],
	contract: BackendContractObj,
): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated Hono app entry (contract-driven)`);
	lines.push(`// API base: ${contract.apiBasePath}`);
	lines.push(``);
	lines.push(`import { Hono } from "hono";`);
	lines.push(`import { cors } from "hono/cors";`);
	for (const imp of routeImports) {
		lines.push(imp);
	}
	lines.push(``);
	lines.push(`export const app = new Hono()`);
	lines.push(`  .use("*", cors())`);
	lines.push(`  .get("/health", (c) => c.json({ ok: true }))`);
	for (const mount of routeMounts) {
		lines.push(mount);
	}
	lines.push(`;`);
	lines.push(``);
	lines.push(`export type AppType = typeof app;`);
	lines.push(``);
	return lines.join("\n");
}
