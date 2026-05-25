// emit-shared.ts — generates packages/shared/src from SharedContractObj.
// Emits: schemas/index.ts, types/index.ts, errors.ts, api-contract.ts

import type { SharedContractObj } from "../lib/contracts/compile-shared";
import type { GeneratedFile } from "./types";

/**
 * Emit shared package files from a compiled SharedContractObj.
 */
export function emitSharedPackage(contract: SharedContractObj): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// ── packages/shared/src/schemas/index.ts ──────────────────────────────────
	files.push({
		path: "packages/shared/src/schemas/index.ts",
		kind: "CODE",
		content: emitSchemasIndex(contract),
	});

	// ── packages/shared/src/types/index.ts ────────────────────────────────────
	files.push({
		path: "packages/shared/src/types/index.ts",
		kind: "CODE",
		content: emitTypesIndex(contract),
	});

	// ── packages/shared/src/errors.ts ─────────────────────────────────────────
	files.push({
		path: "packages/shared/src/errors.ts",
		kind: "CODE",
		content: emitErrors(contract),
	});

	// ── packages/shared/src/api-contract.ts ───────────────────────────────────
	files.push({
		path: "packages/shared/src/api-contract.ts",
		kind: "CODE",
		content: emitApiContract(contract),
	});

	// ── packages/shared/src/index.ts — barrel ─────────────────────────────────
	files.push({
		path: "packages/shared/src/index.ts",
		kind: "CODE",
		content: `// Auto-generated shared package barrel — do not edit by hand.\nexport * from "./schemas/index";\nexport * from "./types/index";\nexport * from "./errors";\nexport * from "./api-contract";\n`,
	});

	return files;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emitSchemasIndex(contract: SharedContractObj): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated Zod schemas — do not edit by hand.`);
	lines.push(`import { z } from "zod";`);
	lines.push(``);

	for (const schema of contract.schemas) {
		lines.push(`export const ${schema.name} = ${schema.zodSchema};`);
		lines.push(`export type ${schema.name.replace(/Schema$/, "")} = z.infer<typeof ${schema.name}>;`);
		lines.push(``);
	}

	return lines.join("\n");
}

function emitTypesIndex(contract: SharedContractObj): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated TypeScript types — do not edit by hand.`);
	lines.push(``);

	for (const type of contract.types) {
		if (type.kind === "error") continue; // emitted in errors.ts
		if (!type.fields || type.fields.length === 0) {
			// No fields — emit a string union or empty type
			if (type.description?.startsWith("Role enum:")) {
				const roles = type.description.replace("Role enum: ", "").split(" | ").map((r) => `"${r.trim()}"`);
				lines.push(`export type ${type.name} = ${roles.join(" | ")};`);
			} else {
				lines.push(`export type ${type.name} = Record<string, unknown>;`);
			}
		} else {
			lines.push(`export type ${type.name} = {`);
			for (const f of type.fields) {
				const opt = f.required ? "" : "?";
				lines.push(`  ${f.name}${opt}: ${f.type};`);
			}
			lines.push(`};`);
		}
		if (type.description) {
			// Prepend a JSDoc comment before the type (we need to insert it before the last type line)
			const lastIdx = lines.length - 1;
			// find the start of this type block
			const exportLine = lines.findIndex((l, i) => i < lastIdx && l.startsWith(`export type ${type.name}`));
			if (exportLine >= 0) {
				lines.splice(exportLine, 0, `/** ${type.description} */`);
			}
		}
		lines.push(``);
	}

	return lines.join("\n");
}

function emitErrors(contract: SharedContractObj): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated error codes — do not edit by hand.`);
	lines.push(``);
	lines.push(`export type ApiErrorCode =`);
	const codes = contract.errors.map((e) => `  | "${e.code}"`);
	lines.push(codes.join("\n") + ";");
	lines.push(``);
	lines.push(`export type ApiError = {`);
	lines.push(`  code: ApiErrorCode;`);
	lines.push(`  message: string;`);
	lines.push(`  httpStatus: number;`);
	lines.push(`};`);
	lines.push(``);
	lines.push(`export const API_ERRORS: Record<ApiErrorCode, ApiError> = {`);
	for (const e of contract.errors) {
		lines.push(`  ${e.code}: { code: "${e.code}", message: "${e.message}", httpStatus: ${e.httpStatus} },`);
	}
	lines.push(`};`);
	lines.push(``);
	return lines.join("\n");
}

function emitApiContract(contract: SharedContractObj): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated API client contract — do not edit by hand.`);
	lines.push(``);
	lines.push(`export const API_BASE_URL = "${contract.apiClient.baseUrl}";`);
	lines.push(``);
	lines.push(`export type ApiOperation = {`);
	lines.push(`  name: string;`);
	lines.push(`  method: "GET" | "POST";`);
	lines.push(`  path: string;`);
	lines.push(`  inputType: string;`);
	lines.push(`  outputType: string;`);
	lines.push(`};`);
	lines.push(``);
	lines.push(`export const API_OPERATIONS: ApiOperation[] = ${JSON.stringify(contract.apiClient.operations, null, 2)};`);
	lines.push(``);

	if (contract.events.length > 0) {
		lines.push(`export const API_EVENTS = ${JSON.stringify(contract.events, null, 2)};`);
		lines.push(``);
	}

	return lines.join("\n");
}
