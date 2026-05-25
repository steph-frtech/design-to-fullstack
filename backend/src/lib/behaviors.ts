// V1 frozen Behavior catalogue.
//
// A Behavior is a declarative macro attached to an Entity. The /expand-behaviors
// endpoint computes the equivalent Resources / Operations / Policies / Attributes
// that would exist if the macro was inlined — this expansion is the source of
// truth for codegen.

import { z } from "zod";

export const ownableConfig = z.object({
	ownerField: z.string().default("ownerId"),
});

export const softDeletableConfig = z.object({
	field: z.string().default("deletedAt"),
});

export const publishableConfig = z.object({
	statusField: z.string().default("status"),
	publishedAtField: z.string().default("publishedAt"),
});

export const taggableConfig = z.object({
	field: z.string().default("tags"),
});

export const searchableConfig = z.object({
	fields: z.array(z.string()).min(1),
	mode: z.enum(["ilike", "fulltext", "external"]).default("ilike"),
});

export const shareableConfig = z.object({
	linkEntityName: z.string().optional(), // defaults to `${Entity.name}ShareLink`
	tokenField: z.string().default("token"),
});

export const auditableConfig = z.object({
	trackFields: z.array(z.string()).optional(), // subset of fields to audit; empty = all
});

export const versionedConfig = z.object({
	versionField: z.string().default("version"),
});

export const commentableConfig = z.object({
	commentEntityName: z.string().optional(), // defaults to "Comment"
	bodyField: z.string().default("body"),
});

export const attachableConfig = z.object({
	assetEntityName: z.string().optional(), // defaults to "Asset"
});

export const localizableConfig = z.object({
	fields: z.array(z.string()).min(1), // which fields are translatable
});

export type BehaviorKind =
	| "ownable"
	| "soft-deletable"
	| "publishable"
	| "taggable"
	| "searchable"
	| "shareable"
	| "auditable"
	| "versioned"
	| "commentable"
	| "attachable"
	| "localizable";

type CatalogueEntry = {
	description: string;
	// Zod parser for the `config` JSON.
	parseConfig: (raw: unknown) => unknown;
	// What this macro adds in plain English (used in `/api/behaviors`).
	adds: string[];
};

export const BEHAVIOR_CATALOGUE: Record<string, CatalogueEntry> = {
	ownable: {
		description: "Attaches an owner User to each row; auto-policy for read/write.",
		parseConfig: (raw) => ownableConfig.parse(raw ?? {}),
		adds: [
			"adds Attribute <ownerField> referencing User",
			"adds Policy 'is-owner' scope ENTITY rule eq($.record.<ownerField>, $.auth.user.id)",
			"injects where-clause on Resource list/read",
		],
	},
	"soft-deletable": {
		description: "Soft delete via a nullable timestamp; Operations expose restore.",
		parseConfig: (raw) => softDeletableConfig.parse(raw ?? {}),
		adds: [
			"adds Attribute <field>: DateTime?",
			"injects where { <field>: null } on Resource list/read",
			"adds Operation 'restore<Entity>'",
		],
	},
	publishable: {
		description: "Adds DRAFT/PUBLISHED/ARCHIVED lifecycle + publish/unpublish.",
		parseConfig: (raw) => publishableConfig.parse(raw ?? {}),
		adds: [
			"adds Attribute <statusField>: enum DRAFT|PUBLISHED|ARCHIVED",
			"adds Attribute <publishedAtField>: DateTime?",
			"adds Operations publish/unpublish/archive",
			"public Resource only sees status=PUBLISHED",
		],
	},
	taggable: {
		description: "Adds a string[] tags column with a contains filter.",
		parseConfig: (raw) => taggableConfig.parse(raw ?? {}),
		adds: [
			"adds Attribute <field>: string[]",
			"exposes filter contains on Resource",
		],
	},
	searchable: {
		description: "Declares which fields participate in search.",
		parseConfig: (raw) => searchableConfig.parse(raw),
		adds: [
			"adds Operation 'search<Entity>' with q: string",
			"queries via ilike (V1) / fulltext-external (V2)",
		],
	},
	shareable: {
		description: "Creates an EntityShareLink + createShareLink Operation.",
		parseConfig: (raw) => shareableConfig.parse(raw ?? {}),
		adds: [
			"adds child Entity '<Entity>ShareLink' with token, expiresAt",
			"adds Operation 'createShareLinkFor<Entity>'",
			"adds public route gated by token",
		],
	},
	auditable: {
		description: "Writes an AuditLog entry on every mutation of the entity.",
		parseConfig: (raw) => auditableConfig.parse(raw ?? {}),
		adds: [
			"hooks into mutate steps on the entity to emit AuditLog rows",
			"references AuditLog entity (Phase 10) by name — no inline DDL",
			"adds Operation 'list<Entity>AuditLog' (QUERY) — V1",
		],
	},
	versioned: {
		description: "Marks the entity as versioned using the Revision mechanism.",
		parseConfig: (raw) => versionedConfig.parse(raw ?? {}),
		adds: [
			"adds Attribute <versionField>: NUMBER (incremented on every update)",
			"integrates with ChangeSet/Revision for point-in-time reconstruction",
		],
	},
	commentable: {
		description: "Enables user Comments on the entity (polymorphic Comment relation).",
		parseConfig: (raw) => commentableConfig.parse(raw ?? {}),
		adds: [
			"adds ONE_TO_MANY relation from <Entity> to Comment (entityType+entityId)",
			"adds Operation 'addCommentTo<Entity>' (COMMAND)",
			"adds Operation 'list<Entity>Comments' (QUERY)",
		],
	},
	attachable: {
		description: "Enables file attachments on the entity via the Asset model (Phase 10).",
		parseConfig: (raw) => attachableConfig.parse(raw ?? {}),
		adds: [
			"adds ONE_TO_MANY relation from <Entity> to Asset",
			"adds Operation 'attachFileTo<Entity>' (COMMAND)",
			"adds Operation 'list<Entity>Attachments' (QUERY)",
		],
	},
	localizable: {
		description: "Marks designated fields as translatable via TextKey/Translation.",
		parseConfig: (raw) => localizableConfig.parse(raw),
		adds: [
			"for each <field> in fields: adds a parallel Attribute <field>Key (TEXT) holding a TextKey reference",
			"links to Translation / TextKey models already present in the project",
			"adds Operation 'set<Entity>Translation' (COMMAND) — V2",
		],
	},
};

export type CatalogueDescriptor = {
	kind: BehaviorKind;
	description: string;
	adds: string[];
};

export function describeCatalogue(): CatalogueDescriptor[] {
	return Object.entries(BEHAVIOR_CATALOGUE).map(([kind, entry]) => ({
		kind: kind as BehaviorKind,
		description: entry.description,
		adds: entry.adds,
	}));
}
