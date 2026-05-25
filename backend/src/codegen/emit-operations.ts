// emit-operations.ts — generates typed operation handler stubs.
// Each operation gets: typed input/output interfaces + a handler stub
// listing the Step DSL steps as comments + TODO.

import type { CodegenSpec, GeneratedFile } from "./types.ts";

type JsonSchemaProperty = {
	type?: string;
	description?: string;
	[key: string]: unknown;
};

type JsonSchema = {
	type?: string;
	properties?: Record<string, JsonSchemaProperty>;
	required?: string[];
	[key: string]: unknown;
};

type OperationStep = {
	kind?: string;
	as?: string;
	[key: string]: unknown;
};

function toPascalCase(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

function jsonSchemaTsType(schema: unknown): string {
	if (!schema || typeof schema !== "object") return "unknown";
	const s = schema as JsonSchema;
	if (s.type === "string") return "string";
	if (s.type === "number" || s.type === "integer") return "number";
	if (s.type === "boolean") return "boolean";
	if (s.type === "array") return "unknown[]";
	if (s.type === "object" || s.properties) {
		const props = s.properties ?? {};
		const required = new Set(s.required ?? []);
		const fields = Object.entries(props).map(([k, v]) => {
			const opt = required.has(k) ? "" : "?";
			return `${k}${opt}: ${jsonSchemaTsType(v)}`;
		});
		return fields.length > 0 ? `{ ${fields.join("; ")} }` : "Record<string, unknown>";
	}
	return "unknown";
}

function parseSteps(raw: unknown): OperationStep[] {
	if (Array.isArray(raw)) return raw as OperationStep[];
	return [];
}

/**
 * Emit one TypeScript file per Operation with:
 * - Input/Output type interfaces
 * - A typed handler function stub
 * - Step DSL documented as comments
 */
export function emitOperationHandlers(spec: CodegenSpec): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// Sort for determinism
	const sorted = [...spec.operations].sort((a, b) => a.name.localeCompare(b.name));

	for (const op of sorted) {
		const pascalName = toPascalCase(op.name);
		const filePath = `backend/src/operations/${op.name}.ts`;
		const content = emitOperationFile(op, pascalName);
		files.push({ path: filePath, kind: "CODE", content });
	}

	// Emit an index that re-exports all handlers
	if (sorted.length > 0) {
		const indexLines: string[] = [];
		indexLines.push(`// Auto-generated operation handlers index`);
		indexLines.push(``);
		for (const op of sorted) {
			indexLines.push(
				`export { handle${toPascalCase(op.name)} } from "./${op.name}.ts";`,
			);
		}
		indexLines.push(``);
		files.push({
			path: "backend/src/operations/index.ts",
			kind: "CODE",
			content: indexLines.join("\n"),
		});
	}

	return files;
}

function emitOperationFile(
	op: CodegenSpec["operations"][number],
	pascalName: string,
): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated handler stub for operation: ${op.name} (${op.kind})`);
	lines.push(`// Regenerate via: dtfs__generate_app`);
	lines.push(``);

	// Input type
	const inputType = jsonSchemaTsType(op.inputSchema);
	lines.push(`export type ${pascalName}Input = ${inputType};`);
	lines.push(``);

	// Output type
	if (op.outputSchema) {
		const outputType = jsonSchemaTsType(op.outputSchema);
		lines.push(`export type ${pascalName}Output = ${outputType};`);
	} else {
		lines.push(`export type ${pascalName}Output = void;`);
	}
	lines.push(``);

	// Context type
	lines.push(`export type OperationContext = {`);
	lines.push(`  userId?: string;`);
	lines.push(`  // extend with auth session, request, etc.`);
	lines.push(`};`);
	lines.push(``);

	// Handler stub
	lines.push(
		`export async function handle${pascalName}(`);
	lines.push(`  input: ${pascalName}Input,`);
	lines.push(`  ctx: OperationContext,`);
	lines.push(`): Promise<${pascalName}Output> {`);

	// Steps as comments
	const steps = parseSteps(op.steps);
	if (steps.length > 0) {
		lines.push(`  // ─── Step DSL (${steps.length} step${steps.length === 1 ? "" : "s"}) ───`);
		for (const step of steps) {
			const kind = step.kind ?? "unknown";
			const alias = step.as ? ` → as: ${step.as}` : "";
			lines.push(`  // [${kind}${alias}] ${JSON.stringify(step)}`);
		}
		lines.push(``);
	}

	if (op.bodyHint) {
		lines.push(`  // Hint: ${op.bodyHint}`);
		lines.push(``);
	}

	lines.push(`  // TODO: implement`);
	lines.push(`  throw new Error("Not implemented: ${op.name}");`);
	lines.push(`}`);
	lines.push(``);

	return lines.join("\n");
}
