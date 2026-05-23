"use client";

import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { History } from "lucide-react";
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
				<span className="text-red-600">
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
					<code className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-lg text-zinc-900">
						{screen.path}
					</code>
				}
				subtitle={`v${screen.currentVersion}`}
				actions={
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							setTarget({
								entityType: "Screen",
								entityId: screen.id,
								label: `screen ${screen.path}`,
							})
						}
					>
						<History className="h-3.5 w-3.5" />
						History
					</Button>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				<section>
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
						Components{" "}
						<span className="text-zinc-400 normal-case">
							({screen.components.length} root)
						</span>
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

				<aside className="lg:sticky lg:top-6 lg:self-start">
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
					<div className="flex items-baseline gap-2">
						<span className="font-mono text-sm font-medium text-zinc-900">
							{comp.type}
						</span>
						<span className="text-xs text-zinc-500">
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
					<div className="mt-4 border-l-2 border-zinc-100 pl-4">
						<p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
							Form ({comp.form.fields.length} fields)
						</p>
						<ul className="mt-2 space-y-1.5">
							{comp.form.fields.map((f) => (
								<li
									key={f.id}
									className="flex items-center justify-between"
								>
									<span className="text-sm">
										<span className="font-mono font-medium text-zinc-900">
											{f.name}
										</span>
										<span className="ml-2 text-xs text-zinc-500">
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
					<ul className="mt-4 space-y-2 border-l-2 border-zinc-100 pl-4">
						{comp.children.map((child) => (
							<li
								key={child.id}
								className="rounded-md bg-zinc-50 px-3 py-2"
							>
								<span className="font-mono text-xs text-zinc-700">
									{child.type}
								</span>
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
				Click <span className="font-mono text-zinc-700">history</span> on any
				node to see its revisions.
			</EmptyState>
		);
	}

	return (
		<Card className="p-4">
			<h3 className="mb-3 text-sm font-semibold text-zinc-900">
				History — {target.label}
			</h3>
			{isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
			{data && "revisions" in data && (
				<ul className="space-y-3">
					{data.revisions.length === 0 && (
						<li className="text-sm text-zinc-500">No revisions yet.</li>
					)}
					{data.revisions.map((r) => (
						<li
							key={r.id}
							className="border-l-2 border-zinc-100 pl-3 text-xs"
						>
							<div className="flex items-center justify-between">
								<span className="font-mono font-semibold text-zinc-900">
									v{r.version}
								</span>
								<Badge
									variant={
										r.op === "CREATE"
											? "success"
											: r.op === "UPDATE"
												? "info"
												: r.op === "DELETE"
													? "danger"
													: "default"
									}
								>
									{r.op}
								</Badge>
							</div>
							<div className="mt-0.5 text-zinc-500">
								{new Date(r.createdAt).toLocaleString()}
								{r.actor && ` · ${r.actor.email}`}
							</div>
							{r.diff && Object.keys(r.diff as object).length > 0 && (
								<details className="mt-1">
									<summary className="cursor-pointer text-zinc-600 hover:text-zinc-900">
										diff ({Object.keys(r.diff as object).length} fields)
									</summary>
									<pre className="mt-1 overflow-x-auto rounded-md bg-zinc-50 p-2 text-[10px] text-zinc-700">
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
