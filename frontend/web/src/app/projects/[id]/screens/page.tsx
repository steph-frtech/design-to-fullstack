"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

export default function ScreensListPage({
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
				title="Screens"
				subtitle={`${project.screens.length} screens in ${project.slug}`}
			/>

			{project.screens.length === 0 ? (
				<EmptyState>No screens.</EmptyState>
			) : (
				<Card>
					<ul className="divide-y divide-zinc-100">
						{project.screens.map((s) => (
							<li key={s.id}>
								<Link
									href={`/projects/${project.id}/screens/${s.id}`}
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
