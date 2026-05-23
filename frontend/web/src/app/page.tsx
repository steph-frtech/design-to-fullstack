"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers, MonitorPlay } from "lucide-react";
import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

export default function ProjectsPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["projects"],
		queryFn: async () => {
			const res = await api.api.projects.$get();
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	return (
		<div>
			<PageHeader
				title="Projects"
				subtitle="Apps you've built from designs."
			/>

			{isLoading && <EmptyState>Loading…</EmptyState>}

			{error && (
				<EmptyState>
					<span className="text-red-600">
						Error: {(error as Error).message}
					</span>
				</EmptyState>
			)}

			{data && data.projects.length === 0 && (
				<EmptyState>
					No projects yet. Run{" "}
					<code className="rounded-sm bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
						pnpm --filter backend seed
					</code>{" "}
					to add demo data.
				</EmptyState>
			)}

			{data && data.projects.length > 0 && (
				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{data.projects.map((p) => (
						<li key={p.id}>
							<Link
								href={`/projects/${p.id}`}
								className="group block"
							>
								<Card className="transition-colors hover:border-blue-400">
									<CardHeader className="pb-3">
										<CardTitle>{p.slug}</CardTitle>
										<CardDescription className="font-mono text-xs">
											{p.id}
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-2">
										<MetricRow
											icon={<MonitorPlay className="h-3.5 w-3.5" />}
											label="Screens"
											value={String(p._count.screens)}
										/>
										<MetricRow
											icon={<Layers className="h-3.5 w-3.5" />}
											label="Entities"
											value={String(p._count.entities)}
										/>
										<MetricRow
											label="Locale"
											value={p.defaultLocale.code}
										/>
									</CardContent>
								</Card>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function MetricRow({
	icon,
	label,
	value,
}: {
	icon?: React.ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="flex items-center gap-1.5 text-zinc-500">
				{icon}
				{label}
			</span>
			<span className="font-medium text-zinc-900">{value}</span>
		</div>
	);
}
