"use client";

import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import Link from "next/link";
import { use, useState } from "react";
import { api } from "@/lib/api";

type ScreenResponse = InferResponseType<
	(typeof api.api.projects)[":id"]["screens"][":screenId"]["$get"],
	200
>;
type ScreenComponent = ScreenResponse["screen"]["components"][number];

type RevisionTarget = { entityType: string; entityId: string; label: string };

export default function ScreenDetail({
	params,
}: {
	params: Promise<{ id: string; screenId: string }>;
}) {
	const { id, screenId } = use(params);
	const [target, setTarget] = useState<RevisionTarget | null>(null);

	const screenQuery = useQuery({
		queryKey: ["screen", screenId],
		queryFn: async () => {
			const res = await api.api.projects[":id"].screens[":screenId"].$get({
				param: { id, screenId },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	if (screenQuery.isLoading) return <p className="text-zinc-500">Loading…</p>;
	if (screenQuery.error)
		return <p className="text-red-600">Error: {(screenQuery.error as Error).message}</p>;
	if (!screenQuery.data || "error" in screenQuery.data) return <p>Screen not found.</p>;

	const { screen } = screenQuery.data;

	return (
		<div className="grid gap-8 lg:grid-cols-[1fr_360px]">
			<div className="space-y-6">
				<div>
					<Link
						href={`/projects/${id}`}
						className="text-sm text-zinc-500 hover:underline"
					>
						← Project
					</Link>
					<h1 className="mt-2 text-2xl font-semibold">
						<code className="rounded bg-zinc-100 px-2 py-1 text-base dark:bg-zinc-800">
							{screen.path}
						</code>
					</h1>
					<p className="text-sm text-zinc-500">v{screen.currentVersion}</p>
					<button
						type="button"
						className="mt-2 text-xs text-blue-600 hover:underline"
						onClick={() =>
							setTarget({
								entityType: "Screen",
								entityId: screen.id,
								label: `screen ${screen.path}`,
							})
						}
					>
						View revision history →
					</button>
				</div>

				<section>
					<h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
						Components ({screen.components.length} root)
					</h2>
					{screen.components.length === 0 ? (
						<p className="text-sm text-zinc-500">No components.</p>
					) : (
						<ul className="space-y-2">
							{screen.components.map((comp) => (
								<ComponentNode
									key={comp.id}
									comp={comp}
									onShowRevisions={(t) => setTarget(t)}
								/>
							))}
						</ul>
					)}
				</section>
			</div>

			<aside className="lg:sticky lg:top-8 lg:self-start">
				<RevisionPanel target={target} />
			</aside>
		</div>
	);
}

function ComponentNode({
	comp,
	onShowRevisions,
}: {
	comp: ScreenComponent;
	onShowRevisions: (t: RevisionTarget) => void;
}) {
	const hasForm = comp.form != null;
	return (
		<li className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
			<div className="flex items-center justify-between">
				<div>
					<span className="font-mono text-sm font-medium">{comp.type}</span>
					<span className="ml-2 text-xs text-zinc-500">v{comp.currentVersion}</span>
				</div>
				<button
					type="button"
					className="text-xs text-blue-600 hover:underline"
					onClick={() =>
						onShowRevisions({
							entityType: "Component",
							entityId: comp.id,
							label: `component ${comp.type}`,
						})
					}
				>
					history
				</button>
			</div>

			{hasForm && comp.form && (
				<div className="mt-3 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
					<p className="text-xs uppercase tracking-wide text-zinc-500">
						Form ({comp.form.fields.length} fields)
					</p>
					<ul className="mt-1 space-y-1">
						{comp.form.fields.map((f) => (
							<li key={f.id} className="flex items-center justify-between text-sm">
								<span className="font-mono">
									{f.name}
									<span className="ml-2 text-xs text-zinc-500">
										{f.type}
										{f.required ? " · required" : ""}
									</span>
								</span>
								<button
									type="button"
									className="text-xs text-blue-600 hover:underline"
									onClick={() =>
										onShowRevisions({
											entityType: "Field",
											entityId: f.id,
											label: `field ${f.name}`,
										})
									}
								>
									history
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			{comp.children && comp.children.length > 0 && (
				<ul className="mt-3 space-y-2 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
					{comp.children.map((child) => (
						<li
							key={child.id}
							className="rounded border border-zinc-200 p-2 dark:border-zinc-800"
						>
							<span className="font-mono text-xs">{child.type}</span>
						</li>
					))}
				</ul>
			)}
		</li>
	);
}

function RevisionPanel({ target }: { target: RevisionTarget | null }) {
	const { data, isLoading } = useQuery({
		queryKey: ["revisions", target?.entityType, target?.entityId],
		queryFn: async () => {
			if (!target) return null;
			const res = await api.api.revisions.$get({
				query: { entityType: target.entityType, entityId: target.entityId },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
		enabled: target != null,
	});

	if (!target) {
		return (
			<div className="rounded border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
				Click <span className="font-mono">history</span> on any node to see its
				revisions.
			</div>
		);
	}

	return (
		<div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
			<h3 className="mb-2 text-sm font-semibold">History — {target.label}</h3>
			{isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
			{data && "revisions" in data && (
				<ul className="space-y-2">
					{data.revisions.length === 0 && (
						<li className="text-sm text-zinc-500">No revisions yet.</li>
					)}
					{data.revisions.map((r) => (
						<li
							key={r.id}
							className="border-l-2 border-zinc-200 pl-3 text-xs dark:border-zinc-700"
						>
							<div className="flex items-center justify-between">
								<span className="font-mono font-semibold">v{r.version}</span>
								<span
									className={`rounded px-1.5 py-0.5 text-[10px] ${
										r.op === "CREATE"
											? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
											: r.op === "UPDATE"
												? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
												: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
									}`}
								>
									{r.op}
								</span>
							</div>
							<div className="mt-0.5 text-zinc-500">
								{new Date(r.createdAt).toLocaleString()}
								{r.actor && ` · ${r.actor.email}`}
							</div>
							{r.diff && Object.keys(r.diff as object).length > 0 && (
								<details className="mt-1">
									<summary className="cursor-pointer text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">
										diff ({Object.keys(r.diff as object).length} fields)
									</summary>
									<pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 text-[10px] dark:bg-zinc-900">
										{JSON.stringify(r.diff, null, 2)}
									</pre>
								</details>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
