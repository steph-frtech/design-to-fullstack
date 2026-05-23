"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

export default function EntitiesPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const { data, isLoading, error } = useQuery({
		queryKey: ["project", id],
		queryFn: async () => {
			const res = await api.api.projects[":id"].$get({ param: { id } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

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

	const { project } = data;

	return (
		<div>
			<PageHeader
				title="Entities"
				subtitle={`${project.entities.length} data types defined in ${project.slug}`}
			/>

			{project.entities.length === 0 ? (
				<EmptyState>No entities.</EmptyState>
			) : (
				<Card>
					<ul className="divide-y divide-zinc-100">
						{project.entities.map((e) => (
							<li
								key={e.id}
								className="flex items-center justify-between px-4 py-3"
							>
								<div>
									<div className="font-mono text-sm font-medium text-zinc-900">
										{e.name}
									</div>
									{e.nameKey && (
										<div className="mt-0.5 font-mono text-xs text-zinc-400">
											{e.nameKey}
										</div>
									)}
								</div>
								<div className="text-xs text-zinc-500">
									{e._count.attributes} attributes · {e._count.records} records
									· v{e.currentVersion}
								</div>
							</li>
						))}
					</ul>
				</Card>
			)}
		</div>
	);
}
