"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronRight,
	Clock,
	RotateCcw,
	Undo2,
	X,
} from "lucide-react";
import { use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { readApiError } from "@/lib/api-error";
import { cn } from "@/lib/cn";

type ChangeSetRow = {
	id: string;
	message: string;
	status: "DRAFT" | "APPLIED" | "REVERTED";
	createdAt: string;
	appliedAt: string | null;
	revertedAt: string | null;
	revertOfId: string | null;
	revertedById: string | null;
	actor: { id: string; name: string | null; email: string } | null;
	_count: { revisions: number };
};

type Revision = {
	id: string;
	entityType: string;
	entityId: string;
	version: number;
	op: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
	data: unknown;
	diff: Record<string, [unknown, unknown]> | null;
	actorId: string | null;
	createdAt: string;
};

export default function HistoryPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const queryClient = useQueryClient();
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [confirmingRevert, setConfirmingRevert] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const list = useQuery({
		queryKey: ["history", id],
		queryFn: async () => {
			const res = await fetch(`/api/projects/${id}/changesets`);
			if (!res.ok) throw new Error(await readApiError(res));
			return (await res.json()) as { items: ChangeSetRow[] };
		},
	});

	const revertCs = useMutation({
		mutationFn: async (csid: string) => {
			const res = await fetch(
				`/api/projects/${id}/changesets/${csid}/revert`,
				{ method: "POST" },
			);
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		onSuccess: () => {
			setConfirmingRevert(null);
			setError(null);
			queryClient.invalidateQueries({ queryKey: ["history", id] });
		},
		onError: (e: Error) => setError(e.message),
	});

	function toggle(csid: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(csid)) next.delete(csid);
			else next.add(csid);
			return next;
		});
	}

	if (list.isLoading)
		return (
			<div>
				<PageHeader title="History" />
				<EmptyState>Loading…</EmptyState>
			</div>
		);

	if (list.error)
		return (
			<div>
				<PageHeader title="History" />
				<EmptyState>
					<span className="text-red-600">
						{(list.error as Error).message}
					</span>
				</EmptyState>
			</div>
		);

	const items = list.data?.items ?? [];

	return (
		<div>
			<PageHeader
				title="History"
				subtitle={`${items.length} change set${items.length !== 1 ? "s" : ""}`}
			/>

			{error && (
				<div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{error}
				</div>
			)}

			{items.length === 0 ? (
				<EmptyState>No history yet.</EmptyState>
			) : (
				<div className="space-y-2">
					{items.map((cs) => (
						<ChangeSetCard
							key={cs.id}
							projectId={id}
							cs={cs}
							expanded={expanded.has(cs.id)}
							onToggle={() => toggle(cs.id)}
							onRevertRequested={() => setConfirmingRevert(cs.id)}
						/>
					))}
				</div>
			)}

			{confirmingRevert && (
				<ConfirmRevert
					message={
						items.find((c) => c.id === confirmingRevert)?.message ?? ""
					}
					loading={revertCs.isPending}
					onCancel={() => setConfirmingRevert(null)}
					onConfirm={() => revertCs.mutate(confirmingRevert)}
				/>
			)}
		</div>
	);
}

function ChangeSetCard({
	projectId,
	cs,
	expanded,
	onToggle,
	onRevertRequested,
}: {
	projectId: string;
	cs: ChangeSetRow;
	expanded: boolean;
	onToggle: () => void;
	onRevertRequested: () => void;
}) {
	const detail = useQuery({
		enabled: expanded,
		queryKey: ["history", projectId, cs.id],
		queryFn: async () => {
			const res = await fetch(`/api/projects/${projectId}/changesets/${cs.id}`);
			if (!res.ok) throw new Error(await readApiError(res));
			return (await res.json()) as {
				changeSet: { revisions: Revision[] };
			};
		},
	});

	const statusBadge = (
		<Badge
			variant={
				cs.status === "APPLIED"
					? "success"
					: cs.status === "REVERTED"
						? "warn"
						: "default"
			}
		>
			{cs.status.toLowerCase()}
		</Badge>
	);

	return (
		<Card className="overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
			>
				{expanded ? (
					<ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
				) : (
					<ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
				)}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate text-sm font-medium text-zinc-900">
							{cs.message}
						</span>
						{statusBadge}
						{cs.revertOfId && (
							<Badge variant="info">
								<RotateCcw className="h-2.5 w-2.5" />
								revert
							</Badge>
						)}
					</div>
					<div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
						<Clock className="h-3 w-3" />
						<span>{new Date(cs.createdAt).toLocaleString()}</span>
						{cs.actor && <span>· {cs.actor.name ?? cs.actor.email}</span>}
						<span>· {cs._count.revisions} revision{cs._count.revisions !== 1 ? "s" : ""}</span>
					</div>
				</div>
				{cs.status === "APPLIED" && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onRevertRequested();
						}}
						className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
					>
						<Undo2 className="-mt-0.5 mr-1 inline h-3 w-3" />
						Revert
					</button>
				)}
			</button>

			{expanded && (
				<div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
					{detail.isLoading ? (
						<div className="text-xs text-zinc-500">Loading…</div>
					) : detail.error ? (
						<div className="text-xs text-red-600">
							{(detail.error as Error).message}
						</div>
					) : detail.data ? (
						<RevisionsList
							projectId={projectId}
							revisions={detail.data.changeSet.revisions}
						/>
					) : null}
				</div>
			)}
		</Card>
	);
}

function RevisionsList({
	projectId,
	revisions,
}: {
	projectId: string;
	revisions: Revision[];
}) {
	void projectId;
	if (revisions.length === 0)
		return <div className="text-xs text-zinc-500">No revisions.</div>;
	return (
		<ul className="space-y-1.5">
			{revisions.map((r) => (
				<li key={r.id}>
					<div className="flex items-center gap-2 text-xs">
						<Badge
							variant={
								r.op === "CREATE"
									? "success"
									: r.op === "DELETE"
										? "danger"
										: "info"
							}
						>
							{r.op.toLowerCase()}
						</Badge>
						<span className="font-mono text-zinc-700">{r.entityType}</span>
						<span className="text-zinc-400">v{r.version}</span>
						<span className="ml-auto font-mono text-zinc-400">
							{r.entityId.slice(0, 8)}…
						</span>
					</div>
					{r.op === "UPDATE" && r.diff && (
						<dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 pl-1 text-[11px]">
							{Object.entries(r.diff).map(([field, pair]) => (
								<div key={field} className="contents">
									<dt className="font-mono text-zinc-500">{field}</dt>
									<dd className="overflow-hidden text-ellipsis whitespace-nowrap text-zinc-700">
										<code className="text-red-600">
											{summarize(pair[0])}
										</code>{" "}
										→{" "}
										<code className="text-emerald-600">
											{summarize(pair[1])}
										</code>
									</dd>
								</div>
							))}
						</dl>
					)}
				</li>
			))}
		</ul>
	);
}

function summarize(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "string") {
		return value.length > 40 ? `"${value.slice(0, 40)}…"` : `"${value}"`;
	}
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	const s = JSON.stringify(value);
	return s.length > 50 ? `${s.slice(0, 50)}…` : s;
}

function ConfirmRevert({
	message,
	loading,
	onCancel,
	onConfirm,
}: {
	message: string;
	loading: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
			<div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-lg">
				<div className="flex items-start justify-between px-5 py-4">
					<div>
						<h3 className="text-sm font-semibold text-zinc-900">
							Revert this change set?
						</h3>
						<p className="mt-1 text-xs text-zinc-500">
							This will create a new APPLIED change set with the inverse
							revisions of:
						</p>
						<p className="mt-2 truncate font-mono text-xs text-zinc-700">
							{message}
						</p>
					</div>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
				<div
					className={cn(
						"flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3",
					)}
				>
					<Button variant="ghost" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						disabled={loading}
						onClick={onConfirm}
					>
						{loading ? "Reverting…" : "Revert"}
					</Button>
				</div>
			</div>
		</div>
	);
}
