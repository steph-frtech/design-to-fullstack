// safe-path.ts — resolveSafeOutDir validates that the codegen output directory
// is never inside the meta-platform repo, never uses path traversal, and is
// confined to /tmp or a project-owned generated/ sub-directory.

import path from "node:path";
import fs from "node:fs";

/** Absolute path to the meta-platform repo root (never write here). */
const REPO_ROOT = path.resolve("/data/dev/design-to-fullstack");

/**
 * Resolve and validate a codegen output directory.
 *
 * Rules enforced (throws on any violation):
 * 1. `outDir` must be an absolute path.
 * 2. `outDir` must NOT contain `..` components.
 * 3. `outDir` must NOT be inside (or equal to) the meta-platform repo root.
 * 4. Allowed locations:
 *    a. Anywhere under /tmp
 *    b. If `projectLocalPath` is provided: must be `<projectLocalPath>/generated/<anything>`
 *
 * Returns the canonicalised absolute path.
 */
export function resolveSafeOutDir(outDir: string, projectLocalPath?: string): string {
	if (!outDir) {
		throw new Error("outDir is required");
	}

	// Must be absolute
	if (!path.isAbsolute(outDir)) {
		throw new Error(`outDir must be an absolute path (got: ${outDir})`);
	}

	// Canonicalise (does NOT resolve symlinks, but normalises ./ and ../ lexically)
	const resolved = path.normalize(outDir);

	// Reject if the normalised path still contains ".." — defence in depth
	if (resolved.split(path.sep).includes("..")) {
		throw new Error(`outDir contains path traversal components (got: ${outDir})`);
	}

	// Reject anything inside the meta-platform repo
	const normalRepo = path.normalize(REPO_ROOT);
	if (resolved === normalRepo || resolved.startsWith(normalRepo + path.sep)) {
		throw new Error(
			`outDir must not point inside the meta-platform repo (${REPO_ROOT}). Got: ${resolved}`,
		);
	}

	// Allow /tmp/... unconditionally
	if (resolved.startsWith("/tmp/") || resolved === "/tmp") {
		return resolved;
	}

	// Allow <projectLocalPath>/generated/... when localPath is known
	if (projectLocalPath) {
		const normalLocal = path.normalize(projectLocalPath);
		const allowedBase = path.join(normalLocal, "generated");
		if (resolved === allowedBase || resolved.startsWith(allowedBase + path.sep)) {
			return resolved;
		}
	}

	throw new Error(
		`outDir is not an allowed location. Use /tmp/... or <projectLocalPath>/generated/... (got: ${resolved})`,
	);
}

/**
 * Write content to <outDir>/<relPath>, creating parent directories as needed.
 * `outDir` MUST have already been validated by resolveSafeOutDir.
 */
export function writeGenFile(outDir: string, relPath: string, content: string): void {
	const fullPath = path.join(outDir, relPath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content, "utf8");
}
