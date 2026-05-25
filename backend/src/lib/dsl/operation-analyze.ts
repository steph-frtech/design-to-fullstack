// Static analysis for OperationBody.
// Collects entity/policy/integration/event names referenced in an operation body.

import type { OperationBody, OperationStep } from "./operation-dsl";

// ─── Public API ───────────────────────────────────────────────────────────────

/** All entity names referenced in read or mutate steps (unique, sorted). */
export function collectOperationEntities(body: OperationBody): string[] {
	const acc = new Set<string>();
	walkSteps(body, (step) => {
		if (step.kind === "read") acc.add(step.entity);
		if (step.kind === "mutate") acc.add(step.entity);
	});
	return Array.from(acc).sort();
}

/** Entities read (read steps only) — unique, sorted. */
export function collectOperationReads(body: OperationBody): string[] {
	const acc = new Set<string>();
	walkSteps(body, (step) => {
		if (step.kind === "read") acc.add(step.entity);
	});
	return Array.from(acc).sort();
}

/** Entities written (mutate steps only) — unique, sorted. */
export function collectOperationWrites(body: OperationBody): string[] {
	const acc = new Set<string>();
	walkSteps(body, (step) => {
		if (step.kind === "mutate") acc.add(step.entity);
	});
	return Array.from(acc).sort();
}

/** All policy names referenced in authorize steps (unique, sorted). */
export function collectOperationPolicies(body: OperationBody): string[] {
	const acc = new Set<string>();
	walkSteps(body, (step) => {
		if (step.kind === "authorize") acc.add(step.policy);
	});
	return Array.from(acc).sort();
}

/** All integration keys referenced in callIntegration steps (unique, sorted). */
export function collectOperationIntegrations(body: OperationBody): string[] {
	const acc = new Set<string>();
	walkSteps(body, (step) => {
		if (step.kind === "callIntegration") acc.add(step.integration);
	});
	return Array.from(acc).sort();
}

/** All event names referenced in emitEvent steps (unique, sorted). */
export function collectOperationEvents(body: OperationBody): string[] {
	const acc = new Set<string>();
	walkSteps(body, (step) => {
		if (step.kind === "emitEvent") acc.add(step.event);
	});
	return Array.from(acc).sort();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkSteps(steps: OperationBody, fn: (step: OperationStep) => void): void {
	for (const step of steps) {
		fn(step);
		if (step.kind === "branch") {
			walkSteps(step.then, fn);
			if (step.else) walkSteps(step.else, fn);
		}
	}
}
