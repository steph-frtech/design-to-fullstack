// Pure unit test — no DB, no network.
// Run: node --import tsx/esm --test src/runtime/runtime.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeRuntimeRoadmap, RUNTIME_CONCEPTS } from "./index";

describe("describeRuntimeRoadmap()", () => {
	it("returns at least 12 entries", () => {
		const roadmap = describeRuntimeRoadmap();
		assert.ok(roadmap.length >= 12, `expected ≥12 entries, got ${roadmap.length}`);
	});

	it("every entry has status 'planned'", () => {
		const roadmap = describeRuntimeRoadmap();
		for (const entry of roadmap) {
			assert.strictEqual(
				entry.status,
				"planned",
				`entry "${entry.capability}" has status "${entry.status}", expected "planned"`,
			);
		}
	});

	it("every entry has a non-empty capability and notes", () => {
		const roadmap = describeRuntimeRoadmap();
		for (const entry of roadmap) {
			assert.ok(entry.capability.length > 0, "capability must be non-empty");
			assert.ok(entry.notes.length > 0, `notes missing for "${entry.capability}"`);
		}
	});
});

describe("RUNTIME_CONCEPTS", () => {
	const expected = [
		"Job",
		"Schedule",
		"WebhookEndpoint",
		"NotificationTemplate",
		"SearchIndex",
		"Tenant",
		"Subscription",
		"BillingPlan",
		"RuntimeMetric",
	];

	it("contains exactly the 9 expected concept names", () => {
		assert.strictEqual(RUNTIME_CONCEPTS.length, 9, `expected 9 concepts, got ${RUNTIME_CONCEPTS.length}`);
		for (const name of expected) {
			assert.ok(
				RUNTIME_CONCEPTS.includes(name),
				`RUNTIME_CONCEPTS is missing "${name}"`,
			);
		}
	});
});
