// Side-effect helpers for the new-project wizard:
//   - prepareDirectory : mkdir + git init + initial commit (with create / overwrite / use-as-is modes)
//   - createGithubRepo : POST /user/repos when owner matches the authenticated GitHub user
//   - linkGitRemote    : git remote add origin <https-url>  (no push)
//
// All filesystem mutations are confined to PROJECTS_BASE_DIR via resolveSafe (system.ts).

import { execFile as execFileCb } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const BASE_DIR = process.env.PROJECTS_BASE_DIR ?? "/data/dev";

function resolveSafe(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const abs = path.isAbsolute(trimmed)
		? path.resolve(trimmed)
		: path.resolve(BASE_DIR, trimmed);
	const rel = path.relative(BASE_DIR, abs);
	if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
	return abs;
}

export type DirMode = "create" | "overwrite" | "use-as-is";

export type DirResult =
	| {
			ok: true;
			absolutePath: string;
			created: boolean;
			gitInitialized: boolean;
			note: string;
	  }
	| { ok: false; absolutePath: string | null; error: string };

export type RepoResult =
	| {
			ok: true;
			created: boolean;
			url: string;
			owner: string;
			name: string;
			note: string;
	  }
	| { ok: false; error: string };

async function pathInfo(
	abs: string,
): Promise<{ exists: boolean; isDirectory: boolean; isEmpty: boolean }> {
	try {
		const stat = await fs.stat(abs);
		if (!stat.isDirectory())
			return { exists: true, isDirectory: false, isEmpty: false };
		const entries = await fs.readdir(abs);
		return { exists: true, isDirectory: true, isEmpty: entries.length === 0 };
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT")
			return { exists: false, isDirectory: false, isEmpty: true };
		throw err;
	}
}

async function gitInitWithCommit(abs: string, slug: string): Promise<void> {
	// Make sure README exists so the initial commit has content.
	const readme = path.join(abs, "README.md");
	try {
		await fs.access(readme);
	} catch {
		await fs.writeFile(readme, `# ${slug}\n`);
	}
	await execFile("git", ["init", "-q", "--initial-branch=main"], { cwd: abs });
	await execFile("git", ["add", "-A"], { cwd: abs });
	// Use -c flags so this works even when the user has no global git identity.
	await execFile(
		"git",
		[
			"-c",
			"user.email=design-to-fullstack@local",
			"-c",
			"user.name=design-to-fullstack",
			"commit",
			"-q",
			"-m",
			"init",
		],
		{ cwd: abs },
	);
}

export async function prepareDirectory(opts: {
	localPath: string;
	mode: DirMode;
	slug: string;
}): Promise<DirResult> {
	const abs = resolveSafe(opts.localPath);
	if (!abs) {
		return { ok: false, absolutePath: null, error: "path_outside_base" };
	}

	try {
		const info = await pathInfo(abs);

		if (info.exists && !info.isDirectory) {
			return {
				ok: false,
				absolutePath: abs,
				error: "path_is_a_file",
			};
		}

		if (opts.mode === "overwrite") {
			if (info.exists) await fs.rm(abs, { recursive: true, force: true });
			await fs.mkdir(abs, { recursive: true });
			await gitInitWithCommit(abs, opts.slug);
			return {
				ok: true,
				absolutePath: abs,
				created: true,
				gitInitialized: true,
				note: "directory wiped and recreated",
			};
		}

		if (opts.mode === "use-as-is") {
			if (!info.exists) {
				return {
					ok: false,
					absolutePath: abs,
					error: "use_as_is_but_path_missing",
				};
			}
			// Initialize a repo if there isn't one already.
			const dotGit = path.join(abs, ".git");
			let hasGit = false;
			try {
				await fs.stat(dotGit);
				hasGit = true;
			} catch {
				/* no .git */
			}
			if (!hasGit) {
				await gitInitWithCommit(abs, opts.slug);
				return {
					ok: true,
					absolutePath: abs,
					created: false,
					gitInitialized: true,
					note: "existing directory — git init only",
				};
			}
			return {
				ok: true,
				absolutePath: abs,
				created: false,
				gitInitialized: false,
				note: "existing directory with .git — nothing changed",
			};
		}

		// mode === "create"
		if (info.exists && !info.isEmpty) {
			return {
				ok: false,
				absolutePath: abs,
				error: "directory_not_empty",
			};
		}
		if (!info.exists) await fs.mkdir(abs, { recursive: true });
		await gitInitWithCommit(abs, opts.slug);
		return {
			ok: true,
			absolutePath: abs,
			created: !info.exists,
			gitInitialized: true,
			note: info.exists ? "empty directory used" : "directory created",
		};
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code ?? "unknown";
		const msg = (err as Error).message;
		return {
			ok: false,
			absolutePath: abs,
			error: `${code}: ${msg}`,
		};
	}
}

async function fetchGithubUser(
	token: string,
): Promise<{ login: string } | null> {
	const res = await fetch("https://api.github.com/user", {
		headers: {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { login?: string };
	return json.login ? { login: json.login } : null;
}

export async function createGithubRepo(opts: {
	owner: string;
	name: string;
	private?: boolean;
}): Promise<RepoResult> {
	const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
	if (!token) {
		return { ok: false, error: "no_github_token" };
	}

	const me = await fetchGithubUser(token);
	if (!me) {
		return { ok: false, error: "github_user_unreachable" };
	}

	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		Authorization: `Bearer ${token}`,
	};

	// Does the repo already exist?
	const probe = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.name)}`,
		{ headers },
	);
	if (probe.status === 200) {
		const json = (await probe.json()) as { html_url?: string };
		return {
			ok: true,
			created: false,
			url: json.html_url ?? `https://github.com/${opts.owner}/${opts.name}`,
			owner: opts.owner,
			name: opts.name,
			note: "repository already exists — linked",
		};
	}

	// Only create when the owner is the authenticated user — org creation needs org perms.
	if (opts.owner !== me.login) {
		return {
			ok: false,
			error: `owner_mismatch (authenticated as ${me.login}, requested ${opts.owner})`,
		};
	}

	const create = await fetch("https://api.github.com/user/repos", {
		method: "POST",
		headers: { ...headers, "Content-Type": "application/json" },
		body: JSON.stringify({
			name: opts.name,
			private: opts.private ?? true,
			auto_init: false,
		}),
	});
	if (!create.ok) {
		const text = await create.text();
		return {
			ok: false,
			error: `github_create_failed (${create.status}): ${text.slice(0, 200)}`,
		};
	}
	const json = (await create.json()) as { html_url?: string };
	return {
		ok: true,
		created: true,
		url: json.html_url ?? `https://github.com/${opts.owner}/${opts.name}`,
		owner: opts.owner,
		name: opts.name,
		note: "repository created",
	};
}

export async function linkGitRemote(opts: {
	absolutePath: string;
	owner: string;
	name: string;
}): Promise<{ ok: boolean; alreadyLinked: boolean; error?: string }> {
	try {
		// Bail early if no .git exists.
		await fs.stat(path.join(opts.absolutePath, ".git"));
	} catch {
		return { ok: false, alreadyLinked: false, error: "no_git_repo" };
	}

	try {
		const { stdout } = await execFile(
			"git",
			["remote", "get-url", "origin"],
			{ cwd: opts.absolutePath },
		);
		// Remote already exists.
		void stdout;
		return { ok: true, alreadyLinked: true };
	} catch {
		// No origin yet — add it.
	}

	const url = `https://github.com/${opts.owner}/${opts.name}.git`;
	try {
		await execFile("git", ["remote", "add", "origin", url], {
			cwd: opts.absolutePath,
		});
		return { ok: true, alreadyLinked: false };
	} catch (err) {
		return {
			ok: false,
			alreadyLinked: false,
			error: (err as Error).message,
		};
	}
}
