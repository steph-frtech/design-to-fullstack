// types.ts — shared types for the codegen module

/**
 * A single file to be emitted by a codegen emitter.
 * `path` is relative to the output root (no leading slash).
 * `kind` matches the GeneratedArtifactKind enum from the schema.
 */
export type GeneratedFile = {
	path: string;
	kind: "CODE" | "MIGRATION" | "ASSET" | "TEST" | "DOCS";
	content: string;
};

/**
 * Entry in the .dtfs-manifest.json file.
 */
export type ManifestEntry = {
	path: string;
	kind: "CODE" | "MIGRATION" | "ASSET" | "TEST" | "DOCS";
	contentHash: string;
	bytes: number;
	protected: false;
};

/**
 * Return value of generateApp().
 */
export type CodegenResult = {
	outDir: string;
	files: ManifestEntry[];
	counts: {
		total: number;
		prismaSchema: number;
		honoRoutes: number;
		operationHandlers: number;
		nextPages: number;
		/** New in Phase 28: packages/shared files */
		sharedFiles?: number;
		/** New in Phase 28: test stub files */
		testFiles?: number;
	};
};

/**
 * Minimal spec shape consumed by the emitters.
 * Derived from the Prisma models via getSpec() — only the fields we actually use.
 */
export type CodegenSpec = {
	project: {
		id: string;
		slug: string;
		localPath: string | null;
	};
	entities: Array<{
		id: string;
		name: string;
		attributes: Array<{
			name: string;
			type: string;
			required: boolean;
			unique: boolean;
		}>;
	}>;
	entityRelations: Array<{
		id: string;
		fromEntityId: string;
		toEntityId: string;
		name: string;
		kind: string;
		required: boolean;
		fromField: string | null;
	}>;
	resources: Array<{
		id: string;
		entityId: string;
		name: string;
		exposedOps: unknown;
	}>;
	operations: Array<{
		id: string;
		name: string;
		kind: string;
		inputSchema: unknown;
		outputSchema: unknown | null;
		steps: unknown;
		bodyHint: string | null;
	}>;
	screens: Array<{
		id: string;
		path: string;
		type: string | null;
		components: Array<{
			id: string;
			type: string;
			config: unknown;
		}>;
	}>;
};
