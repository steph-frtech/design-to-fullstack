"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

// Common screen types — the project itself stores free-form strings,
// but these are the buckets we always present as tabs even when empty.
const TYPE_TABS = ["web", "mobile", "desktop"] as const;

export default function ScreensListPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const [activeType, setActiveType] = useState<string>("web");

	const { data, isLoading, error } = useQuery({
		queryKey: ["project", id],
		queryFn: async () => {
			const res = await api.api.projects[":id"].$get({ param: { id } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	const screens = useMemo(() => {
		if (!data || "error" in data) return [];
		return data.project.screens;
	}, [data]);

	// Build tab list: known types + any extra types found in the data
	const tabs = useMemo(() => {
		const present = new Set<string>(TYPE_TABS);
		for (const s of screens) if (s.type) present.add(s.type);
		return Array.from(present);
	}, [screens]);

	const filtered = screens.filter((s) => (s.type ?? "web") === activeType);

	if (isLoading) return <EmptyState>Loading…</EmptyState>;
	if (error)
		return (
			<EmptyState>
				<span className="text-red-600">
					Error: {(error as Error).message}
				</span>
			</EmptyState>
		);
	if (!data || "error" in data)
		return <EmptyState>Project not found.</EmptyState>;

	return (
		<div>
			<PageHeader
				title="Screens"
				subtitle={`${screens.length} screens · grouped by platform`}
			/>

			<div className="mb-4 inline-flex rounded-md border border-zinc-200 bg-white p-0.5">
				{tabs.map((t) => {
					const count = screens.filter(
						(s) => (s.type ?? "web") === t,
					).length;
					const active = t === activeType;
					return (
						<button
							key={t}
							type="button"
							onClick={() => setActiveType(t)}
							className={cn(
								"rounded-sm px-3 py-1 text-xs font-medium capitalize transition-colors",
								active
									? "bg-blue-50 text-blue-700"
									: "text-zinc-600 hover:text-zinc-900",
							)}
						>
							{t}
							<span className="ml-1.5 text-zinc-400">{count}</span>
						</button>
					);
				})}
			</div>

			{filtered.length === 0 ? (
				<EmptyState>No {activeType} screens.</EmptyState>
			) : (
				<Card>
					<ul className="divide-y divide-zinc-100">
						{filtered.map((s) => (
							<li key={s.id}>
								<Link
									href={`/projects/${id}/screens/${s.id}`}
									className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50"
								>
									<div>
										<div className="font-mono text-sm text-zinc-900">
											{s.path}
										</div>
										{s.titleKey && (
											<div className="mt-0.5 font-mono text-xs text-zinc-400">
												{s.titleKey}
											</div>
										)}
									</div>
									<div className="flex items-center gap-3 text-xs text-zinc-500">
										{s._count.components} components · v{s.currentVersion}
										<ChevronRight className="h-4 w-4 text-zinc-400" />
									</div>
								</Link>
							</li>
						))}
					</ul>
				</Card>
			)}
		</div>
	);
}
