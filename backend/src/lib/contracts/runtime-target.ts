// Runtime target helpers.
// The RuntimeTarget table is declared in the schema (Phase 25) but the
// migration may not yet be applied (gate humain). Every DB call is wrapped in
// try/catch and falls back gracefully.

import { prisma } from "../../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuntimeTargetObj = {
	name: string;
	backend: {
		framework: string;
		versionPolicy: string;
		runtime: string;
		apiStyle: string;
	};
	frontend: {
		framework: string;
		version: string;
		router: string;
		rendering: string;
	};
	auth: {
		provider: string;
		basePath: string;
	};
	database: {
		provider: string;
		orm: string;
	};
	packageManager: string;
};

export type RuntimeTargetResult = RuntimeTargetObj & {
	source: "db" | "default";
};

// ─── Default ──────────────────────────────────────────────────────────────────

export const DEFAULT_RUNTIME_TARGET: RuntimeTargetObj = {
	name: "hono-next",
	backend: {
		framework: "hono",
		versionPolicy: "latest-stable",
		runtime: "node",
		apiStyle: "rest",
	},
	frontend: {
		framework: "next",
		version: "16.x",
		router: "app",
		rendering: "server-components-first",
	},
	auth: {
		provider: "better-auth",
		basePath: "/api/auth",
	},
	database: {
		provider: "postgresql",
		orm: "prisma",
	},
	packageManager: "pnpm",
};

// ─── getRuntimeTarget ─────────────────────────────────────────────────────────

/**
 * Try to read the RuntimeTarget from DB. If the table does not exist (migration
 * not applied yet), return DEFAULT with source:"default". Never throws.
 */
export async function getRuntimeTarget(
	projectId: string,
	name = "hono-next",
): Promise<RuntimeTargetResult> {
	try {
		const row = await prisma.runtimeTarget.findFirst({
			where: { projectId, name },
		});
		if (!row) {
			return { ...DEFAULT_RUNTIME_TARGET, source: "default" };
		}
		return {
			name: row.name,
			backend: row.backend as RuntimeTargetObj["backend"],
			frontend: row.frontend as RuntimeTargetObj["frontend"],
			auth: row.auth as RuntimeTargetObj["auth"],
			database: row.database as RuntimeTargetObj["database"],
			packageManager: row.packageManager ?? DEFAULT_RUNTIME_TARGET.packageManager,
			source: "db",
		};
	} catch {
		return { ...DEFAULT_RUNTIME_TARGET, source: "default" };
	}
}

// ─── setRuntimeTarget ─────────────────────────────────────────────────────────

type SetRuntimeTargetResult =
	| { ok: true; id: string }
	| { ok: false; error: string; hint?: string };

/**
 * Upsert a RuntimeTarget to DB. If the table does not exist, returns an error
 * object — never throws.
 */
type PartialRuntimeTargetInput = {
	name?: string;
	backend?: Partial<RuntimeTargetObj["backend"]>;
	frontend?: Partial<RuntimeTargetObj["frontend"]>;
	auth?: Partial<RuntimeTargetObj["auth"]>;
	database?: Partial<RuntimeTargetObj["database"]>;
	packageManager?: string;
};

export async function setRuntimeTarget(
	projectId: string,
	target: PartialRuntimeTargetInput,
): Promise<SetRuntimeTargetResult> {
	try {
		const name = target.name ?? "hono-next";
		const base = DEFAULT_RUNTIME_TARGET;
		const row = await prisma.runtimeTarget.upsert({
			where: { projectId_name: { projectId, name } },
			create: {
				projectId,
				name,
				backend: (target.backend ?? base.backend) as never,
				frontend: (target.frontend ?? base.frontend) as never,
				auth: (target.auth ?? base.auth) as never,
				database: (target.database ?? base.database) as never,
				packageManager: target.packageManager ?? base.packageManager,
			},
			update: {
				...(target.backend !== undefined && { backend: target.backend as never }),
				...(target.frontend !== undefined && { frontend: target.frontend as never }),
				...(target.auth !== undefined && { auth: target.auth as never }),
				...(target.database !== undefined && { database: target.database as never }),
				...(target.packageManager !== undefined && { packageManager: target.packageManager }),
			},
		});
		return { ok: true, id: row.id };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		// P2021 = "The table `{table}` does not exist in the current database."
		if (msg.includes("P2021") || msg.includes("does not exist")) {
			return {
				ok: false,
				error: "runtime_target_table_not_migrated",
				hint: "apply migration 20260524120000",
			};
		}
		return { ok: false, error: msg };
	}
}
