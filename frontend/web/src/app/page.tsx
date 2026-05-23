"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { NewProjectDialog } from "@/components/new-project-dialog";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";

export default function DashboardPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["projects"],
		queryFn: async () => {
			const res = await api.api.projects.$get();
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	return (
		<div className="min-h-screen">
			{/* top bar */}
			<header className="border-b border-zinc-200 bg-white">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
					<div className="flex items-center gap-1.5">
						<span className="font-mono text-sm font-semibold tracking-tight text-zinc-900">
							design
						</span>
						<span className="text-blue-600">→</span>
						<span className="font-mono text-sm font-semibold tracking-tight text-zinc-900">
							fullstack
						</span>
					</div>
					<NewProjectDialog />
				</div>
			</header>

			{/* content */}
			<main className="mx-auto w-full max-w-7xl px-8 py-10">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
						Projects
					</h1>
					<p className="mt-1 text-sm text-zinc-500">
						Apps you've built from designs.
					</p>
				</div>

				{isLoading && <EmptyState>Loading…</EmptyState>}

				{error && (
					<EmptyState>
						<span className="text-red-600">
							Error: {(error as Error).message}
						</span>
					</EmptyState>
				)}

				{data && data.projects.length === 0 && (
					<EmptyState action={<NewProjectDialog />}>
						No projects yet. Create your first one.
					</EmptyState>
				)}

				{data && data.projects.length > 0 && (
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{data.projects.map((p) => (
							<li key={p.id}>
								<Link href={`/projects/${p.id}`} className="group block">
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
			</main>
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
