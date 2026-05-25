// behavior-expand.ts
//
// Converts (entity, behavior) pairs into a canonical DeltaSpec (Phase 7).
// ALWAYS dry-run: this module never writes to the database.

import type { AttributeInput, DeltaSpec, OperationInput, PolicyInput, RelationInput, TestScenarioInput } from "./dsl/delta-spec";
import type { BehaviorKind } from "./behaviors";
import { BEHAVIOR_CATALOGUE } from "./behaviors";

// ─── Public types ─────────────────────────────────────────────────────────────

export type EntityBehaviorRequest = {
	name: string;
	behaviors: BehaviorKind[];
	/** Optional per-behavior config overrides. key = behavior kind */
	config?: Partial<Record<BehaviorKind, unknown>>;
};

export type PerBehaviorDetail = {
	entity: string;
	behavior: BehaviorKind;
	added: {
		attributes: AttributeInput[];
		relations: RelationInput[];
		operations: OperationInput[];
		policies: PolicyInput[];
		testScenarios: TestScenarioInput[];
	};
};

export type BehaviorExpandResult = {
	deltaSpec: DeltaSpec;
	perBehavior: PerBehaviorDetail[];
};

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Expand (entity, behavior[]) pairs into a DeltaSpec.
 * Pure function — no DB access, no side effects.
 */
export function expandToDelta(entities: EntityBehaviorRequest[]): BehaviorExpandResult {
	const perBehavior: PerBehaviorDetail[] = [];

	const allAttributes: AttributeInput[] = [];
	const allRelations: RelationInput[] = [];
	const allOperations: OperationInput[] = [];
	const allPolicies: PolicyInput[] = [];
	const allTestScenarios: TestScenarioInput[] = [];

	for (const entityReq of entities) {
		const entityName = entityReq.name;

		for (const kind of entityReq.behaviors) {
			const entry = BEHAVIOR_CATALOGUE[kind];
			if (!entry) continue;

			// Parse config (may throw; caller handles)
			const rawConfig = entityReq.config?.[kind];
			const config = entry.parseConfig(rawConfig ?? null) as Record<string, unknown>;

			const detail = expandOne(entityName, kind, config);
			perBehavior.push(detail);

			allAttributes.push(...detail.added.attributes);
			allRelations.push(...detail.added.relations);
			allOperations.push(...detail.added.operations);
			allPolicies.push(...detail.added.policies);
			allTestScenarios.push(...detail.added.testScenarios);
		}
	}

	const deltaSpec: DeltaSpec = {};

	if (allAttributes.length > 0) deltaSpec.attributes = { create: allAttributes };
	if (allRelations.length > 0) deltaSpec.relations = { create: allRelations };
	if (allOperations.length > 0) deltaSpec.operations = { create: allOperations };
	if (allPolicies.length > 0) deltaSpec.policies = { create: allPolicies };
	if (allTestScenarios.length > 0) deltaSpec.testScenarios = { create: allTestScenarios };

	return { deltaSpec, perBehavior };
}

// ─── Per-behavior expansion logic ─────────────────────────────────────────────

function expandOne(
	entityName: string,
	kind: BehaviorKind,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	switch (kind) {
		case "ownable":
			return expandOwnable(entityName, config);
		case "soft-deletable":
			return expandSoftDeletable(entityName, config);
		case "publishable":
			return expandPublishable(entityName, config);
		case "taggable":
			return expandTaggable(entityName, config);
		case "searchable":
			return expandSearchable(entityName, config);
		case "shareable":
			return expandShareable(entityName, config);
		case "auditable":
			return expandAuditable(entityName, config);
		case "versioned":
			return expandVersioned(entityName, config);
		case "commentable":
			return expandCommentable(entityName, config);
		case "attachable":
			return expandAttachable(entityName, config);
		case "localizable":
			return expandLocalizable(entityName, config);
	}
}

// ─── ownable ──────────────────────────────────────────────────────────────────

function expandOwnable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const ownerField = (config.ownerField as string | undefined) ?? "ownerId";
	const policyName = `${entityName}OwnerOnly`;
	const opName = `list${entityName}ForOwner`;

	const attributes: AttributeInput[] = [
		{
			entityName,
			name: ownerField,
			type: "TEXT",
			required: true,
			config: { relation: "User", relationField: "id" },
		},
	];

	const policies: PolicyInput[] = [
		{
			name: policyName,
			scope: "ENTITY",
			entityName,
			effect: "ALLOW",
			rule: { eq: [{ ref: `record.${ownerField}` }, { ref: "auth.user.id" }] },
		},
	];

	const operations: OperationInput[] = [
		{
			name: opName,
			kind: "QUERY",
			inputSchema: {},
			outputSchema: { type: "array", items: { $ref: entityName } },
			reads: [entityName],
			writes: [],
			steps: [
				{ kind: "authorize", policy: policyName },
				{
					kind: "read",
					entity: entityName,
					where: { eq: [{ ref: `record.${ownerField}` }, { ref: "auth.user.id" }] },
					many: true,
					as: "items",
				},
				{ kind: "return", value: { ref: "items" } },
			],
			bodyHint: `List ${entityName} records belonging to the authenticated user.`,
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${entityName} owner can read their own records`,
			operationName: opName,
			inputs: {},
			expected: { statusCode: 200 },
		},
		{
			name: `${entityName} non-owner is denied`,
			operationName: opName,
			inputs: { userId: "other-user" },
			expected: { statusCode: 403 },
		},
	];

	return {
		entity: entityName,
		behavior: "ownable",
		added: { attributes, relations: [], operations, policies, testScenarios },
	};
}

// ─── soft-deletable ───────────────────────────────────────────────────────────

function expandSoftDeletable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const field = (config.field as string | undefined) ?? "deletedAt";
	const restoreOpName = `restore${entityName}`;

	const attributes: AttributeInput[] = [
		{
			entityName,
			name: field,
			type: "DATETIME",
			required: false,
			config: { nullable: true, description: "Set to mark as soft-deleted. NULL = active." },
		},
	];

	const operations: OperationInput[] = [
		{
			name: restoreOpName,
			kind: "COMMAND",
			inputSchema: { id: { type: "string" } },
			reads: [entityName],
			writes: [entityName],
			steps: [
				{
					kind: "read",
					entity: entityName,
					where: { eq: [{ ref: "record.id" }, { ref: "input.id" }] },
					as: "target",
				},
				{
					kind: "mutate",
					op: "update",
					entity: entityName,
					where: { eq: [{ ref: "record.id" }, { ref: "input.id" }] },
					data: { obj: { [field]: { lit: null } } },
					as: "restored",
				},
				{ kind: "return", value: { ref: "restored" } },
			],
			bodyHint: `Restore a soft-deleted ${entityName} by clearing ${field}.`,
		},
	];

	const policies: PolicyInput[] = [
		{
			name: `${entityName}NotDeleted`,
			scope: "ENTITY",
			entityName,
			effect: "ALLOW",
			rule: { eq: [{ ref: `record.${field}` }, { lit: null }] },
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `soft-delete ${entityName} sets ${field}`,
			operationName: `delete${entityName}`,
			inputs: { id: "some-id" },
			expected: { [`${field}`]: "non-null" },
		},
		{
			name: `${restoreOpName} clears ${field}`,
			operationName: restoreOpName,
			inputs: { id: "some-id" },
			expected: { [`${field}`]: null },
		},
		{
			name: `soft-deleted ${entityName} excluded from list`,
			operationName: `list${entityName}`,
			inputs: {},
			expected: { excludesSoftDeleted: true },
		},
	];

	return {
		entity: entityName,
		behavior: "soft-deletable",
		added: { attributes, relations: [], operations, policies, testScenarios },
	};
}

// ─── publishable ──────────────────────────────────────────────────────────────

function expandPublishable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const statusField = (config.statusField as string | undefined) ?? "status";
	const publishedAtField = (config.publishedAtField as string | undefined) ?? "publishedAt";

	const attributes: AttributeInput[] = [
		{
			entityName,
			name: statusField,
			type: "TEXT",
			required: true,
			config: { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "DRAFT" },
		},
		{
			entityName,
			name: publishedAtField,
			type: "DATETIME",
			required: false,
			config: { nullable: true },
		},
	];

	const publishOpName = `publish${entityName}`;
	const unpublishOpName = `unpublish${entityName}`;
	const archiveOpName = `archive${entityName}`;

	const operations: OperationInput[] = [
		{
			name: publishOpName,
			kind: "COMMAND",
			inputSchema: { id: { type: "string" } },
			reads: [entityName],
			writes: [entityName],
			steps: [
				{
					kind: "mutate",
					op: "update",
					entity: entityName,
					where: { eq: [{ ref: "record.id" }, { ref: "input.id" }] },
					data: {
						obj: {
							[statusField]: { lit: "PUBLISHED" },
							[publishedAtField]: { call: "now", args: [] },
						},
					},
					as: "updated",
				},
				{ kind: "return", value: { ref: "updated" } },
			],
			bodyHint: `Transition ${entityName} to PUBLISHED status.`,
		},
		{
			name: unpublishOpName,
			kind: "COMMAND",
			inputSchema: { id: { type: "string" } },
			reads: [entityName],
			writes: [entityName],
			steps: [
				{
					kind: "mutate",
					op: "update",
					entity: entityName,
					where: { eq: [{ ref: "record.id" }, { ref: "input.id" }] },
					data: { obj: { [statusField]: { lit: "DRAFT" } } },
					as: "updated",
				},
				{ kind: "return", value: { ref: "updated" } },
			],
			bodyHint: `Revert ${entityName} to DRAFT status.`,
		},
		{
			name: archiveOpName,
			kind: "COMMAND",
			inputSchema: { id: { type: "string" } },
			reads: [entityName],
			writes: [entityName],
			steps: [
				{
					kind: "mutate",
					op: "update",
					entity: entityName,
					where: { eq: [{ ref: "record.id" }, { ref: "input.id" }] },
					data: { obj: { [statusField]: { lit: "ARCHIVED" } } },
					as: "updated",
				},
				{ kind: "return", value: { ref: "updated" } },
			],
			bodyHint: `Archive (deactivate) a ${entityName}.`,
		},
	];

	const policies: PolicyInput[] = [
		{
			name: `${entityName}PublishedOnly`,
			scope: "ENTITY",
			entityName,
			effect: "ALLOW",
			rule: { eq: [{ ref: `record.${statusField}` }, { lit: "PUBLISHED" }] },
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${publishOpName} sets status PUBLISHED and ${publishedAtField}`,
			operationName: publishOpName,
			inputs: { id: "some-id" },
			expected: { [statusField]: "PUBLISHED", [`${publishedAtField}`]: "non-null" },
		},
		{
			name: `${unpublishOpName} reverts to DRAFT`,
			operationName: unpublishOpName,
			inputs: { id: "some-id" },
			expected: { [statusField]: "DRAFT" },
		},
		{
			name: `public list only shows PUBLISHED ${entityName}`,
			operationName: `list${entityName}`,
			inputs: {},
			expected: { onlyPublished: true },
		},
	];

	return {
		entity: entityName,
		behavior: "publishable",
		added: { attributes, relations: [], operations, policies, testScenarios },
	};
}

// ─── taggable ─────────────────────────────────────────────────────────────────

function expandTaggable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const field = (config.field as string | undefined) ?? "tags";

	const attributes: AttributeInput[] = [
		{
			entityName,
			name: field,
			type: "TEXT",
			required: false,
			config: { array: true, default: [] },
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${entityName} can be created with tags`,
			operationName: `create${entityName}`,
			inputs: { [field]: ["tag1", "tag2"] },
			expected: { [field]: ["tag1", "tag2"] },
		},
		{
			name: `list ${entityName} filtered by tag`,
			operationName: `list${entityName}`,
			inputs: { filter: { [field]: { contains: "tag1" } } },
			expected: { allMatch: { [field]: "tag1" } },
		},
	];

	return {
		entity: entityName,
		behavior: "taggable",
		added: { attributes, relations: [], operations: [], policies: [], testScenarios },
	};
}

// ─── searchable ───────────────────────────────────────────────────────────────

function expandSearchable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const fields = (config.fields as string[] | undefined) ?? [];
	const mode = (config.mode as string | undefined) ?? "ilike";
	const opName = `search${entityName}`;

	const operations: OperationInput[] = [
		{
			name: opName,
			kind: "QUERY",
			inputSchema: { q: { type: "string", description: "Search query string" } },
			outputSchema: { type: "array", items: { $ref: entityName } },
			reads: [entityName],
			writes: [],
			steps: [
				{
					kind: "read",
					entity: entityName,
					where: {
						any: fields.map((f) => ({
							matches: [{ ref: `record.${f}` }, { ref: "input.q" }],
						})),
					},
					many: true,
					as: "results",
				},
				{ kind: "return", value: { ref: "results" } },
			],
			bodyHint: `Search ${entityName} across fields [${fields.join(", ")}] using ${mode}.`,
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${opName} returns matching ${entityName} records`,
			operationName: opName,
			inputs: { q: "test" },
			expected: { statusCode: 200, resultsIsArray: true },
		},
		{
			name: `${opName} with empty q returns empty array`,
			operationName: opName,
			inputs: { q: "" },
			expected: { results: [] },
		},
	];

	return {
		entity: entityName,
		behavior: "searchable",
		added: { attributes: [], relations: [], operations, policies: [], testScenarios },
	};
}

// ─── shareable ────────────────────────────────────────────────────────────────

function expandShareable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const linkEntityName =
		(config.linkEntityName as string | undefined) ?? `${entityName}ShareLink`;
	const tokenField = (config.tokenField as string | undefined) ?? "token";
	const opName = `createShareLinkFor${entityName}`;

	const relations: RelationInput[] = [
		{
			fromEntityName: entityName,
			toEntityName: linkEntityName,
			name: "shareLinks",
			kind: "ONE_TO_MANY",
			required: false,
		},
	];

	const operations: OperationInput[] = [
		{
			name: opName,
			kind: "COMMAND",
			inputSchema: { id: { type: "string" }, expiresInSeconds: { type: "number" } },
			reads: [entityName],
			writes: [linkEntityName],
			steps: [
				{
					kind: "mutate",
					op: "create",
					entity: linkEntityName,
					data: {
						obj: {
							[`${entityName.toLowerCase()}Id`]: { ref: "input.id" },
							[tokenField]: { call: "randomToken", args: [] },
							expiresAt: { ref: "input.expiresInSeconds" },
						},
					},
					as: "link",
				},
				{ kind: "return", value: { ref: "link" } },
			],
			bodyHint: `Generate a time-limited share link for a ${entityName}.`,
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${opName} returns a valid token`,
			operationName: opName,
			inputs: { id: "some-id", expiresInSeconds: 3600 },
			expected: { hasToken: true },
		},
	];

	return {
		entity: entityName,
		behavior: "shareable",
		added: { attributes: [], relations, operations, policies: [], testScenarios },
	};
}

// ─── auditable ────────────────────────────────────────────────────────────────

function expandAuditable(
	entityName: string,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_config: Record<string, unknown>,
): PerBehaviorDetail {
	const listOpName = `list${entityName}AuditLog`;

	const operations: OperationInput[] = [
		{
			name: listOpName,
			kind: "QUERY",
			inputSchema: { entityId: { type: "string" } },
			outputSchema: { type: "array", items: { $ref: "AuditLog" } },
			reads: ["AuditLog"],
			writes: [],
			steps: [
				{
					kind: "read",
					entity: "AuditLog",
					where: {
						all: [
							{ eq: [{ ref: "record.entityType" }, { lit: entityName }] },
							{ eq: [{ ref: "record.entityId" }, { ref: "input.entityId" }] },
						],
					},
					many: true,
					as: "entries",
				},
				{ kind: "return", value: { ref: "entries" } },
			],
			bodyHint: `List AuditLog entries for a ${entityName} record. Writes are hooked at mutation time (V2).`,
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `mutating ${entityName} writes an AuditLog entry`,
			operationName: `update${entityName}`,
			inputs: { id: "some-id", field: "newValue" },
			expected: { auditLogEntryCreated: true },
			mocks: { AuditLog: "capture" },
		},
		{
			name: `${listOpName} returns audit history`,
			operationName: listOpName,
			inputs: { entityId: "some-id" },
			expected: { statusCode: 200, resultsIsArray: true },
		},
	];

	return {
		entity: entityName,
		behavior: "auditable",
		added: { attributes: [], relations: [], operations, policies: [], testScenarios },
	};
}

// ─── versioned ────────────────────────────────────────────────────────────────

function expandVersioned(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const versionField = (config.versionField as string | undefined) ?? "version";

	const attributes: AttributeInput[] = [
		{
			entityName,
			name: versionField,
			type: "NUMBER",
			required: true,
			config: { default: 1, description: "Incremented on every update via ChangeSet/Revision." },
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${entityName} version increments on update`,
			operationName: `update${entityName}`,
			inputs: { id: "some-id", field: "value" },
			expected: { [`${versionField}Incremented`]: true },
		},
		{
			name: `${entityName} history recoverable via spec-at`,
			operationName: "getSpecAt",
			inputs: { version: 1 },
			expected: { entityPresent: true },
		},
	];

	return {
		entity: entityName,
		behavior: "versioned",
		added: { attributes, relations: [], operations: [], policies: [], testScenarios },
	};
}

// ─── commentable ──────────────────────────────────────────────────────────────

function expandCommentable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const commentEntityName =
		(config.commentEntityName as string | undefined) ?? "Comment";
	const bodyField = (config.bodyField as string | undefined) ?? "body";
	const addOpName = `addCommentTo${entityName}`;
	const listOpName = `list${entityName}Comments`;

	const relations: RelationInput[] = [
		{
			fromEntityName: entityName,
			toEntityName: commentEntityName,
			name: "comments",
			kind: "ONE_TO_MANY",
			required: false,
		},
	];

	const operations: OperationInput[] = [
		{
			name: addOpName,
			kind: "COMMAND",
			inputSchema: {
				entityId: { type: "string" },
				[bodyField]: { type: "string", minLength: 1 },
			},
			reads: [entityName],
			writes: [commentEntityName],
			steps: [
				{
					kind: "mutate",
					op: "create",
					entity: commentEntityName,
					data: {
						obj: {
							entityType: { lit: entityName },
							entityId: { ref: "input.entityId" },
							[bodyField]: { ref: `input.${bodyField}` },
							authorId: { ref: "auth.user.id" },
						},
					},
					as: "comment",
				},
				{ kind: "return", value: { ref: "comment" } },
			],
			bodyHint: `Add a comment to a ${entityName} record.`,
		},
		{
			name: listOpName,
			kind: "QUERY",
			inputSchema: { entityId: { type: "string" } },
			outputSchema: { type: "array", items: { $ref: commentEntityName } },
			reads: [commentEntityName],
			writes: [],
			steps: [
				{
					kind: "read",
					entity: commentEntityName,
					where: {
						all: [
							{ eq: [{ ref: "record.entityType" }, { lit: entityName }] },
							{ eq: [{ ref: "record.entityId" }, { ref: "input.entityId" }] },
						],
					},
					many: true,
					as: "comments",
				},
				{ kind: "return", value: { ref: "comments" } },
			],
			bodyHint: `List all comments on a ${entityName} record.`,
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${addOpName} creates a comment`,
			operationName: addOpName,
			inputs: { entityId: "some-id", [bodyField]: "Great ticket!" },
			expected: { statusCode: 201, [bodyField]: "Great ticket!" },
		},
		{
			name: `${listOpName} returns comments for entity`,
			operationName: listOpName,
			inputs: { entityId: "some-id" },
			expected: { statusCode: 200, resultsIsArray: true },
		},
	];

	return {
		entity: entityName,
		behavior: "commentable",
		added: { attributes: [], relations, operations, policies: [], testScenarios },
	};
}

// ─── attachable ───────────────────────────────────────────────────────────────

function expandAttachable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const assetEntityName =
		(config.assetEntityName as string | undefined) ?? "Asset";
	const attachOpName = `attachFileTo${entityName}`;
	const listOpName = `list${entityName}Attachments`;

	const relations: RelationInput[] = [
		{
			fromEntityName: entityName,
			toEntityName: assetEntityName,
			name: "attachments",
			kind: "ONE_TO_MANY",
			required: false,
		},
	];

	const operations: OperationInput[] = [
		{
			name: attachOpName,
			kind: "COMMAND",
			inputSchema: {
				entityId: { type: "string" },
				assetId: { type: "string", description: "Pre-uploaded Asset id" },
			},
			reads: [entityName, assetEntityName],
			writes: [assetEntityName],
			steps: [
				{
					kind: "mutate",
					op: "update",
					entity: assetEntityName,
					where: { eq: [{ ref: "record.id" }, { ref: "input.assetId" }] },
					data: {
						obj: {
							entityId: { ref: "input.entityId" },
							entityType: { lit: entityName },
						},
					},
					as: "linked",
				},
				{ kind: "return", value: { ref: "linked" } },
			],
			bodyHint: `Link a pre-uploaded Asset to a ${entityName} record.`,
		},
		{
			name: listOpName,
			kind: "QUERY",
			inputSchema: { entityId: { type: "string" } },
			outputSchema: { type: "array", items: { $ref: assetEntityName } },
			reads: [assetEntityName],
			writes: [],
			steps: [
				{
					kind: "read",
					entity: assetEntityName,
					where: {
						all: [
							{ eq: [{ ref: "record.entityType" }, { lit: entityName }] },
							{ eq: [{ ref: "record.entityId" }, { ref: "input.entityId" }] },
						],
					},
					many: true,
					as: "assets",
				},
				{ kind: "return", value: { ref: "assets" } },
			],
			bodyHint: `List assets attached to a ${entityName} record.`,
		},
	];

	const testScenarios: TestScenarioInput[] = [
		{
			name: `${attachOpName} links asset to entity`,
			operationName: attachOpName,
			inputs: { entityId: "some-id", assetId: "asset-id" },
			expected: { entityId: "some-id" },
		},
		{
			name: `${listOpName} returns attachments`,
			operationName: listOpName,
			inputs: { entityId: "some-id" },
			expected: { statusCode: 200, resultsIsArray: true },
		},
	];

	return {
		entity: entityName,
		behavior: "attachable",
		added: { attributes: [], relations, operations, policies: [], testScenarios },
	};
}

// ─── localizable ──────────────────────────────────────────────────────────────

function expandLocalizable(
	entityName: string,
	config: Record<string, unknown>,
): PerBehaviorDetail {
	const fields = (config.fields as string[] | undefined) ?? [];

	// One parallel *Key attribute per translatable field
	const attributes: AttributeInput[] = fields.map((f) => ({
		entityName,
		name: `${f}Key`,
		type: "TEXT",
		required: false,
		config: {
			description: `TextKey reference for the translatable '${f}' field.`,
			relation: "TextKey",
			relationField: "key",
		},
	}));

	const testScenarios: TestScenarioInput[] = fields.flatMap((f) => [
		{
			name: `${entityName}.${f} has a TextKey for translation`,
			operationName: `create${entityName}`,
			inputs: { [`${f}Key`]: `${entityName.toLowerCase()}.${f}.1` },
			expected: { [`${f}Key`]: "non-null" },
		},
	]);

	return {
		entity: entityName,
		behavior: "localizable",
		added: { attributes, relations: [], operations: [], policies: [], testScenarios },
	};
}

// DB-backed wrapper lives in behavior-expand-db.ts to keep this module
// free of side-effecting imports (so unit tests can import expandToDelta
// without needing DATABASE_URL).
