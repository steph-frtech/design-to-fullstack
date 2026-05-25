// Smoke test: extract and list all MCP tool names registered in createMcpServer.
// Parses mcp.ts source statically — no DB connection required.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "../src/mcp.ts"), "utf8");

const pattern = /server\.tool\(\s*["']([^"']+)["']/g;
const names: string[] = [];
let m: RegExpExecArray | null;
while ((m = pattern.exec(src)) !== null) {
	names.push(m[1]);
}

names.sort();

const MVP_TOOLS = [
	"dtfs__list_projects",
	"dtfs__get_project_spec",
	"dtfs__describe_concept",
	"dtfs__list_expr_functions",
	"dtfs__list_behaviors",
	"dtfs__create_product_spec_from_prompt",
	"dtfs__create_screen_spec_from_prompt",
	"dtfs__list_open_questions",
	"dtfs__answer_open_question",
	"dtfs__generate_sdd_artifacts",
	"dtfs__sync_speckit_artifacts",
	"dtfs__validate_sdd_artifacts",
	"dtfs__propose_platform_spec",
	"dtfs__create_delta_from_platform_proposal",
	"dtfs__validate_spec",
	"dtfs__explain_delta_spec",
	"dtfs__begin_changeset",
	"dtfs__apply_spec",
	"dtfs__commit_changeset",
	"dtfs__discard_changeset",
	"dtfs__revert_changeset",
];

console.log(`Total tools registered: ${names.length}\n`);
console.log("All registered tools (sorted):");
for (const name of names) {
	const isMvp = MVP_TOOLS.includes(name);
	console.log(`  ${isMvp ? "[MVP]" : "     "} ${name}`);
}

console.log("\nMVP tools check:");
const missing = MVP_TOOLS.filter((t) => !names.includes(t));
if (missing.length === 0) {
	console.log("  All MVP tools present.");
} else {
	console.log("  MISSING:");
	for (const t of missing) console.log(`    - ${t}`);
}
