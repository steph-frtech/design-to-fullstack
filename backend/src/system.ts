import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z, type ZodError } from "zod";
import { prisma } from "./db";
import {
	createGithubRepo,
	linkGitRemote,
	prepareDirectory,
} from "./scaffold";

const BASE_DIR = process.env.PROJECTS_BASE_DIR ?? "/data/dev";

function validationHook<T>(
	result: { success: true; data: T } | { success: false; error: ZodError },
	c: Context,
) {
	if (!result.success) {
		return c.json(
			{
				error: "validation_failed",
				issues: result.error.issues.map((i) => ({
					path: i.path.join("."),
					message: i.message,
				})),
			},
			400,
		);
	}
}

function resolveSafe(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const abs = path.isAbsolute(trimmed)
		? path.resolve(trimmed)
		: path.resolve(BASE_DIR, trimmed);
	// Confine resolution to BASE_DIR to avoid accidental fs probes
	// of unrelated paths from the browser.
	const rel = path.relative(BASE_DIR, abs);
	if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
	return abs;
}

export const systemRoutes = new Hono()
	.get("/base-dir", (c) => c.json({ baseDir: BASE_DIR }))

	.get("/list-dirs", async (c) => {
		try {
			const entries = await fs.readdir(BASE_DIR, { withFileTypes: true });
			const dirs = entries
				.filter((e) => e.isDirectory() && !e.name.startsWith("."))
				.map(async (e) => {
					try {
						const children = await fs.readdir(path.join(BASE_DIR, e.name));
						return { name: e.name, isEmpty: children.length === 0 };
					} catch {
						// Unreadable (permission, broken symlink, etc.) → treat as in-use
						return { name: e.name, isEmpty: false };
					}
				});
			const resolved = await Promise.all(dirs);
			// Empty dirs first (more relevant for a new project), then alpha within each group.
			resolved.sort((a, b) => {
				if (a.isEmpty !== b.isEmpty) return a.isEmpty ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
			return c.json({ entries: resolved, baseDir: BASE_DIR });
		} catch (err) {
			return c.json(
				{
					error: "readdir_failed",
					message: (err as Error).message,
					baseDir: BASE_DIR,
				},
				500,
			);
		}
	})

	.get("/github-user", async (c) => {
		const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
		if (!token) return c.json({ login: null, authenticated: false });

		const res = await fetch("https://api.github.com/user", {
			headers: {
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				Authorization: `Bearer ${token}`,
			},
		});
		if (!res.ok) return c.json({ login: null, authenticated: true });
		const json = (await res.json()) as { login?: string };
		return c.json({ login: json.login ?? null, authenticated: true });
	})

	.post(
		"/check-dir",
		zValidator(
			"json",
			z.object({ path: z.string().min(1).max(512) }),
			validationHook,
		),
		async (c) => {
			const { path: raw } = c.req.valid("json");
			const abs = resolveSafe(raw);
			if (!abs) {
				return c.json(
					{
						error: "path_outside_base",
						baseDir: BASE_DIR,
					},
					400,
				);
			}

			try {
				const stat = await fs.stat(abs);
				if (!stat.isDirectory()) {
					return c.json({
						exists: true,
						isDirectory: false,
						isEmpty: false,
						absolutePath: abs,
					});
				}
				const entries = await fs.readdir(abs);
				return c.json({
					exists: true,
					isDirectory: true,
					isEmpty: entries.length === 0,
					absolutePath: abs,
				});
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === "ENOENT") {
					return c.json({
						exists: false,
						isDirectory: false,
						isEmpty: true,
						absolutePath: abs,
					});
				}
				throw err;
			}
		},
	)

	.post(
		"/check-repo",
		zValidator(
			"json",
			z.object({
				owner: z.string().min(1).max(64),
				name: z.string().min(1).max(128),
			}),
			validationHook,
		),
		async (c) => {
			const { owner, name } = c.req.valid("json");
			const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

			const headers: Record<string, string> = {
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			};
			if (token) headers.Authorization = `Bearer ${token}`;

			const res = await fetch(
				`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
				{ headers },
			);

			if (res.status === 200) {
				const json = (await res.json()) as {
					html_url?: string;
					private?: boolean;
					default_branch?: string;
				};
				return c.json({
					exists: true,
					owner,
					name,
					url: json.html_url,
					private: json.private ?? false,
					defaultBranch: json.default_branch,
					authenticated: Boolean(token),
				});
			}
			if (res.status === 404) {
				return c.json({
					exists: false,
					owner,
					name,
					authenticated: Boolean(token),
				});
			}
			return c.json(
				{
					error: "github_request_failed",
					status: res.status,
					authenticated: Boolean(token),
				},
				502,
			);
		},
	)

	// ─── Step-by-step: prepare identity (slug check + mkdir + gh create) ──
	// Called by the wizard at step 1 → step 2 transition. Performs all side
	// effects so the user gets immediate feedback. Idempotent enough that a
	// retry with the same inputs converges (use-as-is, repo already exists).
	.post(
		"/prepare-identity",
		zValidator(
			"json",
			z.object({
				slug: z
					.string()
					.min(2)
					.max(64)
					.regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
				localPath: z.string().min(1).max(512).optional(),
				directoryMode: z
					.enum(["create", "overwrite", "use-as-is"])
					.default("create"),
				github: z
					.object({
						owner: z.string().min(1).max(64),
						name: z.string().min(1).max(128),
					})
					.optional(),
			}),
			validationHook,
		),
		async (c) => {
			const { slug, localPath, directoryMode, github } = c.req.valid("json");

			// 1. slug uniqueness
			const existing = await prisma.project.findUnique({ where: { slug } });
			if (existing) return c.json({ error: "slug_taken" }, 409);

			// 2. directory side effects
			const directory = localPath
				? await prepareDirectory({ localPath, mode: directoryMode, slug })
				: ({ ok: true as const, skipped: true as const });

			// 3. github side effects
			const repo = github
				? await createGithubRepo({
						owner: github.owner,
						name: github.name,
						private: true,
					})
				: ({ ok: true as const, skipped: true as const });

			// 4. link remote (best effort, only when both worked)
			if (
				localPath &&
				github &&
				"absolutePath" in directory &&
				directory.ok &&
				"created" in repo &&
				repo.ok
			) {
				await linkGitRemote({
					absolutePath: directory.absolutePath,
					owner: github.owner,
					name: github.name,
				});
			}

			return c.json({
				ok:
					(!("ok" in directory) || directory.ok) &&
					(!("ok" in repo) || repo.ok),
				scaffolding: { directory, repo },
				resolvedLocalPath:
					"absolutePath" in directory ? directory.absolutePath : null,
			});
		},
	);
