// emit-sdk.ts — generates the typed API client SDK from SharedContractObj.
// Target: packages/shared/src (overlaps with emit-shared, focuses on client SDK)

import type { SharedContractObj } from "../lib/contracts/compile-shared";
import type { GeneratedFile } from "./types";

/**
 * Emit typed SDK files from a compiled SharedContractObj.
 * Produces packages/shared/src with typed fetch wrappers per operation.
 */
export function emitSdk(contract: SharedContractObj): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	files.push({
		path: "packages/shared/src/sdk/client.ts",
		kind: "CODE",
		content: emitSdkClient(contract),
	});

	files.push({
		path: "packages/shared/src/sdk/index.ts",
		kind: "CODE",
		content: emitSdkIndex(contract),
	});

	return files;
}

function emitSdkClient(contract: SharedContractObj): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated typed API client SDK — do not edit by hand.`);
	lines.push(`// Operations: ${contract.apiClient.operations.map((o) => o.name).join(", ") || "none"}`);
	lines.push(``);
	lines.push(`const BASE_URL = "${contract.apiClient.baseUrl}";`);
	lines.push(``);
	lines.push(`async function call<TOut>(path: string, method: string, body?: unknown): Promise<TOut> {`);
	lines.push(`  const res = await fetch(\`\${BASE_URL}\${path}\`, {`);
	lines.push(`    method,`);
	lines.push(`    headers: { "Content-Type": "application/json" },`);
	lines.push(`    ...(body ? { body: JSON.stringify(body) } : {}),`);
	lines.push(`  });`);
	lines.push(`  if (!res.ok) throw new Error(\`API \${method} \${path} failed: \${res.status}\`);`);
	lines.push(`  return res.json() as Promise<TOut>;`);
	lines.push(`}`);
	lines.push(``);

	for (const op of contract.apiClient.operations) {
		const fnName = op.name;
		const inputType = op.inputType;
		const outputType = `${op.outputType}`;
		lines.push(`export function ${fnName}(input: ${inputType}): Promise<${outputType}> {`);
		lines.push(`  return call<${outputType}>("${op.path}", "${op.method}", ${op.method !== "GET" ? "input" : "undefined"});`);
		lines.push(`}`);
		lines.push(``);
	}

	if (contract.apiClient.operations.length === 0) {
		lines.push(`// No operations defined yet — add operations in the control plane`);
	}

	return lines.join("\n");
}

function emitSdkIndex(contract: SharedContractObj): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated SDK index — do not edit by hand.`);
	lines.push(`export * from "./client";`);
	lines.push(``);
	// Re-export type names for convenience
	for (const op of contract.apiClient.operations) {
		lines.push(`export type { ${op.inputType} } from "../types/index";`);
	}
	lines.push(``);
	return lines.join("\n");
}
