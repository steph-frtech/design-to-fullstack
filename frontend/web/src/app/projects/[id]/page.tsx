"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

export default function ProjectDetail({
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
				<span className="text-rose-300">Error: {(error as Error).message}</span>
			</EmptyState>
		);
	if (!data || "error" in data) return <EmptyState>Project not found.</EmptyState>;

	const { project } = data;

	return (
		<div>
			<PageHeader
				back={{ href: "/", label: "Projects" }}
				title={project.slug}
				subtitle={
					<>
						Default locale: <code className="font-mono text-white/80">{project.defaultLocale.code}</code> · v
						{project.currentVersion}
					</>
				}
			/>

			<div className="space-y-10">
				<section>
					<SectionTitle>Locales</SectionTitle>
					<div className="flex flex-wrap gap-2">
						{project.locales.map((pl) => (
							<span
								key={pl.localeId}
								className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
							>
								{pl.locale.code} — {pl.locale.name}
							</span>
						))}
					</div>
				</section>

				<section>
					<SectionTitle>Entities ({project.entities.length})</SectionTitle>
					<ul className="grid gap-2">
						{project.entities.map((e) => (
							<li key={e.id}>
								<Card className="p-4">
									<div className="flex items-baseline justify-between">
										<span className="font-mono text-sm font-medium">{e.name}</span>
										<span className="text-xs text-white/50">
											{e._count.attributes} attrs · {e._count.records} records · v
											{e.currentVersion}
										</span>
									</div>
								</Card>
							</li>
						))}
					</ul>
				</section>

				<section>
					<SectionTitle>Screens ({project.screens.length})</SectionTitle>
					<ul className="grid gap-2">
						{project.screens.map((s) => (
							<li key={s.id}>
								<Link
									href={`/projects/${project.id}/screens/${s.id}`}
									className="block"
								>
									<Card className="p-4">
										<div className="flex items-baseline justify-between">
											<span className="font-mono text-sm font-medium">{s.path}</span>
											<span className="text-xs text-white/50">
												{s._count.components} components · v{s.currentVersion}
											</span>
										</div>
									</Card>
								</Link>
							</li>
						))}
					</ul>
				</section>
			</div>
		</div>
	);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
			{children}
		</h2>
	);
}
