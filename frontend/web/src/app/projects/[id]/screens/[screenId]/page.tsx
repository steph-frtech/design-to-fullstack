"use client";

import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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

	if (screenQuery.isLoading) return <EmptyState>Loading…</EmptyState>;
	if (screenQuery.error)
		return (
			<EmptyState>
				<span className="text-rose-300">
					Error: {(screenQuery.error as Error).message}
				</span>
			</EmptyState>
		);
	if (!screenQuery.data || "error" in screenQuery.data)
		return <EmptyState>Screen not found.</EmptyState>;

	const { screen } = screenQuery.data;

	return (
		<div>
			<PageHeader
				back={{ href: `/projects/${id}`, label: "Project" }}
				title={
					<code className="rounded-lg bg-white/10 px-3 py-1 font-mono">
						{screen.path}
					</code>
				}
				subtitle={`v${screen.currentVersion}`}
				actions={
					<Button
						variant="secondary"
						size="sm"
						onClick={() =>
							setTarget({
								entityType: "Screen",
								entityId: screen.id,
								label: `screen ${screen.path}`,
							})
						}
					>
						History
					</Button>
				}
			/>

			<div className="grid gap-8 lg:grid-cols-[1fr_360px]">
				<section>
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
						Components ({screen.components.length} root)
					</h2>
					{screen.components.length === 0 ? (
						<EmptyState>No components.</EmptyState>
					) : (
						<ul className="space-y-3">
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

				<aside className="lg:sticky lg:top-24 lg:self-start">
					<RevisionPanel target={target} />
				</aside>
			</div>
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
	return (
		<li>
			<Card className="p-4">
				<div className="flex items-center justify-between">
					<div>
						<span className="font-mono text-sm font-medium">{comp.type}</span>
						<span className="ml-2 text-xs text-white/50">
							v{comp.currentVersion}
						</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							onShowRevisions({
								entityType: "Component",
								entityId: comp.id,
								label: `component ${comp.type}`,
							})
						}
					>
						history
					</Button>
				</div>

				{comp.form && (
					<div className="mt-4 border-l-2 border-white/10 pl-4">
						<p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
							Form ({comp.form.fields.length} fields)
						</p>
						<ul className="mt-2 space-y-1.5">
							{comp.form.fields.map((f) => (
								<li
									key={f.id}
									className="flex items-center justify-between text-sm"
								>
									<span className="font-mono">
										{f.name}
										<span className="ml-2 text-xs text-white/50">
											{f.type}
											{f.required ? " · required" : ""}
										</span>
									</span>
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											onShowRevisions({
												entityType: "Field",
												entityId: f.id,
												label: `field ${f.name}`,
											})
										}
									>
										history
									</Button>
								</li>
							))}
						</ul>
					</div>
				)}

				{comp.children && comp.children.length > 0 && (
					<ul className="mt-4 space-y-2 border-l-2 border-white/10 pl-4">
						{comp.children.map((child) => (
							<li
								key={child.id}
								className="rounded-lg bg-white/5 px-3 py-2"
							>
								<span className="font-mono text-xs">{child.type}</span>
							</li>
						))}
					</ul>
				)}
			</Card>
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
			<EmptyState>
				Click <span className="font-mono text-white/80">history</span> on any
				node to see its revisions.
			</EmptyState>
		);
	}

	return (
		<Card className="p-4">
			<h3 className="mb-3 text-sm font-semibold">History — {target.label}</h3>
			{isLoading && <p className="text-sm text-white/60">Loading…</p>}
			{data && "revisions" in data && (
				<ul className="space-y-3">
					{data.revisions.length === 0 && (
						<li className="text-sm text-white/60">No revisions yet.</li>
					)}
					{data.revisions.map((r) => (
						<li
							key={r.id}
							className="border-l-2 border-white/10 pl-3 text-xs"
						>
							<div className="flex items-center justify-between">
								<span className="font-mono font-semibold">v{r.version}</span>
								<Badge
									variant={
										r.op === "CREATE"
											? "create"
											: r.op === "UPDATE"
												? "update"
												: r.op === "DELETE"
													? "delete"
													: "neutral"
									}
								>
									{r.op}
								</Badge>
							</div>
							<div className="mt-1 text-white/50">
								{new Date(r.createdAt).toLocaleString()}
								{r.actor && ` · ${r.actor.email}`}
							</div>
							{r.diff && Object.keys(r.diff as object).length > 0 && (
								<details className="mt-1">
									<summary className="cursor-pointer text-white/60 hover:text-white">
										diff ({Object.keys(r.diff as object).length} fields)
									</summary>
									<pre className="mt-1 overflow-x-auto rounded-lg bg-black/30 p-2 text-[10px] text-white/80">
										{JSON.stringify(r.diff, null, 2)}
									</pre>
								</details>
							)}
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
