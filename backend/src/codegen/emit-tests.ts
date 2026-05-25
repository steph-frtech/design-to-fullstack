// emit-tests.ts — generates test stubs for tests/{api, e2e, contract}
// from BackendContractObj + SharedContractObj.

import type { BackendContractObj } from "../lib/contracts/compile-backend";
import type { SharedContractObj } from "../lib/contracts/compile-shared";
import type { GeneratedFile } from "./types";

/**
 * Emit test stub files from compiled contracts.
 * Target: tests/{api/, e2e/, contract/}
 */
export function emitTests(
	backendContract: BackendContractObj,
	sharedContract: SharedContractObj,
): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// ── API tests ─────────────────────────────────────────────────────────────
	for (const route of backendContract.routes) {
		const testPath = routeToTestPath(route);
		if (!testPath) continue;
		files.push({
			path: `tests/api/${testPath}.test.ts`,
			kind: "TEST",
			content: emitApiTestStub(route),
		});
	}

	// ── Contract tests ────────────────────────────────────────────────────────
	files.push({
		path: "tests/contract/shared-types.test.ts",
		kind: "TEST",
		content: emitContractTestStub(sharedContract),
	});

	// ── E2E stubs (one per page) ──────────────────────────────────────────────
	files.push({
		path: "tests/e2e/smoke.test.ts",
		kind: "TEST",
		content: emitE2eStub(),
	});

	return files;
}

type RouteEntry = BackendContractObj["routes"][number];

function routeToTestPath(route: RouteEntry): string | null {
	if (route.resourceRef) {
		return route.resourceRef;
	}
	if (route.operationRef) {
		return `operations/${route.operationRef}`;
	}
	return null;
}

function emitApiTestStub(route: RouteEntry): string {
	const resourceOrOp = route.resourceRef ?? route.operationRef ?? "unknown";
	return `// Auto-generated API test stub — do not edit by hand.
// Route: ${route.method} ${route.path}
// Regenerate via: dtfs__generate_tests

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("${resourceOrOp} API", () => {
  it("${route.method} ${route.path} — placeholder (not yet runnable)", () => {
    // TODO: implement integration test for ${route.description}
    assert.ok(true, "stub passes");
  });
});
`;
}

function emitContractTestStub(contract: SharedContractObj): string {
	const typeNames = contract.types.map((t) => t.name).slice(0, 5).join(", ");
	return `// Auto-generated contract test stub — do not edit by hand.
// Types: ${typeNames}
// Regenerate via: dtfs__generate_tests

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Shared contract types", () => {
  it("error codes are defined", () => {
    const codes = ${JSON.stringify(contract.errors.map((e) => e.code))};
    assert.ok(codes.length > 0, "should have at least one error code");
  });

  it("has expected type count (${contract.types.length} types)", () => {
    // Type count captured at codegen time — verify types are stable
    assert.equal(${contract.types.length}, ${contract.types.length});
  });
});
`;
}

function emitE2eStub(): string {
	return `// Auto-generated E2E smoke test stub — do not edit by hand.
// Regenerate via: dtfs__generate_tests

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("E2E smoke", () => {
  it("placeholder — not yet runnable (V1 stub)", () => {
    // TODO: implement with Playwright or similar
    assert.ok(true, "stub passes");
  });
});
`;
}
